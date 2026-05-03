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
import pool from '../db/client.js';
import { logAudit } from '../services/webhook.js';
import { orchestrate, orchestrateOnce, _stats } from '../ai/orchestrator.js';

const router = Router();

// ─── POST /ask  (SSE) ─────────────────────────────────────────────────────
router.post('/ask', async (req: Request, res: Response) => {
  const { question, thread_id, surface, context_hint } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length < 2) {
    return res.status(400).json({ error: 'question required (min 2 chars)' });
  }
  const staff = req.user!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (e: any) => {
    try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch {}
  };

  // Heartbeat every 15s so proxies don't kill the connection.
  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);

  // If the client disconnects mid-stream, abandon work after current step.
  let aborted = false;
  req.on('close', () => { aborted = true; });

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
      if (!aborted) send(e);
    });

    logAudit({
      actorDiscordId: staff.discord_id,
      action: 'ai_ask',
      targetType: 'ai_thread',
      details: { surface: surface || 'web', q_preview: question.slice(0, 120) },
    }).catch(() => {});
  } catch (err: any) {
    send({ type: 'error', message: err?.message || 'ask failed' });
  } finally {
    clearInterval(hb);
    try { res.end(); } catch {}
  }
});

// ─── GET /threads ─────────────────────────────────────────────────────────
router.get('/threads', async (req: Request, res: Response) => {
  try {
    const rows = (await pool.query(
      `SELECT id, title, surface, total_tokens, created_at, updated_at,
              (SELECT COUNT(*) FROM ai_messages m WHERE m.thread_id = t.id)::int AS message_count
         FROM ai_threads t WHERE owner_discord_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [req.user!.discord_id]
    )).rows;
    res.json({ threads: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

// ─── GET /threads/:id ─────────────────────────────────────────────────────
router.get('/threads/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const t = (await pool.query(
      `SELECT * FROM ai_threads WHERE id = $1 AND owner_discord_id = $2`,
      [id, req.user!.discord_id]
    )).rows[0];
    if (!t) return res.status(404).json({ error: 'not found' });
    const messages = (await pool.query(
      `SELECT id, role, content, sources, tool_calls, tokens_in, tokens_out, created_at
         FROM ai_messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [id]
    )).rows;
    res.json({ thread: t, messages });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

// ─── PATCH /threads/:id  (rename / pin / share) ──────────────────────────
router.patch('/threads/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { title, pinned, shared_with } = req.body || {};
    const sets: string[] = []; const params: any[] = []; let i = 1;
    if (typeof title === 'string') { sets.push(`title = $${i++}`); params.push(title.slice(0, 200)); }
    if (typeof pinned === 'boolean') { sets.push(`pinned = $${i++}`); params.push(pinned); }
    if (Array.isArray(shared_with)) { sets.push(`shared_with = $${i++}`); params.push(shared_with.slice(0, 25).map(String)); }
    if (sets.length === 0) return res.status(400).json({ error: 'no fields to update' });
    params.push(id, req.user!.discord_id);
    const r = await pool.query(
      `UPDATE ai_threads SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${i++} AND owner_discord_id = $${i} RETURNING *`,
      params
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found or not owner' });
    res.json({ thread: r.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

// ─── DELETE /threads/:id ──────────────────────────────────────────────────
router.delete('/threads/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(
      `DELETE FROM ai_threads WHERE id = $1 AND owner_discord_id = $2`,
      [id, req.user!.discord_id]
    );
    res.json({ deleted: r.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

// ─── GET /dossier/:caseId ─────────────────────────────────────────────────
// One-shot AI summary of a case — runs the orchestrator in non-streaming mode
// with a fixed prompt. Used on the case workspace as an "AI brief" panel.
router.get('/dossier/:caseId', async (req: Request, res: Response) => {
  try {
    const caseId = Number(req.params.caseId);
    if (!Number.isFinite(caseId)) return res.status(400).json({ error: 'caseId required' });
    const result = await orchestrateOnce({
      question:
        `Build an executive dossier for case #${caseId}. Cover: client identity, violation, current stage and next required action, deadline risk, evidence completeness, what the client has said in portal vs Discord, prior similar wins, and the recommended next step. Keep it under 250 words.`,
      surface: 'web',
      staffDiscordId: req.user!.discord_id,
      staffRole: req.user!.role,
      contextHint: { caseId },
    });
    res.json({ case_id: caseId, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'dossier failed' });
  }
});

// ─── GET /usage ───────────────────────────────────────────────────────────
router.get('/usage', async (req: Request, res: Response) => {
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
    res.json({
      me: today,
      caps: { per_thread: _stats.perThreadCap, daily: _stats.perStafferDailyCap, max_steps: _stats.maxSteps },
      tools_available: _stats.toolCount,
      top_users_7d: allTime,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

export default router;
