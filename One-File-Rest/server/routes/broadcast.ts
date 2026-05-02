import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';

const router = Router();

/**
 * GET /api/broadcast - List all broadcast logs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, sent_by, target_segment, subject, content, recipient_count, sent_at
       FROM broadcast_logs
       ORDER BY sent_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching broadcast logs:', err);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

/**
 * POST /api/broadcast - Send a broadcast to all connected portal users
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { subject, content, target_segment = 'all' } = req.body;
    const staffDiscordId = req.user?.discord_id;

    if (!subject || !content) {
      return res.status(400).json({ error: 'subject and content are required' });
    }

    // Count users in segment
    let recipientCount = 0;
    try {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM users`);
      recipientCount = parseInt(countResult.rows[0].count);
    } catch (countErr) {
      console.warn('Could not count recipients:', countErr);
    }

    // Emit to all connected socket clients
    getIO().emit('broadcast:received', {
      subject,
      content,
      sent_at: new Date(),
    });

    // Log the broadcast
    const result = await pool.query(
      `INSERT INTO broadcast_logs (sent_by, target_segment, subject, content, recipient_count, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [staffDiscordId, target_segment, subject, content, recipientCount]
    );

    res.status(201).json({
      ...result.rows[0],
      users_reached: recipientCount,
    });
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export default router;
