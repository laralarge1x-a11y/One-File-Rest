// Device-token registration for the native admin APK.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { fcmConfigured, sendFcmToUser } from '../services/fcm.js';
import { validate } from '../middleware/index.js';
import { emptyQuerySchema, emptyBodySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

const RegisterBody = z.object({
  token: z.string().min(1).max(2000),
  platform: z.enum(['android', 'ios', 'web']).optional(),
  deviceLabel: z.string().max(200).optional().nullable(),
  appVersion: z.string().max(40).optional().nullable(),
}).strict();

const UnregisterBody = z.object({ token: z.string().min(1).max(2000).optional() }).strict();

router.post('/register', validate({ body: RegisterBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { token, platform, deviceLabel, appVersion } = req.body;
    const plat = platform || 'android';
    await pool.query(
      `INSERT INTO device_tokens (user_discord_id, token, platform, device_label, app_version, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (token) DO UPDATE SET
         user_discord_id = EXCLUDED.user_discord_id,
         platform = EXCLUDED.platform,
         device_label = EXCLUDED.device_label,
         app_version = EXCLUDED.app_version,
         last_seen_at = NOW()`,
      [req.user!.discord_id, token, plat, deviceLabel || null, appVersion || null]
    );
    return res.json({ success: true, fcmConfigured: fcmConfigured() });
  } catch (err) {
    console.error('[devices/register]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to register device', requestId: req.id } });
  }
});

router.post('/unregister', validate({ body: UnregisterBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (token) {
      await pool.query(
        'DELETE FROM device_tokens WHERE token = $1 AND user_discord_id = $2',
        [token, req.user!.discord_id]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, platform, device_label, app_version, last_seen_at, created_at
       FROM device_tokens WHERE user_discord_id = $1
       ORDER BY last_seen_at DESC`,
      [req.user!.discord_id]
    );
    return res.json({ devices: r.rows, fcmConfigured: fcmConfigured() });
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.post('/test', validate({ body: emptyBodySchema, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const r = await sendFcmToUser(req.user!.discord_id, {
      title: 'Elite Tok Admin',
      body: 'Push notifications are working on this device.',
      url: '/admin',
    });
    return res.json(r);
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'FCM test failed', requestId: req.id } });
  }
});

export default router;
