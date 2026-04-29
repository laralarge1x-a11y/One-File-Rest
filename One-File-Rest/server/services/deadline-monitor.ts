import pool from '../db/client.js';
import { Server as SocketServer } from 'socket.io';
import logger from '../utils/logger.js';

export function startDeadlineMonitor(io: SocketServer) {
  setInterval(async () => {
    try {
      // Optimized: Query only cases with deadlines in next 72 hours
      const casesResult = await pool.query(
        `SELECT c.id, c.user_discord_id, c.appeal_deadline, u.discord_username
         FROM cases c
         JOIN users u ON c.user_discord_id = u.discord_id
         WHERE c.status NOT IN ('won', 'denied', 'closed')
         AND c.appeal_deadline IS NOT NULL
         AND c.appeal_deadline > NOW()
         AND c.appeal_deadline < NOW() + INTERVAL '72 hours'`
      );

      if (casesResult.rows.length === 0) {
        return;
      }

      const caseIds = casesResult.rows.map(c => c.id);

      // Optimized: Get all sent alerts in single query instead of N queries
      const alertsResult = await pool.query(
        `SELECT case_id, alert_type FROM deadline_alerts_sent
         WHERE case_id = ANY($1)`,
        [caseIds]
      );

      const sentAlerts = new Map();
      alertsResult.rows.forEach(row => {
        const key = `${row.case_id}:${row.alert_type}`;
        sentAlerts.set(key, true);
      });

      // Process each case
      for (const caseData of casesResult.rows) {
        const hoursRemaining = Math.floor(
          (new Date(caseData.appeal_deadline).getTime() - Date.now()) / (1000 * 60 * 60)
        );

        const alertThresholds = [
          { type: '72h', min: 71, max: 73 },
          { type: '24h', min: 23, max: 25 },
          { type: '6h', min: 5, max: 7 },
        ];

        for (const threshold of alertThresholds) {
          if (hoursRemaining >= threshold.min && hoursRemaining <= threshold.max) {
            const alertKey = `${caseData.id}:${threshold.type}`;

            if (!sentAlerts.has(alertKey)) {
              // Insert alert record
              await pool.query(
                `INSERT INTO deadline_alerts_sent (case_id, alert_type) VALUES ($1, $2)`,
                [caseData.id, threshold.type]
              );

              // Update priority for 24h alert
              if (threshold.type === '24h') {
                await pool.query(
                  `UPDATE cases SET priority = $1 WHERE id = $2`,
                  ['critical', caseData.id]
                );
              }

              // Emit socket event
              io.to('admin').emit('case:deadline_alert', {
                case_id: caseData.id,
                client_name: caseData.discord_username,
                hours_remaining: hoursRemaining,
                alert_type: threshold.type,
              });

              logger.info('Deadline alert sent', {
                caseId: caseData.id,
                alertType: threshold.type,
                hoursRemaining,
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error('Deadline monitor error', { error: (err as Error).message });
    }
  }, 15 * 60 * 1000); // Run every 15 minutes
}
