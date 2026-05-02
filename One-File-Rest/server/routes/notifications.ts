import { Router, Request, Response } from 'express';
import pool from '../db/client.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_discord_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [discordId]
    );
    const unreadResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_discord_id = $1 AND is_read = false`,
      [discordId]
    );
    res.json({ notifications: result.rows, unread: unreadResult.rows[0].count });
  } catch (err) {
    console.error('[notifications GET]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_discord_id = $2`,
      [id, discordId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_discord_id = $1 AND is_read = false`,
      [discordId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

export default router;
