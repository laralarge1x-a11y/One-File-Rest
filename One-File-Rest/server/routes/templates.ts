import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { createTemplateSchema, updateTemplateSchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/templates - Get all templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM appeal_templates WHERE active = true ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/templates/:id - Get specific template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM appeal_templates WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/templates - Create new template
 */
router.post('/', validateRequest(createTemplateSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { violationType, templateName, templateBody, variables, winRate } = validatedData;
    const createdBy = req.user?.discord_id;

    const result = await pool.query(
      `INSERT INTO appeal_templates (violation_type, template_name, template_body, variables, win_rate, created_by, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [violationType, templateName, templateBody, JSON.stringify(variables || []), winRate || null, createdBy, true]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * PUT /api/templates/:id - Update template
 */
router.put('/:id', validateRequest(updateTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = (req as any).validatedBody;

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (validatedData.templateName !== undefined) {
      updates.push(`template_name = $${paramCount++}`);
      values.push(validatedData.templateName);
    }
    if (validatedData.templateBody !== undefined) {
      updates.push(`template_body = $${paramCount++}`);
      values.push(validatedData.templateBody);
    }
    if (validatedData.variables !== undefined) {
      updates.push(`variables = $${paramCount++}`);
      values.push(JSON.stringify(validatedData.variables));
    }
    if (validatedData.winRate !== undefined) {
      updates.push(`win_rate = $${paramCount++}`);
      values.push(validatedData.winRate);
    }
    if (validatedData.active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      values.push(validatedData.active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `UPDATE appeal_templates SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/templates/:id - Delete template (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE appeal_templates SET active = false WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
