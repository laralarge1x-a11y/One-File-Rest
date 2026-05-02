import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { streamCasePdf } from '../services/pdf.js';

const router = Router();
const STAFF = ['support', 'case_manager', 'owner', 'admin'];

router.get('/case/:id.pdf', async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(req.params.id);
    if (!Number.isFinite(caseId)) return res.status(400).json({ error: 'Invalid id' });
    const isStaff = STAFF.includes(req.user?.role || '');
    if (!isStaff) {
      const own = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (own.rows[0]?.user_discord_id !== req.user!.discord_id) return res.status(403).json({ error: 'Forbidden' });
    }
    await streamCasePdf(caseId, res);
  } catch (err) {
    console.error('[exports/case pdf]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
