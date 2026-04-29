import { Server as SocketServer } from 'socket.io';
import logger from '../utils/logger.js';

export class SocketEvents {
  private io: SocketServer;

  constructor(io: SocketServer) {
    this.io = io;
  }

  // Case events
  emitCaseCreated(caseData: any) {
    this.io.to(`user:${caseData.user_discord_id}`).emit('case:created', {
      caseId: caseData.id,
      accountUsername: caseData.account_username,
      violationType: caseData.violation_type,
      status: caseData.status,
      createdAt: caseData.created_at,
    });
    logger.info('Case created event emitted', { caseId: caseData.id });
  }

  emitCaseUpdated(caseData: any, userId: string) {
    this.io.to(`user:${userId}`).emit('case:updated', {
      caseId: caseData.id,
      status: caseData.status,
      priority: caseData.priority,
      outcome: caseData.outcome,
      updatedAt: caseData.updated_at,
    });
    this.io.to(`case:${caseData.id}`).emit('case:updated', {
      caseId: caseData.id,
      status: caseData.status,
      priority: caseData.priority,
      outcome: caseData.outcome,
      updatedAt: caseData.updated_at,
    });
    logger.info('Case updated event emitted', { caseId: caseData.id });
  }

  emitCaseDeleted(caseId: number, userId: string) {
    this.io.to(`user:${userId}`).emit('case:deleted', { caseId });
    logger.info('Case deleted event emitted', { caseId });
  }

  // Message events
  emitMessageCreated(messageData: any, caseId: number) {
    this.io.to(`case:${caseId}`).emit('message:created', {
      messageId: messageData.id,
      caseId,
      content: messageData.content,
      createdAt: messageData.created_at,
      createdBy: messageData.created_by_discord_id,
    });
    logger.info('Message created event emitted', { messageId: messageData.id, caseId });
  }

  emitMessageDeleted(messageId: number, caseId: number) {
    this.io.to(`case:${caseId}`).emit('message:deleted', { messageId, caseId });
    logger.info('Message deleted event emitted', { messageId, caseId });
  }

  // Evidence events
  emitEvidenceUploaded(evidenceData: any, caseId: number) {
    this.io.to(`case:${caseId}`).emit('evidence:uploaded', {
      evidenceId: evidenceData.id,
      caseId,
      fileName: evidenceData.file_name,
      fileType: evidenceData.file_type,
      uploadedAt: evidenceData.uploaded_at,
    });
    logger.info('Evidence uploaded event emitted', { evidenceId: evidenceData.id, caseId });
  }

  emitEvidenceDeleted(evidenceId: number, caseId: number) {
    this.io.to(`case:${caseId}`).emit('evidence:deleted', { evidenceId, caseId });
    logger.info('Evidence deleted event emitted', { evidenceId, caseId });
  }

  // Compliance score events
  emitComplianceScoreUpdated(caseId: number, score: any, userId: string) {
    this.io.to(`user:${userId}`).emit('compliance:score_updated', {
      caseId,
      score: score.score,
      grade: score.grade,
      trend: score.trend,
      updatedAt: new Date(),
    });
    this.io.to(`case:${caseId}`).emit('compliance:score_updated', {
      caseId,
      score: score.score,
      grade: score.grade,
      trend: score.trend,
      updatedAt: new Date(),
    });
    logger.info('Compliance score updated event emitted', { caseId, score: score.score });
  }

  // Broadcast events
  emitBroadcastSent(broadcastData: any) {
    this.io.emit('broadcast:sent', {
      subject: broadcastData.subject,
      content: broadcastData.content,
      targetSegment: broadcastData.target_segment,
      recipientCount: broadcastData.recipient_count,
      sentAt: broadcastData.sent_at,
    });
    logger.info('Broadcast sent event emitted', { targetSegment: broadcastData.target_segment });
  }

  // Notification events
  emitNotification(userId: string, notification: any) {
    this.io.to(`user:${userId}`).emit('notification:received', {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.created_at,
    });
    logger.info('Notification emitted', { userId, type: notification.type });
  }

  // Admin events
  emitAdminAlert(alert: any) {
    this.io.to('admin').emit('admin:alert', {
      type: alert.type,
      message: alert.message,
      severity: alert.severity,
      createdAt: new Date(),
    });
    logger.info('Admin alert emitted', { type: alert.type });
  }
}

export function createSocketEvents(io: SocketServer): SocketEvents {
  return new SocketEvents(io);
}
