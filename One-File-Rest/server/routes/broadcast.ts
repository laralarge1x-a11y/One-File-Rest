import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { buildBroadcastEmbed, logAudit } from '../services/webhook.js';
import { validate } from '../middleware/index.js';
import { emptyQuerySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

const BroadcastBody = z
  .object({
    subject: z.string().min(1).max(300),
    content: z.string().min(1).max(10_000),
    target_segment: z
      .enum(['all', 'basic_guard', 'fortnightly_defense', 'proshield_creator', 'expiring_7d'])
      .default('all'),
  })
  .strict();

router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM broadcast_logs ORDER BY sent_at DESC LIMIT 100`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching broadcasts:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch broadcasts', requestId: req.id } });
  }
});

router.post('/', validate({ body: BroadcastBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { subject, content, target_segment } = req.body as z.infer<typeof BroadcastBody>;
    const staffDiscordId = req.user!.discord_id;
    const staffUsername = req.user?.discord_username || 'Staff';

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

    // Audit: broadcast row creation = transition from "no broadcast id"
    // to a fully populated row, with explicit before/after & diff fields
    // matching the rest of the admin mutation surface.
    logAudit({
      actorDiscordId: staffDiscordId,
      action: 'broadcast_sent',
      targetType: 'broadcast',
      targetId: Number(result.rows[0].id),
      details: {
        before: null,
        after: {
          id: Number(result.rows[0].id),
          subject,
          target_segment,
          recipient_count: users.length,
        },
        diff: {
          created: true,
          subject: { before: null, after: subject },
          target_segment: { before: null, after: target_segment },
          recipients: { before: 0, after: users.length },
        },
        preview: content.slice(0, 200),
      },
    }).catch(console.error);

    return res.status(201).json({
      ...result.rows[0],
      users_targeted: users.length,
    });
  } catch (err) {
    console.error('Error sending broadcast:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to send broadcast', requestId: req.id } });
  }
});

export default router;
