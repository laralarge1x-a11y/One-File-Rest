# Elite Tok Admin — Expo (Expo Go) App

A premium **native** admin app for Elite Tok Club staff, built with Expo SDK 54
+ Expo Router + NativeWind. The UI is Discord-style: dark theme, channel-list
case rails, chat-first case view, blur effects, haptics, and gesture
animations. The app talks to the existing backend (`/api/*`) — **no backend
changes required** beyond what's already shipped.

This is a **separate codebase** from `One-File-Rest/mobile/` (the Capacitor APK
shell). Both can coexist; this Expo app is the recommended one going forward
because it can be tested instantly via **Expo Go** on a phone.

## Quick start (test on your phone in 60 seconds)

1. **Install Expo Go** on your phone:
   - iOS: <https://apps.apple.com/app/expo-go/id982107779>
   - Android: <https://play.google.com/store/apps/details?id=host.exp.exponent>

2. **Install dependencies** (first time only):
   ```bash
   cd admin-expo
   npm install
   ```

3. **Start the dev server**:
   ```bash
   npx expo start
   ```

4. **Scan the QR code** that appears in the terminal with:
   - **iOS**: the built-in Camera app
   - **Android**: the **Scan QR code** button inside Expo Go

The app opens on your phone in seconds. Code changes hot-reload instantly.

> If your phone is not on the same Wi-Fi as the dev machine, run
> `npx expo start --tunnel` instead — it routes through Expo's tunnel so any
> network works (slower but reliable).

## Configuration

The API base URL lives in `app.json` under `expo.extra.apiBaseUrl`. It defaults
to the deployed Replit URL. To point at a local backend, change it (or set the
`EXPO_PUBLIC_API_BASE` env var and update `src/api/client.ts`).

For Discord OAuth to work on the device, the deployed backend's
`DISCORD_REDIRECT_URI` must already be set (it is — same one the web app uses).
Sign-in opens an in-app browser that returns to the Expo app via the
`elitetokadmin://auth/complete` deep link.

## What's implemented (v1)

- **Discord OAuth login** with staff-only gate (non-staff see a friendly block screen)
- **Biometric unlock** after 30 min in background (Face ID / Touch ID / fingerprint)
- **Smart Queue** with 5 lanes (Hot / Stalled / In-Flight / Mine / Snoozed),
  pull-to-refresh, live updates via Socket.IO, lane counts
- **Bulk actions** (long-press to select → snooze 24h / set critical)
- **Case detail** — chat thread, status pill, priority dot, AI summary bottom
  sheet, evidence grid with image lightbox, snooze button
- **Reply composer** — full-screen modal with AI suggested-reply pill, template
  picker, attach from camera or photo library
- **Inbox** — notifications feed with deep-link to the right case on tap
- **Knowledge Base** browser with search and article modal
- **Specialists directory** with online/offline presence and win-rate
- **Push notifications** via Expo Push (registered against `/api/devices`)
  with deep-link routing on tap
- **Settings** — profile card, send test push, sign out

## Architecture notes

- **Routing**: Expo Router file-based routes in `app/`
- **Networking**: tiny `fetch` wrapper in `src/api/client.ts` that forwards
  the `connect.sid` session cookie (stored in `expo-secure-store`)
- **State**: `@tanstack/react-query` for server state; `zustand` for the
  session
- **Realtime**: `socket.io-client` over websocket only (Expo Go safe)
- **Styling**: NativeWind v4 + a small `colors.ts` theme matching the Discord
  palette
- **No custom native modules** — every dependency is in the Expo SDK 54
  prebuilt module set, so it runs in Expo Go with zero configuration.

## Building real binaries (later)

Expo Go is great for development. For production APK / IPA, use **EAS Build**.

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview      # APK for sideload
eas build -p ios --profile preview          # iOS dev/sim build
eas build -p android --profile production   # Play Store AAB
eas build -p ios --profile production       # App Store IPA
```

EAS runs the build in the cloud, so no Android Studio / Xcode is required on
your machine. Submission is `eas submit`.

## Out of scope (intentionally)

- Client-facing app (clients keep using the website)
- Replacing the Capacitor APK in `One-File-Rest/mobile/` (both coexist)
- Offline mode (real-time + React Query cache covers v1)
- Rare-use admin pages like KB CRUD or weekly report PDF generation — those
  stay web-only for now

## Project layout

```
admin-expo/
├── app/                         # Expo Router routes
│   ├── _layout.tsx              # Root: providers, route guard, biometric gate
│   ├── index.tsx                # Redirect to queue
│   ├── login.tsx                # Discord OAuth landing
│   ├── blocked.tsx              # Non-staff block screen
│   ├── (tabs)/                  # Bottom tab nav
│   │   ├── queue.tsx            # 5-lane queue + bulk actions
│   │   ├── notifications.tsx
│   │   ├── kb.tsx
│   │   ├── specialists.tsx
│   │   └── settings.tsx
│   └── case/
│       ├── [id].tsx             # Chat-first case detail
│       └── [id]/compose.tsx     # Full-screen reply composer
├── src/
│   ├── api/{client,queries}.ts  # fetch wrapper + react-query hooks
│   ├── auth/session.ts          # zustand auth store
│   ├── components/              # Avatar, CaseRow, Pill, Screen, EmptyState
│   ├── hooks/                   # usePushRegistration, useBiometricLock
│   ├── realtime/socket.ts       # Socket.IO singleton
│   └── theme/colors.ts          # Discord palette
├── assets/                      # icon.png, splash.png (drop yours here)
├── app.json
├── package.json
└── README.md
```

## Troubleshooting

- **"Network request failed"**: confirm `expo.extra.apiBaseUrl` in `app.json`
  is reachable from your phone. Use `--tunnel` if local dev.
- **Login loops back to login**: the in-app browser uses the system cookie
  jar; some Android variants block third-party cookies. Re-open the app and
  the session cookie persists in `expo-secure-store`.
- **No push received**: Expo Go pushes only work with an Expo project ID. Run
  `npx eas init` once to create one, then redeploy.
