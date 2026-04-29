import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { io } from '../server';

const router = Router();

// Bot Bridge Internal API - Communication between Portal and Discord Bot

// Middleware to verify bot token
const verifyBotToken = (req: Request, res: Response, next: Function) => {
  const token = req.headers['x-bot-token'];
  if (token !== process.env.BOT_BRIDGE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// POST: Send message from Discord to Portal
router.post('/messages/receive', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { discord_user_id, case_id, content, attachments } = req.body;

    // Get user by Discord ID
    const userResult = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [discord_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Create message in database
    const messageResult = await db.query(
      `INSERT INTO messages (case_id, sender_id, content, type, created_at)
       VALUES ($1, $2, $3, 'discord', NOW())
       RETURNING *`,
      [case_id, userId, content]
    );

    // Handle attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await db.query(
          `INSERT INTO evidence (case_id, file_url, file_type, file_name, uploaded_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [case_id, attachment.url, attachment.type, attachment.name]
        );
      }
    }

    // Broadcast to portal users
    io.emit('message:new', messageResult.rows[0]);

    res.json({ success: true, message_id: messageResult.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to receive message' });
  }
});

// POST: Send message from Portal to Discord
router.post('/messages/send', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { case_id, user_id, content } = req.body;

    // Get case with Discord channel info
    const caseResult = await db.query(
      'SELECT * FROM cases WHERE id = $1',
      [case_id]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseResult.rows[0];

    // Get user info
    const userResult = await db.query(
      'SELECT discord_id FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return message data for bot to send
    res.json({
      success: true,
      discord_user_id: userResult.rows[0].discord_id,
      case_id,
      content,
      embed: {
        title: `Case: ${caseData.account_username}`,
        description: content,
        color: 0x0099ff,
        fields: [
          {
            name: 'Violation Type',
            value: caseData.violation_type,
            inline: true,
          },
          {
            name: 'Status',
            value: caseData.status,
            inline: true,
          },
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST: Update case status from Discord
router.post('/cases/update-status', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { case_id, status, reason } = req.body;

    const result = await db.query(
      `UPDATE cases
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, case_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Log the update
    await db.query(
      `INSERT INTO case_updates (case_id, field, old_value, new_value, reason, created_at)
       VALUES ($1, 'status', $2, $3, $4, NOW())`,
      [case_id, result.rows[0].status, status, reason]
    );

    // Broadcast update
    io.emit('case:status_updated', {
      case_id,
      status,
      reason,
    });

    res.json({ success: true, case: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update case' });
  }
});

// POST: Create appeal from Discord
router.post('/cases/create', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { discord_user_id, account_username, violation_type, description } = req.body;

    // Get user by Discord ID
    const userResult = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [discord_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userResult.rows[0].id;

    // Create case
    const caseResult = await db.query(
      `INSERT INTO cases (client_id, account_username, violation_type, description, status, priority, appeal_deadline, created_at)
       VALUES ($1, $2, $3, $4, 'open', 'normal', NOW() + INTERVAL '30 days', NOW())
       RETURNING *`,
      [userId, account_username, violation_type, description]
    );

    res.status(201).json({
      success: true,
      case: caseResult.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// GET: Get case details for Discord
router.get('/cases/:caseId', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const result = await db.query(
      'SELECT * FROM cases WHERE id = $1',
      [caseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// POST: Send notification from Discord
router.post('/notifications/send', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { discord_user_id, title, message, type } = req.body;

    // Get user
    const userResult = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [discord_user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create notification
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userResult.rows[0].id, title, message, type]
    );

    // Broadcast to user
    io.to(`user:${discord_user_id}`).emit('notification', {
      title,
      message,
      type,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// GET: Get user profile for Discord
router.get('/users/:discordId', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { discordId } = req.params;

    const result = await db.query(
      'SELECT id, discord_id, discord_username, email, role FROM users WHERE discord_id = $1',
      [discordId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST: Sync user from Discord
router.post('/users/sync', verifyBotToken, async (req: Request, res: Response) => {
  try {
    const { discord_id, discord_username, email, avatar_url } = req.body;

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE discord_id = $1',
      [discord_id]
    );

    let result;
    if (existingUser.rows.length > 0) {
      // Update existing user
      result = await db.query(
        `UPDATE users
         SET discord_username = $1, email = $2, avatar_url = $3, updated_at = NOW()
         WHERE discord_id = $4
         RETURNING *`,
        [discord_username, email, avatar_url, discord_id]
      );
    } else {
      // Create new user
      result = await db.query(
        `INSERT INTO users (discord_id, discord_username, email, avatar_url, role, created_at)
         VALUES ($1, $2, $3, $4, 'client', NOW())
         RETURNING *`,
        [discord_id, discord_username, email, avatar_url]
      );
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// GET: Health check
router.get('/health', verifyBotToken, (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
  });
});

export default router;
