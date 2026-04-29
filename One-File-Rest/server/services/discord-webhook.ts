import pool from '../db/client.js';

export interface PortalEvent {
  type: 'login' | 'case_created' | 'message_sent' | 'evidence_uploaded' | 'status_updated' | 'deadline_set' | 'policy_viewed';
  discordId: string;
  data: Record<string, any>;
}

function buildWebhookEmbed(event: PortalEvent) {
  const baseEmbed = {
    username: 'Elite Tok Club Portal',
    avatar_url: 'https://cdn.discordapp.com/app-icons/YOUR_BOT_ID/YOUR_ICON_HASH.png'
  };

  switch (event.type) {
    case 'login':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0x2ecc71,
          title: '✅ Portal Login',
          description: `${event.data.username} just logged into their portal`,
          timestamp: new Date().toISOString()
        }]
      };

    case 'case_created':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0x3498db,
          title: '📋 New Case Created',
          description: `${event.data.username} submitted a new case`,
          fields: [
            { name: 'Account', value: event.data.accountUsername, inline: true },
            { name: 'Violation Type', value: event.data.violationType, inline: true },
            { name: 'Case ID', value: `#${event.data.caseId}`, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    case 'message_sent':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0x9b59b6,
          title: '💬 New Message',
          description: `${event.data.username} sent a message on Case #${event.data.caseId}`,
          fields: [
            { name: 'Message', value: event.data.content.substring(0, 100) + (event.data.content.length > 100 ? '...' : ''), inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    case 'evidence_uploaded':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0xe74c3c,
          title: '📎 Evidence Uploaded',
          description: `${event.data.username} uploaded evidence on Case #${event.data.caseId}`,
          fields: [
            { name: 'File', value: event.data.fileName, inline: true },
            { name: 'Type', value: event.data.fileType, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    case 'status_updated':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0xf39c12,
          title: '🔄 Case Status Updated',
          description: `Case #${event.data.caseId} status changed`,
          fields: [
            { name: 'New Status', value: event.data.newStatus, inline: true },
            { name: 'Updated By', value: event.data.updatedBy, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    case 'deadline_set':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0xe67e22,
          title: '⏰ Appeal Deadline Set',
          description: `Case #${event.data.caseId} has a new appeal deadline`,
          fields: [
            { name: 'Deadline', value: event.data.deadline, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    case 'policy_viewed':
      return {
        ...baseEmbed,
        embeds: [{
          color: 0x1abc9c,
          title: '👀 Policy Alert Viewed',
          description: `${event.data.username} read a policy alert`,
          fields: [
            { name: 'Alert', value: event.data.alertTitle, inline: false }
          ],
          timestamp: new Date().toISOString()
        }]
      };

    default:
      return { ...baseEmbed, embeds: [{ color: 0x95a5a6, title: 'Portal Update' }] };
  }
}

export async function sendWebhookUpdate(event: PortalEvent) {
  try {
    const result = await pool.query(
      `SELECT webhook_url, webhook_id, access_active
       FROM portal_access WHERE discord_id = $1`,
      [event.discordId]
    );

    if (!result.rows[0] || !result.rows[0].access_active) {
      console.log(`Webhook not sent: user ${event.discordId} has no active access`);
      return;
    }

    const { webhook_url, webhook_id } = result.rows[0];

    const payload = buildWebhookEmbed(event);

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const success = response.ok;

    await pool.query(
      `INSERT INTO portal_webhook_logs (discord_id, webhook_id, event_type, content, success)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.discordId, webhook_id, event.type, JSON.stringify(payload), success]
    );

    if (!success) {
      console.error(`Webhook send failed for ${event.discordId}:`, await response.text());
    }
  } catch (err) {
    console.error('Webhook send error:', err);
    try {
      await pool.query(
        `INSERT INTO portal_webhook_logs (discord_id, webhook_id, event_type, content, success, error_message)
         VALUES ($1, $2, $3, $4, false, $5)`,
        [event.discordId, 'unknown', event.type, '{}', String(err)]
      );
    } catch (logErr) {
      console.error('Failed to log webhook error:', logErr);
    }
  }
}
