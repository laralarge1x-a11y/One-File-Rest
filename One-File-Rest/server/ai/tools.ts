// Read-only retrieval tools for the "Ask Elite" omniscient assistant.
// Every tool returns a ToolResult with structured `data` for the model and
// a parallel `sources` array for citation rendering. Tools MUST NOT mutate.
//
// Conventions:
//   - All limits are clamped (max 25) to keep prompts cheap.
//   - All long text is truncated to ~600 chars per record before being fed
//     back to the model.
//   - Deep links use process.env.PORTAL_URL.

import pool from '../db/client.js';
import { groqVision } from '../services/groq.js';
import type { ToolDef, ToolResult, Source, ToolContext } from './types.js';
import type { GroqToolDef } from '../services/groq.js';

const PORTAL_URL = process.env.PORTAL_URL || 'https://one-file-rest.replit.app';

function clamp(n: any, def: number, max: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(v, max);
}

function trunc(s: string | null | undefined, n = 600): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function caseUrl(id: number) { return `${PORTAL_URL}/admin/cases/${id}`; }
function clientUrl(id: number | string) { return `${PORTAL_URL}/admin/clients/${id}`; }
function kbUrl(slug: string) { return `${PORTAL_URL}/kb/${slug}`; }

// ─── searchCases ──────────────────────────────────────────────────────────
const searchCases: ToolDef = {
  name: 'searchCases',
  description:
    'Search cases by status, client, violation type, or free-text. Returns a brief summary per case (id, status, violation, client, deadline). Use this to find cases by topic or filter; for full detail call getCase.',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Optional case status filter (pending|intake|profile_built|appeal_drafted|appeal_submitted|awaiting_tiktok|response_received|won|denied|escalated|closed).' },
      client_discord_id: { type: 'string', description: 'Optional client Discord snowflake.' },
      client_query: { type: 'string', description: 'Optional client name/username ILIKE — matches users.discord_username and cases.account_username.' },
      violation_type: { type: 'string', description: 'Optional violation_type ILIKE filter.' },
      query: { type: 'string', description: 'Optional free-text search across description / notes / account username.' },
      open_only: { type: 'boolean', description: 'When true, exclude won/denied/closed.' },
      created_after_days: { type: 'integer', description: 'Only cases created in the last N days.' },
      created_before_days: { type: 'integer', description: 'Only cases created MORE than N days ago.' },
      updated_within_days: { type: 'integer', description: 'Only cases updated in the last N days.' },
      no_reply_days: { type: 'integer', description: 'Only cases where the client (sender_type=client) has not posted a portal message in the last N days.' },
      deadline_within_days: { type: 'integer', description: 'Only cases whose appeal_deadline is within the next N days (and not past).' },
      assigned_staff_id: { type: 'string', description: 'Optional staff Discord ID to filter by case owner.' },
      limit: { type: 'integer', description: 'Max results, default 10, hard cap 25.' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 10, 25);
    const where: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (a.status) { where.push(`c.status = $${i++}`); params.push(a.status); }
    if (a.client_discord_id) { where.push(`c.user_discord_id = $${i++}`); params.push(a.client_discord_id); }
    if (a.client_query) {
      where.push(`(u.discord_username ILIKE $${i} OR c.account_username ILIKE $${i})`);
      params.push(`%${a.client_query}%`); i++;
    }
    if (a.violation_type) { where.push(`c.violation_type ILIKE $${i++}`); params.push(`%${a.violation_type}%`); }
    if (a.query) {
      where.push(`(c.violation_description ILIKE $${i} OR c.account_username ILIKE $${i} OR c.internal_notes ILIKE $${i} OR c.outcome_notes ILIKE $${i})`);
      params.push(`%${a.query}%`); i++;
    }
    if (a.open_only) where.push(`c.status NOT IN ('won','denied','closed')`);
    if (a.created_after_days) { where.push(`c.created_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.created_after_days)); }
    if (a.created_before_days) { where.push(`c.created_at < NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.created_before_days)); }
    if (a.updated_within_days) { where.push(`c.updated_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.updated_within_days)); }
    if (a.deadline_within_days) {
      where.push(`c.appeal_deadline IS NOT NULL AND c.appeal_deadline <= NOW() + ($${i++}::int * INTERVAL '1 day') AND c.appeal_deadline >= NOW()`);
      params.push(Number(a.deadline_within_days));
    }
    if (a.assigned_staff_id) { where.push(`c.staff_assigned_id = $${i++}`); params.push(a.assigned_staff_id); }
    if (a.no_reply_days) {
      where.push(`NOT EXISTS (SELECT 1 FROM messages m WHERE m.case_id = c.id AND m.sender_type = 'client' AND m.created_at > NOW() - ($${i++}::int * INTERVAL '1 day'))`);
      params.push(Number(a.no_reply_days));
    }
    const sql = `
      SELECT c.id, c.user_discord_id, u.discord_username, c.account_username,
             c.violation_type, c.status, c.priority, c.appeal_deadline,
             c.staff_assigned_id, c.created_at, c.updated_at, LEFT(c.violation_description, 300) AS desc,
             (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.case_id = c.id AND m2.sender_type = 'client') AS last_client_reply_at
        FROM cases c
        LEFT JOIN users u ON u.discord_id = c.user_discord_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY c.updated_at DESC
        LIMIT ${limit}`;
    const rows = (await pool.query(sql, params)).rows;
    const sources: Source[] = rows.map((r: any) => ({
      type: 'case', id: r.id,
      label: `Case #${r.id} · ${r.violation_type || 'Violation'} · @${r.account_username || r.discord_username || '—'}`,
      url: caseUrl(r.id),
      snippet: trunc(r.desc, 200),
    }));
    return { ok: true, data: { count: rows.length, cases: rows.map((r: any) => ({ ...r, desc: trunc(r.desc, 200) })) }, sources };
  },
};

// ─── getCase ──────────────────────────────────────────────────────────────
const getCase: ToolDef = {
  name: 'getCase',
  description: 'Fetch a complete case dossier: core fields, timeline, checklist, evidence list, onboarding answers, internal notes, latest portal messages, latest compliance score.',
  parameters: {
    type: 'object',
    required: ['case_id'],
    properties: {
      case_id: { type: 'integer' },
      include_messages: { type: 'boolean', description: 'Include last 8 portal messages (default true).' },
    },
  },
  handler: async (a) => {
    const id = Number(a.case_id);
    if (!Number.isFinite(id)) return { ok: false, error: 'case_id required' };
    const c = (await pool.query(
      `SELECT c.*, u.discord_username, u.plan, u.plan_expiry
         FROM cases c LEFT JOIN users u ON u.discord_id = c.user_discord_id
         WHERE c.id = $1`, [id])).rows[0];
    if (!c) return { ok: false, error: `case #${id} not found` };
    const [timeline, checklist, evidence, onb, notes, msgs, score] = await Promise.all([
      pool.query(`SELECT stage_name, stage_status, notes, created_at, completed_at FROM case_timeline WHERE case_id = $1 ORDER BY created_at`, [id]),
      pool.query(`SELECT label, stage, required, completed, completed_at FROM case_checklist_items WHERE case_id = $1 ORDER BY sort_order, id`, [id]),
      pool.query(`SELECT id, file_name, file_type, file_url, description, ai_analysis, uploaded_at FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC LIMIT 25`, [id]),
      pool.query(`SELECT * FROM onboarding_data WHERE case_id = $1 LIMIT 1`, [id]),
      pool.query(`SELECT note, staff_discord_id, created_at FROM internal_notes WHERE case_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]),
      a.include_messages !== false
        ? pool.query(`SELECT sender_type, sender_discord_id, content, created_at FROM messages WHERE case_id = $1 ORDER BY created_at DESC LIMIT 8`, [id])
        : { rows: [] },
      pool.query(`SELECT score, grade, trend, factors, recommendations, created_at FROM compliance_scores WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    ]);
    const sources: Source[] = [{
      type: 'case', id,
      label: `Case #${id} · ${c.violation_type || 'Violation'}`,
      url: caseUrl(id),
      snippet: trunc(c.violation_description, 200),
    }];
    for (const e of evidence.rows) {
      sources.push({ type: 'evidence', id: e.id, label: e.file_name || `Evidence #${e.id}`, url: e.file_url, snippet: trunc(e.description || e.ai_analysis, 160) });
    }
    return {
      ok: true,
      data: {
        case: { ...c, violation_description: trunc(c.violation_description, 800), internal_notes: trunc(c.internal_notes, 600), outcome_notes: trunc(c.outcome_notes, 600) },
        timeline: timeline.rows,
        checklist: checklist.rows,
        evidence: evidence.rows.map((e: any) => ({ ...e, description: trunc(e.description, 200), ai_analysis: trunc(e.ai_analysis, 200) })),
        onboarding: onb.rows[0] || null,
        internal_notes: notes.rows.map((n: any) => ({ ...n, note: trunc(n.note, 400) })),
        recent_messages: msgs.rows.map((m: any) => ({ ...m, content: trunc(m.content, 300) })),
        compliance: score.rows[0] || null,
      },
      sources,
    };
  },
};

// ─── searchPortalMessages ─────────────────────────────────────────────────
const searchPortalMessages: ToolDef = {
  name: 'searchPortalMessages',
  description: 'Search messages exchanged inside the portal (between client and staff/AI). Filter by case or sender, free-text query.',
  parameters: {
    type: 'object',
    properties: {
      case_id: { type: 'integer' },
      sender_discord_id: { type: 'string' },
      sender_type: { type: 'string', description: 'client|staff|ai|system' },
      query: { type: 'string' },
      since_days: { type: 'integer', description: 'Only messages from the last N days.' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 15, 25);
    const where: string[] = []; const params: any[] = []; let i = 1;
    if (a.case_id) { where.push(`m.case_id = $${i++}`); params.push(a.case_id); }
    if (a.sender_discord_id) { where.push(`m.sender_discord_id = $${i++}`); params.push(a.sender_discord_id); }
    if (a.sender_type) { where.push(`m.sender_type = $${i++}`); params.push(a.sender_type); }
    if (a.query) { where.push(`m.content ILIKE $${i++}`); params.push(`%${a.query}%`); }
    if (a.since_days) { where.push(`m.created_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.since_days)); }
    const sql = `
      SELECT m.id, m.case_id, m.sender_discord_id, m.sender_type, m.content, m.created_at,
             u.discord_username AS sender_username
        FROM messages m
        LEFT JOIN users u ON u.discord_id = m.sender_discord_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.created_at DESC
        LIMIT ${limit}`;
    const rows = (await pool.query(sql, params)).rows;
    const sources: Source[] = rows.map((m: any) => ({
      type: 'message', id: m.id,
      label: `Msg ${m.sender_type} → case #${m.case_id} · ${new Date(m.created_at).toISOString().slice(0, 10)}`,
      url: m.case_id ? caseUrl(m.case_id) : undefined,
      snippet: trunc(m.content, 160),
    }));
    return { ok: true, data: { count: rows.length, messages: rows.map((m: any) => ({ ...m, content: trunc(m.content, 400) })) }, sources };
  },
};

// ─── searchDiscord ────────────────────────────────────────────────────────
const searchDiscord: ToolDef = {
  name: 'searchDiscord',
  description: 'Search the indexed Discord transcripts (private customer channels and tickets). Filter by channel, author, free-text, or recency.',
  parameters: {
    type: 'object',
    properties: {
      channel_id: { type: 'string' },
      author_discord_id: { type: 'string' },
      query: { type: 'string' },
      since_days: { type: 'integer' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 15, 25);
    const where: string[] = ['(deleted_at IS NULL)']; const params: any[] = []; let i = 1;
    if (a.channel_id) { where.push(`channel_id = $${i++}`); params.push(a.channel_id); }
    if (a.author_discord_id) { where.push(`author_discord_id = $${i++}`); params.push(a.author_discord_id); }
    if (a.query) { where.push(`content ILIKE $${i++}`); params.push(`%${a.query}%`); }
    if (a.since_days) { where.push(`created_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.since_days)); }
    const sql = `
      SELECT id, channel_id, guild_id, author_discord_id, author_username, is_bot, content, created_at, edited_at, attachments
        FROM discord_messages
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ${limit}`;
    const rows = (await pool.query(sql, params)).rows;
    const sources: Source[] = rows.map((d: any) => ({
      type: 'discord', id: String(d.id),
      label: `Discord · ${d.author_username || d.author_discord_id} · ${new Date(d.created_at).toISOString().slice(0, 16).replace('T', ' ')}`,
      url: d.guild_id ? `https://discord.com/channels/${d.guild_id}/${d.channel_id}/${d.id}` : undefined,
      snippet: trunc(d.content, 160),
    }));
    return { ok: true, data: { count: rows.length, messages: rows.map((d: any) => ({ ...d, id: String(d.id), content: trunc(d.content, 400) })) }, sources };
  },
};

// ─── getDiscordTranscript ─────────────────────────────────────────────────
const getDiscordTranscript: ToolDef = {
  name: 'getDiscordTranscript',
  description: 'Get the most recent N messages from a Discord channel as a transcript. Use this to read a customer\'s ticket history end-to-end.',
  parameters: {
    type: 'object',
    required: ['channel_id'],
    properties: {
      channel_id: { type: 'string' },
      limit: { type: 'integer', description: 'Default 25, max 50.' },
    },
  },
  handler: async (a) => {
    const limit = Math.min(clamp(a.limit, 25, 50), 50);
    const rows = (await pool.query(
      `SELECT id, guild_id, author_username, author_discord_id, is_bot, content, created_at
         FROM discord_messages
         WHERE channel_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT ${limit}`,
      [a.channel_id]
    )).rows.reverse();
    const guildId = rows[0]?.guild_id;
    const sources: Source[] = [{
      type: 'discord', id: a.channel_id,
      label: `Discord channel ${a.channel_id} · last ${rows.length} messages`,
      url: guildId ? `https://discord.com/channels/${guildId}/${a.channel_id}` : undefined,
    }];
    return { ok: true, data: { count: rows.length, transcript: rows.map((r: any) => ({ ...r, id: String(r.id), content: trunc(r.content, 400) })) }, sources };
  },
};

// ─── searchClients ────────────────────────────────────────────────────────
const searchClients: ToolDef = {
  name: 'searchClients',
  description: 'Find clients by Discord username, ID, plan, or activity. Returns plan, expiry, case counts.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'ILIKE on discord_username or email.' },
      plan: { type: 'string' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 10, 25);
    const where: string[] = [`u.role = 'client' OR u.role IS NULL OR u.role NOT IN ('owner','admin','case_manager','support')`];
    const params: any[] = []; let i = 1;
    if (a.query) { where.push(`(u.discord_username ILIKE $${i} OR u.email ILIKE $${i} OR u.discord_id = $${i+1})`); params.push(`%${a.query}%`); params.push(a.query); i += 2; }
    if (a.plan) { where.push(`u.plan = $${i++}`); params.push(a.plan); }
    const sql = `
      SELECT u.id, u.discord_id, u.discord_username, u.email, u.plan, u.plan_expiry,
             u.discord_channel_id, u.created_at, u.last_active,
             (SELECT COUNT(*) FROM cases WHERE user_discord_id = u.discord_id)::int AS total_cases,
             (SELECT COUNT(*) FROM cases WHERE user_discord_id = u.discord_id AND status NOT IN ('won','denied','closed'))::int AS open_cases
        FROM users u
        WHERE (${where[0]})${where.length > 1 ? ' AND ' + where.slice(1).join(' AND ') : ''}
        ORDER BY u.last_active DESC NULLS LAST
        LIMIT ${limit}`;
    const rows = (await pool.query(sql, params)).rows;
    const sources: Source[] = rows.map((u: any) => ({
      type: 'client', id: u.id,
      label: `${u.discord_username} · ${u.plan || 'no plan'} · ${u.open_cases} open / ${u.total_cases} total`,
      url: clientUrl(u.id),
    }));
    return { ok: true, data: { count: rows.length, clients: rows }, sources };
  },
};

// ─── getClient ────────────────────────────────────────────────────────────
const getClient: ToolDef = {
  name: 'getClient',
  description: 'Full client profile: plan, all cases (latest 10), assigned channel, total spend signals, recent activity.',
  parameters: {
    type: 'object',
    properties: {
      discord_id: { type: 'string' },
      user_id: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const u = (a.discord_id
      ? await pool.query(`SELECT * FROM users WHERE discord_id = $1`, [a.discord_id])
      : await pool.query(`SELECT * FROM users WHERE id = $1`, [a.user_id])).rows[0];
    if (!u) return { ok: false, error: 'client not found' };
    const [cases, subs, tiktokAccts] = await Promise.all([
      pool.query(`SELECT id, violation_type, status, priority, appeal_deadline, created_at, account_username, outcome
                    FROM cases WHERE user_discord_id = $1 ORDER BY created_at DESC LIMIT 10`, [u.discord_id]),
      pool.query(`SELECT plan, status, start_date, end_date FROM subscriptions WHERE user_discord_id = $1 ORDER BY start_date DESC LIMIT 5`, [u.discord_id]),
      pool.query(`SELECT username, account_url, is_primary FROM tiktok_accounts WHERE user_discord_id = $1`, [u.discord_id]),
    ]);
    const sources: Source[] = [{ type: 'client', id: u.id, label: `${u.discord_username} (${u.discord_id})`, url: clientUrl(u.id) }];
    for (const c of cases.rows) sources.push({ type: 'case', id: c.id, label: `Case #${c.id} · ${c.status}`, url: caseUrl(c.id) });
    return {
      ok: true,
      data: { client: u, recent_cases: cases.rows, subscriptions: subs.rows, tiktok_accounts: tiktokAccts.rows },
      sources,
    };
  },
};

// ─── searchKB ─────────────────────────────────────────────────────────────
const searchKB: ToolDef = {
  name: 'searchKB',
  description: 'Search the knowledge base by title/body/tags.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      category: { type: 'string' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 5, 15);
    const where: string[] = ['published = true']; const params: any[] = []; let i = 1;
    if (a.query) { where.push(`(title ILIKE $${i} OR body_md ILIKE $${i} OR $${i+1} = ANY(tags))`); params.push(`%${a.query}%`); params.push(a.query); i += 2; }
    if (a.category) { where.push(`category = $${i++}`); params.push(a.category); }
    const rows = (await pool.query(
      `SELECT id, slug, title, category, tags, LEFT(body_md, 400) AS excerpt
         FROM kb_articles WHERE ${where.join(' AND ')}
         ORDER BY view_count DESC NULLS LAST, updated_at DESC LIMIT ${limit}`,
      params
    )).rows;
    const sources: Source[] = rows.map((k: any) => ({ type: 'kb', id: k.id, label: `KB · ${k.title}`, url: kbUrl(k.slug), snippet: trunc(k.excerpt, 200) }));
    return { ok: true, data: { count: rows.length, articles: rows }, sources };
  },
};

// ─── getKBArticle ─────────────────────────────────────────────────────────
const getKBArticle: ToolDef = {
  name: 'getKBArticle',
  description: 'Fetch full body of a KB article by slug.',
  parameters: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } },
  handler: async (a) => {
    const r = (await pool.query(`SELECT id, slug, title, category, tags, body_md FROM kb_articles WHERE slug = $1`, [a.slug])).rows[0];
    if (!r) return { ok: false, error: `KB article '${a.slug}' not found` };
    return { ok: true, data: { ...r, body_md: trunc(r.body_md, 2400) }, sources: [{ type: 'kb', id: r.id, label: `KB · ${r.title}`, url: kbUrl(r.slug) }] };
  },
};

// ─── searchTemplates ──────────────────────────────────────────────────────
const searchTemplates: ToolDef = {
  name: 'searchTemplates',
  description: 'Search appeal templates by violation type, tag, or text. Returns template summaries with win-rate.',
  parameters: {
    type: 'object',
    properties: {
      violation_type: { type: 'string' },
      query: { type: 'string' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 5, 15);
    const where: string[] = ['active = true']; const params: any[] = []; let i = 1;
    if (a.violation_type) { where.push(`violation_type ILIKE $${i++}`); params.push(`%${a.violation_type}%`); }
    if (a.query) { where.push(`(template_name ILIKE $${i} OR template_body ILIKE $${i})`); params.push(`%${a.query}%`); i++; }
    const rows = (await pool.query(
      `SELECT id, template_name, violation_type, category, tags, win_rate, use_count, LEFT(template_body, 400) AS excerpt
         FROM appeal_templates WHERE ${where.join(' AND ')}
         ORDER BY win_rate DESC NULLS LAST, use_count DESC LIMIT ${limit}`, params
    )).rows;
    const sources: Source[] = rows.map((t: any) => ({ type: 'template', id: t.id, label: `Template · ${t.template_name} (win ${t.win_rate ?? '–'}%)`, url: `${PORTAL_URL}/admin/templates`, snippet: trunc(t.excerpt, 200) }));
    return { ok: true, data: { count: rows.length, templates: rows }, sources };
  },
};

// ─── searchAuditLog ───────────────────────────────────────────────────────
const searchAuditLog: ToolDef = {
  name: 'searchAuditLog',
  description: 'Inspect the audit log: who did what, when. Filter by actor, action keyword, target, recency.',
  parameters: {
    type: 'object',
    properties: {
      actor_discord_id: { type: 'string' },
      action: { type: 'string', description: 'ILIKE filter on action.' },
      target_type: { type: 'string' },
      target_id: { type: 'integer' },
      since_days: { type: 'integer' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 15, 25);
    const where: string[] = []; const params: any[] = []; let i = 1;
    if (a.actor_discord_id) { where.push(`actor_discord_id = $${i++}`); params.push(a.actor_discord_id); }
    if (a.action) { where.push(`action ILIKE $${i++}`); params.push(`%${a.action}%`); }
    if (a.target_type) { where.push(`target_type = $${i++}`); params.push(a.target_type); }
    if (a.target_id) { where.push(`target_id = $${i++}`); params.push(a.target_id); }
    if (a.since_days) { where.push(`created_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.since_days)); }
    const rows = (await pool.query(
      `SELECT id, actor_discord_id, action, target_type, target_id, details, created_at
         FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY created_at DESC LIMIT ${limit}`, params
    )).rows;
    const sources: Source[] = rows.slice(0, 8).map((r: any) => ({
      type: 'audit', id: r.id,
      label: `Audit · ${r.action} on ${r.target_type || '—'} #${r.target_id || '—'} by ${r.actor_discord_id || 'system'}`,
    }));
    return { ok: true, data: { count: rows.length, events: rows }, sources };
  },
};

// ─── getDeadlines ─────────────────────────────────────────────────────────
const getDeadlines: ToolDef = {
  name: 'getDeadlines',
  description: 'List cases with appeal deadlines coming up or already overdue. Default: next 7 days + overdue.',
  parameters: {
    type: 'object',
    properties: {
      due_within_days: { type: 'integer', description: 'Default 7.' },
      include_overdue: { type: 'boolean', description: 'Default true.' },
      open_only: { type: 'boolean', description: 'Exclude won/denied/closed (default true).' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const days = clamp(a.due_within_days, 7, 60);
    const limit = clamp(a.limit, 25, 25);
    const cond: string[] = ['c.appeal_deadline IS NOT NULL'];
    cond.push(a.include_overdue === false
      ? `c.appeal_deadline BETWEEN NOW() AND NOW() + INTERVAL '${days} days'`
      : `c.appeal_deadline < NOW() + INTERVAL '${days} days'`);
    if (a.open_only !== false) cond.push(`c.status NOT IN ('won','denied','closed')`);
    const rows = (await pool.query(
      `SELECT c.id, c.user_discord_id, u.discord_username, c.violation_type, c.status,
              c.priority, c.appeal_deadline, c.staff_assigned_id,
              EXTRACT(EPOCH FROM (c.appeal_deadline - NOW()))/3600 AS hours_remaining
         FROM cases c LEFT JOIN users u ON u.discord_id = c.user_discord_id
         WHERE ${cond.join(' AND ')}
         ORDER BY c.appeal_deadline ASC LIMIT ${limit}`
    )).rows;
    const sources: Source[] = rows.map((r: any) => ({
      type: 'case', id: r.id,
      label: `Case #${r.id} · deadline ${new Date(r.appeal_deadline).toISOString().slice(0, 10)} (${Math.round(r.hours_remaining)}h)`,
      url: caseUrl(r.id),
    }));
    return { ok: true, data: { count: rows.length, deadlines: rows }, sources };
  },
};

// ─── searchPolicyAlerts ───────────────────────────────────────────────────
const searchPolicyAlerts: ToolDef = {
  name: 'searchPolicyAlerts',
  description: 'Search published policy alerts (TikTok rule changes / risk warnings).',
  parameters: {
    type: 'object',
    properties: {
      severity: { type: 'string', description: 'info|warning|critical' },
      query: { type: 'string' },
      since_days: { type: 'integer' },
      limit: { type: 'integer' },
    },
  },
  handler: async (a) => {
    const limit = clamp(a.limit, 5, 15);
    const where: string[] = ['active = true']; const params: any[] = []; let i = 1;
    if (a.severity) { where.push(`severity = $${i++}`); params.push(a.severity); }
    if (a.query) { where.push(`(title ILIKE $${i} OR summary ILIKE $${i})`); params.push(`%${a.query}%`); i++; }
    if (a.since_days) { where.push(`published_at > NOW() - ($${i++}::int * INTERVAL '1 day')`); params.push(Number(a.since_days)); }
    const rows = (await pool.query(
      `SELECT id, title, summary, severity, tiktok_category, source_url, published_at
         FROM policy_alerts WHERE ${where.join(' AND ')}
         ORDER BY published_at DESC LIMIT ${limit}`, params
    )).rows;
    const sources: Source[] = rows.map((p: any) => ({
      type: 'policy', id: p.id,
      label: `Policy · ${p.title} (${p.severity})`,
      url: p.source_url || `${PORTAL_URL}/policies`,
      snippet: trunc(p.summary, 200),
    }));
    return { ok: true, data: { count: rows.length, alerts: rows }, sources };
  },
};

// ─── listStaff ────────────────────────────────────────────────────────────
const listStaff: ToolDef = {
  name: 'listStaff',
  description: 'Roster of all active staff with role, specialties, languages, and active case count.',
  parameters: { type: 'object', properties: {} },
  handler: async () => {
    const rows = (await pool.query(
      `SELECT s.discord_id, s.name, s.role, s.specialties, s.languages, s.timezone,
              (SELECT COUNT(*) FROM cases WHERE staff_assigned_id = s.discord_id AND status NOT IN ('won','denied','closed'))::int AS active_cases
         FROM staff s WHERE s.active = true ORDER BY s.role, s.name`
    )).rows;
    const sources: Source[] = [{ type: 'staff', id: 'roster', label: `${rows.length} active staff` }];
    return { ok: true, data: { staff: rows }, sources };
  },
};

// ─── analyzeImage ─────────────────────────────────────────────────────────
const analyzeImage: ToolDef = {
  name: 'analyzeImage',
  description: 'Run the vision model against an image URL (typically an evidence file). Returns a description / answer.',
  parameters: {
    type: 'object',
    required: ['image_url', 'question'],
    properties: {
      image_url: { type: 'string' },
      question: { type: 'string', description: 'Specific question or instruction (e.g., "what TikTok screen does this show?").' },
    },
  },
  handler: async (a) => {
    try {
      const result = await groqVision({ imageUrl: a.image_url, question: a.question, maxTokens: 600 });
      return { ok: true, data: { analysis: result }, sources: [{ type: 'evidence', id: a.image_url, label: 'Vision analysis', url: a.image_url, snippet: trunc(result, 160) }] };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'vision failed' };
    }
  },
};

// ─── getCaseMessages ──────────────────────────────────────────────────────
const getCaseMessages: ToolDef = {
  name: 'getCaseMessages',
  description: 'Fetch the full portal message thread for a case (chronological). Use this when a question requires reading what was actually said back-and-forth, not just summary fields on the case.',
  parameters: {
    type: 'object',
    required: ['case_id'],
    properties: {
      case_id: { type: 'integer' },
      limit: { type: 'integer', description: 'Default 50, max 100.' },
    },
  },
  handler: async (a) => {
    const id = Number(a.case_id);
    if (!Number.isFinite(id)) return { ok: false, error: 'case_id required' };
    const limit = Math.min(clamp(a.limit, 50, 100), 100);
    const rows = (await pool.query(
      `SELECT m.id, m.sender_type, m.sender_discord_id, m.content, m.attachments,
              m.is_read, m.created_at, u.discord_username AS sender_username
         FROM messages m LEFT JOIN users u ON u.discord_id = m.sender_discord_id
         WHERE m.case_id = $1 ORDER BY m.created_at ASC LIMIT ${limit}`,
      [id]
    )).rows;
    const sources: Source[] = [{
      type: 'case', id, label: `Case #${id} · ${rows.length} portal messages`, url: caseUrl(id),
    }];
    return { ok: true, data: { count: rows.length, case_id: id, messages: rows.map((m: any) => ({ ...m, content: trunc(m.content, 400) })) }, sources };
  },
};

const getClientDossier: ToolDef = {
  name: 'getClientDossier',
  description: 'Build a complete cross-source dossier for a person: profile, ALL their cases, recent portal messages, recent Discord activity in their assigned channel, subscriptions, and audit footprint. Use this for "tell me everything about <client>" or "what is going on with <name>" questions.',
  parameters: {
    type: 'object',
    properties: {
      discord_id: { type: 'string' },
      discord_username: { type: 'string', description: 'Used for fuzzy lookup when discord_id unknown.' },
    },
  },
  handler: async (a) => {
    let u: any = null;
    if (a.discord_id) {
      u = (await pool.query(`SELECT * FROM users WHERE discord_id = $1`, [a.discord_id])).rows[0];
    }
    if (!u && a.discord_username) {
      u = (await pool.query(
        `SELECT * FROM users WHERE discord_username ILIKE $1 ORDER BY last_active DESC NULLS LAST LIMIT 1`,
        [`%${String(a.discord_username).replace(/^@/, '')}%`]
      )).rows[0];
    }
    if (!u) return { ok: false, error: 'client not found (try discord_id or full discord_username)' };
    const [cases, subs, tiktokAccts, lastMsgs, lastDiscord, lastAudit] = await Promise.all([
      pool.query(`SELECT id, violation_type, status, priority, appeal_deadline, account_username, outcome, created_at
                    FROM cases WHERE user_discord_id = $1 ORDER BY created_at DESC LIMIT 25`, [u.discord_id]),
      pool.query(`SELECT plan, status, start_date, end_date FROM subscriptions WHERE user_discord_id = $1 ORDER BY start_date DESC LIMIT 10`, [u.discord_id]),
      pool.query(`SELECT username, account_url, is_primary FROM tiktok_accounts WHERE user_discord_id = $1`, [u.discord_id]),
      pool.query(`SELECT id, case_id, sender_type, content, created_at FROM messages
                    WHERE sender_discord_id = $1 OR case_id IN (SELECT id FROM cases WHERE user_discord_id = $1)
                    ORDER BY created_at DESC LIMIT 12`, [u.discord_id]),
      u.discord_channel_id
        ? pool.query(`SELECT id, author_username, content, created_at FROM discord_messages
                        WHERE channel_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 15`, [u.discord_channel_id])
        : { rows: [] } as any,
      pool.query(`SELECT action, target_type, target_id, created_at FROM audit_log
                    WHERE actor_discord_id = $1 OR (details->>'user_discord_id') = $1
                    ORDER BY created_at DESC LIMIT 10`, [u.discord_id]),
    ]);
    const sources: Source[] = [{ type: 'client', id: u.id, label: `${u.discord_username} (${u.discord_id})`, url: clientUrl(u.id) }];
    for (const c of cases.rows.slice(0, 10)) sources.push({ type: 'case', id: c.id, label: `Case #${c.id} · ${c.status}`, url: caseUrl(c.id) });
    if (lastDiscord.rows.length) sources.push({ type: 'discord', id: u.discord_channel_id, label: `Discord channel · ${lastDiscord.rows.length} recent msgs` });
    return {
      ok: true,
      data: {
        client: u,
        all_cases: cases.rows,
        subscriptions: subs.rows,
        tiktok_accounts: tiktokAccts.rows,
        recent_portal_messages: lastMsgs.rows.map((m: any) => ({ ...m, content: trunc(m.content, 300) })),
        recent_discord_messages: lastDiscord.rows.map((m: any) => ({ ...m, id: String(m.id), content: trunc(m.content, 300) })),
        recent_audit: lastAudit.rows,
      },
      sources,
    };
  },
};

// ─── compareCases ─────────────────────────────────────────────────────────
const compareCases: ToolDef = {
  name: 'compareCases',
  description: 'Side-by-side comparison of 2-5 cases (status, violation, deadline, evidence count, AI score, outcome). Use for "what do these denied cases have in common?" or "why did X win and Y lose?".',
  parameters: {
    type: 'object',
    required: ['case_ids'],
    properties: {
      case_ids: { type: 'array', items: { type: 'integer' }, description: 'Between 2 and 5 case ids.' },
    },
  },
  handler: async (a) => {
    const ids = (Array.isArray(a.case_ids) ? a.case_ids : []).map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n)).slice(0, 5);
    if (ids.length < 2) return { ok: false, error: 'Provide 2–5 case_ids' };
    const rows = (await pool.query(
      `SELECT c.id, c.violation_type, c.status, c.outcome, c.priority,
              c.appeal_deadline, c.account_username, c.user_discord_id,
              LEFT(c.violation_description, 240) AS desc,
              (SELECT COUNT(*) FROM evidence WHERE case_id = c.id)::int AS evidence_count,
              (SELECT score FROM compliance_scores WHERE case_id = c.id ORDER BY created_at DESC LIMIT 1) AS latest_score
         FROM cases c WHERE c.id = ANY($1::int[]) ORDER BY c.id`,
      [ids]
    )).rows;
    const sources: Source[] = rows.map((c: any) => ({ type: 'case', id: c.id, label: `Case #${c.id} · ${c.status}`, url: caseUrl(c.id) }));
    return { ok: true, data: { count: rows.length, comparison: rows }, sources };
  },
};

export const TOOLS: ToolDef[] = [
  searchCases, getCase, getCaseMessages,
  searchPortalMessages,
  searchDiscord, getDiscordTranscript,
  searchClients, getClient, getClientDossier,
  searchKB, getKBArticle, searchTemplates,
  searchAuditLog, getDeadlines, searchPolicyAlerts,
  listStaff, analyzeImage,
  compareCases,
];

export const TOOL_MAP: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export function toolsForGroq(): GroqToolDef[] {
  return TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function runTool(name: string, args: any, ctx: ToolContext): Promise<ToolResult> {
  const t = TOOL_MAP[name];
  if (!t) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    return await t.handler(args || {}, ctx);
  } catch (err: any) {
    console.error(`[ai.tools] ${name} failed`, err);
    return { ok: false, error: err?.message || 'tool failed' };
  }
}
