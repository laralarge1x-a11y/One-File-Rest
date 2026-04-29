import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { broadcastSchema, validateRequest } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/broadcast - Send broadcast message to users
 */
router.post('/', validateRequest(broadcastSchema), async (req: Request, res: Response) => {
  try {
    const validatedData = (req as any).validatedBody;
    const { targetSegment, subject, content } = validatedData;
    const sentBy = req.user?.discord_id;

    // Get target users based on segment
    let userQuery = `SELECT discord_id FROM users`;
    const params: any[] = [];

    if (targetSegment === 'active') {
      userQuery += ` WHERE last_active > NOW() - INTERVAL '30 days'`;
    } else if (targetSegment === 'inactive') {
      userQuery += ` WHERE last_active < NOW() - INTERVAL '30 days'`;
    } else if (targetSegment === 'premium') {
      userQuery += ` WHERE discord_id IN (SELECT user_discord_id FROM subscriptions WHERE status = 'active' AND plan IN ('fortnightly', 'proshield'))`;
    } else if (targetSegment === 'basic') {
      userQuery += ` WHERE discord_id IN (SELECT user_discord_id FROM subscriptions WHERE status = 'active' AND plan = 'basic')`;
    }

    const usersResult = await pool.query(userQuery, params);
    const recipientCount = usersResult.rows.length;

    // Log broadcast
    await pool.query(
      `INSERT INTO broadcast_logs (sent_by, target_segment, subject, content, recipient_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [sentBy, targetSegment, subject, content, recipientCount]
    );

    // Send notifications to users
    for (const user of usersResult.rows) {
      await pool.query(
        `INSERT INTO notifications (user_discord_id, type, title, message)
         VALUES ($1, $2, $3, $4)`,
        [user.discord_id, 'broadcast', subject, content]
      );
    }

    res.status(201).json({
      success: true,
      recipientCount,
      message: `Broadcast sent to ${recipientCount} users`
    });
  } catch (err) {
    console.error('Error sending broadcast:', err);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

/**
 * GET /api/broadcast/logs - Get broadcast logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM broadcast_logs ORDER BY sent_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching broadcast logs:', err);
    res.status(500).json({ error: 'Failed to fetch broadcast logs' });
  }
});

export default router;
