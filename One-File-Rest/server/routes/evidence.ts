import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { fireWebhook, buildEvidenceUploadedEmbed, logAudit } from '../services/webhook.js';

const router = Router();

router.get('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!isStaff) {
      const check = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
      if (check.rows[0].user_discord_id !== discordId) return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `SELECT * FROM evidence WHERE case_id = $1 ORDER BY uploaded_at DESC`,
      [caseId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching evidence:', err);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { case_id, file_url, file_name, file_type, description, cloudinary_public_id, thumbnail_url } = req.body;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!case_id || !file_url) return res.status(400).json({ error: 'case_id and file_url required' });

    const caseResult = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [case_id]);
    if (caseResult.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const caseOwner = caseResult.rows[0].user_discord_id;

    if (!isStaff && caseOwner !== discordId) return res.status(403).json({ error: 'Forbidden' });

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

    res.status(201).json(evidence);
  } catch (err) {
    console.error('Error uploading evidence:', err);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    const ev = await pool.query('SELECT uploaded_by_discord_id FROM evidence WHERE id = $1', [id]);
    if (ev.rows.length === 0) return res.status(404).json({ error: 'Evidence not found' });
    if (!isStaff && ev.rows[0].uploaded_by_discord_id !== discordId) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('DELETE FROM evidence WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting evidence:', err);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

export default router;
