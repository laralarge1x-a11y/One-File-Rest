import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { fireWebhook, buildBroadcastEmbed, buildRevokeEmbed, logAudit, PLAN_META } from '../services/webhook.js';
import { groqText } from '../services/groq.js';
import { createNotification, emitCaseStatusChanged } from '../services/notifications.js';
import { advanceCaseTimeline } from '../services/timeline.js';

const router = Router();

// ─── Stats Overview ───────────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      clientsRes,
      activeCasesRes,
      resolvedMonthRes,
      expiringRes,
      planCountsRes,
      avgResolutionRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE plan IS NOT NULL`),
      pool.query(`SELECT COUNT(*) FROM cases WHERE status IN ('pending','intake','profile_built','appeal_drafted','appeal_submitted','awaiting_tiktok','response_received','escalated')`),
      pool.query(`SELECT COUNT(*) FROM cases WHERE status IN ('won','denied','closed') AND updated_at >= date_trunc('month', NOW())`),
      pool.query(`SELECT COUNT(*) FROM users WHERE plan IS NOT NULL AND plan_expiry BETWEEN NOW() AND NOW() + INTERVAL '7 days'`),
      pool.query(`SELECT plan, COUNT(*) as count FROM users WHERE plan IS NOT NULL GROUP BY plan`),
      pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_hours FROM cases WHERE status IN ('won','denied','closed') AND updated_at >= NOW() - INTERVAL '30 days'`),
    ]);

    // Calculate revenue from plan counts
    let totalRevenue = 0;
    for (const row of planCountsRes.rows) {
      const meta = PLAN_META[row.plan];
      if (meta) totalRevenue += meta.price * parseInt(row.count);
    }

    res.json({
      totalClients: parseInt(clientsRes.rows[0].count),
      activeCases: parseInt(activeCasesRes.rows[0].count),
      resolvedThisMonth: parseInt(resolvedMonthRes.rows[0].count),
      expiringSoon: parseInt(expiringRes.rows[0].count),
      totalRevenue,
      avgResolutionHours: Math.round(parseFloat(avgResolutionRes.rows[0].avg_hours) || 0),
      planCounts: Object.fromEntries(planCountsRes.rows.map((r) => [r.plan, parseInt(r.count)])),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Activity Feed ────────────────────────────────────────────────────────
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.discord_username
       FROM audit_log a
       LEFT JOIN users u ON a.actor_discord_id = u.discord_id
       ORDER BY a.created_at DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/activity]', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ─── Urgent Alerts (deadline within 72h) ─────────────────────────────────
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.account_username, c.violation_type, c.appeal_deadline, c.status,
              u.discord_username, u.plan
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       WHERE c.appeal_deadline BETWEEN NOW() AND NOW() + INTERVAL '72 hours'
         AND c.status NOT IN ('won','denied','closed')
       ORDER BY c.appeal_deadline ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/alerts]', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─── All Cases (admin view — all users) ──────────────────────────────────
router.get('/cases', async (req: Request, res: Response) => {
  try {
    const { status, plan, search, staff, from, to, limit = '100', offset = '0' } = req.query;
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let p = 1;

    if (status && status !== 'all') {
      conditions.push(`c.status = $${p++}`);
      values.push(status);
    }
    if (plan && plan !== 'all') {
      conditions.push(`u.plan = $${p++}`);
      values.push(plan);
    }
    if (staff && staff !== 'all') {
      conditions.push(`c.staff_assigned_id = $${p++}`);
      values.push(staff);
    }
    if (search) {
      conditions.push(`(c.account_username ILIKE $${p} OR u.discord_username ILIKE $${p} OR c.id::text = $${p})`);
      values.push(`%${search}%`);
      p++;
    }
    if (from) {
      conditions.push(`c.created_at >= $${p++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`c.created_at <= $${p++}`);
      values.push(to);
    }

    const query = `
      SELECT c.*, u.id as user_id, u.discord_username, u.discord_avatar, u.plan,
             s.name as staff_name, s.role as staff_role,
             COALESCE((
               SELECT COUNT(*) FROM messages m
               WHERE m.case_id = c.id AND m.sender_type = 'client' AND m.is_read = false
             ), 0)::int AS unread_count
      FROM cases c
      JOIN users u ON c.user_discord_id = u.discord_id
      LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `;
    values.push(parseInt(String(limit)), parseInt(String(offset)));

    const result = await pool.query(query, values);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cases c JOIN users u ON c.user_discord_id = u.discord_id WHERE ${conditions.join(' AND ')}`,
      values.slice(0, -2)
    );

    res.json({ cases: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error('[admin/cases]', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// ─── Get single case (admin) ──────────────────────────────────────────────
router.get('/cases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [caseRes, messagesRes, evidenceRes, notesRes, timelineRes, auditRes, onboardingRes] = await Promise.all([
      pool.query(`
        SELECT c.*, u.id as user_id, u.discord_username, u.discord_avatar, u.plan, u.discord_webhook_url,
               s.name as staff_name
        FROM cases c
        JOIN users u ON c.user_discord_id = u.discord_id
        LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
        WHERE c.id = $1`, [id]),
      pool.query(`SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`, [id]),
      pool.query(`
        SELECT n.*, u.discord_username as staff_username
        FROM internal_notes n
        LEFT JOIN users u ON n.staff_discord_id = u.discord_id
        WHERE n.case_id = $1 ORDER BY n.created_at DESC`, [id]),
      pool.query(
        `SELECT t.*, s.name AS owner_name
           FROM case_timeline t
           LEFT JOIN staff s ON t.created_by_discord_id = s.discord_id
          WHERE t.case_id = $1 ORDER BY t.id ASC`, [id]),
      pool.query(`
        SELECT * FROM audit_log
        WHERE target_type = 'case' AND target_id = $1
        ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1`, [id]),
    ]);
    if (caseRes.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json({
      ...caseRes.rows[0],
      messages: messagesRes.rows,
      evidence: evidenceRes.rows,
      internal_notes: notesRes.rows,
      timeline: timelineRes.rows,
      audit_log: auditRes.rows,
      onboarding: onboardingRes.rows[0] || null,
    });
  } catch (err) {
    console.error('[admin/cases/:id]', err);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// ─── Update case (admin) ──────────────────────────────────────────────────
router.patch('/cases/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, staff_assigned_id, outcome, outcome_notes, appeal_deadline } = req.body;
    const staffId = req.user!.discord_id;

    const before = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const oldCase = before.rows[0];

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (status !== undefined) { updates.push(`status = $${p++}`); values.push(status); }
    if (priority !== undefined) { updates.push(`priority = $${p++}`); values.push(priority); }
    if (staff_assigned_id !== undefined) { updates.push(`staff_assigned_id = $${p++}`); values.push(staff_assigned_id); }
    if (outcome !== undefined) { updates.push(`outcome = $${p++}`); values.push(outcome); }
    if (outcome_notes !== undefined) { updates.push(`outcome_notes = $${p++}`); values.push(outcome_notes); }
    if (appeal_deadline !== undefined) { updates.push(`appeal_deadline = $${p++}`); values.push(appeal_deadline); }
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE cases SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );

    // Log audit
    logAudit({ actorDiscordId: staffId, action: 'case_updated', targetType: 'case', targetId: parseInt(id), details: { status, priority, outcome } }).catch(console.error);

    // Fire webhooks for status/resolution changes
    if (status && status !== oldCase.status) {
      fireWebhook(oldCase.user_discord_id, 'status_changed', {
        color: 0xEB459E,
        title: '🔄 Case Status Updated',
        fields: [
          { name: 'Case ID', value: `#${id}`, inline: true },
          { name: 'Old Status', value: oldCase.status, inline: true },
          { name: 'New Status', value: status, inline: true },
          { name: 'Updated By', value: req.user!.discord_username, inline: true },
        ],
        footer: { text: 'TikTok Recovery Portal' },
      });
    }
    if (outcome && ['won', 'denied'].includes(outcome)) {
      const createdAt = new Date(oldCase.created_at);
      const diffHours = Math.round((Date.now() - createdAt.getTime()) / 3600000);
      fireWebhook(oldCase.user_discord_id, 'case_resolved', {
        color: outcome === 'won' ? 0x57F287 : 0xED4245,
        title: outcome === 'won' ? '✅ Case Resolved — Won!' : '❌ Case Resolved — Denied',
        fields: [
          { name: 'Case ID', value: `#${id}`, inline: true },
          { name: 'Outcome', value: outcome.toUpperCase(), inline: true },
          { name: 'Time Taken', value: `${diffHours} hours`, inline: true },
          { name: 'Notes', value: (outcome_notes || 'No additional notes').substring(0, 200), inline: false },
        ],
        footer: { text: 'Thank you for using TikTok Recovery Portal' },
      });
    }

    // In-app notification + socket + timeline advance
    if (status && status !== oldCase.status) {
      await advanceCaseTimeline(parseInt(id), status, staffId);
      createNotification({
        userDiscordId: oldCase.user_discord_id,
        type: 'status_change',
        title: 'Case Status Updated',
        message: `Case #${id} moved to "${String(status).replace(/_/g, ' ')}"`,
        caseId: parseInt(id),
        actionUrl: `/cases/${id}`,
      });
      emitCaseStatusChanged(parseInt(id), { caseId: parseInt(id), oldStatus: oldCase.status, newStatus: status });
    }
    if (outcome && ['won', 'denied'].includes(outcome)) {
      createNotification({
        userDiscordId: oldCase.user_discord_id,
        type: 'case_resolved',
        title: outcome === 'won' ? 'Case Won! 🎉' : 'Case Resolved',
        message: outcome === 'won' ? `Great news — case #${id} was approved.` : `Case #${id} outcome: denied. See notes.`,
        caseId: parseInt(id),
        actionUrl: `/cases/${id}`,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/cases/:id PATCH]', err);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// ─── Needs Attention Queue ────────────────────────────────────────────────
router.get('/needs-attention', async (_req: Request, res: Response) => {
  try {
    const [deadlinesRes, staleRes, unrepliedRes] = await Promise.all([
      pool.query(`
        SELECT c.id, c.account_username, c.violation_type, c.appeal_deadline, c.status, c.priority,
               u.discord_username, u.plan,
               EXTRACT(EPOCH FROM (c.appeal_deadline - NOW()))/3600 AS hours_remaining
        FROM cases c JOIN users u ON c.user_discord_id = u.discord_id
        WHERE c.appeal_deadline BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
          AND c.status NOT IN ('won','denied','closed')
        ORDER BY c.appeal_deadline ASC LIMIT 25`),
      // Stale = waiting on a staff reply > 12h.
      // The latest message in the case is from the client and is older than 12h
      // (so the client has been waiting >12h without a staff response).
      pool.query(`
        SELECT c.id, c.account_username, c.violation_type, c.status, c.priority,
               u.discord_username, u.plan,
               m.created_at AS last_client_message,
               EXTRACT(EPOCH FROM (NOW() - m.created_at))/3600 AS stale_hours
        FROM cases c
        JOIN users u ON c.user_discord_id = u.discord_id
        JOIN LATERAL (
          SELECT created_at, sender_type FROM messages
          WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1
        ) m ON true
        WHERE m.sender_type = 'client'
          AND m.created_at < NOW() - INTERVAL '12 hours'
          AND c.status NOT IN ('won','denied','closed')
        ORDER BY m.created_at ASC LIMIT 25`),
      // New client messages = any unread client messages (regardless of age)
      // surfaced as cases needing attention with their most recent unread.
      pool.query(`
        SELECT c.id, c.account_username, c.violation_type, c.status, c.priority,
               u.discord_username, u.plan,
               MAX(m.created_at) AS last_client_message,
               COUNT(m.id)::int AS unread_count
        FROM cases c
        JOIN users u ON c.user_discord_id = u.discord_id
        JOIN messages m ON m.case_id = c.id
        WHERE m.sender_type = 'client'
          AND m.is_read = false
          AND c.status NOT IN ('won','denied','closed')
        GROUP BY c.id, c.violation_type, c.priority, u.discord_username, u.plan
        ORDER BY MAX(m.created_at) DESC LIMIT 25`),
    ]);
    res.json({
      deadlines: deadlinesRes.rows,
      stale: staleRes.rows,
      unreplied: unrepliedRes.rows,
    });
  } catch (err) {
    console.error('[admin/needs-attention]', err);
    res.status(500).json({ error: 'Failed to fetch attention queue' });
  }
});

// ─── All Clients ──────────────────────────────────────────────────────────
router.get('/clients', async (req: Request, res: Response) => {
  try {
    const { search, plan, status } = req.query;
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(u.discord_username ILIKE $${p} OR u.discord_id = $${p})`);
      values.push(`%${search}%`);
      p++;
    }
    if (plan && plan !== 'all') {
      conditions.push(`u.plan = $${p++}`);
      values.push(plan);
    }
    if (status === 'active') { conditions.push(`u.plan_expiry > NOW()`); }
    if (status === 'expired') { conditions.push(`u.plan_expiry < NOW()`); }
    if (status === 'no_plan') { conditions.push(`u.plan IS NULL`); }

    const result = await pool.query(
      `SELECT u.*,
              COUNT(DISTINCT c.id) as case_count
       FROM users u
       LEFT JOIN cases c ON u.discord_id = c.user_discord_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/clients]', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// ─── Single Client ────────────────────────────────────────────────────────
router.get('/clients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userResult = await pool.query(
      `SELECT u.*, COUNT(DISTINCT c.id) as case_count
       FROM users u
       LEFT JOIN cases c ON u.discord_id = c.user_discord_id
       WHERE u.id = $1 GROUP BY u.id`,
      [id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Client not found' });

    const user = userResult.rows[0];
    const casesResult = await pool.query(
      `SELECT c.*, s.name as staff_name
       FROM cases c
       LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
       WHERE c.user_discord_id = $1
       ORDER BY c.created_at DESC`,
      [user.discord_id]
    );
    const messagesResult = await pool.query(
      `SELECT m.*, c.account_username FROM messages m
       JOIN cases c ON m.case_id = c.id
       WHERE c.user_discord_id = $1
       ORDER BY m.created_at DESC LIMIT 50`,
      [user.discord_id]
    );

    res.json({ ...user, cases: casesResult.rows, messages: messagesResult.rows });
  } catch (err) {
    console.error('[admin/clients/:id]', err);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// ─── Update Client ────────────────────────────────────────────────────────
router.patch('/clients/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { plan, plan_start, plan_expiry, discord_channel_id, discord_webhook_url, role } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (plan !== undefined) { updates.push(`plan = $${p++}`); values.push(plan); }
    if (plan_start !== undefined) { updates.push(`plan_start = $${p++}`); values.push(plan_start); }
    if (plan_expiry !== undefined) { updates.push(`plan_expiry = $${p++}`); values.push(plan_expiry); }
    if (discord_channel_id !== undefined) { updates.push(`discord_channel_id = $${p++}`); values.push(discord_channel_id); }
    if (discord_webhook_url !== undefined) { updates.push(`discord_webhook_url = $${p++}`); values.push(discord_webhook_url); }
    if (role !== undefined) { updates.push(`role = $${p++}`); values.push(role); }
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[admin/clients/:id PATCH]', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// ─── Revoke client access ──────────────────────────────────────────────────
router.post('/clients/:id/revoke', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET plan = NULL, plan_start = NULL, plan_expiry = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    const user = result.rows[0];
    fireWebhook(user.discord_id, 'access_revoked', buildRevokeEmbed(req.user!.discord_username));
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'access_revoked', targetType: 'user', targetId: parseInt(id) }).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/clients/:id/revoke]', err);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// ─── Portal link ──────────────────────────────────────────────────────────
router.get('/clients/:id/portal-link', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT portal_token, discord_username FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    const { portal_token, discord_username } = result.rows[0];
    const baseUrl = process.env.DISCORD_REDIRECT_URI?.replace('/auth/callback', '') || 'https://one-file-rest.replit.app';
    res.json({
      portal_link: `${baseUrl}/auth/access/${portal_token}`,
      username: discord_username,
    });
  } catch (err) {
    console.error('[admin/clients/:id/portal-link]', err);
    res.status(500).json({ error: 'Failed to get portal link' });
  }
});

// ─── Regenerate portal token ──────────────────────────────────────────────
router.post('/clients/:id/regenerate-token', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users SET portal_token = gen_random_uuid(), updated_at = NOW()
       WHERE id = $1 RETURNING portal_token, discord_username`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    const { portal_token, discord_username } = result.rows[0];
    const baseUrl = process.env.DISCORD_REDIRECT_URI?.replace('/auth/callback', '') || 'https://one-file-rest.replit.app';
    res.json({
      portal_link: `${baseUrl}/auth/access/${portal_token}`,
      username: discord_username,
    });
  } catch (err) {
    console.error('[admin/clients/:id/regenerate-token]', err);
    res.status(500).json({ error: 'Failed to regenerate token' });
  }
});

// ─── Send message to client via bot webhook ────────────────────────────────
router.post('/clients/:id/message', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const result = await pool.query('SELECT discord_id, discord_username FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    const { discord_id } = result.rows[0];
    fireWebhook(discord_id, 'direct_message', {
      color: 0x5865F2,
      title: '📩 Message from Support',
      description: message,
      footer: { text: `TikTok Recovery Portal • ${req.user!.discord_username}` },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/clients/:id/message]', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── Internal Notes ───────────────────────────────────────────────────────
router.get('/notes/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const result = await pool.query(
      `SELECT n.*, u.discord_username as staff_username, u.discord_avatar as staff_avatar
       FROM internal_notes n
       LEFT JOIN users u ON n.staff_discord_id = u.discord_id
       WHERE n.case_id = $1 ORDER BY n.created_at DESC`,
      [caseId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/notes]', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/notes', async (req: Request, res: Response) => {
  try {
    const { case_id, note } = req.body;
    if (!case_id || !note) return res.status(400).json({ error: 'case_id and note are required' });
    const result = await pool.query(
      `INSERT INTO internal_notes (case_id, staff_user_id, staff_discord_id, note, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [case_id, req.user!.id, req.user!.discord_id, note]
    );
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'note_added', targetType: 'case', targetId: case_id, details: { note: note.substring(0, 100) } }).catch(console.error);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[admin/notes POST]', err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// ─── Assign case ──────────────────────────────────────────────────────────
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { case_id, staff_discord_id } = req.body;
    await pool.query(
      `UPDATE cases SET staff_assigned_id = $1, updated_at = NOW() WHERE id = $2`,
      [staff_discord_id, case_id]
    );
    await pool.query(
      `INSERT INTO staff_assignments (case_id, staff_user_id, assigned_at)
       SELECT $1, u.id, NOW() FROM users u WHERE u.discord_id = $2`,
      [case_id, staff_discord_id]
    );
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'case_assigned', targetType: 'case', targetId: case_id, details: { staff_discord_id } }).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/assign]', err);
    res.status(500).json({ error: 'Failed to assign case' });
  }
});

// ─── Staff Management ─────────────────────────────────────────────────────
router.get('/staff', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.discord_avatar, u.last_active, u.plan,
              COUNT(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('won','denied','closed')) as active_cases,
              COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('won','denied')) as resolved_cases
       FROM staff s
       LEFT JOIN users u ON s.discord_id = u.discord_id
       LEFT JOIN cases c ON s.discord_id = c.staff_assigned_id
       WHERE s.active = true
       GROUP BY s.id, u.discord_avatar, u.last_active, u.plan
       ORDER BY s.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/staff GET]', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

router.post('/staff', async (req: Request, res: Response) => {
  try {
    const { discord_id, name, role } = req.body;
    if (!discord_id || !role) return res.status(400).json({ error: 'discord_id and role are required' });

    const result = await pool.query(
      `INSERT INTO staff (discord_id, name, role, active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (discord_id) DO UPDATE SET role = $3, active = true, name = $2
       RETURNING *`,
      [discord_id, name || discord_id, role]
    );
    // Also update users table role
    await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE discord_id = $2`,
      [role, discord_id]
    );
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'staff_added', targetType: 'staff', details: { discord_id, role } }).catch(console.error);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[admin/staff POST]', err);
    res.status(500).json({ error: 'Failed to add staff member' });
  }
});

router.delete('/staff/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const staffRes = await pool.query('SELECT discord_id FROM staff WHERE id = $1', [id]);
    if (staffRes.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    await pool.query(`UPDATE staff SET active = false WHERE id = $1`, [id]);
    await pool.query(`UPDATE users SET role = 'client' WHERE discord_id = $1`, [staffRes.rows[0].discord_id]);
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'staff_removed', targetType: 'staff', details: { discord_id: staffRes.rows[0].discord_id } }).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/staff DELETE]', err);
    res.status(500).json({ error: 'Failed to remove staff' });
  }
});

// ─── Webhook Logs ─────────────────────────────────────────────────────────
router.get('/webhook-logs', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT wl.*, u.discord_username
       FROM webhook_logs wl
       LEFT JOIN users u ON wl.user_id = u.id
       ORDER BY wl.created_at DESC LIMIT 200`
    );
    const stats = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE success = true) as success_count,
              COUNT(*) FILTER (WHERE success = false) as failed_count
       FROM webhook_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    res.json({ logs: result.rows, stats: stats.rows[0] });
  } catch (err) {
    console.error('[admin/webhook-logs]', err);
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

// ─── Test Webhook ─────────────────────────────────────────────────────────
router.post('/test-webhook', async (req: Request, res: Response) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) return res.status(400).json({ error: 'webhook_url required' });

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          color: 0x57F287,
          title: '✅ Webhook Test',
          description: 'Your webhook is working correctly! This is a test message from the Elite Tok Club Portal.',
          footer: { text: 'TikTok Recovery Portal • Test' },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(400).json({ error: `Webhook failed: HTTP ${response.status} — ${text.substring(0, 200)}` });
    }
    res.json({ success: true, status: response.status });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to reach webhook URL' });
  }
});

// ─── Export Cases CSV ─────────────────────────────────────────────────────
router.get('/export/cases', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.id, u.discord_username as client, u.plan, c.account_username,
              c.violation_type, c.status, c.priority, c.outcome,
              c.created_at, c.updated_at, c.appeal_deadline
       FROM cases c JOIN users u ON c.user_discord_id = u.discord_id
       ORDER BY c.created_at DESC`
    );
    const headers = ['ID', 'Client', 'Plan', 'Account', 'Violation', 'Status', 'Priority', 'Outcome', 'Created', 'Updated', 'Deadline'];
    const rows = result.rows.map((r) => [
      r.id, r.client, r.plan || '', r.account_username || '', r.violation_type || '',
      r.status, r.priority, r.outcome || '', r.created_at, r.updated_at, r.appeal_deadline || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cases.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[admin/export/cases]', err);
    res.status(500).json({ error: 'Failed to export cases' });
  }
});

// ─── System Stats ─────────────────────────────────────────────────────────
router.get('/system-stats', async (req: Request, res: Response) => {
  try {
    const tables = ['users', 'cases', 'messages', 'webhook_logs', 'audit_log'];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
        counts[t] = parseInt(r.rows[0].count);
      } catch { counts[t] = 0; }
    }
    res.json({
      table_counts: counts,
      uptime_seconds: process.uptime(),
      node_env: process.env.NODE_ENV,
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (err) {
    console.error('[admin/system-stats]', err);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// ─── Clear old webhook logs ────────────────────────────────────────────────
router.delete('/webhook-logs/old', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id`
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('[admin/webhook-logs/old DELETE]', err);
    res.status(500).json({ error: 'Failed to clear old logs' });
  }
});

// ─── Policy Alerts Management ─────────────────────────────────────────────
router.get('/policy-alerts', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM policy_alerts ORDER BY published_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch policy alerts' });
  }
});

router.post('/policy-alerts', async (req: Request, res: Response) => {
  try {
    const { title, summary, full_content, severity, source_url, active } = req.body;
    const result = await pool.query(
      `INSERT INTO policy_alerts (title, summary, full_content, severity, source_url, active, created_by, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [title, summary, full_content, severity || 'info', source_url, active !== false, req.user!.discord_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create policy alert' });
  }
});

router.patch('/policy-alerts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, summary, full_content, severity, active } = req.body;
    const result = await pool.query(
      `UPDATE policy_alerts SET title = COALESCE($1, title), summary = COALESCE($2, summary),
       full_content = COALESCE($3, full_content), severity = COALESCE($4, severity),
       active = COALESCE($5, active) WHERE id = $6 RETURNING *`,
      [title, summary, full_content, severity, active, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update policy alert' });
  }
});

router.delete('/policy-alerts/:id', async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM policy_alerts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete policy alert' });
  }
});

// ─── Weekly Report via AI ─────────────────────────────────────────────────
router.post('/weekly-report', async (req: Request, res: Response) => {
  try {
    const [casesRes, resolvedRes, newClientsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM cases WHERE created_at >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) FROM cases WHERE status IN ('won','denied','closed') AND updated_at >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`),
    ]);
    const summary = await groqText({
      systemPrompt: 'You are a professional business analyst for a TikTok Shop account recovery service. Generate concise, professional weekly summary reports.',
      userMessage: `Generate a weekly summary report for our TikTok recovery portal. This week: ${casesRes.rows[0].count} new cases submitted, ${resolvedRes.rows[0].count} cases resolved, ${newClientsRes.rows[0].count} new clients joined. Provide insights and recommendations in 3-4 paragraphs.`,
    });
    res.json({ report: summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate report' });
  }
});

// ─── Env var status check ─────────────────────────────────────────────────
router.get('/env-status', async (req: Request, res: Response) => {
  const vars = [
    'DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET',
    'DISCORD_GUILD_ID', 'DISCORD_REDIRECT_URI', 'ADMIN_DISCORD_IDS',
    'BOT_BRIDGE_TOKEN', 'SESSION_SECRET', 'DATABASE_URL', 'GROQ_API_KEY',
  ];
  const status = Object.fromEntries(vars.map((v) => [v, !!process.env[v]]));
  res.json(status);
});

export default router;
