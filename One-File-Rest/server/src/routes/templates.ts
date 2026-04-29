import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Advanced template variable parser
class TemplateEngine {
  private variables: Map<string, any> = new Map();
  private conditionals: Map<string, boolean> = new Map();
  private loops: Map<string, any[]> = new Map();

  setVariable(key: string, value: any): void {
    this.variables.set(key, value);
  }

  setConditional(key: string, condition: boolean): void {
    this.conditionals.set(key, condition);
  }

  setLoop(key: string, items: any[]): void {
    this.loops.set(key, items);
  }

  parse(template: string): string {
    let result = template;

    // Handle loops: {{#loop:items}}...{{/loop}}
    result = this.parseLoops(result);

    // Handle conditionals: {{?condition}}...{{/condition}}
    result = this.parseConditionals(result);

    // Handle variables: {{variable}}
    result = this.parseVariables(result);

    // Handle filters: {{variable|uppercase}}
    result = this.parseFilters(result);

    // Handle functions: {{function(arg1, arg2)}}
    result = this.parseFunctions(result);

    return result;
  }

  private parseVariables(template: string): string {
    return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (match, key) => {
      const value = this.variables.get(key);
      return value !== undefined ? String(value) : match;
    });
  }

  private parseConditionals(template: string): string {
    const conditionalRegex = /\{\{\?([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    return template.replace(conditionalRegex, (match, key, content) => {
      const condition = this.conditionals.get(key);
      return condition ? content : '';
    });
  }

  private parseLoops(template: string): string {
    const loopRegex = /\{\{#loop:([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/loop\}\}/g;
    return template.replace(loopRegex, (match, key, content) => {
      const items = this.loops.get(key) || [];
      return items
        .map((item, index) => {
          let itemContent = content;
          itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
          itemContent = itemContent.replace(/\{\{index\}\}/g, String(index));
          if (typeof item === 'object') {
            Object.entries(item).forEach(([k, v]) => {
              itemContent = itemContent.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            });
          }
          return itemContent;
        })
        .join('');
    });
  }

  private parseFilters(template: string): string {
    const filterRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\|([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    return template.replace(filterRegex, (match, key, filter) => {
      const value = this.variables.get(key);
      if (value === undefined) return match;

      switch (filter) {
        case 'uppercase':
          return String(value).toUpperCase();
        case 'lowercase':
          return String(value).toLowerCase();
        case 'capitalize':
          return String(value).charAt(0).toUpperCase() + String(value).slice(1);
        case 'reverse':
          return String(value).split('').reverse().join('');
        case 'length':
          return String(String(value).length);
        default:
          return match;
      }
    });
  }

  private parseFunctions(template: string): string {
    const functionRegex = /\{\{(date|concat|substring|replace)\((.*?)\)\}\}/g;
    return template.replace(functionRegex, (match, func, args) => {
      const argList = args.split(',').map((a) => a.trim());
      switch (func) {
        case 'date':
          return new Date().toLocaleDateString();
        case 'concat':
          return argList.map((arg) => this.variables.get(arg) || arg).join('');
        case 'substring':
          const str = this.variables.get(argList[0]) || argList[0];
          return String(str).substring(parseInt(argList[1]), parseInt(argList[2]));
        default:
          return match;
      }
    });
  }
}

// Get all templates
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const templates = await db.query(
      'SELECT * FROM templates ORDER BY created_at DESC'
    );
    res.json(templates.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await db.query(
      'SELECT * FROM templates WHERE id = $1',
      [id]
    );
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create template
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, content, category, description } = req.body;

    // Extract variables from template
    const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    const result = await db.query(
      `INSERT INTO templates (name, content, category, description, variables, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [name, content, category || 'general', description, JSON.stringify(variables)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, content, category, description } = req.body;

    // Extract variables
    const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    const result = await db.query(
      `UPDATE templates
       SET name = $1, content = $2, category = $3, description = $4, variables = $5
       WHERE id = $6
       RETURNING *`,
      [name, content, category, description, JSON.stringify(variables), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM templates WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Render template with variables
router.post('/:id/render', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { variables, conditionals, loops } = req.body;

    const template = await db.query(
      'SELECT * FROM templates WHERE id = $1',
      [id]
    );

    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const engine = new TemplateEngine();

    // Set variables
    Object.entries(variables || {}).forEach(([key, value]) => {
      engine.setVariable(key, value);
    });

    // Set conditionals
    Object.entries(conditionals || {}).forEach(([key, value]) => {
      engine.setConditional(key, value as boolean);
    });

    // Set loops
    Object.entries(loops || {}).forEach(([key, value]) => {
      engine.setLoop(key, value as any[]);
    });

    const rendered = engine.parse(template.rows[0].content);

    res.json({
      template: template.rows[0],
      rendered,
      variables: JSON.parse(template.rows[0].variables),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to render template' });
  }
});

// Clone template
router.post('/:id/clone', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const template = await db.query(
      'SELECT * FROM templates WHERE id = $1',
      [id]
    );

    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const original = template.rows[0];
    const result = await db.query(
      `INSERT INTO templates (name, content, category, description, variables, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        name || `${original.name} (Copy)`,
        original.content,
        original.category,
        original.description,
        original.variables,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to clone template' });
  }
});

// Get template suggestions based on case
router.get('/suggestions/:caseId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const caseData = await db.query(
      'SELECT * FROM cases WHERE id = $1',
      [caseId]
    );

    if (caseData.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const violationType = caseData.rows[0].violation_type;

    // Get templates matching violation type
    const templates = await db.query(
      `SELECT * FROM templates
       WHERE category = $1 OR category = 'general'
       ORDER BY created_at DESC
       LIMIT 5`,
      [violationType.toLowerCase()]
    );

    res.json(templates.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;
