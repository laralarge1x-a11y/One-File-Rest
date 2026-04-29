import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { calculateComplianceScore } from '../services/compliance-score.js';
import { v4 as uuidv4 } from 'uuid';

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

    // Get compliance score
    const complianceScore = await calculateComplianceScore(parseInt(id));

    // Get messages
    const messagesResult = await pool.query(
      `SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    // Get evidence
    const evidenceResult = await pool.query(
      `SELECT * FROM evidence WHERE case_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      ...caseData,
      complianceScore,
      messages: messagesResult.rows,
      evidence: evidenceResult.rows,
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

    const result = await pool.query(
      `INSERT INTO cases (
        user_discord_id, account_username, violation_type, violation_description,
        appeal_deadline, total_gmv, face_videos_posted, commission_frozen,
        account_purchase_date, status, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        discordId,
        accountUsername,
        violationType,
        violationDescription,
        appealDeadline,
        totalGMV || 0,
        faceVideosPosted || 0,
        commissionFrozen || false,
        accountPurchaseDate || null,
        'open',
        'normal',
      ]
    );

    const newCase = result.rows[0];

    // Calculate initial compliance score
    const complianceScore = await calculateComplianceScore(newCase.id);

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

    // Build update query
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
 * DELETE /api/cases/:id - Delete case (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

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

    // Soft delete
    await pool.query(
      `UPDATE cases SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting case:', err);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

/**
 * GET /api/cases/:id/compliance-score - Get compliance score for case
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
