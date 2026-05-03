import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { fireWebhook, logAudit } from '../services/webhook.js';
import { advanceCaseTimeline } from '../services/timeline.js';
import { createNotification, emitCaseStatusChanged } from '../services/notifications.js';
import {
  STAGES, STAGE_IDS, statusToStage, stageToStatus, getStageMeta,
  type StageId,
} from '../../shared/stages.js';

interface StageBoardCaseRow {
  id: number;
  account_username: string;
  violation_type: string;
  status: string;
  stage: StageId;
  priority: 'normal' | 'high' | 'critical' | null;
  appeal_deadline: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  user_discord_id: string;
  staff_assigned_id: string | null;
  discord_username: string;
  discord_avatar: string | null;
  plan: string | null;
  staff_name: string | null;
  unread_count: number;
}

const router = Router();

// ─── GET /api/admin/stage-board ───────────────────────────────────────────
// Returns all open cases bucketed by canonical stage. Resolved-won and
// resolved-lost are capped at the most-recent N to keep the payload small;
// the kanban renders a "view all" link per terminal column.
router.get('/stage-board', async (req: Request, res: Response) => {
  try {
    const resolvedLimit = Math.min(parseInt(String(req.query.resolvedLimit || '25')) || 25, 200);
    // Filters: plan=plus, assigned=<discord_id>|me|unassigned, priority=critical|high,
    // ageDays=7 (only show cases older than N days at current stage),
    // mine=1 (smart "Needs my attention" bucket).
    const fPlan = String(req.query.plan || '').trim() || null;
    let fAssigned = String(req.query.assigned || '').trim() || null;
    if (fAssigned === 'me') fAssigned = req.user!.discord_id;
    const fPriority = String(req.query.priority || '').trim() || null;
    const fAgeDays = parseInt(String(req.query.ageDays || '0')) || 0;
    const mine = String(req.query.mine || '') === '1';

    const where: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;
    if (fPlan)     { where.push(`u.plan = $${p++}`);                              params.push(fPlan); }
    if (fPriority) { where.push(`c.priority = $${p++}`);                          params.push(fPriority); }
    if (fAssigned === 'unassigned') {
      where.push('c.staff_assigned_id IS NULL');
    } else if (fAssigned) {
      where.push(`c.staff_assigned_id = $${p++}`); params.push(fAssigned);
    }
    if (fAgeDays > 0) {
      where.push(`c.updated_at < NOW() - ($${p++} || ' days')::interval`);
      params.push(fAgeDays);
    }
    if (mine) {
      where.push(`(c.staff_assigned_id = $${p++} OR (c.staff_assigned_id IS NULL AND c.priority IN ('high','critical')))`);
      params.push(req.user!.discord_id);
    }
    const filterSql = where.length ? `AND ${where.join(' AND ')}` : '';

    // Totals must respect the same filters as the columns, otherwise the
    // count badge contradicts the cards displayed.
    const totalsSql = `
      SELECT c.stage, COUNT(*)::int AS count
        FROM cases c
        JOIN users u ON c.user_discord_id = u.discord_id
       WHERE 1=1 ${filterSql.replace(/^AND /, 'AND ')}
       GROUP BY c.stage
    `;

    const [activeRes, resolvedRes, totalsRes] = await Promise.all([
      pool.query<StageBoardCaseRow>(`
        SELECT c.id, c.account_username, c.violation_type, c.status, c.stage, c.priority,
               c.appeal_deadline, c.snoozed_until, c.created_at, c.updated_at,
               c.user_discord_id, c.staff_assigned_id,
               u.discord_username, u.discord_avatar, u.plan,
               s.name AS staff_name,
               COALESCE((
                 SELECT COUNT(*)::int FROM messages m
                 WHERE m.case_id = c.id AND m.sender_type = 'client' AND m.is_read = false
               ), 0) AS unread_count
          FROM cases c
          JOIN users u ON c.user_discord_id = u.discord_id
          LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
         WHERE c.status NOT IN ('won','denied','closed') ${filterSql}
         ORDER BY c.priority DESC NULLS LAST, c.updated_at DESC
      `, params),
      pool.query<StageBoardCaseRow>(`
        SELECT c.id, c.account_username, c.violation_type, c.status, c.stage, c.priority,
               c.appeal_deadline, c.snoozed_until, c.created_at, c.updated_at,
               c.user_discord_id, c.staff_assigned_id,
               u.discord_username, u.discord_avatar, u.plan,
               s.name AS staff_name,
               0 AS unread_count
          FROM cases c
          JOIN users u ON c.user_discord_id = u.discord_id
          LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
         WHERE c.status IN ('won','denied','closed') ${filterSql}
         ORDER BY c.updated_at DESC
         LIMIT $${p}
      `, [...params, resolvedLimit]),
      pool.query<{ stage: StageId; count: number }>(totalsSql, params),
    ]);

    const buckets: Record<StageId, StageBoardCaseRow[]> = {
      intake: [], appeal_drafting: [], appeal_sent: [],
      tiktok_replied: [], needs_retry: [], resolved_won: [], resolved_lost: [],
    };
    for (const row of [...activeRes.rows, ...resolvedRes.rows]) {
      // Use the DB-computed `stage` column; fall back to the runtime mapping
      // if a row was somehow returned without one (older rows pre-migration).
      const stage = (row.stage as StageId) || statusToStage(row.status, (row as { outcome?: string | null }).outcome);
      buckets[stage].push({ ...row, stage });
    }

    const totals: Record<StageId, number> = {
      intake: 0, appeal_drafting: 0, appeal_sent: 0,
      tiktok_replied: 0, needs_retry: 0, resolved_won: 0, resolved_lost: 0,
    };
    for (const row of totalsRes.rows) {
      if (row.stage in totals) totals[row.stage as StageId] = row.count;
    }

    // "Needs my attention" smart bucket — SLA-driven. Surfaces cases that
    // are blocking on the current staffer or breaching the response SLA in
    // the two stages where TikTok-side latency matters most:
    //   • appeal_sent: TikTok hasn't replied within 48h
    //   • tiktok_replied: we haven't acted on their reply within 24h
    // Plus universal escalations: unread client messages, critical
    // priority, and personal deadlines within 24h.
    const meId = req.user!.discord_id;
    const now = Date.now();
    const SLA_APPEAL_SENT_MS    = 48 * 3600_000;
    const SLA_TIKTOK_REPLIED_MS = 24 * 3600_000;
    const myAttention = activeRes.rows.filter((r) => {
      const stage = (r.stage as StageId) || statusToStage(r.status, (r as { outcome?: string | null }).outcome);
      const sinceUpdated = now - new Date(r.updated_at).getTime();
      const mine = r.staff_assigned_id === meId;
      if (r.unread_count > 0 && (mine || !r.staff_assigned_id)) return true;
      if (r.priority === 'critical') return true;
      if (mine && r.appeal_deadline && new Date(r.appeal_deadline).getTime() < now + 24 * 3600_000) return true;
      if (stage === 'appeal_sent'   && sinceUpdated > SLA_APPEAL_SENT_MS) return true;
      if (stage === 'tiktok_replied' && sinceUpdated > SLA_TIKTOK_REPLIED_MS) return true;
      if (stage === 'needs_retry' && mine) return true;
      return false;
    }).map((r) => ({ ...r, stage: (r.stage as StageId) || statusToStage(r.status, (r as { outcome?: string | null }).outcome) }));

    res.json({
      stages: STAGES.map((s) => ({ ...s, total: totals[s.id], cases: buckets[s.id] })),
      smart: { needs_my_attention: myAttention },
    });
  } catch (err) {
    console.error('[admin/stage-board GET]', err);
    res.status(500).json({ error: 'Failed to load stage board' });
  }
});

// ─── POST /api/admin/stage-board/bulk-move ────────────────────────────────
// Bulk drag/select on the kanban — body: { caseIds: number[], toStage }.
// Calls the single-move logic per id so the audit log + notifications +
// timeline update are identical to the per-card flow.
router.post('/stage-board/bulk-move', async (req: Request, res: Response) => {
  const { caseIds, toStage } = req.body || {};
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return res.status(400).json({ error: 'caseIds[] required' });
  }
  if (!(STAGE_IDS as readonly string[]).includes(String(toStage))) {
    return res.status(400).json({ error: 'invalid toStage' });
  }
  const target = toStage as StageId;
  const newStatus = stageToStatus(target);
  const staffId = req.user!.discord_id;

  let moved = 0;
  let unchanged = 0;
  const failures: Array<{ id: number; error: string }> = [];

  for (const raw of caseIds) {
    const id = parseInt(String(raw));
    if (!id) { failures.push({ id: raw, error: 'bad id' }); continue; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await client.query('SELECT * FROM cases WHERE id = $1 FOR UPDATE', [id]);
      if (before.rows.length === 0) {
        await client.query('ROLLBACK');
        failures.push({ id, error: 'not found' }); continue;
      }
      const oldCase = before.rows[0];
      const oldStage = statusToStage(oldCase.status, oldCase.outcome);
      if (oldStage === target) { await client.query('ROLLBACK'); unchanged++; continue; }

      // Setting outcome explicitly: NULL when moving back to a non-terminal
      // stage so analytics/outcome filters don't keep stale terminal data.
      let outcomeSet = ', outcome = NULL';
      if (target === 'resolved_won')       outcomeSet = `, outcome = 'won'`;
      else if (target === 'resolved_lost') outcomeSet = `, outcome = 'denied'`;

      await client.query(
        `UPDATE cases SET status = $1, updated_at = NOW()${outcomeSet} WHERE id = $2`,
        [newStatus, id]
      );
      // Canonical history row uses the *target* stage explicitly so bulk
      // moves to resolved_lost record resolved_lost (not needs_retry,
      // which is what statusToStage('denied') alone would derive).
      await client.query(
        `INSERT INTO case_stage_history
           (case_id, from_stage, to_stage, from_status, to_status, actor_discord_id, source, note)
         VALUES ($1, $2, $3, $4, $5, $6, 'kanban', $7)`,
        [id, oldStage, target, oldCase.status, newStatus, staffId, 'bulk move']
      );
      await client.query('COMMIT');

      advanceCaseTimeline(id, newStatus, staffId, {
        source: 'kanban', oldStatus: oldCase.status, note: 'bulk move', skipStageHistory: true,
      }).catch((e) => console.error('[bulk-move] timeline advance failed:', e));

      logAudit({
        actorDiscordId: staffId, action: 'case_stage_moved',
        targetType: 'case', targetId: id,
        details: { from_stage: oldStage, to_stage: target, bulk: true },
      }).catch(console.error);
      createNotification({
        userDiscordId: oldCase.user_discord_id, type: 'status_change',
        title: 'Case Moved', message: `Case #${id} is now in "${getStageMeta(target).label}".`,
        caseId: id, actionUrl: `/cases/${id}`,
      });
      emitCaseStatusChanged(id, { caseId: id, oldStatus: oldCase.status, newStatus, newStage: target });
      moved++;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* ignored */ }
      console.error('[bulk-move]', id, err);
      failures.push({ id, error: err instanceof Error ? err.message : 'failed' });
    } finally {
      client.release();
    }
  }

  res.json({ ok: true, moved, unchanged, failures, toStage: target });
});

// ─── POST /api/admin/stage-board/move ─────────────────────────────────────
// Drag-and-drop endpoint. Body: { caseId, toStage, note? }.
// Idempotent: a no-op move (same stage) returns 200 without writing history.
router.post('/stage-board/move', async (req: Request, res: Response) => {
  const { caseId, toStage, note } = req.body || {};
  const staffId = req.user!.discord_id;

  const id = parseInt(String(caseId));
  if (!id || !(STAGE_IDS as readonly string[]).includes(String(toStage))) {
    return res.status(400).json({ error: 'caseId and a valid toStage are required' });
  }
  const targetStage = toStage as StageId;
  const newStatus = stageToStatus(targetStage);

  // Wrap the load + UPDATE + history insert in a single transaction so the
  // audit row never goes missing when the UPDATE succeeds (or vice-versa).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await client.query('SELECT * FROM cases WHERE id = $1 FOR UPDATE', [id]);
    if (before.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Case not found' });
    }
    const oldCase = before.rows[0];
    const oldStage = statusToStage(oldCase.status, oldCase.outcome);

    if (oldStage === targetStage) {
      await client.query('ROLLBACK');
      return res.json({ ok: true, unchanged: true, stage: targetStage });
    }

    // Outcome must follow stage: terminal targets set won/denied; moving
    // back out of a terminal stage clears it so analytics don't see stale
    // terminal data.
    let outcomeSet = ', outcome = NULL';
    if (targetStage === 'resolved_won')       outcomeSet = `, outcome = 'won'`;
    else if (targetStage === 'resolved_lost') outcomeSet = `, outcome = 'denied'`;

    const upd = await client.query(
      `UPDATE cases SET status = $1, updated_at = NOW()${outcomeSet} WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
    const updated = upd.rows[0];

    // History row inside the same transaction. We insert directly (instead
    // of going through advanceCaseTimeline) so we can keep both writes
    // atomic; the legacy timeline rows still get advanced below in a
    // best-effort post-commit call.
    await client.query(
      `INSERT INTO case_stage_history
         (case_id, from_stage, to_stage, from_status, to_status, actor_discord_id, source, note)
       VALUES ($1, $2, $3, $4, $5, $6, 'kanban', $7)`,
      [id, oldStage, targetStage, oldCase.status, newStatus, staffId, note || null]
    );

    await client.query('COMMIT');

    // Post-commit: advance the legacy six-stage timeline. The canonical
    // case_stage_history row was already written inside the transaction,
    // so we pass skipStageHistory to avoid a duplicate.
    advanceCaseTimeline(id, newStatus, staffId, {
      source: 'kanban',
      note: note || undefined,
      oldStatus: oldCase.status,
      skipStageHistory: true,
    }).catch((e) => console.error('[stage-board/move] timeline advance failed:', e));

    // Audit log row keyed off the *stage* transition (separate from
    // generic case_updated rows so we can filter for stage activity).
    logAudit({
      actorDiscordId: staffId,
      action: 'case_stage_moved',
      targetType: 'case', targetId: id,
      details: { from_stage: oldStage, to_stage: targetStage, from_status: oldCase.status, to_status: newStatus, note: note || null },
    }).catch(console.error);

    // Customer notification + socket broadcast.
    const meta = getStageMeta(targetStage);
    createNotification({
      userDiscordId: oldCase.user_discord_id,
      type: 'status_change',
      title: 'Case Moved',
      message: `Case #${id} is now in "${meta.label}".`,
      caseId: id,
      actionUrl: `/cases/${id}`,
    });
    emitCaseStatusChanged(id, {
      caseId: id, oldStatus: oldCase.status, newStatus, oldStage, newStage: targetStage,
    });

    // Discord webhook for resolved transitions, mirroring the patch route.
    if (targetStage === 'resolved_won' || targetStage === 'resolved_lost') {
      const won = targetStage === 'resolved_won';
      const diffHours = Math.round((Date.now() - new Date(oldCase.created_at).getTime()) / 3600000);
      fireWebhook(oldCase.user_discord_id, 'case_resolved', {
        color: won ? 0x57F287 : 0xED4245,
        title: won ? '✅ Case Resolved — Won!' : '❌ Case Resolved — Denied',
        fields: [
          { name: 'Case ID', value: `#${id}`, inline: true },
          { name: 'Outcome', value: won ? 'WON' : 'DENIED', inline: true },
          { name: 'Time Taken', value: `${diffHours} hours`, inline: true },
        ],
        footer: { text: 'TikTok Recovery Portal' },
      });
    }

    res.json({ ok: true, case: { ...updated, stage: targetStage }, fromStage: oldStage, toStage: targetStage });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignored */ }
    console.error('[admin/stage-board/move POST]', err);
    res.status(500).json({ error: 'Failed to move case' });
  } finally {
    client.release();
  }
});

// ─── POST /api/admin/stage-board/bulk-assign ─────────────────────────────
// Body: { caseIds: number[], staffDiscordId: string | null }
// `null` clears the assignment. Audit + notification per id.
router.post('/stage-board/bulk-assign', async (req: Request, res: Response) => {
  const { caseIds, staffDiscordId } = req.body || {};
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return res.status(400).json({ error: 'caseIds[] required' });
  }
  const target: string | null = staffDiscordId ? String(staffDiscordId) : null;
  const actor = req.user!.discord_id;
  let assigned = 0;
  const failures: Array<{ id: number; error: string }> = [];
  for (const raw of caseIds) {
    const id = parseInt(String(raw));
    if (!id) { failures.push({ id: raw, error: 'bad id' }); continue; }
    try {
      const r = await pool.query(
        `UPDATE cases SET staff_assigned_id = $1, updated_at = NOW() WHERE id = $2 RETURNING user_discord_id`,
        [target, id]
      );
      if (r.rowCount === 0) { failures.push({ id, error: 'not found' }); continue; }
      logAudit({
        actorDiscordId: actor, action: 'case_assigned',
        targetType: 'case', targetId: id,
        details: { staff_discord_id: target, bulk: true },
      }).catch(console.error);
      if (target && target !== actor) {
        createNotification({
          userDiscordId: target, type: 'assigned',
          title: 'Case assigned to you',
          message: `You have been assigned case #${id}.`,
          caseId: id, actionUrl: `/admin/cases/${id}`,
        });
      }
      assigned++;
    } catch (err) {
      failures.push({ id, error: err instanceof Error ? err.message : 'failed' });
    }
  }
  res.json({ ok: true, assigned, failures, staffDiscordId: target });
});

// ─── POST /api/admin/stage-board/bulk-snooze ─────────────────────────────
// Body: { caseIds: number[], hours: number, reason?: string }
router.post('/stage-board/bulk-snooze', async (req: Request, res: Response) => {
  const { caseIds, hours, reason } = req.body || {};
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return res.status(400).json({ error: 'caseIds[] required' });
  }
  const h = Math.max(1, Math.min(24 * 30, parseInt(String(hours)) || 24));
  const actor = req.user!.discord_id;
  let snoozed = 0;
  const failures: Array<{ id: number; error: string }> = [];
  for (const raw of caseIds) {
    const id = parseInt(String(raw));
    if (!id) { failures.push({ id: raw, error: 'bad id' }); continue; }
    try {
      const r = await pool.query(
        `UPDATE cases
            SET snoozed_until = NOW() + ($1 || ' hours')::interval,
                snooze_reason = $2,
                updated_at = NOW()
          WHERE id = $3`,
        [h, reason || null, id]
      );
      if (r.rowCount === 0) { failures.push({ id, error: 'not found' }); continue; }
      logAudit({
        actorDiscordId: actor, action: 'case_snoozed',
        targetType: 'case', targetId: id,
        details: { hours: h, reason: reason || null, bulk: true },
      }).catch(console.error);
      snoozed++;
    } catch (err) {
      failures.push({ id, error: err instanceof Error ? err.message : 'failed' });
    }
  }
  res.json({ ok: true, snoozed, hours: h, failures });
});

// ─── POST /api/admin/stage-board/bulk-nudge ──────────────────────────────
// Sends a "we're still working on it" notification to every customer in
// the selection. Audit row per id.
router.post('/stage-board/bulk-nudge', async (req: Request, res: Response) => {
  const { caseIds, message } = req.body || {};
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return res.status(400).json({ error: 'caseIds[] required' });
  }
  const note = String(message || 'Your specialist is actively working on your case.').slice(0, 280);
  const actor = req.user!.discord_id;
  let nudged = 0;
  for (const raw of caseIds) {
    const id = parseInt(String(raw));
    if (!id) continue;
    try {
      const r = await pool.query(
        `SELECT user_discord_id FROM cases WHERE id = $1`, [id]
      );
      if (r.rows.length === 0) continue;
      createNotification({
        userDiscordId: r.rows[0].user_discord_id, type: 'nudge',
        title: 'Case update', message: note,
        caseId: id, actionUrl: `/cases/${id}`,
      });
      logAudit({
        actorDiscordId: actor, action: 'case_nudged',
        targetType: 'case', targetId: id,
        details: { message: note, bulk: true },
      }).catch(console.error);
      nudged++;
    } catch (err) {
      console.error('[bulk-nudge]', id, err);
    }
  }
  res.json({ ok: true, nudged });
});

// ─── GET /api/admin/stage-board/history/:caseId ───────────────────────────
router.get('/stage-board/history/:caseId', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT h.*, u.discord_username AS actor_username, s.name AS actor_name
        FROM case_stage_history h
        LEFT JOIN users u ON h.actor_discord_id = u.discord_id
        LEFT JOIN staff s ON h.actor_discord_id = s.discord_id
       WHERE h.case_id = $1
       ORDER BY h.created_at DESC
       LIMIT 100
    `, [req.params.caseId]);
    res.json({ history: r.rows });
  } catch (err) {
    console.error('[admin/stage-board/history]', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// ─── GET /api/admin/search?q=… — command palette backend ──────────────────
// Cross-search cases, clients, KB articles, and templates. Used by Cmd+K.
router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ cases: [], clients: [], kb: [], templates: [] });
  const like = `%${q}%`;
  try {
    const [casesR, clientsR, kbR, tmplR, staffR] = await Promise.all([
      pool.query(`
        SELECT c.id, c.account_username, c.violation_type, c.status, c.outcome, c.user_discord_id, u.discord_username
          FROM cases c JOIN users u ON c.user_discord_id = u.discord_id
         WHERE c.id::text = $1
            OR c.account_username ILIKE $2
            OR c.violation_type  ILIKE $2
            OR u.discord_username ILIKE $2
            OR c.user_discord_id  ILIKE $2
         ORDER BY (c.id::text = $1) DESC, c.updated_at DESC LIMIT 8`, [q, like]),
      pool.query(`
        SELECT discord_id, discord_username, plan
          FROM users
         WHERE discord_id ILIKE $1 OR discord_username ILIKE $1 OR email ILIKE $1
         ORDER BY (discord_username ILIKE $2) DESC, last_active DESC NULLS LAST LIMIT 6`,
        [like, `${q}%`]),
      pool.query(`
        SELECT id, slug, title FROM kb_articles
         WHERE published = true AND (title ILIKE $1 OR body_md ILIKE $1)
         ORDER BY updated_at DESC LIMIT 5`, [like]),
      pool.query(`
        SELECT id, template_name, violation_type FROM appeal_templates
         WHERE active = true AND (template_name ILIKE $1 OR template_body ILIKE $1)
         ORDER BY use_count DESC NULLS LAST LIMIT 5`, [like]),
      pool.query(`
        SELECT discord_id, name, role FROM staff
         WHERE name ILIKE $1 OR discord_id ILIKE $1
         ORDER BY name ASC LIMIT 5`, [like]),
    ]);
    res.json({
      cases: casesR.rows.map((r: { status: string; outcome?: string | null }) => ({ ...r, stage: statusToStage(r.status, r.outcome) })),
      clients: clientsR.rows,
      staff: staffR.rows,
      kb: kbR.rows,
      templates: tmplR.rows,
    });
  } catch (err) {
    console.error('[admin/search]', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Saved views (sidebar presets) ────────────────────────────────────────
router.get('/saved-views', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT * FROM saved_views WHERE owner_discord_id = $1 ORDER BY pinned DESC, sort_order ASC, created_at DESC`,
      [req.user!.discord_id]
    );
    res.json({ views: r.rows });
  } catch (err) {
    console.error('[admin/saved-views GET]', err);
    res.status(500).json({ error: 'Failed to load views' });
  }
});

router.post('/saved-views', async (req: Request, res: Response) => {
  try {
    const { name, scope, query, pinned } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    const r = await pool.query(
      `INSERT INTO saved_views (owner_discord_id, name, scope, query, pinned)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.discord_id, name.slice(0, 120), scope || 'cases', query || {}, !!pinned]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[admin/saved-views POST]', err);
    res.status(500).json({ error: 'Failed to save view' });
  }
});

router.patch('/saved-views/:id', async (req: Request, res: Response) => {
  try {
    const { name, query, pinned, sort_order } = req.body || {};
    const r = await pool.query(
      `UPDATE saved_views
          SET name = COALESCE($1, name),
              query = COALESCE($2, query),
              pinned = COALESCE($3, pinned),
              sort_order = COALESCE($4, sort_order),
              updated_at = NOW()
        WHERE id = $5 AND owner_discord_id = $6 RETURNING *`,
      [name ?? null, query ?? null, pinned ?? null, sort_order ?? null, req.params.id, req.user!.discord_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[admin/saved-views PATCH]', err);
    res.status(500).json({ error: 'Failed to update view' });
  }
});

router.delete('/saved-views/:id', async (req: Request, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM saved_views WHERE id = $1 AND owner_discord_id = $2`,
      [req.params.id, req.user!.discord_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/saved-views DELETE]', err);
    res.status(500).json({ error: 'Failed to delete view' });
  }
});

export default router;
