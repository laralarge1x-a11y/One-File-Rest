import { Router, Request, Response } from 'express';
import pool from '../db/client.js';

const router = Router();

/**
 * GET /api/policies - List all policy alerts
 */
router.get('/', async (req: Request, res: Response) => {
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
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

/**
 * GET /api/policies/:id - Single policy alert
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, title, summary AS content, full_content, source_url,
              tiktok_category, severity, affects_niches, published_at AS created_at
       FROM policy_alerts WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching policy:', err);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

/**
 * POST /api/policies - Create a new policy alert (staff only)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, content, severity, tiktok_category, source_url, affects_niches } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

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

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

export default router;
