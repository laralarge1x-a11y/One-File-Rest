import pool from '../db/client.js';
import { getIO } from '../socket-store.js';
import { sendPushToUser } from './push.js';
import { sendFcmToUser } from './fcm.js';

export interface CreateNotificationOptions {
  userDiscordId: string;
  type: string;
  title: string;
  message: string;
  caseId?: number | null;
  actionUrl?: string | null;
}

export async function createNotification(opts: CreateNotificationOptions) {
  try {
    const r = await pool.query(
      `INSERT INTO notifications (user_discord_id, type, title, message, case_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [opts.userDiscordId, opts.type, opts.title, opts.message, opts.caseId ?? null, opts.actionUrl ?? null]
    );
    const notification = r.rows[0];
    try {
      const io = getIO();
      io.to(`user:${opts.userDiscordId}`).emit('notification:new', notification);
    } catch {}
    // Web push (best effort) — used by the PWA / desktop browsers
    sendPushToUser(opts.userDiscordId, {
      title: opts.title,
      body: opts.message,
      url: opts.actionUrl || (opts.caseId ? `/cases/${opts.caseId}` : '/dashboard'),
      tag: `notif-${notification.id}`,
    }).catch(() => {});
    // FCM (best effort) — used by the native admin Android APK. Deep-links
    // to the admin case route since the APK only exposes the admin UI.
    const fcmUrl = opts.actionUrl
      || (opts.caseId ? `/admin/cases/${opts.caseId}` : '/admin');
    sendFcmToUser(opts.userDiscordId, {
      title: opts.title,
      body: opts.message,
      url: fcmUrl,
      caseId: opts.caseId ?? null,
      notificationId: notification.id,
      tag: `notif-${notification.id}`,
    }).catch(() => {});
    return notification;
  } catch (err) {
    console.error('[notifications] createNotification failed:', err);
    return null;
  }
}

export function emitCaseStatusChanged(caseId: number, payload: any) {
  try {
    const io = getIO();
    io.to(`case:${caseId}`).emit('case:status_changed', payload);
    io.to('admin').emit('case:status_changed', payload);
  } catch {}
}
