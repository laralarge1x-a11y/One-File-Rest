import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { logAudit } from '../services/webhook.js';
import { ah, validate, Errors } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

const AccountBody = z.object({
  username: z.string().trim().min(1).max(200),
  account_url: z.string().trim().max(500).url().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  is_primary: z.boolean().optional(),
}).strict();
const AccountPatch = AccountBody.partial();

router.get(
  '/',
  validate({ query: emptyQuerySchema, params: emptyParamsSchema }),
  ah(async (req: Request, res: Response) => {
    const r = await pool.query(
      `SELECT a.*, COUNT(c.id) FILTER (WHERE c.status NOT IN ('won','denied','closed'))::int AS active_cases
         FROM tiktok_accounts a
         LEFT JOIN cases c ON c.tiktok_account_id = a.id
        WHERE a.user_discord_id = $1
        GROUP BY a.id
        ORDER BY a.is_primary DESC, a.created_at ASC`,
      [req.user!.discord_id]
    );
    res.json(r.rows);
  })
);

router.post(
  '/',
  validate({ body: AccountBody, query: emptyQuerySchema, params: emptyParamsSchema }),
  ah(async (req: Request, res: Response) => {
    const { username, account_url, notes, is_primary } = req.body;
    if (is_primary) {
      await pool.query(
        'UPDATE tiktok_accounts SET is_primary = false WHERE user_discord_id = $1',
        [req.user!.discord_id]
      );
    }
    const r = await pool.query(
      `INSERT INTO tiktok_accounts (user_discord_id, username, account_url, notes, is_primary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.discord_id, username, account_url ?? null, notes ?? null, !!is_primary]
    );
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'account_added',
      targetType: 'tiktok_account',
      targetId: r.rows[0].id,
      details: { username, is_primary: !!is_primary },
    }).catch(console.error);
    res.status(201).json(r.rows[0]);
  })
);

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: AccountPatch, query: emptyQuerySchema }),
  ah(async (req: Request, res: Response) => {
    const id = req.params.id;
    const { username, account_url, notes, is_primary } = req.body;
    const own = await pool.query(
      'SELECT * FROM tiktok_accounts WHERE id = $1 AND user_discord_id = $2',
      [id, req.user!.discord_id]
    );
    if (own.rows.length === 0) throw Errors.notFound('Account not found');
    if (is_primary) {
      await pool.query(
        'UPDATE tiktok_accounts SET is_primary = false WHERE user_discord_id = $1',
        [req.user!.discord_id]
      );
    }
    const r = await pool.query(
      `UPDATE tiktok_accounts SET
         username = COALESCE($1, username),
         account_url = COALESCE($2, account_url),
         notes = COALESCE($3, notes),
         is_primary = COALESCE($4, is_primary)
       WHERE id = $5 RETURNING *`,
      [
        username ?? null,
        account_url ?? null,
        notes ?? null,
        typeof is_primary === 'boolean' ? is_primary : null,
        id,
      ]
    );
    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of ['username', 'account_url', 'notes', 'is_primary'] as const) {
      if (req.body[k] !== undefined && req.body[k] !== own.rows[0][k]) {
        diff[k] = { before: own.rows[0][k], after: req.body[k] };
      }
    }
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'account_updated',
      targetType: 'tiktok_account',
      targetId: Number(id),
      details: { diff },
    }).catch(console.error);
    res.json(r.rows[0]);
  })
);

router.delete(
  '/:id', validate({ params: idParamSchema, query: emptyQuerySchema }),
  ah(async (req: Request, res: Response) => {
    const id = req.params.id;
    const before = await pool.query(
      'SELECT username FROM tiktok_accounts WHERE id = $1 AND user_discord_id = $2',
      [id, req.user!.discord_id]
    );
    await pool.query(
      'DELETE FROM tiktok_accounts WHERE id = $1 AND user_discord_id = $2',
      [id, req.user!.discord_id]
    );
    if (before.rows.length > 0) {
      logAudit({
        actorDiscordId: req.user!.discord_id,
        action: 'account_deleted',
        targetType: 'tiktok_account',
        targetId: Number(id),
        details: { username: before.rows[0].username },
      }).catch(console.error);
    }
    res.json({ success: true });
  })
);

export default router;
