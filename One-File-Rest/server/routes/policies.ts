import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { createPolicySchema, updatePolicySchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/policies - Get all policies
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM policy_alerts ORDER BY published_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

/**
 * GET /api/policies/:id - Get specific policy
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM policy_alerts WHERE id = $1`,
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
 * POST /api/policies - Create new policy
 */
router.post('/', validateRequest(createPolicySchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { title, summary, fullContent, sourceUrl, tiktokCategory, severity, affectsNiches } = validatedData;
    const createdBy = req.user?.discord_id;

    const result = await pool.query(
      `INSERT INTO policy_alerts (title, summary, full_content, source_url, tiktok_category, severity, affects_niches, created_by, is_auto_generated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, summary, fullContent || null, sourceUrl || null, tiktokCategory || null, severity || 'info', JSON.stringify(affectsNiches || []), createdBy, false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating policy:', err);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

/**
 * PUT /api/policies/:id - Update policy
 */
router.put('/:id', validateRequest(updatePolicySchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = (req as any).validatedBody;

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (validatedData.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(validatedData.title);
    }
    if (validatedData.summary !== undefined) {
      updates.push(`summary = $${paramCount++}`);
      values.push(validatedData.summary);
    }
    if (validatedData.fullContent !== undefined) {
      updates.push(`full_content = $${paramCount++}`);
      values.push(validatedData.fullContent);
    }
    if (validatedData.sourceUrl !== undefined) {
      updates.push(`source_url = $${paramCount++}`);
      values.push(validatedData.sourceUrl);
    }
    if (validatedData.tiktokCategory !== undefined) {
      updates.push(`tiktok_category = $${paramCount++}`);
      values.push(validatedData.tiktokCategory);
    }
    if (validatedData.severity !== undefined) {
      updates.push(`severity = $${paramCount++}`);
      values.push(validatedData.severity);
    }
    if (validatedData.affectsNiches !== undefined) {
      updates.push(`affects_niches = $${paramCount++}`);
      values.push(JSON.stringify(validatedData.affectsNiches));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const updateQuery = `UPDATE policy_alerts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating policy:', err);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

/**
 * DELETE /api/policies/:id - Delete policy
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM policy_alerts WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting policy:', err);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

/**
 * POST /api/policies/:id/mark-read - Mark policy as read
 */
router.post('/:id/mark-read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const discordId = req.user?.discord_id;

    await pool.query(
      `INSERT INTO policy_alert_reads (user_discord_id, alert_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [discordId, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error marking policy as read:', err);
    res.status(500).json({ error: 'Failed to mark policy as read' });
  }
});

export default router;
