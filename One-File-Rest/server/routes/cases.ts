import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { calculateComplianceScore } from '../services/compliance-score.js';

const router = Router();

/**
 * GET /api/cases - Get all cases for authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;

    const result = await pool.query(
      `SELECT c.*, u.discord_username, s.discord_username as staff_name
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
       WHERE c.user_discord_id = $1
       ORDER BY c.created_at DESC`,
      [discordId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching cases:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

/**
 * GET /api/cases/:id - Get specific case with full details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    const result = await pool.query(
      `SELECT c.*, u.discord_username, u.email
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       WHERE c.id = $1 AND c.user_discord_id = $2`,
      [id, discordId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = result.rows[0];

    // Get compliance score (may fail gracefully)
    let complianceScore = null;
    try {
      complianceScore = await calculateComplianceScore(parseInt(id));
    } catch (scoreErr) {
      console.warn('Could not calculate compliance score:', scoreErr);
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    // Get evidence
    const evidenceResult = await pool.query(
      `SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`,
      [id]
    );

    // Get onboarding data
    const onboardingResult = await pool.query(
      `SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1`,
      [id]
    );

    res.json({
      ...caseData,
      complianceScore,
      messages: messagesResult.rows,
      evidence: evidenceResult.rows,
      onboarding: onboardingResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Error fetching case:', err);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

/**
 * POST /api/cases - Create new case
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;
    const {
      accountUsername,
      violationType,
      violationDescription,
      appealDeadline,
      totalGMV,
      faceVideosPosted,
      commissionFrozen,
      accountPurchaseDate,
    } = req.body;

    if (!accountUsername || !violationType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into cases (only columns that exist in the table)
    const result = await pool.query(
      `INSERT INTO cases (
        user_discord_id, account_username, violation_type, violation_description,
        appeal_deadline, commission_frozen,
        status, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        discordId,
        accountUsername,
        violationType,
        violationDescription,
        appealDeadline || null,
        commissionFrozen || false,
        'pending',
        'normal',
      ]
    );

    const newCase = result.rows[0];

    // Store extra onboarding fields in onboarding_data table
    if (totalGMV !== undefined || faceVideosPosted !== undefined || accountPurchaseDate) {
      try {
        await pool.query(
          `INSERT INTO onboarding_data (
            case_id, user_discord_id, total_gmv, face_videos_posted,
            account_purchase_date, commission_frozen
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newCase.id,
            discordId,
            totalGMV || 0,
            faceVideosPosted || 0,
            accountPurchaseDate || null,
            commissionFrozen || false,
          ]
        );
      } catch (onboardErr) {
        console.error('Failed to save onboarding data:', onboardErr);
      }
    }

    // Calculate initial compliance score (non-fatal)
    let complianceScore = null;
    try {
      complianceScore = await calculateComplianceScore(newCase.id);
    } catch (scoreErr) {
      console.warn('Could not calculate initial compliance score:', scoreErr);
    }

    res.status(201).json({
      ...newCase,
      complianceScore,
    });
  } catch (err) {
    console.error('Error creating case:', err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

/**
 * PATCH /api/cases/:id - Update case
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const { status, priority, appealDeadline, outcome } = req.body;

    // Verify ownership
    const caseResult = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1`,
      [id]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (appealDeadline !== undefined) {
      updates.push(`appeal_deadline = $${paramCount++}`);
      values.push(appealDeadline);
    }
    if (outcome !== undefined) {
      updates.push(`outcome = $${paramCount++}`);
      values.push(outcome);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `UPDATE cases SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, values);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

/**
 * DELETE /api/cases/:id - Close case (soft close)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    const caseResult = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1`,
      [id]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `UPDATE cases SET status = 'closed', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error closing case:', err);
    res.status(500).json({ error: 'Failed to close case' });
  }
});

/**
 * GET /api/cases/:id/compliance-score
 */
router.get('/:id/compliance-score', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const complianceScore = await calculateComplianceScore(parseInt(id));
    res.json(complianceScore);
  } catch (err) {
    console.error('Error fetching compliance score:', err);
    res.status(500).json({ error: 'Failed to fetch compliance score' });
  }
});

export default router;
