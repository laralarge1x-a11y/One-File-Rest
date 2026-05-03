// Wires every native APK feature into the React app, exactly once.
// Called from <App /> after the user logs in.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  isNative,
  initPushNotifications,
  attachBackButton,
  attachShareIntentListener,
  attachAppUrlOpen,
  closeInAppBrowser,
  setBadgeCount,
  onAppResume,
  SharedIntent,
} from '../lib/native';

export interface UseNativeBridgeOpts {
  isStaff: boolean;
  onSharedItem?: (item: SharedIntent) => void;
}

// Convert a deep-link URL (either club.elitetok.admin://path or a normal
// http(s) URL) into the in-app router path it should navigate to.
function urlToPath(raw: string): string | null {
  try {
    const u = new URL(raw, window.location.origin);
    // Custom scheme: scheme://path?query  →  /path?query
    if (u.protocol === 'club.elitetok.admin:') {
      const path = (u.host + u.pathname).replace(/^\/?/, '/');
      return path + (u.search || '');
    }
    return u.pathname + u.search;
  } catch {
    return raw.startsWith('/') ? raw : null;
  }
}

// The dispatcher Hot queue (cases needing immediate attention) is the
// number staffers actually care about on their phone — not generic
// notification unread count. Falls back to /api/notifications if the
// queue endpoint is unavailable.
function refreshHotBadge() {
  fetch('/api/admin/queue', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const count = d?.counts?.hot;
      if (typeof count === 'number') { setBadgeCount(count); return; }
      throw new Error('no hot count');
    })
    .catch(() => {
      fetch('/api/notifications', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.unread != null) setBadgeCount(d.unread); })
        .catch(() => { /* offline — leave badge as-is */ });
    });
}

export function useNativeBridge({ isStaff, onSharedItem }: UseNativeBridgeOpts) {
  const navigate = useNavigate();
  const setupRef = useRef(false);

  useEffect(() => {
    if (!isNative() || setupRef.current) return;
    if (!isStaff) return; // APK is staff-only — clients use the website
    setupRef.current = true;

    let cleanups: Array<() => void> = [];

    (async () => {
      const handleDeepLink = (raw: string) => {
        const path = urlToPath(raw);
        if (!path) return;
        // OAuth callback returns to /auth/discord/callback — close the
        // browser and let the WebView refresh its session.
        if (/\/auth\/discord(\/|\?|$)/.test(path)) {
          closeInAppBrowser();
          window.location.href = '/';
          return;
        }
        navigate(path, { replace: false });
      };

      // Note: biometric unlock is now enforced by <BiometricGate> in App.tsx
      // BEFORE this hook mounts; we no longer prompt here, which would have
      // raced against the admin tree rendering.

      // 1. App URL opens — notification taps that use the custom scheme
      //    (EliteTokFcmService dispatches via club.elitetok.admin://).
      //    The OAuth callback is handled by useAppLevelDeepLinks in App.tsx
      //    (mounted before login). Drain any URL buffered by it before we
      //    were ready.
      const buffered = (window as any).__pendingDeepLink;
      if (typeof buffered === 'string') {
        delete (window as any).__pendingDeepLink;
        handleDeepLink(buffered);
      }
      cleanups.push(await attachAppUrlOpen(handleDeepLink));

      // 2. Push notifications — registration + foreground action.
      await initPushNotifications({ onDeepLink: handleDeepLink });

      // 3. Hardware back button.
      cleanups.push(await attachBackButton());

      // 4. Share intent.
      if (onSharedItem) {
        cleanups.push(await attachShareIntentListener((i) => onSharedItem(i)));
      }

      // 5. App-resume → refresh unread badge.
      cleanups.push(await onAppResume(refreshHotBadge));
      refreshHotBadge();
    })();

    return () => {
      cleanups.forEach((c) => { try { c(); } catch { /* listener already removed */ } });
      setupRef.current = false;
    };
  }, [isStaff, navigate, onSharedItem]);
}
