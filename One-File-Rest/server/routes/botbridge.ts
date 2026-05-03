import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { requireBotToken } from '../auth/middleware.js';
import { logAudit } from '../services/webhook.js';
import { validate } from '../middleware/index.js';
import { discordIdSchema, isoDateString, emptyQuerySchema, emptyBodySchema, emptyParamsSchema, discordWebhookUrlSchema } from '../../shared/schemas.js';
import { orchestrateOnce } from '../ai/orchestrator.js';

const router = Router();
router.use(requireBotToken);

const SyncBody = z.object({
  discord_id: discordIdSchema,
  discord_username: z.string().min(1).max(120),
  discord_avatar: z.string().max(500).optional().nullable(),
  plan: z.string().max(60).optional().nullable(),
  plan_start: isoDateString.optional().nullable(),
  plan_expiry: isoDateString.optional().nullable(),
  discord_channel_id: z.string().max(40).optional().nullable(),
  discord_webhook_url: discordWebhookUrlSchema.optional().nullable(),
}).strict();
const DiscordIdParam = z.object({ discordId: discordIdSchema }).strict();
const ChannelIdParam = z.object({ channelId: z.string().min(1).max(40) }).strict();
const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();
const CasesQuery = z.object({
  discord_id: discordIdSchema,
  status: z.string().max(40).optional(),
}).strict();
const CaseCreateBody = z.object({
  discord_user_id: discordIdSchema,
  account_username: z.string().min(1).max(200),
  violation_type: z.string().min(1).max(120),
  description: z.string().max(5000).optional().nullable(),
}).strict();
const MessageReceiveBody = z.object({
  discord_user_id: discordIdSchema,
  case_id: z.coerce.number().int().positive(),
  content: z.string().min(1).max(10_000),
  attachments: z.array(z.object({
    url: z.string().url().max(2000),
    type: z.string().max(120).optional(),
    name: z.string().max(300).optional(),
  })).max(10).optional(),
}).strict();
const BotAskBody = z.object({
  staff_discord_id: discordIdSchema,
  question: z.string().min(2).max(8000),
  thread_id: z.coerce.number().int().positive().optional().nullable(),
  context_hint: z.record(z.string(), z.unknown()).optional(),
}).strict();
const DiscordMsgIngestBody = z.object({
  id: z.union([z.string().min(1), z.number()]),
  channel_id: z.string().min(1).max(40),
  guild_id: z.string().max(40).optional().nullable(),
  author_discord_id: discordIdSchema,
  author_username: z.string().max(120).optional().nullable(),
  is_bot: z.boolean().optional(),
  content: z.string().max(20_000).optional(),
  attachments: z.array(z.unknown()).optional(),
  embeds: z.array(z.unknown()).optional(),
  referenced_message_id: z.union([z.string(), z.number()]).optional().nullable(),
  created_at: z.union([z.string(), z.number()]).optional().nullable(),
  edited_at: z.union([z.string(), z.number()]).optional().nullable(),
}).strict();
const DiscordBulkBody = z.object({
  messages: z.array(DiscordMsgIngestBody).max(500),
}).strict();
const DiscordDeleteBody = z.object({
  id: z.union([z.string().min(1), z.coerce.number()]),
}).strict();

router.post('/users/sync', validate({ body: SyncBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const {
      discord_id, discord_username, discord_avatar, plan,
      plan_start, plan_expiry, discord_channel_id, discord_webhook_url,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO users (
        discord_id, discord_username, discord_avatar, plan, plan_start, plan_expiry,
        discord_channel_id, discord_webhook_url, created_at, updated_at, last_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
      ON CONFLICT (discord_id) DO UPDATE SET
        discord_username = EXCLUDED.discord_username,
        discord_avatar = COALESCE(EXCLUDED.discord_avatar, users.discord_avatar),
        plan = COALESCE(EXCLUDED.plan, users.plan),
        plan_start = COALESCE(EXCLUDED.plan_start, users.plan_start),
        plan_expiry = COALESCE(EXCLUDED.plan_expiry, users.plan_expiry),
        discord_channel_id = COALESCE(EXCLUDED.discord_channel_id, users.discord_channel_id),
        discord_webhook_url = COALESCE(EXCLUDED.discord_webhook_url, users.discord_webhook_url),
        last_active = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [discord_id, discord_username, discord_avatar || null, plan || null,
       plan_start || null, plan_expiry || null, discord_channel_id || null, discord_webhook_url || null]
    );

    const user = result.rows[0];

    if (plan) {
      pool.query(
        `INSERT INTO access_grants (granted_by_discord_id, user_discord_id, plan, start_date, end_date, created_at)
         VALUES ('bot', $1, $2, $3, $4, NOW())`,
        [discord_id, plan, plan_start || null, plan_expiry || null]
      ).catch(console.error);
    }

    logAudit({
      actorDiscordId: 'bot',
      action: plan ? 'plan_granted' : 'user_synced',
      targetType: 'user',
      targetId: user.id,
      details: { discord_id, plan, plan_expiry },
    }).catch(console.error);

    return res.json({ success: true, user });
  } catch (err) {
    console.error('[bot/users/sync]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to sync user', requestId: req.id } });
  }
});

router.get('/users/:discordId', validate({ params: DiscordIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_id = $1`,
      [discordId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'User not found', requestId: req.id } });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[bot/users/:discordId]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch user', requestId: req.id } });
  }
});

router.post('/users/:discordId/revoke', validate({ params: DiscordIdParam, query: emptyQuerySchema, body: emptyBodySchema }), async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;
    const beforeR = await pool.query(
      `SELECT id, plan, plan_expiry FROM users WHERE discord_id = $1`, [discordId]
    );
    await pool.query(
      `UPDATE users SET plan = NULL, plan_start = NULL, plan_expiry = NULL, updated_at = NOW()
       WHERE discord_id = $1`,
      [discordId]
    );
    const before = beforeR.rows[0];
    if (before?.id) logAudit({
      actorDiscordId: 'bot',
      action: 'plan_revoked',
      targetType: 'user',
      targetId: Number(before.id),
      details: {
        discord_id: discordId,
        from: { plan: before.plan, plan_expiry: before.plan_expiry },
        to: { plan: null, plan_expiry: null },
      },
    }).catch(console.error);
    return res.json({ success: true });
  } catch (err) {
    console.error('[bot/users/revoke]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to revoke access', requestId: req.id } });
  }
});

router.get('/users/by-channel/:channelId', validate({ params: ChannelIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_channel_id = $1`,
      [req.params.channelId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'No user found for that channel', requestId: req.id } });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[bot/users/by-channel]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch user by channel', requestId: req.id } });
  }
});

router.get('/cases', validate({ query: CasesQuery, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { discord_id, status } = req.query as { discord_id: string; status?: string };
    let query = `SELECT c.*, u.discord_username FROM cases c JOIN users u ON c.user_discord_id = u.discord_id WHERE c.user_discord_id = $1`;
    const values: any[] = [discord_id];
    if (status) { query += ` AND c.status = $2`; values.push(status); }
    query += ` ORDER BY c.created_at DESC`;
    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('[bot/cases]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch cases', requestId: req.id } });
  }
});

router.get('/cases/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.discord_username FROM cases c JOIN users u ON c.user_discord_id = u.discord_id WHERE c.id = $1`,
      [req.params.caseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[bot/cases/:id]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch case', requestId: req.id } });
  }
});

router.post('/cases/create', validate({ body: CaseCreateBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { discord_user_id, account_username, violation_type, description } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE discord_id = $1', [discord_user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'User not found', requestId: req.id } });

    const result = await pool.query(
      `INSERT INTO cases (user_discord_id, account_username, violation_type, violation_description, status, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', 'normal', NOW(), NOW()) RETURNING *`,
      [discord_user_id, account_username, violation_type, description]
    );
    logAudit({
      actorDiscordId: 'bot',
      action: 'case_created',
      targetType: 'case',
      targetId: result.rows[0].id,
      details: { discord_user_id, account_username, violation_type, source: 'discord' },
    }).catch(console.error);
    return res.status(201).json({ success: true, case: result.rows[0] });
  } catch (err) {
    console.error('[bot/cases/create]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to create case', requestId: req.id } });
  }
});

router.post('/messages/receive', validate({ body: MessageReceiveBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { discord_user_id, case_id, content, attachments } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE discord_id = $1', [discord_user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'User not found', requestId: req.id } });

    const result = await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content, created_at)
       VALUES ($1, $2, 'client', $3, NOW()) RETURNING *`,
      [case_id, discord_user_id, content]
    );

    if (attachments?.length) {
      for (const att of attachments) {
        pool.query(
          `INSERT INTO evidence (case_id, uploaded_by_discord_id, file_url, file_type, file_name, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [case_id, discord_user_id, att.url, att.type || 'unknown', att.name || 'attachment']
        ).catch(console.error);
      }
    }

    try { getIO().to(`case:${case_id}`).emit('message:new', result.rows[0]); } catch {}
    return res.json({ success: true, message_id: result.rows[0].id });
  } catch (err) {
    console.error('[bot/messages/receive]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to receive message', requestId: req.id } });
  }
});

router.get('/channels', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT discord_id, discord_channel_id, discord_username FROM users
       WHERE discord_channel_id IS NOT NULL`
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch channels', requestId: req.id } });
  }
});

router.get('/health', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), (_req: Request, res: Response) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function resolveStaff(discordId: string): Promise<{ role: string } | null> {
  const r = (await pool.query(
    `SELECT role FROM staff WHERE discord_id = $1 AND active = true LIMIT 1`,
    [discordId]
  )).rows[0];
  if (r) return { role: r.role };
  const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(discordId)) return { role: 'admin' };
  return null;
}

router.post('/ai/ask', validate({ body: BotAskBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { staff_discord_id, question, thread_id, context_hint } = req.body;
    const staff = await resolveStaff(staff_discord_id);
    if (!staff) return res.status(403).json({ error: { code: 'forbidden', message: 'not_staff', requestId: req.id } });
    const startedAt = Date.now();
    const result = await orchestrateOnce({
      question: String(question).trim(),
      threadId: thread_id ? Number(thread_id) : undefined,
      surface: 'discord',
      staffDiscordId: staff_discord_id,
      staffRole: staff.role,
      contextHint: context_hint || undefined,
    });
    if (result.thread_id) logAudit({
      actorDiscordId: staff_discord_id,
      action: 'ai_ask',
      targetType: 'ai_thread',
      targetId: Number(result.thread_id),
      details: {
        request_id: req.id,
        surface: 'discord',
        q_preview: String(question).slice(0, 240),
        tools: result.tools || [],
        sources: (result.sources || []).slice(0, 8).map((s: any) => ({ type: s.type, id: s.id, label: s.label })),
        duration_ms: Date.now() - startedAt,
        answer_preview: String(result.answer || '').slice(0, 240),
      },
    }).catch(() => {});
    return res.json(result);
  } catch (err: any) {
    console.error('[bot/ai/ask]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'ask failed', requestId: req.id } });
  }
});

router.post('/discord-messages/ingest', validate({ body: DiscordMsgIngestBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO discord_messages
         (id, channel_id, guild_id, author_discord_id, author_username, is_bot,
          content, attachments, embeds, referenced_message_id, created_at, edited_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         attachments = EXCLUDED.attachments,
         embeds = EXCLUDED.embeds,
         edited_at = COALESCE(EXCLUDED.edited_at, discord_messages.edited_at),
         deleted_at = NULL`,
      [
        BigInt(m.id), m.channel_id, m.guild_id || null,
        m.author_discord_id, m.author_username || null, !!m.is_bot,
        m.content || '', JSON.stringify(m.attachments || []), JSON.stringify(m.embeds || []),
        m.referenced_message_id ? BigInt(m.referenced_message_id) : null,
        m.created_at ? new Date(m.created_at) : new Date(),
        m.edited_at ? new Date(m.edited_at) : null,
      ]
    );
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[discord-messages/ingest]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'ingest failed', requestId: req.id } });
  }
});

router.post('/discord-messages/bulk-ingest', validate({ body: DiscordBulkBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    const batch = messages.slice(0, 500);
    let inserted = 0;
    for (const m of batch) {
      try {
        await pool.query(
          `INSERT INTO discord_messages
             (id, channel_id, guild_id, author_discord_id, author_username, is_bot,
              content, attachments, embeds, referenced_message_id, created_at, edited_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (id) DO NOTHING`,
          [
            BigInt(m.id), m.channel_id, m.guild_id || null,
            m.author_discord_id, m.author_username || null, !!m.is_bot,
            m.content || '', JSON.stringify(m.attachments || []), JSON.stringify(m.embeds || []),
            m.referenced_message_id ? BigInt(m.referenced_message_id) : null,
            m.created_at ? new Date(m.created_at) : new Date(),
            m.edited_at ? new Date(m.edited_at) : null,
          ]
        );
        inserted++;
      } catch (rowErr) {
        console.warn('[discord-messages/bulk-ingest] row failed:', (rowErr as Error)?.message);
      }
    }
    return res.json({ ok: true, accepted: batch.length, inserted });
  } catch (err: any) {
    console.error('[discord-messages/bulk-ingest]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'bulk ingest failed', requestId: req.id } });
  }
});

router.post('/discord-messages/delete', validate({ body: DiscordDeleteBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    await pool.query(`UPDATE discord_messages SET deleted_at = NOW() WHERE id = $1`, [BigInt(id)]);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[discord-messages/delete]', { req_id: req.id, err: err?.message });
    return res.status(500).json({ error: { code: 'internal', message: 'delete failed', requestId: req.id } });
  }
});

router.get('/discord-messages/checkpoints', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const rows = (await pool.query(
      `SELECT channel_id, MAX(created_at) AS last_indexed FROM discord_messages GROUP BY channel_id`
    )).rows;
    return res.json({ checkpoints: rows });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'internal', message: 'failed', requestId: req.id } });
  }
});

export default router;
