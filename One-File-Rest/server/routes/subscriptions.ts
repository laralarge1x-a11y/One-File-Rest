import { Router, Request, Response } from 'express';
import { emptyQuerySchema, emptyBodySchema, emptyParamsSchema } from '../../shared/schemas.js';
import { z } from 'zod';
import pool from '../db/client.js';
import { PLAN_META } from '../services/webhook.js';
import { logAudit } from '../services/webhook.js';
import { validate } from '../middleware/index.js';

const router = Router();

const PauseBody = z.object({ reason: z.string().max(500).optional().nullable() }).strict();
const CancelBody = z.object({
  reason: z.string().max(500).optional().nullable(),
  immediate: z.boolean().optional(),
}).strict();
const ChangeBody = z.object({ plan: z.string().min(1).max(60) }).strict();

const PLAN_LIMITS: Record<string, number> = {
  basic_guard: 1,
  fortnightly_defense: 3,
  proshield_creator: 5,
};

router.get('/me', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const userR = await pool.query(
      `SELECT plan, plan_start, plan_expiry FROM users WHERE discord_id = $1`,
      [discordId]
    );
    const u = userR.rows[0] || {};
    const subR = await pool.query(
      `SELECT * FROM subscriptions WHERE user_discord_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [discordId]
    );
    const sub = subR.rows[0] || null;

    // Usage (cases this billing cycle)
    let usage: any = { used: 0, limit: null, periodStart: null };
    const limit = u.plan ? PLAN_LIMITS[u.plan] ?? null : null;
    if (u.plan && u.plan_start) {
      const usageR = await pool.query(
        `SELECT COUNT(*)::int AS used FROM cases
          WHERE user_discord_id = $1 AND created_at >= $2`,
        [discordId, u.plan_start]
      );
      usage = { used: usageR.rows[0].used, limit, periodStart: u.plan_start };
    }

    // History
    const hist = await pool.query(
      `SELECT plan, status, start_date, end_date, paused_at, cancel_at_period_end
         FROM subscriptions WHERE user_discord_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [discordId]
    );

    return res.json({
      plan: u.plan,
      plan_start: u.plan_start,
      plan_expiry: u.plan_expiry,
      planMeta: u.plan ? PLAN_META[u.plan] || null : null,
      subscription: sub,
      usage,
      history: hist.rows,
      availablePlans: Object.entries(PLAN_META).map(([id, m]) => ({ id, ...m, limit: PLAN_LIMITS[id] })),
    });
  } catch (err) {
    console.error('[subscriptions/me]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch subscription', requestId: req.id } });
  }
});

// Pause active subscription (does not change plan)
router.post('/pause', validate({ body: PauseBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const discordId = req.user!.discord_id;
    const r = await pool.query(
      `UPDATE subscriptions SET status = 'paused', paused_at = NOW(), pause_reason = $1, updated_at = NOW()
        WHERE user_discord_id = $2 AND status = 'active' RETURNING *`,
      [reason || null, discordId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'No active subscription', requestId: req.id } });
    logAudit({ actorDiscordId: discordId, action: 'subscription_paused', targetType: 'subscription', targetId: r.rows[0].id, details: { reason } }).catch(console.error);
    return res.json(r.rows[0]);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed to pause', requestId: req.id } }); }
});

router.post('/resume', validate({ body: emptyBodySchema, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const r = await pool.query(
      `UPDATE subscriptions SET status = 'active', paused_at = NULL, pause_reason = NULL, updated_at = NOW()
        WHERE user_discord_id = $1 AND status = 'paused' RETURNING *`,
      [discordId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'No paused subscription', requestId: req.id } });
    logAudit({ actorDiscordId: discordId, action: 'subscription_resumed', targetType: 'subscription', targetId: r.rows[0].id }).catch(console.error);
    return res.json(r.rows[0]);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed to resume', requestId: req.id } }); }
});

router.post('/cancel', validate({ body: CancelBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { reason, immediate } = req.body;
    const discordId = req.user!.discord_id;
    const beforeR = await pool.query(
      `SELECT id, status, cancel_at_period_end, cancel_reason, end_date
         FROM subscriptions WHERE user_discord_id = $1 AND status IN ('active','paused')
         ORDER BY created_at DESC LIMIT 1`,
      [discordId]
    );
    if (beforeR.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'No active subscription', requestId: req.id } });
    const before = beforeR.rows[0];
    const r = await pool.query(
      `UPDATE subscriptions SET
         status = CASE WHEN $1 THEN 'cancelled' ELSE status END,
         cancel_at_period_end = true,
         cancel_reason = $2,
         end_date = CASE WHEN $1 THEN NOW() ELSE end_date END,
         updated_at = NOW()
        WHERE id = $3 RETURNING *`,
      [!!immediate, reason || null, before.id]
    );
    if (immediate) {
      await pool.query(`UPDATE users SET plan = NULL WHERE discord_id = $1`, [discordId]);
    }
    const after = r.rows[0];
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['status', 'cancel_at_period_end', 'cancel_reason', 'end_date'] as const) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
        diff[k] = { from: before[k], to: after[k] };
      }
    }
    logAudit({
      actorDiscordId: discordId,
      action: 'subscription_cancelled',
      targetType: 'subscription',
      targetId: before.id,
      details: { reason: reason || null, immediate: !!immediate, diff },
    }).catch(console.error);
    return res.json(after);
  } catch (err) {
    console.error('[subscriptions/cancel]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to cancel', requestId: req.id } });
  }
});

// Request a plan change. Marks audit log; admin must finalize via /api/admin/clients/:id PATCH.
router.post('/change-request', validate({ body: ChangeBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    if (!PLAN_META[plan]) return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid plan', requestId: req.id } });
    const discordId = req.user!.discord_id;
    const subR = await pool.query(
      `SELECT id FROM subscriptions WHERE user_discord_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [discordId]
    );
    logAudit({
      actorDiscordId: discordId,
      action: 'subscription_change_requested',
      targetType: 'subscription',
      targetId: subR.rows[0]?.id ?? null,
      details: { from: { plan: req.user!.plan }, to: { plan }, status: 'pending_admin_review' },
    }).catch(console.error);
    return res.json({ success: true, message: 'Change request submitted. A staff member will follow up.' });
  } catch (err) {
    console.error('[subscriptions/change]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

export default router;
