// Firebase Cloud Messaging sender for the Android admin APK.
//
// Uses the FCM "Legacy" HTTP API because it only requires a single
// `FIREBASE_SERVER_KEY` secret (vs. the v1 API which requires a service
// account JSON + JWT signing). The legacy endpoint is still supported by
// Google and is the simplest fit for a small staff push fan-out.
//
// If FIREBASE_SERVER_KEY is not set, all sends are silent no-ops so the
// rest of the app keeps working in dev / on Replit.
import pool from '../db/client.js';

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';
const SERVER_KEY = process.env.FIREBASE_SERVER_KEY || '';

export interface FcmPayload {
  title: string;
  body: string;
  // Deep-link path inside the APK, e.g. `/admin/cases/123`
  url?: string;
  caseId?: number | null;
  notificationId?: number | null;
  tag?: string;
  badge?: number;
}

export function fcmConfigured(): boolean {
  return Boolean(SERVER_KEY);
}

async function sendOne(token: string, payload: FcmPayload): Promise<{ ok: boolean; remove?: boolean }> {
  if (!SERVER_KEY) return { ok: false };
  const body = {
    to: token,
    priority: 'high',
    // We send `data` only (not `notification`) so the app's FCM handler
    // always runs — it can then build a styled native notification with
    // the deep-link payload, even when the app is in the background.
    data: {
      title: payload.title,
      body: payload.body,
      url: payload.url || '/admin',
      caseId: payload.caseId == null ? '' : String(payload.caseId),
      notificationId: payload.notificationId == null ? '' : String(payload.notificationId),
      tag: payload.tag || '',
      badge: payload.badge == null ? '' : String(payload.badge),
    },
    android: { priority: 'high' },
  };
  try {
    const res = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${SERVER_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // 401/403 means our server key is wrong — don't drop tokens for that.
      if (res.status === 401 || res.status === 403) {
        console.error('[fcm] auth failed (status', res.status, ') — check FIREBASE_SERVER_KEY');
        return { ok: false };
      }
      return { ok: false };
    }
    const json: any = await res.json().catch(() => ({}));
    // FCM legacy returns { results: [{ error: 'NotRegistered' | 'InvalidRegistration' | ... }] }
    const err = json?.results?.[0]?.error;
    if (err === 'NotRegistered' || err === 'InvalidRegistration') {
      return { ok: false, remove: true };
    }
    return { ok: !err };
  } catch (err) {
    console.error('[fcm] send failed:', err);
    return { ok: false };
  }
}

export async function sendFcmToUser(discordId: string, payload: FcmPayload): Promise<{ sent: number; failed: number }> {
  if (!SERVER_KEY) return { sent: 0, failed: 0 };
  try {
    const r = await pool.query(
      'SELECT id, token FROM device_tokens WHERE user_discord_id = $1',
      [discordId]
    );
    let sent = 0, failed = 0;
    for (const row of r.rows) {
      const result = await sendOne(row.token, payload);
      if (result.ok) {
        sent++;
        // best-effort touch — doesn't matter if it fails
        pool.query('UPDATE device_tokens SET last_seen_at = NOW() WHERE id = $1', [row.id]).catch(() => {});
      } else {
        failed++;
        if (result.remove) {
          pool.query('DELETE FROM device_tokens WHERE id = $1', [row.id]).catch(() => {});
        }
      }
    }
    return { sent, failed };
  } catch (err) {
    console.error('[fcm] sendFcmToUser error:', err);
    return { sent: 0, failed: 0 };
  }
}
