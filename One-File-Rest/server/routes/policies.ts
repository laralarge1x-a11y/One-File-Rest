import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { validate } from '../middleware/index.js';
import { idParamSchema, policyAlertSeverityEnum, emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';
import { logAudit } from '../services/webhook.js';

const router = Router();

const STAFF_ROLES = new Set(['support', 'case_manager', 'owner', 'admin']);
function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!STAFF_ROLES.has(req.user?.role || '')) {
    res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
    return;
  }
  next();
}

const PolicyCreateBody = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20_000),
  severity: policyAlertSeverityEnum.optional(),
  tiktok_category: z.string().max(80).optional().nullable(),
  source_url: z.string().url().max(500).optional().nullable(),
  affects_niches: z.array(z.string().max(80)).max(50).optional(),
}).strict();

/**
 * GET /api/policies - List all policy alerts
 */
router.get('/', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        summary AS content,
        COALESCE(full_content, summary) AS full_content,
        source_url,
        tiktok_category,
        severity,
        affects_niches,
        published_at AS created_at,
        is_auto_generated
      FROM policy_alerts
      ORDER BY published_at DESC
      LIMIT 100
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching policies:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch policies', requestId: req.id } });
  }
});

/**
 * GET /api/policies/:id - Single policy alert
 */
router.get('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, title, summary AS content, full_content, source_url,
              tiktok_category, severity, affects_niches, published_at AS created_at
       FROM policy_alerts WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Policy not found', requestId: req.id } });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching policy:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch policy', requestId: req.id } });
  }
});

/**
 * POST /api/policies - Create a new policy alert (staff only)
 */
router.post('/', requireStaff, validate({ body: PolicyCreateBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { title, content, severity, tiktok_category, source_url, affects_niches } = req.body;
    const result = await pool.query(
      `INSERT INTO policy_alerts (title, summary, full_content, severity, tiktok_category, source_url, affects_niches, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, title, summary AS content, severity, published_at AS created_at`,
      [
        title,
        content,
        content,
        severity || 'info',
        tiktok_category || null,
        source_url || null,
        affects_niches || [],
      ]
    );
    const row = result.rows[0];
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'policy_alert_created',
      targetType: 'policy_alert',
      targetId: row.id,
      details: { from: null, to: { title, severity: severity || 'info', tiktok_category: tiktok_category || null, source_url: source_url || null } },
    }).catch(() => {});
    return res.status(201).json(row);
  } catch (err) {
    console.error('[policies POST]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to create policy', requestId: req.id } });
  }
});

export default router;
