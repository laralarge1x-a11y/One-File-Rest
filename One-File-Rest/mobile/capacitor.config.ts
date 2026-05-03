/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from '@capacitor/cli';

// The native APK is a thin wrapper around the deployed admin web app. By
// default we point `server.url` at the production deployment so any web
// release rolls out to staff phones on next app open — no Play Store update
// required. Set MOBILE_SERVER_URL=http://10.0.2.2:5000 (emulator) for
// live-reload during local dev (see MOBILE.md).
const SERVER_URL =
  process.env.MOBILE_SERVER_URL ||
  process.env.PUBLIC_APP_URL ||
  'https://elite-tok-club.replit.app';

const config: CapacitorConfig = {
  appId: 'club.elitetok.admin',
  appName: 'Elite Tok Admin',
  // The bundled web shell — `pnpm run build:android` copies the React
  // build output here so the app has a fallback in case `server.url` is
  // unreachable on first launch.
  webDir: 'www',
  server: {
    url: SERVER_URL,
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['*.replit.app', '*.replit.dev', 'discord.com', '*.discord.com'],
  },
  android: {
    backgroundColor: '#0a0a0a',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
      overlay: false,
    },
  },
};

export default config;
