import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { fireWebhook, buildStaffReplyEmbed, logAudit } from '../services/webhook.js';
import { createNotification } from '../services/notifications.js';
import { validate } from '../middleware/index.js';
import { emptyQuerySchema, emptyBodySchema , emptyParamsSchema} from '../../shared/schemas.js';

const router = Router();

const CaseIdParam = z.object({ caseId: z.coerce.number().int().positive() }).strict();
const SendMessageBody = z.object({
  case_id: z.coerce.number().int().positive(),
  content: z.string().min(1).max(10_000),
  template_id: z.coerce.number().int().positive().optional(),
}).strict();

router.get('/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema }), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);

    if (!isStaff) {
      const caseCheck = await pool.query('SELECT user_discord_id FROM cases WHERE id = $1', [caseId]);
      if (caseCheck.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
      if (caseCheck.rows[0].user_discord_id !== discordId) return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
    }

    const result = await pool.query(
      `SELECT m.*, u.discord_username as sender_username, u.discord_avatar as sender_avatar
       FROM messages m
       LEFT JOIN users u ON m.sender_discord_id = u.discord_id
       WHERE m.case_id = $1
       ORDER BY m.created_at ASC`,
      [caseId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching messages:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to fetch messages', requestId: req.id } });
  }
});

router.post('/', validate({ body: SendMessageBody, query: emptyQuerySchema, params: emptyParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { case_id, content, template_id } = req.body;
    const discordId = req.user!.discord_id;
    const isStaff = ['support', 'case_manager', 'owner', 'admin'].includes(req.user!.role);
    const senderType = isStaff ? 'staff' : 'client';

    // Verify access
    const caseResult = await pool.query(
      'SELECT user_discord_id, account_username, staff_assigned_id FROM cases WHERE id = $1', [case_id]
    );
    if (caseResult.rows.length === 0) return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
    const caseOwner = caseResult.rows[0];

    if (!isStaff && caseOwner.user_discord_id !== discordId) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden', requestId: req.id } });
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
      // Staff reply → fire to case owner + in-app notification
      fireWebhook(caseOwner.user_discord_id, 'staff_reply', buildStaffReplyEmbed({
        caseId: case_id,
        content,
        staffName: req.user!.discord_username,
      }));
      createNotification({
        userDiscordId: caseOwner.user_discord_id,
        type: 'message',
        title: `New reply from ${req.user!.discord_username}`,
        message: content.length > 140 ? content.substring(0, 137) + '...' : content,
        caseId: case_id,
        actionUrl: `/cases/${case_id}`,
      });
    } else {
      // Client message → notify the assigned staff member (so the native
      // admin APK gets an FCM push) AND log audit. Falls back to silently
      // doing nothing on the notification side if no staffer is assigned —
      // the dispatcher "Hot" queue picks those up via socket already.
      logAudit({ actorDiscordId: discordId, action: 'message_sent', targetType: 'case', targetId: case_id }).catch(console.error);
      const assigned = caseOwner.staff_assigned_id;
      if (assigned) {
        const preview = content.length > 140 ? content.substring(0, 137) + '...' : content;
        createNotification({
          userDiscordId: assigned,
          type: 'client_message',
          title: `New client message · case #${case_id}`,
          message: preview,
          caseId: case_id,
          actionUrl: `/admin/cases/${case_id}`,
        });
      }
      // Mirror to the admin socket room so live dispatcher views update.
      try { getIO().to('admin').emit('message:new', message); } catch {}
    }

    return res.status(201).json(message);
  } catch (err) {
    console.error('Error sending message:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to send message', requestId: req.id } });
  }
});

// Mark messages as read.
// Authorization:
//   - Staff/admin (support, case_manager, owner, admin) may mark messages on
//     any case they can access; in that case we mark CLIENT messages as read
//     (so the admin "needs attention / unreplied" queue clears).
//   - Clients may only mark messages on a case they own (cases.discord_id ===
//     their discord_id); we mark non-client (staff/AI/system) messages as read
//     for them so their bell/unread badge clears.
//   - Anyone else gets a 403.
router.patch('/read/:caseId', validate({ params: CaseIdParam, query: emptyQuerySchema, body: emptyBodySchema }), async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized', requestId: req.id } });
      return;
    }
    const me = req.user;
    const staffRoles = ['support', 'case_manager', 'owner', 'admin'];
    const isStaff = staffRoles.includes(me.role);

    const ownership = await pool.query(
      `SELECT user_discord_id FROM cases WHERE id = $1 LIMIT 1`,
      [caseId]
    );
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Case not found', requestId: req.id } });
      return;
    }
    const ownerDiscordId: string = ownership.rows[0].user_discord_id;
    const isOwner = ownerDiscordId === me.discord_id;

    if (!isStaff && !isOwner) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Forbidden — you do not have access to this case', requestId: req.id } });
      return;
    }

    if (isStaff) {
      // Staff is reading the conversation — clear unread on inbound (client) messages.
      await pool.query(
        `UPDATE messages
            SET is_read = true
          WHERE case_id = $1
            AND is_read = false
            AND sender_type = 'client'`,
        [caseId]
      );
    } else {
      // Owning client is reading — clear unread on staff/AI/system messages addressed to them.
      await pool.query(
        `UPDATE messages
            SET is_read = true
          WHERE case_id = $1
            AND is_read = false
            AND sender_discord_id <> $2
            AND sender_type IN ('staff', 'ai', 'system')`,
        [caseId, me.discord_id]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error marking messages as read:', { req_id: req.id, err });
    return res.status(500).json({ error: { code: 'internal', message: 'Failed to mark messages as read', requestId: req.id } });
  }
});

export default router;
