import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { getVapidPublicKey, sendPushToUser } from '../services/push.js';
import { validate } from '../middleware/index.js';
import { emptyQuerySchema, emptyBodySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

const SubscribeBody = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
}).strict();

const UnsubscribeBody = z.object({
  endpoint: z.string().url().max(2000).optional(),
}).strict();

router.get('/key', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), (_req: Request, res: Response) => {
  return res.json({ publicKey: getVapidPublicKey() });
});

router.post('/subscribe', validate({ body: SubscribeBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { endpoint, keys } = req.body;
    const ua = req.headers['user-agent'] || null;
    await pool.query(
      `INSERT INTO push_subscriptions (user_discord_id, endpoint, p256dh, auth_key, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_discord_id = $1, p256dh = $3, auth_key = $4, last_used_at = NOW()`,
      [req.user!.discord_id, endpoint, keys.p256dh, keys.auth, ua]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[push/subscribe]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to subscribe', requestId: req.id } });
  }
});

router.post('/unsubscribe', validate({ body: UnsubscribeBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.post('/test', validate({ body: emptyBodySchema, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const r = await sendPushToUser(req.user!.discord_id, {
      title: 'Test notification',
      body: 'Push notifications are working.',
      url: '/dashboard',
    });
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Push test failed', requestId: req.id } });
  }
});

export default router;
