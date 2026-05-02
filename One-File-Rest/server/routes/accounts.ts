import { Router, Request, Response } from 'express';
import pool from '../db/client.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
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
  } catch (err) {
    console.error('[accounts GET]', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, account_url, notes, is_primary } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    if (is_primary) {
      await pool.query('UPDATE tiktok_accounts SET is_primary = false WHERE user_discord_id = $1', [req.user!.discord_id]);
    }
    const r = await pool.query(
      `INSERT INTO tiktok_accounts (user_discord_id, username, account_url, notes, is_primary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.discord_id, username, account_url || null, notes || null, !!is_primary]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[accounts POST]', err);
    res.status(500).json({ error: 'Failed to add account' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, account_url, notes, is_primary } = req.body || {};
    const own = await pool.query('SELECT id FROM tiktok_accounts WHERE id = $1 AND user_discord_id = $2', [id, req.user!.discord_id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (is_primary) {
      await pool.query('UPDATE tiktok_accounts SET is_primary = false WHERE user_discord_id = $1', [req.user!.discord_id]);
    }
    const r = await pool.query(
      `UPDATE tiktok_accounts SET
         username = COALESCE($1, username),
         account_url = COALESCE($2, account_url),
         notes = COALESCE($3, notes),
         is_primary = COALESCE($4, is_primary)
       WHERE id = $5 RETURNING *`,
      [username ?? null, account_url ?? null, notes ?? null, typeof is_primary === 'boolean' ? is_primary : null, id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tiktok_accounts WHERE id = $1 AND user_discord_id = $2', [id, req.user!.discord_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
