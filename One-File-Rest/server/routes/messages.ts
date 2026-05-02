import { Router, Request, Response } from 'express';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { fireWebhook, buildClientMessageEmbed, buildStaffReplyEmbed, logAudit } from '../services/webhook.js';

const router = Router();

router.get('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!isStaff) {
      const caseCheck = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
      if (caseCheck.rows[0].user_discord_id !== discordId) return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `SELECT m.*, u.discord_username as sender_username, u.discord_avatar as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_discord_id = u.discord_id
       WHERE m.case_id = $1
       ORDER BY m.created_at ASC`,
      [caseId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { case_id, content, template_id } = req.body;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);
    const senderType = isStaff ? 'staff' : 'client';

    if (!case_id || !content) return res.status(400).json({ error: 'case_id and content required' });

    // Verify access
    const caseResult = await pool.query(
      'SELECT user_discord_id, account_username FROM cases WHERE id = $1', [case_id]
    );
    if (caseResult.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    const caseOwner = caseResult.rows[0];

    if (!isStaff && caseOwner.user_discord_id !== discordId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(
      `INSERT INTO messages (case_id, sender_discord_id, sender_type, content, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [case_id, discordId, senderType, content]
    );
    const message = result.rows[0];

    // Increment template use count if template used
    if (template_id) {
      pool.query('UPDATE appeal_templates SET use_count = use_count + 1 WHERE id = $1', [template_id]).catch(console.error);
    }

    // Broadcast via socket
    try {
      getIO().to(`case:${case_id}`).emit('message:new', message);
    } catch {}

    // Webhook to Discord (non-blocking)
    if (senderType === 'staff') {
      // Staff reply → fire to case owner
      fireWebhook(caseOwner.user_discord_id, 'staff_reply', buildStaffReplyEmbed({
        caseId: case_id,
        content,
        staffName: req.user!.discord_username,
      }));
    } else {
      // Client message → just log; staff receives it via portal
      logAudit({ actorDiscordId: discordId, action: 'message_sent', targetType: 'case', targetId: case_id }).catch(console.error);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark messages as read
router.patch('/read/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    await pool.query(
      `UPDATE messages SET is_read = true WHERE case_id = $1 AND sender_discord_id != $2`,
      [caseId, req.user!.discord_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

export default router;
