import { db } from '../db/client';
import { io } from '../server';
import cron from 'node-cron';

interface DeadlineAlert {
  case_id: number;
  account_username: string;
  days_remaining: number;
  severity: 'urgent' | 'warning' | 'info';
  status: string;
}

class DeadlineAlertService {
  private isRunning = false;

  // Start the background job
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run every hour
    cron.schedule('0 * * * *', () => {
      this.checkDeadlines();
    });

    // Also run on startup
    this.checkDeadlines();

    console.log('Deadline Alert Service started');
  }

  // Check all cases for upcoming deadlines
  private async checkDeadlines() {
    try {
      const result = await db.query(
        `SELECT
          c.id,
          c.account_username,
          c.appeal_deadline,
          c.status,
          u.discord_id,
          EXTRACT(DAY FROM c.appeal_deadline - NOW()) as days_remaining
         FROM cases c
         JOIN users u ON c.client_id = u.id
         WHERE c.status != 'won' AND c.status != 'denied'
         AND c.appeal_deadline > NOW()
         ORDER BY c.appeal_deadline ASC`
      );

      const alerts: DeadlineAlert[] = [];

      for (const row of result.rows) {
        const daysRemaining = Math.ceil(row.days_remaining);

        // Determine severity
        let severity: 'urgent' | 'warning' | 'info' = 'info';
        if (daysRemaining <= 1) severity = 'urgent';
        else if (daysRemaining <= 3) severity = 'warning';

        // Check if alert already sent
        const existingAlert = await db.query(
          `SELECT * FROM deadline_alerts
           WHERE case_id = $1 AND severity = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
          [row.id, severity]
        );

        if (existingAlert.rows.length === 0) {
          // Create new alert
          await db.query(
            `INSERT INTO deadline_alerts (case_id, severity, days_remaining, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [row.id, severity, daysRemaining]
          );

          alerts.push({
            case_id: row.id,
            account_username: row.account_username,
            days_remaining: daysRemaining,
            severity,
            status: row.status,
          });

          // Send real-time notification
          io.to(`user:${row.discord_id}`).emit('deadline:alert', {
            case_id: row.id,
            account_username: row.account_username,
            days_remaining: daysRemaining,
            severity,
            deadline: row.appeal_deadline,
          });
        }
      }

      // Broadcast to admin dashboard
      if (alerts.length > 0) {
        io.emit('admin:deadline_alerts', alerts);
      }

      console.log(`Checked deadlines: ${alerts.length} new alerts`);
    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  }

  // Get all active deadline alerts
  async getActiveAlerts() {
    try {
      const result = await db.query(
        `SELECT
          da.id,
          c.id as case_id,
          c.account_username,
          c.appeal_deadline,
          da.severity,
          EXTRACT(DAY FROM c.appeal_deadline - NOW()) as days_remaining,
          da.created_at
         FROM deadline_alerts da
         JOIN cases c ON da.case_id = c.id
         WHERE c.status != 'won' AND c.status != 'denied'
         AND c.appeal_deadline > NOW()
         ORDER BY c.appeal_deadline ASC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      return [];
    }
  }

  // Get alerts by severity
  async getAlertsBySeverity(severity: string) {
    try {
      const result = await db.query(
        `SELECT
          da.id,
          c.id as case_id,
          c.account_username,
          c.appeal_deadline,
          da.severity,
          EXTRACT(DAY FROM c.appeal_deadline - NOW()) as days_remaining
         FROM deadline_alerts da
         JOIN cases c ON da.case_id = c.id
         WHERE da.severity = $1
         AND c.status != 'won' AND c.status != 'denied'
         AND c.appeal_deadline > NOW()
         ORDER BY c.appeal_deadline ASC`,
        [severity]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching alerts by severity:', error);
      return [];
    }
  }

  // Acknowledge an alert
  async acknowledgeAlert(alertId: number) {
    try {
      await db.query(
        `UPDATE deadline_alerts SET acknowledged = true, acknowledged_at = NOW()
         WHERE id = $1`,
        [alertId]
      );

      return true;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const result = await db.query(
        `SELECT
          COUNT(*) as total_alerts,
          SUM(CASE WHEN severity = 'urgent' THEN 1 ELSE 0 END) as urgent_count,
          SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_count,
          SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info_count,
          SUM(CASE WHEN acknowledged = true THEN 1 ELSE 0 END) as acknowledged_count
         FROM deadline_alerts
         WHERE created_at > NOW() - INTERVAL '7 days'`
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }
  }

  // Send custom deadline reminder
  async sendReminder(caseId: number, message: string) {
    try {
      const caseResult = await db.query(
        'SELECT * FROM cases WHERE id = $1',
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        throw new Error('Case not found');
      }

      const caseData = caseResult.rows[0];

      // Create reminder record
      await db.query(
        `INSERT INTO deadline_reminders (case_id, message, sent_at)
         VALUES ($1, $2, NOW())`,
        [caseId, message]
      );

      // Send notification
      io.emit('deadline:reminder', {
        case_id: caseId,
        account_username: caseData.account_username,
        message,
        deadline: caseData.appeal_deadline,
      });

      return true;
    } catch (error) {
      console.error('Error sending reminder:', error);
      return false;
    }
  }
}

export const deadlineAlertService = new DeadlineAlertService();
