import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { PLAN_META } from '../services/webhook.js';
import { logAudit } from '../services/webhook.js';

const router = Router();

const PLAN_LIMITS: Record<string, number> = {
  basic_guard: 1,
  fortnightly_defense: 3,
  proshield_creator: 5,
};

router.get('/me', async (req: Request, res: Response) => {
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

    res.json({
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
    console.error('[subscriptions/me]', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Pause active subscription (does not change plan)
router.post('/pause', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    const discordId = req.user!.discord_id;
    const r = await pool.query(
      `UPDATE subscriptions SET status = 'paused', paused_at = NOW(), pause_reason = $1, updated_at = NOW()
        WHERE user_discord_id = $2 AND status = 'active' RETURNING *`,
      [reason || null, discordId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No active subscription' });
    logAudit({ actorDiscordId: discordId, action: 'subscription_paused', targetType: 'subscription', targetId: r.rows[0].id, details: { reason } }).catch(console.error);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to pause' }); }
});

router.post('/resume', async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const r = await pool.query(
      `UPDATE subscriptions SET status = 'active', paused_at = NULL, pause_reason = NULL, updated_at = NOW()
        WHERE user_discord_id = $1 AND status = 'paused' RETURNING *`,
      [discordId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No paused subscription' });
    logAudit({ actorDiscordId: discordId, action: 'subscription_resumed', targetType: 'subscription', targetId: r.rows[0].id }).catch(console.error);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to resume' }); }
});

router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { reason, immediate } = req.body || {};
    const discordId = req.user!.discord_id;
    const r = await pool.query(
      `UPDATE subscriptions SET
         status = CASE WHEN $1 THEN 'cancelled' ELSE status END,
         cancel_at_period_end = true,
         cancel_reason = $2,
         end_date = CASE WHEN $1 THEN NOW() ELSE end_date END,
         updated_at = NOW()
        WHERE user_discord_id = $3 AND status IN ('active','paused') RETURNING *`,
      [!!immediate, reason || null, discordId]
    );
    if (immediate) {
      await pool.query(`UPDATE users SET plan = NULL WHERE discord_id = $1`, [discordId]);
    }
    logAudit({ actorDiscordId: discordId, action: 'subscription_cancelled', targetType: 'subscription', details: { reason, immediate: !!immediate } }).catch(console.error);
    res.json(r.rows[0] || { success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to cancel' }); }
});

// Request a plan change. Marks audit log; admin must finalize via /api/admin/clients/:id PATCH.
router.post('/change-request', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !PLAN_META[plan]) return res.status(400).json({ error: 'Invalid plan' });
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'subscription_change_requested',
      targetType: 'subscription',
      details: { requested_plan: plan, current_plan: req.user!.plan },
    }).catch(console.error);
    res.json({ success: true, message: 'Change request submitted. A staff member will follow up.' });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
