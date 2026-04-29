import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { calculateComplianceScore } from '../services/compliance-score.js';
import { v4 as uuidv4 } from 'uuid';
import { createCaseSchema, updateCaseSchema, validateRequest, validateParams } from '../utils/validation.js';
import { z } from 'zod';
import logger from '../utils/logger.js';

const router = Router();

// Param validation schema
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid case ID')
});

// Socket events instance (will be injected)
let socketEvents: any = null;

export function setSocketEvents(events: any) {
  socketEvents = events;
}

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
router.post('/', validateRequest(createCaseSchema), async (req: Request, res: Response) => {
  try {
    const discordId = req.user?.discord_id;
    const validatedBody = (req as any).validatedBody;
    const {
      accountUsername,
      violationType,
      violationDescription,
      appealDeadline,
      totalGMV,
      faceVideosPosted,
      commissionFrozen,
      accountPurchaseDate,
    } = validatedBody;

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

    // Emit socket event
    if (socketEvents) {
      socketEvents.emitCaseCreated(newCase);
    }

    logger.info('Case created', { caseId: newCase.id, userId: discordId });

    res.status(201).json({
      ...newCase,
      complianceScore,
    });
  } catch (err) {
    logger.error('Error creating case', { error: (err as Error).message });
    res.status(500).json({ error: 'Failed to create case' });
  }
});

/**
 * PATCH /api/cases/:id - Update case
 */
router.patch('/:id', validateRequest(updateCaseSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;
    const validatedData = (req as any).validatedBody;

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

    if (validatedData.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(validatedData.status);
    }
    if (validatedData.priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(validatedData.priority);
    }
    if (validatedData.appealDeadline !== undefined) {
      updates.push(`appeal_deadline = $${paramCount++}`);
      values.push(validatedData.appealDeadline);
    }
    if (validatedData.outcome !== undefined) {
      updates.push(`outcome = $${paramCount++}`);
      values.push(validatedData.outcome);
    }
    if (validatedData.violationType !== undefined) {
      updates.push(`violation_type = $${paramCount++}`);
      values.push(validatedData.violationType);
    }
    if (validatedData.violationDescription !== undefined) {
      updates.push(`violation_description = $${paramCount++}`);
      values.push(validatedData.violationDescription);
    }
    if (validatedData.outcomeNotes !== undefined) {
      updates.push(`outcome_notes = $${paramCount++}`);
      values.push(validatedData.outcomeNotes);
    }
    if (validatedData.internalNotes !== undefined) {
      updates.push(`internal_notes = $${paramCount++}`);
      values.push(validatedData.internalNotes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `UPDATE cases SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, values);
    const updatedCase = result.rows[0];

    // Emit socket event
    if (socketEvents) {
      socketEvents.emitCaseUpdated(updatedCase, discordId);
    }

    logger.info('Case updated', { caseId: id, userId: discordId });

    res.json(updatedCase);
  } catch (err) {
    logger.error('Error updating case', { error: (err as Error).message });
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

    // Emit socket event
    if (socketEvents) {
      socketEvents.emitCaseDeleted(parseInt(id), discordId);
    }

    logger.info('Case deleted', { caseId: id, userId: discordId });

    res.json({ success: true });
  } catch (err) {
    logger.error('Error deleting case', { error: (err as Error).message });
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
