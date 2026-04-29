import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { io } from '../server';
import { groqAI } from '../services/ai';

const router = Router();

// Advanced policy alert system with AI generation
interface PolicyAlert {
  id: number;
  title: string;
  content: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  affected_users: number;
  created_at: string;
  broadcast_at?: string;
}

// Get all policies
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { category, severity, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM policies WHERE 1=1';
    const params: any[] = [];

    if (category) {
      query += ` AND category = $${params.length + 1}`;
      params.push(category);
    }

    if (severity) {
      query += ` AND severity = $${params.length + 1}`;
      params.push(severity);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Get policy by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const policy = await db.query(
      'SELECT * FROM policies WHERE id = $1',
      [id]
    );

    if (policy.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json(policy.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// Create policy manually
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, severity, category, tags } = req.body;

    const result = await db.query(
      `INSERT INTO policies (title, content, severity, category, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [title, content, severity, category, JSON.stringify(tags || [])]
    );

    const policy = result.rows[0];

    // Broadcast to all connected clients
    io.emit('policy:new', policy);

    res.status(201).json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

// Generate policy using AI
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { topic, severity, context } = req.body;

    const prompt = `Generate a TikTok policy alert about "${topic}".
    Severity: ${severity}
    Context: ${context}

    Format as JSON with fields: title, content, category, key_points (array)`;

    const aiResponse = await groqAI.generateText(prompt);
    const parsed = JSON.parse(aiResponse);

    const result = await db.query(
      `INSERT INTO policies (title, content, severity, category, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        parsed.title,
        parsed.content,
        severity,
        parsed.category,
        JSON.stringify(parsed.key_points || []),
      ]
    );

    const policy = result.rows[0];

    // Broadcast to all connected clients
    io.emit('policy:new', policy);

    res.status(201).json({
      policy,
      generated: true,
      ai_response: parsed,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate policy' });
  }
});

// Update policy
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, severity, category, tags } = req.body;

    const result = await db.query(
      `UPDATE policies
       SET title = $1, content = $2, severity = $3, category = $4, tags = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [title, content, severity, category, JSON.stringify(tags || []), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policy = result.rows[0];

    // Broadcast update
    io.emit('policy:updated', policy);

    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// Delete policy
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM policies WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Broadcast deletion
    io.emit('policy:deleted', { id });

    res.json({ message: 'Policy deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

// Broadcast policy to users
router.post('/:id/broadcast', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { segment = 'all', channels = ['portal', 'discord'] } = req.body;

    const policy = await db.query(
      'SELECT * FROM policies WHERE id = $1',
      [id]
    );

    if (policy.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    const policyData = policy.rows[0];

    // Get target users based on segment
    let userQuery = 'SELECT id, discord_id FROM users WHERE 1=1';
    const params: any[] = [];

    if (segment === 'high_compliance') {
      userQuery += ` AND id IN (
        SELECT user_id FROM compliance_scores WHERE score >= 80
      )`;
    } else if (segment === 'low_compliance') {
      userQuery += ` AND id IN (
        SELECT user_id FROM compliance_scores WHERE score < 60
      )`;
    } else if (segment === 'active') {
      userQuery += ` AND id IN (
        SELECT DISTINCT client_id FROM cases WHERE created_at > NOW() - INTERVAL '30 days'
      )`;
    }

    const users = await db.query(userQuery, params);

    // Broadcast to portal
    if (channels.includes('portal')) {
      io.emit('policy:broadcast', {
        policy: policyData,
        timestamp: new Date(),
      });
    }

    // Broadcast to Discord (if configured)
    if (channels.includes('discord')) {
      // Send to Discord bot bridge
      // This would integrate with your Discord bot
    }

    // Log broadcast
    await db.query(
      `INSERT INTO broadcasts (policy_id, segment, channels, user_count, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, segment, JSON.stringify(channels), users.rows.length]
    );

    res.json({
      message: 'Policy broadcasted',
      users_reached: users.rows.length,
      channels,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to broadcast policy' });
  }
});

// Get policy analytics
router.get('/:id/analytics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const analytics = await db.query(
      `SELECT
        COUNT(*) as total_broadcasts,
        SUM(user_count) as total_users_reached,
        MAX(created_at) as last_broadcast
       FROM broadcasts
       WHERE policy_id = $1`,
      [id]
    );

    res.json(analytics.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Search policies
router.get('/search/:query', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query } = req.params;

    const result = await db.query(
      `SELECT * FROM policies
       WHERE title ILIKE $1 OR content ILIKE $1 OR tags::text ILIKE $1
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search policies' });
  }
});

// Get trending policies
router.get('/trending/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT p.*, COUNT(b.id) as broadcast_count
       FROM policies p
       LEFT JOIN broadcasts b ON p.id = b.policy_id
       GROUP BY p.id
       ORDER BY broadcast_count DESC, p.created_at DESC
       LIMIT 10`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending policies' });
  }
});

export default router;
