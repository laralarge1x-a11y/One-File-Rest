import pool from '../db/client.js';

export interface WebhookEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

// Plan metadata
export const PLAN_META: Record<string, { name: string; price: number; color: number; responseTime: string; violations: string }> = {
  basic_guard: {
    name: 'Basic Guard Plan',
    price: 79,
    color: 0x5865F2,
    responseTime: '48–72 hours',
    violations: '1 violation/month',
  },
  fortnightly_defense: {
    name: 'Fortnightly Defense Plan',
    price: 159,
    color: 0x57F287,
    responseTime: 'Under 12 hours',
    violations: 'Up to 3 violations per 2 weeks',
  },
  proshield_creator: {
    name: 'ProShield Creator Plan',
    price: 259,
    color: 0xFFD700,
    responseTime: 'Priority — fastest queue',
    violations: 'Up to 5 violations/month',
  },
};

// ─── Core fire function ────────────────────────────────────────────────────
async function _fireWebhook(discordId: string, eventType: string, embed: WebhookEmbed): Promise<void> {
  // Look up user's webhook URL and id
  const userResult = await pool.query(
    'SELECT id, discord_webhook_url FROM users WHERE discord_id = $1',
    [discordId]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].discord_webhook_url) {
    return; // No webhook configured — silently skip
  }

  const { id: userId, discord_webhook_url: webhookUrl } = userResult.rows[0];

  let success = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          ...embed,
          timestamp: embed.timestamp || new Date().toISOString(),
        }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      errorMessage = `HTTP ${response.status}: ${text.substring(0, 200)}`;
    } else {
      success = true;
    }
  } catch (fetchErr: any) {
    errorMessage = fetchErr?.message || 'Network error';
  }

  // Log to webhook_logs (non-fatal)
  try {
    await pool.query(
      `INSERT INTO webhook_logs (user_id, event_type, payload, success, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, eventType, JSON.stringify({ embed }), success, errorMessage]
    );
  } catch (logErr) {
    console.error('[webhook] Failed to log webhook result:', logErr);
  }

  if (!success) {
    console.error(`[webhook] Failed to deliver ${eventType} to user ${discordId}: ${errorMessage}`);
  }
}

/**
 * Fire a webhook non-blocking. NEVER awaited in main request flow.
 * Usage: fireWebhook(discordId, 'case_created', embed).catch(console.error);
 */
export function fireWebhook(discordId: string, eventType: string, embed: WebhookEmbed): void {
  _fireWebhook(discordId, eventType, embed).catch((err) => {
    console.error(`[webhook] Unhandled error for ${eventType}:`, err);
  });
}

// ─── Embed builders ────────────────────────────────────────────────────────

export function buildNewCaseEmbed(caseData: {
  id: number;
  violation_type: string;
  violation_description?: string;
  plan?: string;
  account_username?: string;
}): WebhookEmbed {
  const planName = caseData.plan ? (PLAN_META[caseData.plan]?.name || caseData.plan) : 'Unknown';
  return {
    color: 0x5865F2,
    title: '📋 New Case Submitted',
    fields: [
      { name: 'Case ID', value: `#${caseData.id}`, inline: true },
      { name: 'Plan', value: planName, inline: true },
      { name: 'Violation Type', value: caseData.violation_type || 'Unknown', inline: true },
      { name: 'Account', value: caseData.account_username || 'N/A', inline: true },
      { name: 'Description', value: (caseData.violation_description || 'No description').substring(0, 200), inline: false },
      { name: 'Status', value: '⏳ Pending Review', inline: true },
    ],
    footer: { text: 'TikTok Recovery Portal • Our team will review your case shortly' },
  };
}

export function buildClientMessageEmbed(data: {
  caseId: number;
  content: string;
  senderName?: string;
}): WebhookEmbed {
  return {
    color: 0x57F287,
    title: '💬 New Message from Client',
    fields: [
      { name: 'Case', value: `#${data.caseId}`, inline: true },
      { name: 'From', value: data.senderName || 'Client', inline: true },
      { name: 'Message', value: data.content.substring(0, 200), inline: false },
    ],
    footer: { text: 'Reply on the portal to respond' },
  };
}

export function buildStaffReplyEmbed(data: {
  caseId: number;
  content: string;
  staffName: string;
}): WebhookEmbed {
  return {
    color: 0xFEE75C,
    title: '👨‍💼 Staff Reply',
    fields: [
      { name: 'Case', value: `#${data.caseId}`, inline: true },
      { name: 'Staff', value: data.staffName, inline: true },
      { name: 'Message', value: data.content.substring(0, 200), inline: false },
    ],
    footer: { text: 'Login to portal to view full conversation' },
  };
}

export function buildStatusChangedEmbed(data: {
  caseId: number;
  oldStatus: string;
  newStatus: string;
  updatedBy?: string;
}): WebhookEmbed {
  return {
    color: 0xEB459E,
    title: '🔄 Case Status Updated',
    fields: [
      { name: 'Case ID', value: `#${data.caseId}`, inline: true },
      { name: 'Old Status', value: data.oldStatus, inline: true },
      { name: 'New Status', value: data.newStatus, inline: true },
      { name: 'Updated By', value: data.updatedBy || 'Staff', inline: true },
    ],
    footer: { text: 'TikTok Recovery Portal' },
  };
}

export function buildEvidenceUploadedEmbed(data: {
  caseId: number;
  fileName: string;
  uploadedBy: string;
}): WebhookEmbed {
  return {
    color: 0x9B59B6,
    title: '📎 Evidence Uploaded',
    fields: [
      { name: 'Case ID', value: `#${data.caseId}`, inline: true },
      { name: 'File', value: data.fileName, inline: true },
      { name: 'Uploaded By', value: data.uploadedBy, inline: true },
    ],
    footer: { text: 'TikTok Recovery Portal' },
  };
}

export function buildCaseResolvedEmbed(data: {
  caseId: number;
  outcome: string;
  notes?: string;
  timeTaken?: string;
}): WebhookEmbed {
  return {
    color: 0x57F287,
    title: '✅ Case Resolved',
    fields: [
      { name: 'Case ID', value: `#${data.caseId}`, inline: true },
      { name: 'Outcome', value: data.outcome, inline: true },
      { name: 'Time Taken', value: data.timeTaken || 'N/A', inline: true },
      { name: 'Summary', value: (data.notes || 'Your case has been resolved.').substring(0, 200), inline: false },
    ],
    footer: { text: 'Thank you for using TikTok Recovery Portal' },
  };
}

export function buildBroadcastEmbed(data: {
  subject: string;
  content: string;
  senderName?: string;
}): WebhookEmbed {
  return {
    color: 0x5865F2,
    title: `📢 ${data.subject}`,
    description: data.content.substring(0, 2000),
    footer: { text: `TikTok Recovery Portal${data.senderName ? ' • ' + data.senderName : ''}` },
  };
}

export function buildRevokeEmbed(revokedBy: string): WebhookEmbed {
  return {
    color: 0xED4245,
    title: '⛔ Access Revoked',
    description: 'Your TikTok Recovery Portal access has been revoked.',
    fields: [
      {
        name: '📋 What This Means',
        value: 'Your portal account is now inactive. You can no longer submit new cases or access the portal.',
        inline: false,
      },
      {
        name: '❓ Questions?',
        value: 'Please contact support if you believe this is a mistake.',
        inline: false,
      },
    ],
    footer: { text: `TikTok Recovery Portal • Revoked by ${revokedBy}` },
  };
}

// ─── Audit log helper ──────────────────────────────────────────────────────
export async function logAudit(data: {
  actorDiscordId?: string;
  actorUserId?: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_discord_id, actor_user_id, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        data.actorDiscordId || null,
        data.actorUserId || null,
        data.action,
        data.targetType || null,
        data.targetId || null,
        JSON.stringify(data.details || {}),
      ]
    );
  } catch (err) {
    console.error('[audit] Failed to log audit event:', err);
  }
}
