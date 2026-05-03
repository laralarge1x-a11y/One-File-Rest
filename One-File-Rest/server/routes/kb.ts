import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { validate } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';

const router = Router();
const STAFF = ['support', 'case_manager', 'owner', 'admin'];

const KbListQuery = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
}).strict();
const KbCreateBody = z.object({
  slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(300),
  category: z.string().max(80).optional().nullable(),
  body_md: z.string().min(1).max(200_000),
  tags: z.array(z.string().max(60)).max(50).optional(),
  published: z.boolean().optional(),
}).strict();
const KbPatchBody = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z.string().max(80).optional().nullable(),
  body_md: z.string().min(1).max(200_000).optional(),
  tags: z.array(z.string().max(60)).max(50).optional(),
  published: z.boolean().optional(),
}).strict();
const KbFeedbackBody = z.object({
  helpful: z.boolean(),
  note: z.string().max(2000).optional().nullable(),
}).strict();

router.get('/', validate({ query: KbListQuery, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { q, category } = req.query;
    const isStaff = STAFF.includes(req.user?.role || '');
    const conditions: string[] = [];
    const values: any[] = [];
    let p = 1;
    if (!isStaff) conditions.push(`published = true`);
    if (q) { conditions.push(`(title ILIKE $${p} OR body_md ILIKE $${p})`); values.push(`%${q}%`); p++; }
    if (category) { conditions.push(`category = $${p++}`); values.push(category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const r = await pool.query(
      `SELECT id, slug, title, category, tags, published, view_count, updated_at,
              substring(body_md FROM 1 FOR 240) AS excerpt
         FROM kb_articles ${where} ORDER BY updated_at DESC LIMIT 100`,
      values
    );
    return res.json(r.rows);
  } catch (err) {
    console.error('[kb GET]', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.get('/categories', validate({ query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT category, COUNT(*)::int as count FROM kb_articles WHERE published = true AND category IS NOT NULL GROUP BY category ORDER BY count DESC`
    );
    return res.json(r.rows);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

const KbSlugParam = z.object({ slug: z.string().min(1).max(160).regex(/^[a-z0-9-]+$/) }).strict();
router.get('/:slug', validate({ params: KbSlugParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const isStaff = STAFF.includes(req.user?.role || '');
    const r = await pool.query(
      `SELECT * FROM kb_articles WHERE slug = $1 ${isStaff ? '' : 'AND published = true'}`,
      [req.params.slug]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Not found', requestId: req.id } });
    pool.query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1', [r.rows[0].id]).catch(() => {});
    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.post('/', validate({ body: KbCreateBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
  try {
    const { slug, title, category, body_md, tags, published } = req.body;
    const r = await pool.query(
      `INSERT INTO kb_articles (slug, title, category, body_md, tags, published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [slug, title, category || null, body_md, tags || [], published !== false, req.user!.discord_id]
    );
    return res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: { code: 'conflict', message: 'Slug already exists', requestId: req.id } });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } });
  }
});

router.patch('/:id', validate({ params: idParamSchema, body: KbPatchBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
  try {
    const { title, category, body_md, tags, published } = req.body;
    const r = await pool.query(
      `UPDATE kb_articles SET
         title = COALESCE($1, title),
         category = COALESCE($2, category),
         body_md = COALESCE($3, body_md),
         tags = COALESCE($4, tags),
         published = COALESCE($5, published),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title ?? null, category ?? null, body_md ?? null, tags ?? null, typeof published === 'boolean' ? published : null, req.params.id]
    );
    return res.json(r.rows[0]);
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

router.delete('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
  try {
    await pool.query('DELETE FROM kb_articles WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

router.post('/:id/feedback', validate({ params: idParamSchema, body: KbFeedbackBody, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { helpful, note } = req.body;
    await pool.query(
      `INSERT INTO kb_article_feedback (article_id, user_discord_id, helpful, note) VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user!.discord_id, !!helpful, note || null]
    );
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ error: { code: 'internal', message: 'Failed', requestId: req.id } }); }
});

export default router;
