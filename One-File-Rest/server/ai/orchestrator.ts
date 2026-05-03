// "Ask Elite" orchestrator — agent loop with read-only tool calling.
//
// SSE protocol (see ai/types.ts → StreamEvent):
//   thread       → emitted once with the (possibly newly-created) thread_id
//   step         → about to call a tool
//   tool_result  → tool finished (with summary)
//   token        → final answer chunk (we deliver one big token in v1)
//   sources      → all citations
//   done         → final tally (tokens, ms)
//   error        → fatal problem
//
// Constraints:
//   - MAX_STEPS hard caps the agent loop so a runaway model can't burn $$.
//   - Per-thread token cap + per-staffer daily cap enforced before we even
//     start the loop. Both numbers come from env (sane defaults).
//   - Every tool call result is truncated by the tool itself; we still keep
//     the JSON we feed back to the model under ~10k chars per tool call.

import pool from '../db/client.js';
import { groqTool, type GroqToolMessage } from '../services/groq.js';
import { TOOLS, toolsForGroq, runTool } from './tools.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import type { Source, StreamEvent, ToolContext } from './types.js';

const MAX_STEPS = 6;
const PER_THREAD_TOKEN_CAP = parseInt(process.env.AI_PER_THREAD_TOKEN_CAP || '120000', 10);
const PER_STAFFER_DAILY_CAP = parseInt(process.env.AI_PER_STAFFER_DAILY_CAP || '500000', 10);
const MAX_TOOL_RESULT_CHARS = 10000;

export interface OrchestrateInput {
  question: string;
  threadId?: number;
  surface: 'web' | 'discord';
  staffDiscordId: string;
  staffRole: string;
  contextHint?: { caseId?: number; clientDiscordId?: string };
  isAborted?: () => boolean;
}

export type EmitFn = (e: StreamEvent) => void;

async function ensureThread(input: OrchestrateInput): Promise<{ id: number; total_tokens: number }> {
  if (input.threadId) {
    const r = (await pool.query(
      `SELECT id, owner_discord_id, total_tokens FROM ai_threads WHERE id = $1`,
      [input.threadId]
    )).rows[0];
    if (!r) throw new Error('thread not found');
    if (r.owner_discord_id !== input.staffDiscordId) throw new Error('thread access denied');
    return { id: r.id, total_tokens: r.total_tokens || 0 };
  }
  const title = input.question.slice(0, 80);
  const r = (await pool.query(
    `INSERT INTO ai_threads (owner_discord_id, title, surface)
     VALUES ($1, $2, $3) RETURNING id`,
    [input.staffDiscordId, title, input.surface]
  )).rows[0];
  return { id: r.id, total_tokens: 0 };
}

async function loadHistory(threadId: number): Promise<GroqToolMessage[]> {
  const rows = (await pool.query(
    `SELECT role, content, tool_calls FROM ai_messages WHERE thread_id = $1 ORDER BY created_at ASC LIMIT 30`,
    [threadId]
  )).rows;
  // We only feed back user/assistant pairs to the model — tool messages from
  // prior turns are too large and rarely useful. Fresh tool results for the
  // current turn are appended live during the loop.
  return rows
    .filter((r: any) => r.role === 'user' || r.role === 'assistant')
    .map((r: any) => ({ role: r.role, content: r.content }));
}

async function dailyTokensFor(staff: string): Promise<number> {
  const r = (await pool.query(
    `SELECT COALESCE(SUM(tokens_in + tokens_out), 0)::bigint AS t
       FROM ai_query_log WHERE staff_discord_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [staff]
  )).rows[0];
  return Number(r?.t || 0);
}

function summarizeToolResult(_name: string, res: any): string {
  if (!res?.ok) return `error: ${res?.error || 'unknown'}`;
  const c = res.data?.count;
  if (typeof c === 'number') return `${c} result${c === 1 ? '' : 's'}`;
  if (res.data?.case) return `case #${res.data.case.id}`;
  if (res.data?.client) return `client ${res.data.client.discord_username}`;
  if (res.data?.transcript) return `${res.data.transcript.length} message(s)`;
  if (res.data?.staff) return `${res.data.staff.length} staff`;
  if (res.data?.analysis) return `vision OK`;
  return 'ok';
}

// First-seen wins — preserves the order the *model* observed sources across
// successive tool calls, so its inline [#N] citations align with the rendered
// chip ordering. Hard cap raised to 40 so common multi-tool turns rarely run
// past the visible source list.
function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of sources) {
    const k = `${s.type}:${s.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.slice(0, 40);
}

export async function orchestrate(input: OrchestrateInput, emit: EmitFn): Promise<void> {
  const started = Date.now();
  const ctx: ToolContext = { staffDiscordId: input.staffDiscordId, staffRole: input.staffRole, surface: input.surface };

  // ── Per-staffer rate limit ──
  // Hard cap on queries-per-minute (default 20) to prevent a runaway loop or
  // a UI bug from spamming the orchestrator.
  const RATE_LIMIT_PER_MIN = parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '20', 10);
  const recentCount = Number((await pool.query(
    `SELECT COUNT(*)::int AS c FROM ai_query_log WHERE staff_discord_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
    [input.staffDiscordId]
  )).rows[0]?.c || 0);
  if (recentCount >= RATE_LIMIT_PER_MIN) {
    emit({ type: 'error', message: `Slow down — Ask Elite is capped at ${RATE_LIMIT_PER_MIN} queries/minute per staffer.` });
    return;
  }

  // Cost guardrails
  const dailyUsed = await dailyTokensFor(input.staffDiscordId);
  if (dailyUsed >= PER_STAFFER_DAILY_CAP) {
    emit({ type: 'error', message: `Daily AI token budget reached (${dailyUsed.toLocaleString()} / ${PER_STAFFER_DAILY_CAP.toLocaleString()}). Try again tomorrow.` });
    return;
  }

  const thread = await ensureThread(input);
  emit({ type: 'thread', thread_id: thread.id });

  if (thread.total_tokens >= PER_THREAD_TOKEN_CAP) {
    emit({ type: 'error', message: `This thread has reached its token budget (${thread.total_tokens.toLocaleString()} / ${PER_THREAD_TOKEN_CAP.toLocaleString()}). Start a new thread.` });
    return;
  }

  const history = await loadHistory(thread.id);

  // Persist the user's new turn immediately so it shows up in thread history
  // even if the orchestrator crashes mid-stream.
  await pool.query(
    `INSERT INTO ai_messages (thread_id, role, content) VALUES ($1, 'user', $2)`,
    [thread.id, input.question]
  );

  const userPreamble = input.contextHint
    ? `\n\n[Context hint: ${[
        input.contextHint.caseId ? `viewing case #${input.contextHint.caseId}` : '',
        input.contextHint.clientDiscordId ? `client ${input.contextHint.clientDiscordId}` : '',
      ].filter(Boolean).join(', ')}]`
    : '';

  const messages: GroqToolMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: input.question + userPreamble },
  ];

  const tools = toolsForGroq();
  const allSources: Source[] = [];
  const toolsUsed: string[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let finalAnswer = '';

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      // Cooperative cancellation: client disconnected → stop spending tokens.
      if (input.isAborted?.()) {
        emit({ type: 'error', message: 'cancelled by client' });
        return;
      }
      // Hard runtime cap: re-check budget each iteration so a long multi-step
      // turn can't blow past the daily/thread limit.
      if (totalIn + totalOut + thread.total_tokens >= PER_THREAD_TOKEN_CAP) {
        emit({ type: 'error', message: 'thread token cap reached mid-turn — stopping.' });
        return;
      }
      if (dailyUsed + totalIn + totalOut >= PER_STAFFER_DAILY_CAP) {
        emit({ type: 'error', message: 'daily token cap reached mid-turn — stopping.' });
        return;
      }

      const resp = await groqTool({ messages, tools, temperature: 0.2, maxTokens: 1500 });
      totalIn += resp.tokens_in;
      totalOut += resp.tokens_out;

      if (resp.tool_calls.length > 0) {
        // Push the assistant's tool-call turn into the convo so the model
        // can see its own plan when we feed back results.
        messages.push({
          role: 'assistant',
          content: resp.content || null,
          tool_calls: resp.tool_calls.map((c) => ({
            id: c.id, type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        });

        for (const call of resp.tool_calls) {
          emit({ type: 'step', tool: call.name, args: call.args });
          const result = await runTool(call.name, call.args, ctx);
          toolsUsed.push(call.name);
          if (result.sources) allSources.push(...result.sources);
          const summary = summarizeToolResult(call.name, result);
          emit({ type: 'tool_result', tool: call.name, ok: result.ok, summary });

          let payload = JSON.stringify(result);
          if (payload.length > MAX_TOOL_RESULT_CHARS) {
            payload = payload.slice(0, MAX_TOOL_RESULT_CHARS) + '...[truncated]';
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: payload });
        }
        continue; // ask the model again with tool results in context
      }

      // No more tool calls — this is the final answer.
      finalAnswer = resp.content || '';
      break;
    }

    if (!finalAnswer) {
      finalAnswer = 'I gathered the data but ran out of reasoning steps before composing a final answer. Please refine the question or break it into smaller parts.';
    }

    // ── Citation enforcement ──
    // If the model produced a factual answer with zero sources (no tool calls
    // ever fired), force one retry that explicitly tells it to ground via
    // tools or refuse. This catches "hallucinated" answers that bypass our
    // retrieval layer. Trivial / chitchat replies (under ~120 chars) skip
    // this guard.
    const looksFactual = finalAnswer.length > 120 && !/^(hi|hello|hey|sure|okay|ok|got it|thanks)/i.test(finalAnswer.trim());
    if (allSources.length === 0 && toolsUsed.length === 0 && looksFactual) {
      messages.push({ role: 'assistant', content: finalAnswer });
      messages.push({
        role: 'user',
        content: 'STOP. That answer cited zero portal data. You MUST call at least one tool (searchCases, getClientDossier, searchDiscord, etc.) before making factual claims about this organisation. Re-answer using tools, or — if no tool can answer it — say "I don\'t have data on that" and suggest where the staffer could look manually.',
      });
      const retry = await groqTool({ messages, tools, temperature: 0.2, maxTokens: 1500 });
      totalIn += retry.tokens_in;
      totalOut += retry.tokens_out;
      if (retry.tool_calls.length > 0) {
        messages.push({
          role: 'assistant', content: retry.content || null,
          tool_calls: retry.tool_calls.map((c) => ({
            id: c.id, type: 'function',
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          })),
        });
        for (const call of retry.tool_calls) {
          emit({ type: 'step', tool: call.name, args: call.args });
          const result = await runTool(call.name, call.args, ctx);
          toolsUsed.push(call.name);
          if (result.sources) allSources.push(...result.sources);
          emit({ type: 'tool_result', tool: call.name, ok: result.ok, summary: summarizeToolResult(call.name, result) });
          let payload = JSON.stringify(result);
          if (payload.length > MAX_TOOL_RESULT_CHARS) payload = payload.slice(0, MAX_TOOL_RESULT_CHARS) + '...[truncated]';
          messages.push({ role: 'tool', tool_call_id: call.id, content: payload });
        }
        const finalRetry = await groqTool({ messages, tools: [], temperature: 0.2, maxTokens: 1200 });
        totalIn += finalRetry.tokens_in;
        totalOut += finalRetry.tokens_out;
        finalAnswer = finalRetry.content || finalAnswer;
      } else {
        finalAnswer = retry.content || finalAnswer;
      }
    }

    const sources = dedupeSources(allSources);
    // Final guard: if there are still no sources and the model is asserting
    // facts, prepend a clear "ungrounded" warning so the staffer knows.
    if (sources.length === 0 && looksFactual) {
      finalAnswer = '⚠️ _No portal sources back this answer — treat as opinion only._\n\n' + finalAnswer;
    }
    emit({ type: 'sources', sources });
    emit({ type: 'token', text: finalAnswer });

    // Persist the assistant turn
    await pool.query(
      `INSERT INTO ai_messages (thread_id, role, content, sources, tool_calls, tokens_in, tokens_out)
       VALUES ($1, 'assistant', $2, $3, $4, $5, $6)`,
      [thread.id, finalAnswer, JSON.stringify(sources), JSON.stringify(toolsUsed), totalIn, totalOut]
    );
    await pool.query(
      `UPDATE ai_threads SET total_tokens = total_tokens + $1, updated_at = NOW() WHERE id = $2`,
      [totalIn + totalOut, thread.id]
    );

    const ms = Date.now() - started;
    await pool.query(
      `INSERT INTO ai_query_log (thread_id, staff_discord_id, surface, question, tools_called, tokens_in, tokens_out, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [thread.id, input.staffDiscordId, input.surface, input.question, toolsUsed, totalIn, totalOut, ms]
    );

    emit({ type: 'done', tokens_in: totalIn, tokens_out: totalOut, duration_ms: ms });
  } catch (err: any) {
    console.error('[ai.orchestrator] failed', err);
    const msg = err?.message || 'orchestrator failure';
    const ms = Date.now() - started;
    await pool.query(
      `INSERT INTO ai_query_log (thread_id, staff_discord_id, surface, question, tools_called, tokens_in, tokens_out, duration_ms, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [thread.id, input.staffDiscordId, input.surface, input.question, toolsUsed, totalIn, totalOut, ms, msg]
    ).catch(() => {});
    emit({ type: 'error', message: msg });
  }
}

// One-shot helper for non-streaming surfaces (Discord bot). Returns the final
// answer + sources after running the full agent loop.
export async function orchestrateOnce(input: OrchestrateInput): Promise<{
  answer: string; sources: Source[]; thread_id: number;
  tokens_in: number; tokens_out: number; tools: string[];
}> {
  let answer = '';
  let sources: Source[] = [];
  let thread_id = 0;
  let tokens_in = 0;
  let tokens_out = 0;
  const tools: string[] = [];
  let errored: string | null = null;

  await orchestrate(input, (e) => {
    if (e.type === 'thread') thread_id = e.thread_id;
    else if (e.type === 'token') answer += e.text;
    else if (e.type === 'sources') sources = e.sources;
    else if (e.type === 'step') tools.push(e.tool);
    else if (e.type === 'done') { tokens_in = e.tokens_in; tokens_out = e.tokens_out; }
    else if (e.type === 'error') errored = e.message;
  });
  if (errored) throw new Error(errored);
  return { answer, sources, thread_id, tokens_in, tokens_out, tools };
}

export const _stats = {
  toolCount: TOOLS.length,
  perThreadCap: PER_THREAD_TOKEN_CAP,
  perStafferDailyCap: PER_STAFFER_DAILY_CAP,
  maxSteps: MAX_STEPS,
};
