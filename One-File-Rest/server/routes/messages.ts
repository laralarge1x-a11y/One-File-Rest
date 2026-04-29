import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { createMessageSchema, validateRequest } from '../utils/validation.js';
import { z } from 'zod';

const router = Router();

const caseIdParamSchema = z.object({
  caseId: z.string().regex(/^\d+$/, 'Invalid case ID')
});

// GET messages for a case
router.get('/:caseId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.* FROM messages m
       JOIN cases c ON m.case_id = c.id
       WHERE m.case_id = $1 AND c.user_discord_id = $2
       ORDER BY m.created_at ASC`,
      [req.params.caseId, req.user!.discord_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST send message
router.post('/', validateRequest(createMessageSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { caseId, content, attachments } = validatedData;

    // Verify case ownership
    const caseResult = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseResult.rows[0].user_discord_id !== req.user!.discord_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content, attachments)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [caseId, req.user!.discord_id, 'client', content, JSON.stringify(attachments || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
