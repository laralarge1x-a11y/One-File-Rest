import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { fireWebhook, buildEvidenceUploadedEmbed, logAudit } from '../services/webhook.js';
import { validate } from '../middleware/index.js';
import { idParamSchema, emptyQuerySchema , emptyParamsSchema} from '../../shared/schemas.js';

const router = Router();

const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();
const EvidenceBody = z.object({
  case_id: z.coerce.number().int().positive(),
  file_name: z.string().max(300).optional(),
  file_type: z.string().max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  cloudinary_public_id: z.string().max(300).optional().nullable(),
  thumbnail_url: z.string().url().max(2000).optional().nullable(),
  file_url: z.string().max(10_000_000).optional(),
  base64: z.string().max(10_000_000).optional(),
}).strict();

router.get('/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!isStaff) {
      const check = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (check.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
      if (check.rows[0].user_discord_id !== discordId) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
    }

    const result = await pool.query(
      `SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`,
      [caseId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching evidence:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch evidence', requestId: req.id } });
  }
});

// 8 MB cap on inline data URLs to prevent DoS through unbounded camera/share uploads.
const MAX_DATA_URL_BYTES = 8 * 1024 * 1024;

router.post('/', validate({ body: EvidenceBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { case_id, file_name, file_type, description, cloudinary_public_id, thumbnail_url, base64 } = req.body;
    let { file_url } = req.body;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!file_url && typeof base64 === 'string' && base64.length > 0) {
      file_url = /^data:/.test(base64)
        ? base64
        : `data:${file_type || 'application/octet-stream'};base64,${base64}`;
    }

    if (!case_id || !file_url) return res.status(400).json({ error: { code: 'bad_request', message: 'case_id and file_url (or base64) required', requestId: req.id } });

    if (typeof file_url === 'string' && file_url.startsWith('data:') && file_url.length > MAX_DATA_URL_BYTES) {
      return res.status(413).json({ error: { code: 'payload_too_large', message: `Inline upload too large (max ${MAX_DATA_URL_BYTES} bytes). Use Cloudinary upload instead.`, requestId: req.id } });
    }

    const caseResult = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [case_id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    const caseOwner = caseResult.rows[0].user_discord_id;

    if (!isStaff && caseOwner !== discordId) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });

    const result = await pool.query(
      `INSERT INTO evidence (case_id, uploaded_by_discord_id, cloudinary_public_id, file_url, thumbnail_url, file_type, file_name, description, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [case_id, discordId, cloudinary_public_id || null, file_url, thumbnail_url || null, file_type || 'unknown', file_name || 'file', description || null]
    );
    const evidence = result.rows[0];

    // Webhook + audit (non-blocking)
    fireWebhook(caseOwner, 'evidence_uploaded', buildEvidenceUploadedEmbed({
      caseId: case_id,
      fileName: file_name || 'file',
      uploadedBy: req.user!.discord_username,
    }));
    logAudit({ actorDiscordId: discordId, action: 'evidence_uploaded', targetType: 'case', targetId: case_id, details: { file_name } }).catch(console.error);

    return res.status(201).json(evidence);
  } catch (err) {
    console.error('Error uploading evidence:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to upload evidence', requestId: req.id } });
  }
});

router.delete('/:id', validate({ params: idParamSchema, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    const ev = await pool.query('SELECT uploaded_by_discord_id, case_id, file_name FROM evidence WHERE id = $1', [id]);
    if (ev.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Evidence not found', requestId: req.id } });
    if (!isStaff && ev.rows[0].uploaded_by_discord_id !== discordId) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });

    await pool.query('DELETE FROM evidence WHERE id = $1', [id]);
    logAudit({
      actorDiscordId: discordId,
      action: 'evidence_deleted',
      targetType: 'evidence',
      targetId: parseInt(String(id)),
      details: { case_id: ev.rows[0].case_id, file_name: ev.rows[0].file_name },
    }).catch(console.error);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting evidence:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to delete evidence', requestId: req.id } });
  }
});

export default router;
