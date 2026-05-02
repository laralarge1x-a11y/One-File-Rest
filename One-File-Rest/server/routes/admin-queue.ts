import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { logAudit } from '../services/webhook.js';
import { advanceCaseTimeline } from '../services/timeline.js';
import { emitCaseStatusChanged } from '../services/notifications.js';

const router = Router();

// Smart dispatcher queue: hot, stalled, in_flight, my_queue, snoozed
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const me = req.user!.discord_id;
    const baseSelect = `
      SELECT c.id, c.account_username, c.violation_type, c.status, c.priority,
             c.appeal_deadline, c.staff_assigned_id, c.snoozed_until, c.snooze_reason,
             c.updated_at, c.created_at,
             u.discord_username, u.plan, u.discord_avatar,
             s.name AS staff_name,
             EXTRACT(EPOCH FROM (NOW() - c.updated_at))/3600 AS hours_since_update,
             EXTRACT(EPOCH FROM (c.appeal_deadline - NOW()))/3600 AS hours_to_deadline,
             (SELECT COUNT(*)::int FROM messages m WHERE m.case_id = c.id AND m.is_read = false AND m.sender_type = 'client') AS unread_client,
             (SELECT MAX(created_at) FROM messages m WHERE m.case_id = c.id) AS last_msg_at
        FROM cases c
        JOIN users u ON c.user_discord_id = u.discord_id
        LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
       WHERE c.status NOT IN ('won','denied','closed')
         AND (c.snoozed_until IS NULL OR c.snoozed_until <= NOW())`;

    const all = await pool.query(baseSelect);
    const rows: any[] = all.rows;

    const now = Date.now();
    const hot = rows.filter((c) => {
      const hrs = c.hours_to_deadline;
      return (hrs !== null && hrs <= 24) || c.priority === 'critical' || c.unread_client > 0;
    }).sort((a, b) => (a.hours_to_deadline ?? 999) - (b.hours_to_deadline ?? 999));

    const stalled = rows.filter((c) => {
      return c.hours_since_update >= 24 && !hot.includes(c);
    }).sort((a, b) => b.hours_since_update - a.hours_since_update);

    const in_flight = rows.filter((c) => {
      return ['intake', 'profile_built', 'appeal_drafted', 'appeal_submitted', 'awaiting_tiktok', 'response_received', 'escalated'].includes(c.status)
        && !hot.includes(c) && !stalled.includes(c);
    });

    const my_queue = rows.filter((c) => c.staff_assigned_id === me);

    const snoozedRes = await pool.query(
      `${baseSelect.replace('AND (c.snoozed_until IS NULL OR c.snoozed_until <= NOW())', 'AND c.snoozed_until > NOW()')}`
    );

    res.json({
      hot,
      stalled,
      in_flight,
      my_queue,
      snoozed: snoozedRes.rows,
      counts: {
        hot: hot.length,
        stalled: stalled.length,
        in_flight: in_flight.length,
        my_queue: my_queue.length,
        snoozed: snoozedRes.rows.length,
      },
    });
  } catch (err) {
    console.error('[admin/queue]', err);
    res.status(500).json({ error: 'Failed to load queue' });
  }
});

// Snooze a case
router.post('/cases/:id/snooze', async (req: Request, res: Response) => {
  try {
    const { until, reason } = req.body || {};
    const id = parseInt(req.params.id);
    if (!until) return res.status(400).json({ error: 'until required (ISO date)' });
    const r = await pool.query(
      `UPDATE cases SET snoozed_until = $1, snooze_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING id, snoozed_until, snooze_reason`,
      [until, reason || null, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logAudit({ actorDiscordId: req.user!.discord_id, action: 'case_snoozed', targetType: 'case', targetId: id, details: { until, reason } }).catch(console.error);
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[admin/snooze]', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/cases/:id/snooze', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query(`UPDATE cases SET snoozed_until = NULL, snooze_reason = NULL, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Bulk actions: assign, status, snooze, priority
router.post('/cases/bulk', async (req: Request, res: Response) => {
  try {
    const { ids, action, value } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || !action) {
      return res.status(400).json({ error: 'ids and action required' });
    }
    const intIds = ids.map((x) => parseInt(x)).filter(Number.isFinite);
    let updated = 0;

    if (action === 'assign') {
      const r = await pool.query(`UPDATE cases SET staff_assigned_id = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id`, [value || null, intIds]);
      updated = r.rowCount || 0;
    } else if (action === 'status') {
      const r = await pool.query(`UPDATE cases SET status = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id, status`, [value, intIds]);
      updated = r.rowCount || 0;
      for (const row of r.rows) {
        await advanceCaseTimeline(row.id, row.status, req.user!.discord_id);
        emitCaseStatusChanged(row.id, { caseId: row.id, newStatus: row.status });
      }
    } else if (action === 'priority') {
      const r = await pool.query(`UPDATE cases SET priority = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [value, intIds]);
      updated = r.rowCount || 0;
    } else if (action === 'snooze') {
      const r = await pool.query(`UPDATE cases SET snoozed_until = $1, updated_at = NOW() WHERE id = ANY($2::int[])`, [value, intIds]);
      updated = r.rowCount || 0;
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    logAudit({ actorDiscordId: req.user!.discord_id, action: `bulk_${action}`, targetType: 'case', details: { ids: intIds, value } }).catch(console.error);
    res.json({ updated });
  } catch (err) {
    console.error('[admin/cases/bulk]', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// Hover preview: condensed case summary
router.get('/cases/:id/preview', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.account_username, c.violation_type, c.status, c.priority,
              c.appeal_deadline, c.violation_description,
              u.discord_username, u.plan,
              s.name AS staff_name,
              (SELECT COUNT(*)::int FROM messages WHERE case_id = c.id) AS msg_count,
              (SELECT COUNT(*)::int FROM evidence WHERE case_id = c.id) AS ev_count,
              (SELECT content FROM messages WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT score FROM compliance_scores WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1) AS compliance_score
         FROM cases c
         JOIN users u ON c.user_discord_id = u.discord_id
         LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
        WHERE c.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
