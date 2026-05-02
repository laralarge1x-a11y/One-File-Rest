import { Router, Request, Response } from 'express';
import pool from '../db/client.js';

const router = Router();
const STAFF = ['support', 'case_manager', 'owner', 'admin'];

router.get('/', async (req: Request, res: Response) => {
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
    res.json(r.rows);
  } catch (err) {
    console.error('[kb GET]', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT category, COUNT(*)::int as count FROM kb_articles WHERE published = true AND category IS NOT NULL GROUP BY category ORDER BY count DESC`
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const isStaff = STAFF.includes(req.user?.role || '');
    const r = await pool.query(
      `SELECT * FROM kb_articles WHERE slug = $1 ${isStaff ? '' : 'AND published = true'}`,
      [req.params.slug]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    pool.query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1', [r.rows[0].id]).catch(() => {});
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { slug, title, category, body_md, tags, published } = req.body || {};
    if (!slug || !title || !body_md) return res.status(400).json({ error: 'slug, title, body_md required' });
    const r = await pool.query(
      `INSERT INTO kb_articles (slug, title, category, body_md, tags, published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [slug, title, category || null, body_md, tags || [], published !== false, req.user!.discord_id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Slug already exists' });
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { title, category, body_md, tags, published } = req.body || {};
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
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user?.role || '')) return res.status(403).json({ error: 'Forbidden' });
  try {
    await pool.query('DELETE FROM kb_articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { helpful, note } = req.body || {};
    await pool.query(
      `INSERT INTO kb_article_feedback (article_id, user_discord_id, helpful, note) VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user!.discord_id, !!helpful, note || null]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
