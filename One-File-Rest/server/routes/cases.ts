import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { calculateComplianceScore } from '../services/compliance-score.js';
import { fireWebhook, buildNewCaseEmbed, buildStatusChangedEmbed, logAudit } from '../services/webhook.js';
import { createNotification, emitCaseStatusChanged } from '../services/notifications.js';
import { advanceCaseTimeline } from '../services/timeline.js';
import { statusToStage, STAGE_IDS, getStatusesForStage, type StageId } from '../../shared/stages.js';
import { validate } from '../middleware/index.js';
import {
  idParamSchema,
  caseStatusEnum,
  casePriorityEnum,
  caseOutcomeEnum,
  isoDateString,
  stageEnum,
  emptyQuerySchema, emptyParamsSchema
} from '../../shared/schemas.js';

const router = Router();

const ListQuery = z.object({
  stage: stageEnum.optional(),
  q: z.string().max(200).optional(),
}).strict();

const CreateCaseBody = z.object({
  accountUsername: z.string().trim().min(1).max(200),
  violationType: z.string().trim().min(1).max(120),
  violationDescription: z.string().max(5000).optional().nullable(),
  appealDeadline: isoDateString.optional().nullable(),
  totalGMV: z.coerce.number().nonnegative().optional(),
  faceVideosPosted: z.coerce.number().int().nonnegative().optional(),
  commissionFrozen: z.boolean().optional(),
  commissionFrozenAmount: z.coerce.number().nonnegative().optional(),
  accountPurchaseDate: isoDateString.optional().nullable(),
  wizard: z.record(z.string(), z.unknown()).optional(),
  selectedPlan: z.string().max(60).optional().nullable(),
}).strict();

const PatchCaseBody = z.object({
  status: caseStatusEnum.optional(),
  priority: casePriorityEnum.optional(),
  appealDeadline: isoDateString.nullable().optional(),
  outcome: caseOutcomeEnum.nullable().optional(),
  outcome_notes: z.string().max(5000).nullable().optional(),
}).strict();

router.get('/', validate({ query: ListQuery, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    const stageParam = String(req.query.stage || '').trim();
    const stageFilter = stageParam && (STAGE_IDS as readonly string[]).includes(stageParam)
      ? (stageParam as StageId) : null;
    const stageStatuses = stageFilter ? getStatusesForStage(stageFilter) : null;

    const conditions: string[] = ['1=1'];
    const values: (string | string[])[] = [];
    let p = 1;
    if (!isStaff) { conditions.push(`c.user_discord_id = $${p++}`); values.push(discordId!); }
    if (stageStatuses && stageStatuses.length) {
      conditions.push(`c.status = ANY($${p++}::text[])`);
      values.push(stageStatuses);
    }
    const q = String(req.query.q || '').trim();
    if (q) {
      conditions.push(`(c.id::text = $${p} OR c.account_username ILIKE $${p + 1} OR c.violation_type ILIKE $${p + 1})`);
      values.push(q, `%${q}%`);
      p += 2;
    }

    const result = await pool.query(
      `SELECT c.*, u.discord_username, s.name as staff_name, u.plan
         FROM cases c
         JOIN users u ON c.user_discord_id = u.discord_id
         LEFT JOIN staff s ON c.staff_assigned_id = s.discord_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.created_at DESC`,
      values
    );
    const rows = result.rows.map((r: { status: string; outcome?: string | null }) => ({ ...r, stage: statusToStage(r.status, r.outcome) }));
    return res.json(rows);
  } catch (err) {
    console.error('Error fetching cases:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch cases', requestId: req.id } });
  }
});

router.get('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    const whereClause = isStaff ? 'WHERE c.id = $1' : 'WHERE c.id = $1 AND c.user_discord_id = $2';
    const values = isStaff ? [id] : [id, discordId];

    const result = await pool.query(
      `SELECT c.*, u.discord_username, u.email, u.plan
       FROM cases c
       JOIN users u ON c.user_discord_id = u.discord_id
       ${whereClause}`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    const caseData = result.rows[0];

    let complianceScore = null;
    try { complianceScore = await calculateComplianceScore(parseInt(String(id))); } catch {}

    const [messagesResult, evidenceResult, onboardingResult, timelineResult] = await Promise.all([
      pool.query(`SELECT * FROM messages WHERE case_id = $1 ORDER BY created_at ASC`, [id]),
      pool.query(`SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`, [id]),
      pool.query(`SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1`, [id]),
      pool.query(
        `SELECT t.*, s.name AS owner_name
           FROM case_timeline t
           LEFT JOIN staff s ON t.created_by_discord_id = s.discord_id
          WHERE t.case_id = $1 ORDER BY t.id ASC`, [id]),
    ]);

    return res.json({
      ...caseData,
      complianceScore,
      messages: messagesResult.rows,
      evidence: evidenceResult.rows,
      onboarding: onboardingResult.rows[0] || null,
      timeline: timelineResult.rows,
    });
  } catch (err) {
    console.error('Error fetching case:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch case', requestId: req.id } });
  }
});

router.post('/', validate({ body: CreateCaseBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const discordId = req.user!.discord_id;
    const {
      accountUsername, violationType, violationDescription,
      appealDeadline, totalGMV, faceVideosPosted, commissionFrozen, commissionFrozenAmount, accountPurchaseDate,
      wizard,
    } = req.body;
    const frozenAmount = Number(
      commissionFrozenAmount ?? wizard?.metrics?.commissionFrozenAmount ?? 0
    ) || 0;
    const isFrozen = frozenAmount > 0 || commissionFrozen === true || wizard?.metrics?.commissionFrozen === true;

    const result = await pool.query(
      `INSERT INTO cases (
        user_discord_id, account_username, violation_type, violation_description,
        appeal_deadline, commission_frozen, status, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'normal', NOW(), NOW()) RETURNING *`,
      [discordId, accountUsername, violationType, violationDescription, appealDeadline || null, isFrozen]
    );
    const newCase = result.rows[0];

    const rawOnboarding = wizard || {};
    const violationAnswers = wizard?.violations || [];
    const metrics = wizard?.metrics || {};
    try {
      await Promise.all([
        pool.query(
          `INSERT INTO onboarding_data (
             case_id, user_discord_id, total_gmv, face_videos_posted,
             account_purchase_date, commission_frozen, prior_appeals,
             violation_specific_answers, raw_onboarding
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newCase.id, discordId,
            metrics.totalGMV ?? totalGMV ?? 0,
            metrics.faceVideos ?? faceVideosPosted ?? 0,
            wizard?.purchase?.accountPurchaseDate ?? accountPurchaseDate ?? null,
            isFrozen,
            JSON.stringify(wizard?.previousAppeals ? [wizard.previousAppeals] : []),
            JSON.stringify(violationAnswers),
            JSON.stringify(rawOnboarding),
          ]
        ),
        pool.query(
          `INSERT INTO case_timeline (case_id, stage_name, stage_status) VALUES
             ($1, 'Submitted', 'active'),
             ($1, 'In Review', 'pending'),
             ($1, 'Appeal Drafted', 'pending'),
             ($1, 'Appeal Sent', 'pending'),
             ($1, 'Awaiting TikTok', 'pending'),
             ($1, 'Resolved', 'pending')`,
          [newCase.id]
        ),
      ]);
    } catch (persistErr) {
      console.error('Case auxiliary persistence failed:', persistErr);
      return res.status(500).json({
        error: {
          code: 'internal',
          message: 'Case created but intake/timeline failed to save. Please contact support.',
          requestId: req.id,
          fields: { case_id: [String(newCase.id)] },
        },
      });
    }

    let complianceScore = null;
    try { complianceScore = await calculateComplianceScore(newCase.id); } catch {}

    const userRes = await pool.query('SELECT plan FROM users WHERE discord_id = $1', [discordId]);
    const plan = userRes.rows[0]?.plan;

    logAudit({
      actorDiscordId: discordId,
      action: 'case_created',
      targetType: 'case',
      targetId: newCase.id,
      details: { violation_type: violationType, account: accountUsername },
    }).catch(console.error);
    fireWebhook(discordId!, 'case_created', buildNewCaseEmbed({ ...newCase, plan }));

    return res.status(201).json({ ...newCase, complianceScore });
  } catch (err) {
    console.error('Error creating case:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to create case', requestId: req.id } });
  }
});

router.patch('/:id', validate({ params: idParamSchema, body: PatchCaseBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');
    const { status, priority, appealDeadline, outcome, outcome_notes } = req.body;

    const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    const oldCase = caseResult.rows[0];

    if (!isStaff && oldCase.user_discord_id !== discordId) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Unauthorized', requestId: req.id } });
    }
    if (!isStaff && (
      status !== undefined || priority !== undefined || outcome !== undefined || outcome_notes !== undefined
    )) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Only staff may change case status, priority, or outcome.', requestId: req.id } });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (isStaff && status !== undefined)        { updates.push(`status = $${p++}`); values.push(status); }
    if (isStaff && priority !== undefined)      { updates.push(`priority = $${p++}`); values.push(priority); }
    if (appealDeadline !== undefined)           { updates.push(`appeal_deadline = $${p++}`); values.push(appealDeadline); }
    if (isStaff && outcome !== undefined)       { updates.push(`outcome = $${p++}`); values.push(outcome); }
    if (isStaff && outcome_notes !== undefined) { updates.push(`outcome_notes = $${p++}`); values.push(outcome_notes); }
    if (updates.length === 0) {
      return res.status(400).json({ error: { code: 'bad_request', message: 'No updatable fields provided.', requestId: req.id } });
    }
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE cases SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );

    if (status && status !== oldCase.status) {
      fireWebhook(oldCase.user_discord_id, 'status_changed', buildStatusChangedEmbed({
        caseId: parseInt(String(id)), oldStatus: oldCase.status, newStatus: status,
        updatedBy: req.user!.discord_username,
      }));
    }
    if (outcome && ['won', 'denied'].includes(outcome)) {
      const diffHours = Math.round((Date.now() - new Date(oldCase.created_at).getTime()) / 3600000);
      fireWebhook(oldCase.user_discord_id, 'case_resolved', {
        color: outcome === 'won' ? 0x57F287 : 0xED4245,
        title: outcome === 'won' ? '✅ Case Resolved — Won!' : '❌ Case Resolved — Denied',
        fields: [
          { name: 'Case ID', value: `#${id}`, inline: true },
          { name: 'Outcome', value: outcome.toUpperCase(), inline: true },
          { name: 'Time Taken', value: `${diffHours} hours`, inline: true },
          { name: 'Notes', value: (outcome_notes || 'No notes').substring(0, 200), inline: false },
        ],
        footer: { text: 'TikTok Recovery Portal' },
      });
    }

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['status', 'priority', 'outcome', 'outcome_notes', 'appeal_deadline'] as const) {
      const next = (req.body as Record<string, unknown>)[k === 'appeal_deadline' ? 'appealDeadline' : k];
      if (next !== undefined && next !== oldCase[k]) diff[k] = { from: oldCase[k], to: next };
    }
    logAudit({
      actorDiscordId: discordId,
      action: 'case_updated',
      targetType: 'case',
      targetId: parseInt(String(id)),
      details: { diff },
    }).catch(console.error);

    if (status && status !== oldCase.status) {
      await advanceCaseTimeline(parseInt(String(id)), status, discordId ?? null, { source: 'manual', oldStatus: oldCase.status });
    }
    if (status && status !== oldCase.status && isStaff) {
      createNotification({
        userDiscordId: oldCase.user_discord_id,
        type: 'status_change',
        title: 'Case Status Updated',
        message: `Case #${id} moved to "${status.replace(/_/g, ' ')}"`,
        caseId: parseInt(String(id)),
        actionUrl: `/cases/${id}`,
      });
      const ESCALATED = ['escalated', 'awaiting_tiktok', 'response_received'];
      if (ESCALATED.includes(status) && oldCase.staff_assigned_id) {
        createNotification({
          userDiscordId: oldCase.staff_assigned_id,
          type: 'case_escalated',
          title: `Case #${id} → ${status.replace(/_/g, ' ')}`,
          message: 'Needs your attention.',
          caseId: parseInt(String(id)),
          actionUrl: `/admin/cases/${id}`,
        });
      }
      emitCaseStatusChanged(parseInt(String(id)), { caseId: parseInt(String(id)), oldStatus: oldCase.status, newStatus: status });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating case:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to update case', requestId: req.id } });
  }
});

router.delete('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user?.role || '');

    const caseResult = await pool.query('SELECT user_discord_id, status FROM cases WHERE id = $1', [id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    if (!isStaff && caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Unauthorized', requestId: req.id } });
    }

    await pool.query(`UPDATE cases SET status = 'closed', updated_at = NOW() WHERE id = $1`, [id]);
    logAudit({
      actorDiscordId: discordId,
      action: 'case_closed',
      targetType: 'case',
      targetId: parseInt(String(id)),
      details: { from: caseResult.rows[0].status, to: 'closed' },
    }).catch(console.error);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error closing case:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to close case', requestId: req.id } });
  }
});

router.get('/:id/compliance-score', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const score = await calculateComplianceScore(parseInt(String(req.params.id)));
    return res.json(score);
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch compliance score', requestId: req.id } });
  }
});

export default router;
