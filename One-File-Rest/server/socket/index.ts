import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import pool from '../db/client.js';

export interface SocketUser {
  discordId: string;
  username: string;
  role: 'client' | 'support' | 'case_manager' | 'owner';
}

/**
 * Initialize Socket.io with authentication and room management
 * Rooms: user:{discord_id}, case:{case_id}, admin, policy_alerts
 */
export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware: Authenticate socket connection
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const discordId = socket.handshake.auth.discordId;

      if (!token || !discordId) {
        return next(new Error('Authentication error: missing token or discordId'));
      }

      // Verify token in database
      const userResult = await pool.query(
        `SELECT id, discord_id, discord_username, role FROM users
         WHERE portal_token = $1 AND discord_id = $2`,
        [token, discordId]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('Authentication error: invalid token'));
      }

      const user = userResult.rows[0];

      // Attach user to socket
      (socket as any).user = {
        discordId: user.discord_id,
        username: user.discord_username,
        role: user.role || 'client',
      };

      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err instanceof Error ? err.message : 'Unknown error'}`));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as SocketUser;
    console.log(`✓ Socket connected: ${user.username} (${socket.id})`);

    // Join user-specific room
    socket.join(`user:${user.discordId}`);

    // Join admin room if staff
    if (['support', 'case_manager', 'owner'].includes(user.role)) {
      socket.join('admin');
    }

    // Join policy alerts room
    socket.join('policy_alerts');

    // Handle case room joins
    socket.on('case:join', (caseId: number) => {
      socket.join(`case:${caseId}`);
      console.log(`✓ User ${user.username} joined case room: case:${caseId}`);
    });

    // Handle case room leaves
    socket.on('case:leave', (caseId: number) => {
      socket.leave(`case:${caseId}`);
      console.log(`✓ User ${user.username} left case room: case:${caseId}`);
    });

    // Handle new message
    socket.on('message:send', async (data: { caseId: number; content: string; type: 'text' | 'system' }) => {
      try {
        const { caseId, content, type } = data;

        // Save message to database
        const messageResult = await pool.query(
          `INSERT INTO messages (case_id, sender_discord_id, sender_type, content, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, created_at`,
          [caseId, user.discordId, type === 'system' ? 'system' : 'client', content]
        );

        const message = messageResult.rows[0];

        // Broadcast to case room
        io.to(`case:${caseId}`).emit('message:new', {
          id: message.id,
          caseId,
          sender: user.username,
          senderDiscordId: user.discordId,
          senderType: type === 'system' ? 'system' : 'client',
          content,
          timestamp: message.created_at,
        });

        console.log(`✓ Message sent in case ${caseId} by ${user.username}`);
      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle case status change
    socket.on('case:status_changed', async (data: { caseId: number; newStatus: string }) => {
      try {
        const { caseId, newStatus } = data;

        // Update case status
        await pool.query(
          `UPDATE cases SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [newStatus, caseId]
        );

        // Broadcast to case room
        io.to(`case:${caseId}`).emit('case:status_changed', {
          caseId,
          newStatus,
          changedBy: user.username,
          timestamp: new Date(),
        });

        console.log(`✓ Case ${caseId} status changed to ${newStatus}`);
      } catch (err) {
        console.error('Error updating case status:', err);
        socket.emit('error', { message: 'Failed to update case status' });
      }
    });

    // Handle compliance score update
    socket.on('compliance:recalculate', async (caseId: number) => {
      try {
        // Recalculate compliance score
        const scoreResult = await pool.query(
          `SELECT score, grade FROM compliance_scores
           WHERE case_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [caseId]
        );

        if (scoreResult.rows.length > 0) {
          const score = scoreResult.rows[0];
          io.to(`case:${caseId}`).emit('compliance:score_updated', {
            caseId,
            score: score.score,
            grade: score.grade,
            timestamp: new Date(),
          });
        }
      } catch (err) {
        console.error('Error recalculating compliance score:', err);
      }
    });

    // Handle notification read
    socket.on('notification:read', async (notificationId: number) => {
      try {
        await pool.query(
          `UPDATE notifications SET read = true, read_at = NOW()
           WHERE id = $1`,
          [notificationId]
        );

        socket.emit('notification:read_confirmed', { notificationId });
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (caseId: number) => {
      io.to(`case:${caseId}`).emit('typing:indicator', {
        user: user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (caseId: number) => {
      io.to(`case:${caseId}`).emit('typing:indicator', {
        user: user.username,
        isTyping: false,
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`✗ Socket disconnected: ${user.username} (${socket.id})`);
    });

    // Error handler
    socket.on('error', (err: Error) => {
      console.error(`Socket error for ${user.username}:`, err);
    });
  });

  console.log('✓ Socket.io initialized');
  return io;
}

/**
 * Emit event to specific user
 */
export function emitToUser(io: SocketIOServer, discordId: string, event: string, data: any): void {
  io.to(`user:${discordId}`).emit(event, data);
}

/**
 * Emit event to case room
 */
export function emitToCase(io: SocketIOServer, caseId: number, event: string, data: any): void {
  io.to(`case:${caseId}`).emit(event, data);
}

/**
 * Emit event to admin room
 */
export function emitToAdmin(io: SocketIOServer, event: string, data: any): void {
  io.to('admin').emit(event, data);
}

/**
 * Emit event to policy alerts room
 */
export function emitToPolicyAlerts(io: SocketIOServer, event: string, data: any): void {
  io.to('policy_alerts').emit(event, data);
}

/**
 * Broadcast event to all connected clients
 */
export function broadcastEvent(io: SocketIOServer, event: string, data: any): void {
  io.emit(event, data);
}
