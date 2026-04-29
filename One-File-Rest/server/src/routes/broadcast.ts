import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { io } from '../server';

const router = Router();

// Advanced Bulk Broadcaster with Segment Targeting

interface BroadcastSegment {
  name: string;
  query: string;
  description: string;
}

// Predefined segments
const SEGMENTS: Record<string, BroadcastSegment> = {
  all: {
    name: 'All Users',
    query: 'SELECT id FROM users',
    description: 'Send to all users',
  },
  active: {
    name: 'Active Users',
    query: `SELECT id FROM users WHERE last_active > NOW() - INTERVAL '7 days'`,
    description: 'Users active in last 7 days',
  },
  high_compliance: {
    name: 'High Compliance',
    query: `SELECT DISTINCT u.id FROM users u
            JOIN compliance_scores cs ON u.id = cs.user_id
            WHERE cs.score >= 80`,
    description: 'Users with compliance score >= 80',
  },
  low_compliance: {
    name: 'Low Compliance',
    query: `SELECT DISTINCT u.id FROM users u
            JOIN compliance_scores cs ON u.id = cs.user_id
            WHERE cs.score < 60`,
    description: 'Users with compliance score < 60',
  },
  urgent_deadline: {
    name: 'Urgent Deadline',
    query: `SELECT DISTINCT c.client_id as id FROM cases c
            WHERE c.appeal_deadline <= NOW() + INTERVAL '3 days'
            AND c.appeal_deadline > NOW()
            AND c.status NOT IN ('won', 'denied')`,
    description: 'Users with cases due in 3 days',
  },
  no_activity: {
    name: 'No Activity',
    query: `SELECT id FROM users WHERE last_active < NOW() - INTERVAL '30 days'`,
    description: 'Users inactive for 30+ days',
  },
  new_users: {
    name: 'New Users',
    query: `SELECT id FROM users WHERE created_at > NOW() - INTERVAL '7 days'`,
    description: 'Users created in last 7 days',
  },
};

// GET all broadcast segments
router.get('/segments', requireAuth, (req: Request, res: Response) => {
  try {
    const segments = Object.entries(SEGMENTS).map(([key, value]) => ({
      id: key,
      ...value,
    }));
    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch segments' });
  }
});

// GET segment preview (count of users)
router.get('/segments/:segment/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;

    if (!SEGMENTS[segment]) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const result = await db.query(`SELECT COUNT(*) as count FROM (${SEGMENTS[segment].query}) as t`);

    res.json({
      segment,
      user_count: parseInt(result.rows[0].count),
      description: SEGMENTS[segment].description,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to preview segment' });
  }
});

// CREATE broadcast
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, message, segment = 'all', channels = ['portal'], scheduled_at } = req.body;

    // Get target users
    if (!SEGMENTS[segment]) {
      return res.status(400).json({ error: 'Invalid segment' });
    }

    const usersResult = await db.query(SEGMENTS[segment].query);
    const users = usersResult.rows;

    // Create broadcast record
    const broadcastResult = await db.query(
      `INSERT INTO broadcasts (title, message, segment, channels, user_count, status, scheduled_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        title,
        message,
        segment,
        JSON.stringify(channels),
        users.length,
        scheduled_at ? 'scheduled' : 'sent',
        scheduled_at,
      ]
    );

    const broadcast = broadcastResult.rows[0];

    // Send immediately if not scheduled
    if (!scheduled_at) {
      await sendBroadcast(broadcast, users);
    }

    res.status(201).json({
      broadcast,
      users_reached: users.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// GET all broadcasts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT * FROM broadcasts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// GET broadcast by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM broadcasts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch broadcast' });
  }
});

// UPDATE broadcast
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, message, status } = req.body;

    const result = await db.query(
      `UPDATE broadcasts
       SET title = $1, message = $2, status = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, message, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update broadcast' });
  }
});

// DELETE broadcast
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM broadcasts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({ message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

// GET broadcast analytics
router.get('/:id/analytics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        id,
        title,
        user_count,
        status,
        created_at,
        (SELECT COUNT(*) FROM broadcast_reads WHERE broadcast_id = $1) as read_count,
        (SELECT COUNT(*) FROM broadcast_clicks WHERE broadcast_id = $1) as click_count
       FROM broadcasts
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const broadcast = result.rows[0];
    const readRate = broadcast.user_count > 0 ? (broadcast.read_count / broadcast.user_count) * 100 : 0;
    const clickRate = broadcast.user_count > 0 ? (broadcast.click_count / broadcast.user_count) * 100 : 0;

    res.json({
      ...broadcast,
      read_rate: readRate.toFixed(2),
      click_rate: clickRate.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// SEND broadcast immediately
router.post('/:id/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const broadcastResult = await db.query(
      'SELECT * FROM broadcasts WHERE id = $1',
      [id]
    );

    if (broadcastResult.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const broadcast = broadcastResult.rows[0];

    // Get target users
    if (!SEGMENTS[broadcast.segment]) {
      return res.status(400).json({ error: 'Invalid segment' });
    }

    const usersResult = await db.query(SEGMENTS[broadcast.segment].query);
    const users = usersResult.rows;

    // Send broadcast
    await sendBroadcast(broadcast, users);

    // Update status
    await db.query(
      'UPDATE broadcasts SET status = $1, sent_at = NOW() WHERE id = $2',
      ['sent', id]
    );

    res.json({
      message: 'Broadcast sent',
      users_reached: users.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

// MARK broadcast as read
router.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    await db.query(
      `INSERT INTO broadcast_reads (broadcast_id, user_id, read_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (broadcast_id, user_id) DO NOTHING`,
      [id, userId]
    );

    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Helper function to send broadcast
async function sendBroadcast(broadcast: any, users: any[]) {
  for (const user of users) {
    // Emit to portal
    io.to(`user:${user.id}`).emit('broadcast:received', {
      id: broadcast.id,
      title: broadcast.title,
      message: broadcast.message,
      created_at: broadcast.created_at,
    });
  }

  // Log broadcast sent
  await db.query(
    'INSERT INTO broadcast_logs (broadcast_id, sent_count, created_at) VALUES ($1, $2, NOW())',
    [broadcast.id, users.length]
  );
}

export default router;
