import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { isOnline } from '../services/presence.js';
import { validate } from '../middleware/index.js';
import { discordIdSchema, emptyQuerySchema, emptyBodySchema, emptyParamsSchema } from '../../shared/schemas.js';

const router = Router();

const DiscordIdParam = z.object({ discordId: discordIdSchema }).strict();

// List visible specialists (with presence + win rate)
router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT s.discord_id, s.name, s.role, s.bio, s.languages, s.specialties, s.timezone,
              u.discord_avatar, u.last_active,
              COUNT(c.id) FILTER (WHERE c.outcome = 'won')::int AS won_cases,
              COUNT(c.id) FILTER (WHERE c.outcome IN ('won','denied'))::int AS resolved_cases,
              AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at))/3600) FILTER (WHERE c.outcome IN ('won','denied'))::float AS avg_resolution_hours
         FROM staff s
         LEFT JOIN users u ON s.discord_id = u.discord_id
         LEFT JOIN cases c ON c.staff_assigned_id = s.discord_id
        WHERE s.active = true
        GROUP BY s.id, u.discord_avatar, u.last_active
        ORDER BY won_cases DESC NULLS LAST`
    );
    const fav = await pool.query(
      `SELECT staff_discord_id FROM specialist_favorites WHERE user_discord_id = $1`,
      [req.user!.discord_id]
    );
    const favSet = new Set(fav.rows.map((r) => r.staff_discord_id));
    const result = r.rows.map((s: any) => ({
      ...s,
      online: isOnline(s.discord_id),
      win_rate: s.resolved_cases > 0 ? Math.round((s.won_cases / s.resolved_cases) * 100) : null,
      favorited: favSet.has(s.discord_id),
    }));
    return res.json(result);
  } catch (err) {
    console.error('[staff-public GET]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.post('/:discordId/favorite', validate({ params: DiscordIdParam, query: emptyQuerySchema, body: emptyBodySchema }), async (req: Request, res: Response) => {
  try {
    await pool.query(
      `INSERT INTO specialist_favorites (user_discord_id, staff_discord_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user!.discord_id, req.params.discordId]
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

router.delete('/:discordId/favorite', validate({ params: DiscordIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    await pool.query(
      `DELETE FROM specialist_favorites WHERE user_discord_id = $1 AND staff_discord_id = $2`,
      [req.user!.discord_id, req.params.discordId]
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

export default router;
