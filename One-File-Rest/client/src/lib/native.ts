// Runtime bridge to Capacitor. Same React bundle ships to web (Capacitor
// absent) and Android APK (Capacitor present).
//
// IMPORTANT: We deliberately do NOT static-import any `@capacitor/*` package
// from the web bundle. In the native APK, `cap sync` injects a tiny
// `capacitor.js` runtime into the WebView that exposes every registered
// plugin via `window.Capacitor.Plugins.<Name>`. Those proxies marshal calls
// through the native bridge — they don't depend on bundled JS at all. So
// the runtime resolution pattern is:
//
//   const Browser = getPlugin('Browser');
//   if (Browser) await Browser.open({ url });
//
// This works in any built WebView (including a remote `server.url`),
// keeps the web bundle small, and avoids a "module not found" failure
// when the npm packages aren't installed (e.g. on Replit, where only the
// developer's workstation runs `cap sync`).

let cachedIsNative: boolean | null = null;

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, any>;
}
function cap(): CapacitorGlobal | null {
  return (typeof window !== 'undefined' && (window as any).Capacitor) || null;
}

export function isNative(): boolean {
  if (cachedIsNative !== null) return cachedIsNative;
  const c = cap();
  cachedIsNative = !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
  return cachedIsNative;
}

export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isNative()) return 'web';
  return (cap()?.getPlatform?.() as 'android' | 'ios') || 'web';
}

function getPlugin<T = any>(name: string): T | null {
  const c = cap();
  if (!c?.Plugins) return null;
  return (c.Plugins[name] as T) || null;
}

// ─── Push notifications (FCM) ──────────────────────────────────────────────
export async function initPushNotifications(opts: { onDeepLink: (url: string) => void }) {
  const PN = getPlugin<any>('PushNotifications');
  if (!PN) return { ok: false, reason: 'plugin-missing' };
  const perm = await PN.checkPermissions();
  let granted = perm.receive === 'granted';
  if (!granted) {
    const req = await PN.requestPermissions();
    granted = req.receive === 'granted';
  }
  if (!granted) return { ok: false, reason: 'denied' };

  PN.addListener('registration', async (t: { value: string }) => {
    try {
      await fetch('/api/devices/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: t.value,
          platform: getPlatform(),
          deviceLabel: navigator.userAgent.slice(0, 200),
          appVersion: '1.0.0',
        }),
      });
    } catch (err) {
      console.warn('[native] device register failed', err);
    }
  });

  PN.addListener('pushNotificationActionPerformed', (action: { notification?: { data?: { url?: string } } }) => {
    const url = action?.notification?.data?.url;
    if (url) opts.onDeepLink(url);
  });

  await PN.register();
  return { ok: true };
}

// ─── Biometric unlock ──────────────────────────────────────────────────────
export async function biometricUnlock(reason = 'Unlock Elite Tok Admin'): Promise<boolean> {
  const NB = getPlugin<any>('NativeBiometric');
  if (!NB) return true; // not native, or plugin not registered — skip
  try {
    const avail = await NB.isAvailable();
    if (!avail?.isAvailable) return true;
    await NB.verifyIdentity({ reason, title: 'Elite Tok Admin', subtitle: 'Confirm your identity to continue' });
    return true;
  } catch {
    return false;
  }
}

// ─── Android hardware back-button ──────────────────────────────────────────
export async function attachBackButton(): Promise<() => void> {
  const App = getPlugin<any>('App');
  if (!App) return () => {};
  const handle = await App.addListener('backButton', () => {
    if (window.history.length > 1) window.history.back();
    else App.minimizeApp?.();
  });
  return () => { handle.remove?.(); };
}

// ─── App URL open (deep links: OAuth callback + notification taps) ─────────
export async function attachAppUrlOpen(cb: (url: string) => void): Promise<() => void> {
  const App = getPlugin<any>('App');
  if (!App) return () => {};
  const handle = await App.addListener('appUrlOpen', (event: { url: string }) => {
    if (event?.url) cb(event.url);
  });
  // Also flush any URL the OS launched the app with (notification cold-start).
  try {
    const launchUrl = await App.getLaunchUrl?.();
    if (launchUrl?.url) cb(launchUrl.url);
  } catch { /* getLaunchUrl unsupported on some plugin versions */ }
  return () => { handle.remove?.(); };
}

export async function closeInAppBrowser() {
  const Browser = getPlugin<any>('Browser');
  try { await Browser?.close?.(); } catch { /* already closed */ }
}

// ─── Native camera ─────────────────────────────────────────────────────────
export async function takePhoto(): Promise<string | null> {
  const Camera = getPlugin<any>('Camera');
  if (!Camera) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: 'dataUrl',
      source: 'CAMERA',
      saveToGallery: false,
    });
    return photo?.dataUrl || null;
  } catch (err) {
    console.warn('[native] takePhoto cancelled or failed', err);
    return null;
  }
}

// ─── Share-intent receiver ─────────────────────────────────────────────────
export interface SharedIntent {
  title?: string;
  text?: string;
  url?: string;
  additionalItems?: Array<{ type?: string; uri?: string; title?: string }>;
}
export async function attachShareIntentListener(cb: (i: SharedIntent) => void): Promise<() => void> {
  const SI = getPlugin<any>('SendIntent');
  if (!SI) return () => {};
  const handle = await SI.addListener?.('receivedSharedItem', (i: SharedIntent) => cb(i));
  SI.checkSendIntentReceived?.()
    .then((i: SharedIntent | null) => { if (i) cb(i); })
    .catch((err: unknown) => console.warn('[native] checkSendIntentReceived failed', err));
  return () => { handle?.remove?.(); };
}

// ─── Badge count ───────────────────────────────────────────────────────────
export async function setBadgeCount(n: number) {
  const Badge = getPlugin<any>('Badge');
  if (!Badge) return;
  try {
    if (n > 0) await Badge.set({ count: n });
    else await Badge.clear?.();
  } catch (err) {
    console.warn('[native] setBadgeCount failed', err);
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
export async function onAppResume(cb: () => void): Promise<() => void> {
  const App = getPlugin<any>('App');
  if (!App) return () => {};
  const handle = await App.addListener('appStateChange', (s: { isActive: boolean }) => { if (s.isActive) cb(); });
  return () => { handle.remove?.(); };
}

// ─── In-app browser (used for Discord OAuth on native) ─────────────────────
export async function openInAppBrowser(url: string) {
  const Browser = getPlugin<any>('Browser');
  if (!Browser) {
    window.location.href = url;
    return;
  }
  await Browser.open({ url, presentationStyle: 'popover' });
}

// ─── Encrypted preferences (session id, last-seen counters, etc.) ──────────
export async function prefGet(key: string): Promise<string | null> {
  const P = getPlugin<any>('Preferences');
  if (!P) return null;
  try {
    const r = await P.get({ key });
    return r?.value ?? null;
  } catch { return null; }
}
export async function prefSet(key: string, value: string): Promise<void> {
  const P = getPlugin<any>('Preferences');
  if (!P) return;
  try { await P.set({ key, value }); } catch (err) { console.warn('[native] prefSet failed', err); }
}
