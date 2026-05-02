import { Router, Request, Response } from 'express';
import pool from '../db/client.js';

const router = Router();

/**
 * GET /api/templates - List all appeal templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, violation_type, template_name AS name, template_body AS content,
              variables, win_rate, use_count, active, created_at, updated_at
       FROM appeal_templates
       WHERE active = true
       ORDER BY use_count DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/templates/:id - Single template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, violation_type, template_name AS name, template_body AS content,
              variables, win_rate, use_count, active, created_at, updated_at
       FROM appeal_templates WHERE id = $1`,
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
 * POST /api/templates - Create template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, content, violation_type, description } = req.body;

    if (!name || !content || !violation_type) {
      return res.status(400).json({ error: 'name, content, and violation_type are required' });
    }

    const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const result = await pool.query(
      `INSERT INTO appeal_templates (violation_type, template_name, template_body, variables, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, violation_type, template_name AS name, template_body AS content, variables, use_count, created_at`,
      [violation_type, name, content, JSON.stringify(variables)]
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, content, violation_type } = req.body;

    const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(content || '')) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const result = await pool.query(
      `UPDATE appeal_templates
       SET template_name = COALESCE($1, template_name),
           template_body = COALESCE($2, template_body),
           violation_type = COALESCE($3, violation_type),
           variables = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, violation_type, template_name AS name, template_body AS content, variables, use_count, updated_at`,
      [name, content, violation_type, JSON.stringify(variables), id]
    );

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
 * DELETE /api/templates/:id - Soft delete (deactivate) template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE appeal_templates SET active = false, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
