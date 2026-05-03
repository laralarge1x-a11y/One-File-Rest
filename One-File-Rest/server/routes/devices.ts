// Device-token registration for the native admin APK.
// The mobile app POSTs its FCM registration token here after login so the
// server can push to it via services/fcm.ts.
import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { fcmConfigured, sendFcmToUser } from '../services/fcm.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { token, platform, deviceLabel, appVersion } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token required' });
    }
    const plat = ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
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
    res.json({ success: true, fcmConfigured: fcmConfigured() });
  } catch (err) {
    console.error('[devices/register]', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

router.post('/unregister', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (token) {
      await pool.query(
        'DELETE FROM device_tokens WHERE token = $1 AND user_discord_id = $2',
        [token, req.user!.discord_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, platform, device_label, app_version, last_seen_at, created_at
       FROM device_tokens WHERE user_discord_id = $1
       ORDER BY last_seen_at DESC`,
      [req.user!.discord_id]
    );
    res.json({ devices: r.rows, fcmConfigured: fcmConfigured() });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    const r = await sendFcmToUser(req.user!.discord_id, {
      title: 'Elite Tok Admin',
      body: 'Push notifications are working on this device.',
      url: '/admin',
    });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: 'FCM test failed' });
  }
});

export default router;
