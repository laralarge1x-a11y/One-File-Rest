import { Router } from 'express';
import pool from '../db/client.js';

const router = Router();

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
router.post('/', async (req, res) => {
  try {
    const { case_id, content } = req.body;

    const result = await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [case_id, req.user!.discord_id, 'client', content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
