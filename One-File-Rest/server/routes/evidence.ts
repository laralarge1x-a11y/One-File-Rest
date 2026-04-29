import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { createEvidenceSchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/evidence/:caseId - Get all evidence for a case
 */
router.get('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const discordId = req.user?.discord_id;

    // Verify case ownership
    const caseResult = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
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

/**
 * POST /api/evidence - Upload evidence file
 */
router.post('/', validateRequest(createEvidenceSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { caseId, cloudinaryPublicId, fileUrl, thumbnailUrl, fileType, fileName, description } = validatedData;
    const discordId = req.user?.discord_id;

    // Verify case ownership
    const caseResult = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `INSERT INTO evidence (case_id, uploaded_by_discord_id, cloudinary_public_id, file_url, thumbnail_url, file_type, file_name, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [caseId, discordId, cloudinaryPublicId, fileUrl, thumbnailUrl || null, fileType || null, fileName, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error uploading evidence:', err);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

/**
 * DELETE /api/evidence/:id - Delete evidence
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    // Verify ownership
    const evidenceResult = await pool.query(
      `SELECT e.*, c.user_discord_id FROM evidence e
       JOIN cases c ON e.case_id = c.id
       WHERE e.id = $1`,
      [id]
    );

    if (evidenceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    if (evidenceResult.rows[0].user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.query(`DELETE FROM evidence WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting evidence:', err);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

export default router;
