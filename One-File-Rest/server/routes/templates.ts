import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { logAudit } from '../services/webhook.js';
import { ah, validate, Errors } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────
const TemplateBody = z.object({
  name: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20_000),
  violation_type: z.string().trim().min(1).max(120),
}).strict();

const TemplatePatchBody = TemplateBody.partial();

function extractVariables(content: string): string[] {
  const re = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const out: string[] = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

/** GET /api/templates */
router.get(
  '/',
  validate({ query: emptyQuerySchema, params: emptyParamsSchema }),
  ah(async (_req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT id, violation_type, template_name AS name, template_body AS content,
              variables, win_rate, use_count, active, created_at, updated_at
         FROM appeal_templates
        WHERE active = true
        ORDER BY use_count DESC, created_at DESC`
    );
    res.json(result.rows);
  })
);

/** GET /api/templates/:id */
router.get(
  '/:id', validate({ params: idParamSchema, query: emptyQuerySchema }),
  ah(async (req: Request, res: Response) => {
    const result = await pool.query(
      `SELECT id, violation_type, template_name AS name, template_body AS content,
              variables, win_rate, use_count, active, created_at, updated_at
         FROM appeal_templates WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) throw Errors.notFound('Template not found');
    res.json(result.rows[0]);
  })
);

/** POST /api/templates */
router.post(
  '/',
  validate({ body: TemplateBody, query: emptyQuerySchema, params: emptyParamsSchema }),
  ah(async (req: Request, res: Response) => {
    const { name, content, violation_type } = req.body;
    const variables = extractVariables(content);
    const result = await pool.query(
      `INSERT INTO appeal_templates (violation_type, template_name, template_body, variables, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, violation_type, template_name AS name, template_body AS content, variables, use_count, created_at`,
      [violation_type, name, content, JSON.stringify(variables)]
    );
    const row = result.rows[0];
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'template_created',
      targetType: 'template',
      targetId: row.id,
      details: {
        before: null,
        after: { name, violation_type, variables },
        diff: {
          created: true,
          name: { before: null, after: name },
          violation_type: { before: null, after: violation_type },
          variables: { before: null, after: variables },
        },
      },
    }).catch(console.error);
    res.status(201).json(row);
  })
);

/** PUT /api/templates/:id */
router.put(
  '/:id',
  validate({ params: idParamSchema, body: TemplatePatchBody, query: emptyQuerySchema }),
  ah(async (req: Request, res: Response) => {
    const id = req.params.id;
    const { name, content, violation_type } = req.body;
    const variables = content ? extractVariables(content) : null;

    const before = await pool.query(
      `SELECT template_name AS name, template_body AS content, violation_type, variables
         FROM appeal_templates WHERE id = $1`,
      [id]
    );
    if (before.rows.length === 0) throw Errors.notFound('Template not found');

    const result = await pool.query(
      `UPDATE appeal_templates
          SET template_name  = COALESCE($1, template_name),
              template_body  = COALESCE($2, template_body),
              violation_type = COALESCE($3, violation_type),
              variables      = COALESCE($4::jsonb, variables),
              updated_at     = NOW()
        WHERE id = $5
        RETURNING id, violation_type, template_name AS name, template_body AS content, variables, use_count, updated_at`,
      [name ?? null, content ?? null, violation_type ?? null, variables ? JSON.stringify(variables) : null, id]
    );

    const row = result.rows[0];
    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of ['name', 'content', 'violation_type'] as const) {
      if (req.body[k] !== undefined && req.body[k] !== before.rows[0][k]) {
        diff[k] = { before: before.rows[0][k], after: req.body[k] };
      }
    }
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'template_updated',
      targetType: 'template',
      targetId: Number(id),
      details: { diff },
    }).catch(console.error);

    res.json(row);
  })
);

/** DELETE /api/templates/:id  (soft delete) */
router.delete(
  '/:id', validate({ params: idParamSchema, query: emptyQuerySchema }),
  ah(async (req: Request, res: Response) => {
    const id = req.params.id;
    const result = await pool.query(
      `UPDATE appeal_templates SET active = false, updated_at = NOW()
        WHERE id = $1 RETURNING id, template_name AS name`,
      [id]
    );
    if (result.rows.length === 0) throw Errors.notFound('Template not found');
    logAudit({
      actorDiscordId: req.user!.discord_id,
      action: 'template_deleted',
      targetType: 'template',
      targetId: Number(id),
      details: {
        before: { active: true, name: result.rows[0].name },
        after: { active: false, name: result.rows[0].name },
        diff: { active: { before: true, after: false } },
        soft_delete: true,
      },
    }).catch(console.error);
    res.json({ message: 'Template deleted' });
  })
);

export default router;
