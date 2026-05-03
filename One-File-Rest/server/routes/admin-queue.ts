import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { logAudit } from '../services/webhook.js';
import { advanceCaseTimeline } from '../services/timeline.js';
import { emitCaseStatusChanged } from '../services/notifications.js';
import { validate } from '../middleware/index.js';
import {
  caseStatusEnum,
  casePriorityEnum,
  discordIdSchema,
  isoDateString,
  emptyQuerySchema, emptyParamsSchema
} from '../../shared/schemas.js';

const router = Router();

const BulkActionBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    value: discordIdSchema.nullable(),
  }),
  z.object({
    action: z.literal('status'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    value: caseStatusEnum,
  }),
  z.object({
    action: z.literal('priority'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    value: casePriorityEnum,
  }),
  z.object({
    action: z.literal('snooze'),
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    value: isoDateString.nullable(),
  }),
]);

const QueueQuery = z.object({
  filter: z.enum(['hot', 'stalled', 'in_flight', 'my_queue', 'snoozed']).optional(),
}).strict();

// Smart dispatcher queue: hot, stalled, in_flight, my_queue, snoozed
router.get('/queue', validate({ query: QueueQuery, params: emptyParamsSchema }), async (req: Request, res: Response) => {
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

    return res.json({
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
    console.error('[admin/queue]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to load queue', requestId: req.id } });
  }
});

const SnoozeIdParam = z.object({ id: z.coerce.number().int().positive() }).strict();
const SnoozeBody = z.object({
  until: isoDateString,
  reason: z.string().max(500).optional().nullable(),
}).strict();

// Snooze a case
router.post('/cases/:id/snooze', validate({ params: SnoozeIdParam, body: SnoozeBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { until, reason } = req.body;
    const id = parseInt(req.params.id);
    const beforeR = await pool.query(`SELECT snoozed_until, snooze_reason FROM cases WHERE id = $1`, [id]);
    if (beforeR.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Not found', requestId: req.id } });
    const before = beforeR.rows[0];
    const r = await pool.query(
      `UPDATE cases SET snoozed_until = $1, snooze_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING id, snoozed_until, snooze_reason`,
      [until, reason || null, id]
    );
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'case_snoozed',
      targetType: 'case',
      targetId: id,
      details: {
        from: { snoozed_until: before.snoozed_until, reason: before.snooze_reason },
        to: { snoozed_until: r.rows[0].snoozed_until, reason: reason || null },
      },
    }).catch(console.error);
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('[admin/snooze]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.delete('/cases/:id/snooze', validate({ params: SnoozeIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const beforeR = await pool.query(`SELECT snoozed_until, snooze_reason FROM cases WHERE id = $1`, [id]);
    if (beforeR.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Not found', requestId: req.id } });
    const before = beforeR.rows[0];
    await pool.query(`UPDATE cases SET snoozed_until = NULL, snooze_reason = NULL, updated_at = NOW() WHERE id = $1`, [id]);
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'case_unsnoozed',
      targetType: 'case',
      targetId: id,
      details: {
        from: { snoozed_until: before.snoozed_until, reason: before.snooze_reason },
        to: { snoozed_until: null, reason: null },
      },
    }).catch(console.error);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin/unsnooze]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

// Bulk actions: assign, status, snooze, priority
router.post('/cases/bulk', validate({ body: BulkActionBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { ids, action, value } = req.body as z.infer<typeof BulkActionBody>;
    const intIds = ids;
    const actorId = req.user!.discord_id;

    // Snapshot the affected rows BEFORE mutating so the audit log can
    // record a precise per-id before/after diff for every privileged
    // bulk action.
    const beforeRows = (
      await pool.query(
        `SELECT id, status, priority, staff_assigned_id, snoozed_until FROM cases WHERE id = ANY($1::int[])`,
        [intIds],
      )
    ).rows as Array<Record<string, unknown> & { id: number }>;
    const beforeMap = new Map(beforeRows.map((r) => [r.id, r]));

    let updated = 0;
    let updatedRows: Array<{ id: number; status?: string }> = [];
    const fieldMap = { assign: 'staff_assigned_id', status: 'status', priority: 'priority', snooze: 'snoozed_until' } as const;
    const field = fieldMap[action];

    if (action === 'assign') {
      const r = await pool.query(
        `UPDATE cases SET staff_assigned_id = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id`,
        [value, intIds],
      );
      updated = r.rowCount || 0;
      updatedRows = r.rows;
      if (value && value !== actorId) {
        try {
          const { createNotification } = await import('../services/notifications.js');
          for (const row of r.rows) {
            await createNotification({
              userDiscordId: value,
              type: 'case_assigned',
              title: `Case #${row.id} assigned to you`,
              message: 'A new case has been assigned to you.',
              caseId: row.id,
              actionUrl: `/admin/cases/${row.id}`,
            });
          }
        } catch (err) {
          console.error('[admin-queue/bulk assign] notify failed', { req_id: req.id, err });
        }
      }
    } else if (action === 'status') {
      const r = await pool.query(
        `UPDATE cases SET status = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id, status`,
        [value, intIds],
      );
      updated = r.rowCount || 0;
      updatedRows = r.rows;
      for (const row of r.rows) {
        await advanceCaseTimeline(row.id, row.status, actorId);
        emitCaseStatusChanged(row.id, { caseId: row.id, newStatus: row.status });
      }
    } else if (action === 'priority') {
      const r = await pool.query(
        `UPDATE cases SET priority = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id`,
        [value, intIds],
      );
      updated = r.rowCount || 0;
      updatedRows = r.rows;
    } else {
      // action === 'snooze'
      const r = await pool.query(
        `UPDATE cases SET snoozed_until = $1, updated_at = NOW() WHERE id = ANY($2::int[]) RETURNING id`,
        [value, intIds],
      );
      updated = r.rowCount || 0;
      updatedRows = r.rows;
    }

    // Per-id audit rows so each affected case has its own targetId entry
    // with the before/after diff for that specific case.
    await Promise.all(
      updatedRows.map((row) => {
        const before = beforeMap.get(row.id);
        return logAudit({
          actorDiscordId: actorId,
          action: `bulk_${action}`,
          targetType: 'case',
          targetId: row.id,
          details: {
            field,
            from: before ? before[field] : null,
            to: value,
            bulk: true,
          },
        }).catch((e) => console.error('[admin-queue/bulk audit]', e));
      }),
    );
    return res.json({ updated });
  } catch (err) {
    console.error('[admin/cases/bulk]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

// Hover preview: condensed case summary
router.get('/cases/:id/preview', validate({ params: SnoozeIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
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
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Not found', requestId: req.id } });
    return res.json(r.rows[0]);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

export default router;
