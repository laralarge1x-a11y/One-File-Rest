import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { validate } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';

const router = Router();
const STAFF = ['support', 'case_manager', 'owner', 'admin'];

const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();
const ChecklistPatchBody = z.object({
  completed: z.boolean().optional(),
  evidence_id: z.coerce.number().int().positive().nullable().optional(),
  label: z.string().max(300).optional(),
  required: z.boolean().optional(),
}).strict();
const ChecklistCreateBody = z.object({
  case_id: z.coerce.number().int().positive(),
  stage: z.string().min(1).max(80),
  label: z.string().min(1).max(300),
  required: z.boolean().optional(),
}).strict();

// Default checklist items per stage
const STAGE_DEFAULTS: Record<string, Array<{ label: string; required: boolean }>> = {
  'Submitted': [
    { label: 'Account username & URL', required: true },
    { label: 'Violation type identified', required: true },
    { label: 'Violation description provided', required: true },
  ],
  'In Review': [
    { label: 'Screenshot of violation notice', required: true },
    { label: 'Account purchase date confirmed', required: true },
    { label: 'Total GMV reported', required: false },
    { label: 'Commission frozen amount (if applicable)', required: false },
  ],
  'Appeal Drafted': [
    { label: 'Draft appeal text reviewed by client', required: true },
    { label: 'Supporting evidence attached', required: true },
  ],
  'Appeal Sent': [
    { label: 'Appeal submission confirmation', required: true },
    { label: 'Submission timestamp recorded', required: true },
  ],
  'Awaiting TikTok': [
    { label: 'Follow-up reminder set', required: false },
  ],
  'Resolved': [
    { label: 'Outcome notes recorded', required: true },
    { label: 'Final response from TikTok attached', required: false },
  ],
};

async function ensureDefaults(caseId: number) {
  const existing = await pool.query('SELECT 1 FROM case_checklist_items WHERE case_id = $1 LIMIT 1', [caseId]);
  if (existing.rows.length > 0) return;
  for (const [stage, items] of Object.entries(STAGE_DEFAULTS)) {
    for (let i = 0; i < items.length; i++) {
      await pool.query(
        `INSERT INTO case_checklist_items (case_id, stage, label, required, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [caseId, stage, items[i].label, items[i].required, i]
      );
    }
  }
}

async function canAccess(req: Request, caseId: number): Promise<boolean> {
  if (STAFF.includes(req.user?.role || '')) return true;
  const r = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
  return r.rows[0]?.user_discord_id === req.user?.discord_id;
}

router.get('/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(req.params.caseId);
    if (!await canAccess(req, caseId)) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
    await ensureDefaults(caseId);
    const r = await pool.query(
      `SELECT * FROM case_checklist_items WHERE case_id = $1 ORDER BY stage, sort_order, id`,
      [caseId]
    );
    return res.json(r.rows);
  } catch (err) {
    console.error('[checklist GET]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.patch('/:id', validate({ params: idParamSchema, body: ChecklistPatchBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const item = await pool.query('SELECT * FROM case_checklist_items WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Not found', requestId: req.id } });
    if (!await canAccess(req, item.rows[0].case_id)) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });

    const { completed, evidence_id, label, required } = req.body || {};
    const r = await pool.query(
      `UPDATE case_checklist_items SET
         completed = COALESCE($1, completed),
         completed_at = CASE WHEN $1 = true THEN NOW() WHEN $1 = false THEN NULL ELSE completed_at END,
         completed_by = CASE WHEN $1 = true THEN $2 ELSE completed_by END,
         evidence_id = COALESCE($3, evidence_id),
         label = COALESCE($4, label),
         required = COALESCE($5, required)
       WHERE id = $6 RETURNING *`,
      [typeof completed === 'boolean' ? completed : null, req.user!.discord_id, evidence_id ?? null,
       label ?? null, typeof required === 'boolean' ? required : null, req.params.id]
    );
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('[checklist PATCH]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.post('/', validate({ body: ChecklistCreateBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
  try {
    const { case_id, stage, label, required } = req.body;
    const r = await pool.query(
      `INSERT INTO case_checklist_items (case_id, stage, label, required) VALUES ($1, $2, $3, $4) RETURNING *`,
      [case_id, stage, label, required !== false]
    );
    return res.status(201).json(r.rows[0]);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

router.delete('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
  try {
    await pool.query('DELETE FROM case_checklist_items WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

// Helper export: check if all required items in a stage are complete
export async function isStageComplete(caseId: number, stage: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE required = true AND completed = false)::int AS missing
       FROM case_checklist_items WHERE case_id = $1 AND stage = $2`,
    [caseId, stage]
  );
  return (r.rows[0]?.missing ?? 0) === 0;
}

export default router;
