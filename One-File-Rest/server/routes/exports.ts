import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { streamCasePdf } from '../services/pdf.js';
import { validate } from '../middleware/index.js';
import { emptyQuerySchema } from '../../shared/schemas.js';

const router = Router();
const STAFF = ['support', 'case_manager', 'owner', 'admin'];

const CasePdfParam = z.object({ id: z.coerce.number().int().positive() }).strict();

router.get('/case/:id.pdf', validate({ params: CasePdfParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(req.params.id);
    const isStaff = STAFF.includes(req.user?.role || '');
    if (!isStaff) {
      const own = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (own.rows[0]?.user_discord_id !== req.user!.discord_id) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
    }
    await streamCasePdf(caseId, res);
    return;
  } catch (err) {
    console.error('[exports/case pdf]', { req_id: req.id, err });
    if (!res.headersSent) res.status(500).json({ error: { code: 'internal', message: 'Failed to generate PDF', requestId: req.id } });
    return;
  }
});

export default router;
