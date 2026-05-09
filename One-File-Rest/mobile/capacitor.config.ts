/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from '@capacitor/cli';

const SERVER_URL =
  process.env.MOBILE_SERVER_URL ||
  process.env.PUBLIC_APP_URL ||
  'https://one-file-rest.replit.app';

const config: CapacitorConfig = {
  appId: 'club.elitetok.admin',
  appName: 'Elite Tok Admin',
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