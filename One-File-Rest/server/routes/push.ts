import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { getVapidPublicKey, sendPushToUser } from '../services/push.js';

const router = Router();

router.get('/key', (_req: Request, res: Response) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const ua = req.headers['user-agent'] || null;
    await pool.query(
      `INSERT INTO push_subscriptions (user_discord_id, endpoint, p256dh, auth_key, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET user_discord_id = $1, p256dh = $3, auth_key = $4, last_used_at = NOW()`,
      [req.user!.discord_id, endpoint, keys.p256dh, keys.auth, ua]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[push/subscribe]', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    const r = await sendPushToUser(req.user!.discord_id, {
      title: 'Test notification',
      body: 'Push notifications are working.',
      url: '/dashboard',
    });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'Push test failed' });
  }
});

export default router;
