import webpush from 'web-push';
import pool from '../db/client.js';

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@elitetokclub.com';

let initialized = false;
function ensureInit() {
  if (initialized) return PUBLIC_KEY && PRIVATE_KEY;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    initialized = true;
    return true;
  } catch (err) {
    console.error('[push] VAPID init failed:', err);
    return false;
  }
}

export function getVapidPublicKey() {
  return PUBLIC_KEY || null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

export async function sendPushToUser(discordId: string, payload: PushPayload) {
  if (!ensureInit()) return { sent: 0, failed: 0 };
  try {
    const subs = await pool.query(
      'SELECT id, endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_discord_id = $1',
      [discordId]
    );
    let sent = 0, failed = 0;
    for (const s of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
        }
      }
    }
    return { sent, failed };
  } catch (err) {
    console.error('[push] sendPushToUser error:', err);
    return { sent: 0, failed: 0 };
  }
}
