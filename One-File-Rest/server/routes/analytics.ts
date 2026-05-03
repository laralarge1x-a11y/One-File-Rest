import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { validate } from '../middleware/index.js';
import { discordIdSchema, emptyQuerySchema, emptyParamsSchema } from '../../shared/schemas.js';
import { z } from 'zod';

const router = Router();
const DiscordIdParam = z.object({ discordId: discordIdSchema }).strict();

/**
 * GET /api/analytics - Admin dashboard stats
 */
router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const [clientsResult, casesResult, _revenueResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM users`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('won','denied','closed')) as active_cases,
          COUNT(*) FILTER (WHERE outcome = 'won') as won_cases
        FROM cases
      `),
      pool.query(`SELECT COALESCE(SUM(0), 0) as total FROM subscriptions WHERE status = 'active'`),
    ]);

    return res.json({
      totalClients: parseInt(clientsResult.rows[0].count),
      activeCases: parseInt(casesResult.rows[0].active_cases),
      wonCases: parseInt(casesResult.rows[0].won_cases),
      totalRevenue: 0,
      avgComplianceScore: 0,
    });
  } catch (err) {
    console.error('Analytics error:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch analytics', requestId: req.id } });
  }
});

/**
 * GET /api/analytics/clients - List all clients with case counts
 */
router.get('/clients', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.discord_id,
        u.discord_username,
        COALESCE(u.email, '') as email,
        COUNT(c.id) as total_cases,
        COUNT(c.id) FILTER (WHERE c.outcome = 'won') as won_cases,
        u.created_at
      FROM users u
      LEFT JOIN cases c ON u.discord_id = c.user_discord_id
      GROUP BY u.id, u.discord_id, u.discord_username, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);

    const clients = result.rows.map((row) => ({
      ...row,
      total_cases: parseInt(row.total_cases),
      won_cases: parseInt(row.won_cases),
      compliance_score: 0,
    }));

    return res.json(clients);
  } catch (err) {
    console.error('Clients analytics error:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch clients', requestId: req.id } });
  }
});

/**
 * GET /api/analytics/clients/:discordId - Single client profile
 */
router.get('/clients/:discordId', validate({ params: DiscordIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;

    const userResult = await pool.query(
      `SELECT id, discord_id, discord_username, COALESCE(email, '') as email, created_at
       FROM users WHERE discord_id = $1`,
      [discordId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Client not found', requestId: req.id } });
    }

    const user = userResult.rows[0];

    const casesResult = await pool.query(
      `SELECT id, account_username, violation_type, status, created_at
       FROM cases WHERE user_discord_id = $1 ORDER BY created_at DESC`,
      [discordId]
    );

    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total_cases,
         COUNT(*) FILTER (WHERE outcome = 'won') as won_cases
       FROM cases WHERE user_discord_id = $1`,
      [discordId]
    );

    return res.json({
      ...user,
      total_cases: parseInt(statsResult.rows[0].total_cases),
      won_cases: parseInt(statsResult.rows[0].won_cases),
      compliance_score: 0,
      cases: casesResult.rows,
    });
  } catch (err) {
    console.error('Client profile error:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch client profile', requestId: req.id } });
  }
});

/**
 * GET /api/analytics/staff - List all staff members
 */
router.get('/staff', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.discord_id,
        s.name as discord_username,
        '' as email,
        s.role,
        s.active,
        s.created_at
      FROM staff s
      ORDER BY s.created_at DESC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error('Staff analytics error:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch staff', requestId: req.id } });
  }
});

export default router;
