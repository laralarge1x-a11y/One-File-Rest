import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { validate } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema, emptyBodySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
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
    return res.json({ notifications: result.rows, unread: unreadResult.rows[0].count });
  } catch (err) {
    console.error('[notifications GET]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch notifications', requestId: req.id } });
  }
});

router.patch('/:id/read', validate({ params: idParamSchema, query: emptyQuerySchema, body: emptyBodySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_discord_id = $2`,
      [id, discordId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to mark read', requestId: req.id } });
  }
});

router.post('/read-all', validate({ body: emptyBodySchema, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_discord_id = $1 AND is_read = false`,
      [discordId]
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to mark all read', requestId: req.id } });
  }
});

export default router;
