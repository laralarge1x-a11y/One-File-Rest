// "Ask Elite" HTTP surface:
//   POST   /api/ai/ask              → SSE stream (orchestrator)
//   GET    /api/ai/threads          → list staffer's threads
//   GET    /api/ai/threads/:id      → thread + messages
//   DELETE /api/ai/threads/:id      → delete thread (owner only)
//   GET    /api/ai/dossier/:caseId  → on-demand AI summary of a case
//   GET    /api/ai/usage            → today's per-staffer token spend + caps
//
// All routes are mounted behind requireStaff in server/index.ts.

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';
import { logAudit } from '../services/webhook.js';
import { orchestrate, orchestrateOnce, _stats } from '../ai/orchestrator.js';
import { validate } from '../middleware/index.js';

const router = Router();

const AskBody = z.object({
  question: z.string().min(2).max(8000),
  thread_id: z.coerce.number().int().positive().optional().nullable(),
  surface: z.enum(['web', 'discord']).optional(),
  context_hint: z.object({
    case_id: z.coerce.number().int().positive().optional(),
    client_discord_id: z.string().max(40).optional(),
  }).partial().optional(),
}).strict();
const ThreadIdParam = z.object({ id: z.coerce.number().int().positive() }).strict();
const ThreadPatchBody = z.object({
  title: z.string().max(200).optional(),
  pinned: z.boolean().optional(),
  shared_with: z.array(z.string().max(40)).max(25).optional(),
}).strict();
const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();

// ─── POST /ask  (SSE) ─────────────────────────────────────────────────────
router.post('/ask', validate({ body: AskBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  const { question, thread_id, surface, context_hint } = req.body;
  const staff = req.user!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (e: any) => {
    try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch {}
  };

  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);

  let aborted = false;
  req.on('close', () => { aborted = true; });

  const auditTools: string[] = [];
  const auditSources: Array<{ type: string; id: any; label: string }> = [];
  let auditThreadId: number | null = null;
  let auditAnswerPreview = '';
  const startedAt = Date.now();

  try {
    await orchestrate({
      question: question.trim(),
      threadId: thread_id ? Number(thread_id) : undefined,
      surface: (surface === 'discord' ? 'discord' : 'web'),
      staffDiscordId: staff.discord_id,
      staffRole: staff.role,
      contextHint: context_hint && typeof context_hint === 'object' ? {
        caseId: context_hint.case_id ? Number(context_hint.case_id) : undefined,
        clientDiscordId: context_hint.client_discord_id || undefined,
      } : undefined,
      isAborted: () => aborted,
    }, (e) => {
      if (e?.type === 'step' && e.tool) auditTools.push(String(e.tool));
      else if (e?.type === 'sources' && Array.isArray(e.sources)) {
        for (const s of e.sources.slice(0, 8)) auditSources.push({ type: s.type, id: s.id, label: s.label });
      } else if (e?.type === 'thread' && e.thread_id) auditThreadId = Number(e.thread_id);
      else if (e?.type === 'token' && typeof e.text === 'string') auditAnswerPreview = (auditAnswerPreview + e.text).slice(0, 240);
      if (!aborted) send(e);
    });

    if (auditThreadId) logAudit({
      actorDiscordId: staff.discord_id,
      action: 'ai_ask',
      targetType: 'ai_thread',
      targetId: auditThreadId,
      details: {
        request_id: req.id,
        surface: surface || 'web',
        q_preview: question.slice(0, 240),
        tools: auditTools,
        sources: auditSources,
        duration_ms: Date.now() - startedAt,
        answer_preview: auditAnswerPreview,
      },
    }).catch(() => {});
  } catch (err: any) {
    console.error('[ai/ask]', { req_id: req.id, err: err?.message });
    send({ type: 'error', message: 'ask failed' });
  } finally {
    clearInterval(hb);
    try { res.end(); } catch {}
  }
  return;
});

router.get('/threads', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const me = req.user!.discord_id;
    const rows = (await pool.query(
      `SELECT id, title, surface, total_tokens, owner_discord_id, shared_with, created_at, updated_at,
              (owner_discord_id = $1) AS is_owner,
              (SELECT COUNT(*) FROM ai_messages m WHERE m.thread_id = t.id)::int AS message_count
         FROM ai_threads t
         WHERE owner_discord_id = $1
            OR $1 = ANY(COALESCE(shared_with, ARRAY[]::text[]))
         ORDER BY updated_at DESC LIMIT 50`,
      [me]
    )).rows;
    return res.json({ threads: rows });
  } catch (err: any) {
    console.error('[ai/threads]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

router.get('/threads/:id', validate({ params: ThreadIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const me = req.user!.discord_id;
    const t = (await pool.query(
      `SELECT * FROM ai_threads
         WHERE id = $1
           AND (owner_discord_id = $2 OR $2 = ANY(COALESCE(shared_with, ARRAY[]::text[])))`,
      [id, me]
    )).rows[0];
    if (!t) return res.status(404).json({ error: { code: 'not_found', message: 'not found', requestId: req.id } });
    const messages = (await pool.query(
      `SELECT id, role, content, sources, tool_calls, tokens_in, tokens_out, created_at
         FROM ai_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [id]
    )).rows;
    return res.json({ thread: t, messages, viewer_role: t.owner_discord_id === me ? 'owner' : 'shared' });
  } catch (err: any) {
    console.error('[ai/threads/:id]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

router.patch('/threads/:id', validate({ params: ThreadIdParam, body: ThreadPatchBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title, pinned, shared_with } = req.body;
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (typeof title === 'string') { sets.push(`title = $${i++}`); params.push(title.slice(0, 200)); }
    if (typeof pinned === 'boolean') { sets.push(`pinned = $${i++}`); params.push(pinned); }
    if (Array.isArray(shared_with)) { sets.push(`shared_with = $${i++}`); params.push(shared_with.slice(0, 25).map(String)); }
    if (sets.length === 0) return res.status(400).json({ error: { code: 'bad_request', message: 'no fields to update', requestId: req.id } });
    const beforeR = await pool.query(
      `SELECT title, pinned, shared_with FROM ai_threads WHERE id = $1 AND owner_discord_id = $2`,
      [id, req.user!.discord_id]
    );
    if (beforeR.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'not found or not owner', requestId: req.id } });
    params.push(id, req.user!.discord_id);
    const r = await pool.query(
      `UPDATE ai_threads SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${i++} AND owner_discord_id = $${i} RETURNING *`,
      params
    );
    const after = r.rows[0];
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['title', 'pinned', 'shared_with'] as const) {
      const incoming = (req.body as Record<string, unknown>)[k];
      if (incoming !== undefined && JSON.stringify(beforeR.rows[0][k]) !== JSON.stringify(after[k])) {
        diff[k] = { from: beforeR.rows[0][k], to: after[k] };
      }
    }
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'ai_thread_updated',
      targetType: 'ai_thread',
      targetId: id,
      details: { diff },
    }).catch(console.error);
    return res.json({ thread: after });
  } catch (err: any) {
    console.error('[ai/threads PATCH]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

router.delete('/threads/:id', validate({ params: ThreadIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const beforeR = await pool.query(
      `SELECT title, pinned FROM ai_threads WHERE id = $1 AND owner_discord_id = $2`,
      [id, req.user!.discord_id]
    );
    const r = await pool.query(
      `DELETE FROM ai_threads WHERE id = $1 AND owner_discord_id = $2`,
      [id, req.user!.discord_id]
    );
    if (r.rowCount && beforeR.rows[0]) {
      logAudit({
        actorDiscordId: req.user!.discord_id,
        action: 'ai_thread_deleted',
        targetType: 'ai_thread',
        targetId: id,
        details: { from: beforeR.rows[0], to: null },
      }).catch(console.error);
    }
    return res.json({ deleted: r.rowCount });
  } catch (err: any) {
    console.error('[ai/threads DELETE]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

router.get('/dossier/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    const result = await orchestrateOnce({
      question:
        `Build an executive dossier for case #${caseId}. Cover: client identity, violation, current stage and next required action, deadline risk, evidence completeness, what the client has said in portal vs Discord, prior similar wins, and the recommended next step. Keep it under 250 words.`,
      surface: 'web',
      staffDiscordId: req.user!.discord_id,
      staffRole: req.user!.role,
      contextHint: { caseId },
    });
    return res.json({ case_id: caseId, ...result });
  } catch (err: any) {
    console.error('[ai/dossier]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'dossier failed', requestId: req.id } });
  }
});

router.get('/usage', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const today = (await pool.query(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0)::int AS tokens,
              COUNT(*)::int AS queries,
              COALESCE(AVG(duration_ms), 0)::int AS avg_ms
         FROM ai_query_log
         WHERE staff_discord_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.user!.discord_id]
    )).rows[0];
    const allTime = (await pool.query(
      `SELECT staff_discord_id, COUNT(*)::int AS queries,
              COALESCE(SUM(tokens_in + tokens_out), 0)::int AS tokens
         FROM ai_query_log WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY staff_discord_id ORDER BY tokens DESC LIMIT 10`
    )).rows;
    return res.json({
      me: today,
      caps: { per_thread: _stats.perThreadCap, daily: _stats.perStafferDailyCap, max_steps: _stats.maxSteps },
      tools_available: _stats.toolCount,
      top_users_7d: allTime,
    });
  } catch (err: any) {
    console.error('[ai/usage]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

export default router;
