import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { fireWebhook, buildBroadcastEmbed, logAudit } from '../services/webhook.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM broadcast_logs ORDER BY sent_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching broadcasts:', err);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { subject, content, target_segment = 'all' } = req.body;
    const staffDiscordId = req.user?.discord_id;
    const staffUsername = req.user?.discord_username || 'Staff';

    if (!subject || !content) return res.status(400).json({ error: 'subject and content are required' });

    // Get targeted users
    let usersQuery = `SELECT discord_id, discord_webhook_url FROM users WHERE discord_webhook_url IS NOT NULL`;
    const values: any[] = [];

    if (target_segment === 'basic_guard') {
      usersQuery += ` AND plan = 'basic_guard'`;
    } else if (target_segment === 'fortnightly_defense') {
      usersQuery += ` AND plan = 'fortnightly_defense'`;
    } else if (target_segment === 'proshield_creator') {
      usersQuery += ` AND plan = 'proshield_creator'`;
    } else if (target_segment === 'expiring_7d') {
      usersQuery += ` AND plan_expiry BETWEEN NOW() AND NOW() + INTERVAL '7 days'`;
    }

    const usersResult = await pool.query(usersQuery, values);
    const users = usersResult.rows;

    // Emit socket broadcast
    try {
      getIO().emit('broadcast:received', { subject, content, sent_at: new Date() });
    } catch {}

    // Fire webhook to all matching users (non-blocking, parallel)
    let delivered = 0, failed = 0;
    const embed = buildBroadcastEmbed({ subject, content, senderName: staffUsername });

    const webhookPromises = users.map(async (user) => {
      try {
        if (!user.discord_webhook_url) { failed++; return; }
        const resp = await fetch(user.discord_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [{ ...embed, timestamp: new Date().toISOString() }] }),
        });
        if (resp.ok) { delivered++; } else { failed++; }
      } catch { failed++; }
    });
    Promise.allSettled(webhookPromises).then(() => {
      pool.query(
        `UPDATE broadcast_logs SET delivered_count = $1, failed_count = $2 WHERE subject = $3 AND sent_at > NOW() - INTERVAL '1 minute'`,
        [delivered, failed, subject]
      ).catch(console.error);
    });

    const result = await pool.query(
      `INSERT INTO broadcast_logs (sent_by, target_segment, subject, content, recipient_count, delivered_count, failed_count, sent_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, NOW()) RETURNING *`,
      [staffDiscordId, target_segment, subject, content, users.length]
    );

    logAudit({ actorDiscordId: staffDiscordId, action: 'broadcast_sent', details: { subject, target_segment, recipients: users.length } }).catch(console.error);

    res.status(201).json({
      ...result.rows[0],
      users_targeted: users.length,
    });
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export default router;
