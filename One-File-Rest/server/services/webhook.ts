import pool from '../db/client.js';

const PORTAL_URL = process.env.PORTAL_URL || 'https://one-file-rest.replit.app';

// Discord component types & button styles
const COMPONENT_TYPE_ACTION_ROW = 1;
const COMPONENT_TYPE_BUTTON = 2;
const BUTTON_STYLE_LINK = 5;

export interface WebhookButton {
  label: string;
  url: string;
  emoji?: string;
}

export interface WebhookEmbed {
  title?: string;
  description?: string;
  color: number;
  author?: { name: string; icon_url?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
  thumbnail?: { url: string };
  buttons?: WebhookButton[];
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

// ─── Helpers ──────────────────────────────────────────────────────────────
function buildButtonRow(buttons?: WebhookButton[]): any[] {
  if (!buttons || buttons.length === 0) return [];
  // Discord limits 5 buttons per row
  const items = buttons.slice(0, 5).map((b) => {
    const btn: any = {
      type: COMPONENT_TYPE_BUTTON,
      style: BUTTON_STYLE_LINK,
      label: b.label,
      url: b.url,
    };
    if (b.emoji) btn.emoji = { name: b.emoji };
    return btn;
  });
  return [{ type: COMPONENT_TYPE_ACTION_ROW, components: items }];
}

function truncate(s: string | undefined | null, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ─── Core fire function ────────────────────────────────────────────────────
async function _fireWebhook(discordId: string, eventType: string, embed: WebhookEmbed): Promise<void> {
  const userResult = await pool.query(
    'SELECT id, discord_webhook_url FROM users WHERE discord_id = $1',
    [discordId]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].discord_webhook_url) {
    return;
  }

  const { id: userId, discord_webhook_url: webhookUrl } = userResult.rows[0];
  const { buttons, ...embedFields } = embed;

  let success = false;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          ...embedFields,
          timestamp: embed.timestamp || new Date().toISOString(),
        }],
        components: buildButtonRow(buttons),
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
  const planName = caseData.plan ? (PLAN_META[caseData.plan]?.name || caseData.plan) : '—';
  const planColor = caseData.plan ? (PLAN_META[caseData.plan]?.color || 0x5865F2) : 0x5865F2;
  const acct = caseData.account_username ? `@${caseData.account_username}` : 'Account pending';

  return {
    color: planColor,
    author: { name: 'Elite Tok Club  •  Case Submitted' },
    title: `📋  Case #${caseData.id}  •  ${caseData.violation_type || 'Violation'}`,
    description: `**${acct}**  ·  ${planName}\n\u200b`,
    fields: [
      {
        name: '📝  What you told us',
        value: truncate(caseData.violation_description || '_No description provided_', 500),
        inline: false,
      },
      {
        name: '\u200b',
        value:
          '**Where your case stands**\n' +
          '🟢  **Submitted**  ·  just now\n' +
          '⚪  In Review\n' +
          '⚪  Appeal Drafted\n' +
          '⚪  Appeal Sent\n' +
          '⚪  Awaiting TikTok\n' +
          '⚪  Resolved',
        inline: false,
      },
    ],
    footer: { text: 'A specialist will review your case shortly  •  Elite Tok Club Portal' },
    buttons: [
      { label: 'Open Case', emoji: '🔍', url: `${PORTAL_URL}/cases/${caseData.id}` },
      { label: 'All My Cases', emoji: '📋', url: `${PORTAL_URL}/cases` },
    ],
  };
}

export function buildClientMessageEmbed(data: {
  caseId: number;
  content: string;
  senderName?: string;
}): WebhookEmbed {
  return {
    color: 0x57F287,
    author: { name: `Elite Tok Club  •  New message from ${data.senderName || 'client'}` },
    title: `💬  Case #${data.caseId}`,
    description: `> ${truncate(data.content, 500).replace(/\n/g, '\n> ')}`,
    footer: { text: 'Open the portal to reply  •  Elite Tok Club Admin' },
    buttons: [
      { label: 'Open & Reply', emoji: '↩️', url: `${PORTAL_URL}/cases/${data.caseId}` },
    ],
  };
}

export function buildStaffReplyEmbed(data: {
  caseId: number;
  content: string;
  staffName: string;
}): WebhookEmbed {
  return {
    color: 0xFEE75C,
    author: { name: `Elite Tok Club  •  ${data.staffName} replied` },
    title: `💬  Case #${data.caseId}`,
    description: `> ${truncate(data.content, 500).replace(/\n/g, '\n> ')}`,
    footer: { text: 'Reply in this channel or open the portal  •  Elite Tok Club Portal' },
    buttons: [
      { label: 'Open Case', emoji: '🔍', url: `${PORTAL_URL}/cases/${data.caseId}` },
      { label: 'View Conversation', emoji: '💬', url: `${PORTAL_URL}/messages` },
    ],
  };
}

export function buildStatusChangedEmbed(data: {
  caseId: number;
  oldStatus: string;
  newStatus: string;
  updatedBy?: string;
}): WebhookEmbed {
  const statusEmoji: Record<string, string> = {
    pending: '⏳', intake: '📥', profile_built: '🏗️', appeal_drafted: '✍️',
    appeal_submitted: '📤', awaiting_tiktok: '⌛', response_received: '📩',
    won: '✅', denied: '❌', escalated: '🚨', closed: '🔒',
  };
  const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    color: 0xEB459E,
    author: { name: 'Elite Tok Club  •  Case Updated' },
    title: `🔄  Case #${data.caseId}`,
    description:
      `${statusEmoji[data.oldStatus] || '•'}  ${fmt(data.oldStatus)}  →  ${statusEmoji[data.newStatus] || '•'}  **${fmt(data.newStatus)}**\n\u200b`,
    fields: [
      { name: 'Updated by', value: data.updatedBy || 'Staff', inline: true },
    ],
    footer: { text: 'Elite Tok Club Portal' },
    buttons: [
      { label: 'Open Case', emoji: '🔍', url: `${PORTAL_URL}/cases/${data.caseId}` },
    ],
  };
}

export function buildEvidenceUploadedEmbed(data: {
  caseId: number;
  fileName: string;
  uploadedBy: string;
}): WebhookEmbed {
  return {
    color: 0x9B59B6,
    author: { name: 'Elite Tok Club  •  Evidence Added' },
    title: `📎  Case #${data.caseId}`,
    description: `**${data.fileName}**\nUploaded by ${data.uploadedBy}`,
    footer: { text: 'Elite Tok Club Portal' },
    buttons: [
      { label: 'View Case', emoji: '🔍', url: `${PORTAL_URL}/cases/${data.caseId}` },
    ],
  };
}

export function buildCaseResolvedEmbed(data: {
  caseId: number;
  outcome: string;
  notes?: string;
  timeTaken?: string;
}): WebhookEmbed {
  const outcomeMeta: Record<string, { color: number; emoji: string; label: string }> = {
    won: { color: 0x57F287, emoji: '🏆', label: 'Won' },
    denied: { color: 0xED4245, emoji: '❌', label: 'Denied' },
    partial: { color: 0xFEE75C, emoji: '◐', label: 'Partial' },
  };
  const meta = outcomeMeta[data.outcome.toLowerCase()] || { color: 0x57F287, emoji: '✅', label: data.outcome };

  return {
    color: meta.color,
    author: { name: 'Elite Tok Club  •  Case Resolved' },
    title: `${meta.emoji}  Case #${data.caseId}  •  ${meta.label}`,
    description: truncate(data.notes || 'Your case has been resolved.', 500) + '\n\u200b',
    fields: [
      { name: '⏱️  Time Taken', value: data.timeTaken || '—', inline: true },
      { name: '📊  Outcome', value: meta.label, inline: true },
    ],
    footer: { text: 'Thank you for trusting Elite Tok Club' },
    buttons: [
      { label: 'View Case Report', emoji: '📄', url: `${PORTAL_URL}/cases/${data.caseId}` },
      { label: 'Submit New Case', emoji: '📝', url: `${PORTAL_URL}/cases/new` },
    ],
  };
}

export function buildBroadcastEmbed(data: {
  subject: string;
  content: string;
  senderName?: string;
}): WebhookEmbed {
  return {
    color: 0x5865F2,
    author: { name: `Elite Tok Club  •  Announcement${data.senderName ? ' from ' + data.senderName : ''}` },
    title: `📢  ${data.subject}`,
    description: truncate(data.content, 2000),
    footer: { text: 'Elite Tok Club Portal' },
    buttons: [
      { label: 'Open Portal', emoji: '🌐', url: PORTAL_URL },
    ],
  };
}

export function buildRevokeEmbed(revokedBy: string): WebhookEmbed {
  return {
    color: 0xED4245,
    author: { name: 'Elite Tok Club  •  Access Revoked' },
    title: '⛔  Your portal access has ended',
    description:
      'Your Elite Tok Club Portal access is now inactive. New cases can\'t be submitted and the portal is no longer accessible.\n\u200b',
    fields: [
      {
        name: '❓  Think this is a mistake?',
        value: 'Reach out to support and we\'ll get it sorted right away.',
        inline: false,
      },
    ],
    footer: { text: `Revoked by ${revokedBy}  •  Elite Tok Club` },
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
