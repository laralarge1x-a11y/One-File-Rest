import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { requireBotToken } from '../auth/middleware.js';
import { logAudit } from '../services/webhook.js';

const router = Router();
router.use(requireBotToken);

// POST /bot/users/sync — register or update user from Discord bot
router.post('/users/sync', async (req: Request, res: Response) => {
  try {
    const {
      discord_id, discord_username, discord_avatar, plan,
      plan_start, plan_expiry, discord_channel_id, discord_webhook_url,
    } = req.body;

    if (!discord_id || !discord_username) {
      return res.status(400).json({ error: 'discord_id and discord_username required' });
    }

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

    // Log access grant if plan was set
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

    res.json({ success: true, user });
  } catch (err) {
    console.error('[bot/users/sync]', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// GET /bot/users/:discordId
router.get('/users/:discordId', async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_id = $1`,
      [discordId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[bot/users/:discordId]', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /bot/users/:discordId/revoke
router.post('/users/:discordId/revoke', async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;
    await pool.query(
      `UPDATE users SET plan = NULL, plan_start = NULL, plan_expiry = NULL, updated_at = NOW()
       WHERE discord_id = $1`,
      [discordId]
    );
    logAudit({
      actorDiscordId: 'bot',
      action: 'plan_revoked',
      targetType: 'user',
      details: { discord_id: discordId },
    }).catch(console.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// GET /bot/users/by-channel/:channelId — reverse lookup by Discord channel
router.get('/users/by-channel/:channelId', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT u.*, COALESCE(s.role, u.role, 'client') as resolved_role
       FROM users u LEFT JOIN staff s ON u.discord_id = s.discord_id
       WHERE u.discord_channel_id = $1`,
      [req.params.channelId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'No user found for that channel' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[bot/users/by-channel]', err);
    res.status(500).json({ error: 'Failed to fetch user by channel' });
  }
});

// GET /bot/cases — get cases for a discord user
router.get('/cases', async (req: Request, res: Response) => {
  try {
    const { discord_id, status } = req.query;
    if (!discord_id) return res.status(400).json({ error: 'discord_id required' });

    let query = `SELECT c.*, u.discord_username FROM cases c JOIN users u ON c.user_discord_id = u.discord_id WHERE c.user_discord_id = $1`;
    const values: any[] = [discord_id];
    if (status) { query += ` AND c.status = $2`; values.push(status); }
    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// GET /bot/cases/:caseId
router.get('/cases/:caseId', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.discord_username FROM cases c JOIN users u ON c.user_discord_id = u.discord_id WHERE c.id = $1`,
      [req.params.caseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// POST /bot/cases/create
router.post('/cases/create', async (req: Request, res: Response) => {
  try {
    const { discord_user_id, account_username, violation_type, description } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE discord_id = $1', [discord_user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      `INSERT INTO cases (user_discord_id, account_username, violation_type, violation_description, status, priority, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', 'normal', NOW(), NOW()) RETURNING *`,
      [discord_user_id, account_username, violation_type, description]
    );
    res.status(201).json({ success: true, case: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// POST /bot/messages/receive — message from Discord → portal
router.post('/messages/receive', async (req: Request, res: Response) => {
  try {
    const { discord_user_id, case_id, content, attachments } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE discord_id = $1', [discord_user_id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content, created_at)
       VALUES ($1, $2, 'client', $3, NOW()) RETURNING *`,
      [case_id, discord_user_id, content]
    );

    if (attachments?.length > 0) {
      for (const att of attachments) {
        pool.query(
          `INSERT INTO evidence (case_id, uploaded_by_discord_id, file_url, file_type, file_name, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [case_id, discord_user_id, att.url, att.type || 'unknown', att.name || 'attachment']
        ).catch(console.error);
      }
    }

    try { getIO().to(`case:${case_id}`).emit('message:new', result.rows[0]); } catch {}
    res.json({ success: true, message_id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to receive message' });
  }
});

// GET /bot/channels — get all known Discord channel IDs (for messageCreate listener)
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT discord_id, discord_channel_id, discord_username FROM users
       WHERE discord_channel_id IS NOT NULL`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /bot/health
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Ask Elite (Discord surface) ──────────────────────────────────────────
// The bot calls this when a staffer pings @bot or runs /ask. We resolve the
// caller's role from the staff table and refuse non-staff. Returns the final
// answer + sources from the orchestrator (non-streaming).
import { orchestrateOnce } from '../ai/orchestrator.js';

// STRICT: only active staff or env-listed admins may use Ask Elite. We do
// NOT trust users.role as a fallback because role rows can become stale on
// deprovisioning while users.role is left behind.
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

router.post('/ai/ask', async (req: Request, res: Response) => {
  try {
    const { staff_discord_id, question, thread_id, context_hint } = req.body || {};
    if (!staff_discord_id || !question) {
      return res.status(400).json({ error: 'staff_discord_id + question required' });
    }
    const staff = await resolveStaff(staff_discord_id);
    if (!staff) return res.status(403).json({ error: 'not_staff' });
    const startedAt = Date.now();
    const result = await orchestrateOnce({
      question: String(question).trim(),
      threadId: thread_id ? Number(thread_id) : undefined,
      surface: 'discord',
      staffDiscordId: staff_discord_id,
      staffRole: staff.role,
      contextHint: context_hint || undefined,
    });
    logAudit({
      actorDiscordId: staff_discord_id,
      action: 'ai_ask',
      targetType: 'ai_thread',
      targetId: result.thread_id ? String(result.thread_id) : undefined,
      details: {
        surface: 'discord',
        q_preview: String(question).slice(0, 240),
        tools: result.tools || [],
        sources: (result.sources || []).slice(0, 8).map((s: any) => ({ type: s.type, id: s.id, label: s.label })),
        duration_ms: Date.now() - startedAt,
        answer_preview: String(result.answer || '').slice(0, 240),
      },
    }).catch(() => {});
    res.json(result);
  } catch (err: any) {
    console.error('[bot/ai/ask] failed', err);
    res.status(500).json({ error: err?.message || 'ask failed' });
  }
});

// ─── Discord message indexing (live + backfill) ───────────────────────────
// Upserts into discord_messages so the orchestrator's searchDiscord /
// getDiscordTranscript tools can read transcripts. The bot calls this from
// messageCreate / messageUpdate. Soft-deletes via deleted_at.
router.post('/discord-messages/ingest', async (req: Request, res: Response) => {
  try {
    const m = req.body || {};
    if (!m.id || !m.channel_id || !m.author_discord_id) {
      return res.status(400).json({ error: 'id, channel_id, author_discord_id required' });
    }
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
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[discord-messages/ingest] failed', err);
    res.status(500).json({ error: err?.message || 'ingest failed' });
  }
});

router.post('/discord-messages/bulk-ingest', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
    const batch = messages.slice(0, 500);
    let inserted = 0;
    for (const m of batch) {
      if (!m?.id || !m?.channel_id || !m?.author_discord_id) continue;
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
    res.json({ ok: true, accepted: batch.length, inserted });
  } catch (err: any) {
    console.error('[discord-messages/bulk-ingest] failed', err);
    res.status(500).json({ error: err?.message || 'bulk ingest failed' });
  }
});

router.post('/discord-messages/delete', async (req: Request, res: Response) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await pool.query(`UPDATE discord_messages SET deleted_at = NOW() WHERE id = $1`, [BigInt(id)]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'delete failed' });
  }
});

// Returns the most recent indexed message timestamp per channel so the bot's
// backfill knows where to resume.
router.get('/discord-messages/checkpoints', async (_req: Request, res: Response) => {
  try {
    const rows = (await pool.query(
      `SELECT channel_id, MAX(created_at) AS last_indexed FROM discord_messages GROUP BY channel_id`
    )).rows;
    res.json({ checkpoints: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed' });
  }
});

export default router;
