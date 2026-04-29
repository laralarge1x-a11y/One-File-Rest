import pool from '../db/client.js';
import { Server as SocketServer } from 'socket.io';

export function startDeadlineMonitor(io: SocketServer) {
  setInterval(async () => {
    try {
      const result = await pool.query(
        `SELECT c.*, u.discord_username FROM cases c
         JOIN users u ON c.user_discord_id = u.discord_id
         WHERE c.status NOT IN ('won', 'denied', 'closed')
         AND c.appeal_deadline IS NOT NULL
         AND c.appeal_deadline > NOW()`
      );

      for (const caseData of result.rows) {
        const hoursRemaining = Math.floor(
          (new Date(caseData.appeal_deadline).getTime() - Date.now()) / (1000 * 60 * 60)
        );

        // 72-hour alert
        if (hoursRemaining >= 71 && hoursRemaining <= 73) {
          const existing = await pool.query(
            `SELECT * FROM deadline_alerts_sent WHERE case_id = $1 AND alert_type = $2`,
            [caseData.id, '72h']
          );

          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO deadline_alerts_sent (case_id, alert_type) VALUES ($1, $2)`,
              [caseData.id, '72h']
            );

            io.to('admin').emit('case:deadline_alert', {
              case_id: caseData.id,
              client_name: caseData.discord_username,
              hours_remaining: hoursRemaining,
              alert_type: '72h',
            });
          }
        }

        // 24-hour alert
        if (hoursRemaining >= 23 && hoursRemaining <= 25) {
          const existing = await pool.query(
            `SELECT * FROM deadline_alerts_sent WHERE case_id = $1 AND alert_type = $2`,
            [caseData.id, '24h']
          );

          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO deadline_alerts_sent (case_id, alert_type) VALUES ($1, $2)`,
              [caseData.id, '24h']
            );

            await pool.query(
              `UPDATE cases SET priority = $1 WHERE id = $2`,
              ['critical', caseData.id]
            );

            io.to('admin').emit('case:deadline_alert', {
              case_id: caseData.id,
              client_name: caseData.discord_username,
              hours_remaining: hoursRemaining,
              alert_type: '24h',
            });
          }
        }

        // 6-hour alert
        if (hoursRemaining >= 5 && hoursRemaining <= 7) {
          const existing = await pool.query(
            `SELECT * FROM deadline_alerts_sent WHERE case_id = $1 AND alert_type = $2`,
            [caseData.id, '6h']
          );

          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO deadline_alerts_sent (case_id, alert_type) VALUES ($1, $2)`,
              [caseData.id, '6h']
            );

            io.to('admin').emit('case:deadline_alert', {
              case_id: caseData.id,
              client_name: caseData.discord_username,
              hours_remaining: hoursRemaining,
              alert_type: '6h',
            });
          }
        }
      }
    } catch (err) {
      console.error('Deadline monitor error:', err);
    }
  }, 15 * 60 * 1000); // Run every 15 minutes
}
