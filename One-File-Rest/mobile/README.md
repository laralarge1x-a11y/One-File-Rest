# Elite Tok Admin — Android (Capacitor)

This folder is the **native Android wrapper** for the existing admin portal.
It is staff-only — clients keep using the website.

> ℹ️ The Android SDK is **not available inside Replit**. All commands here
> must be run on a workstation (macOS / Linux / Windows) with Android Studio
> + JDK 17 installed. The Replit container holds the source so it travels
> with the rest of the codebase, but builds happen on your laptop.

## Architecture

The APK is a 3 MB shell around the deployed admin web app:

```
┌────────────────────────────────────┐
│ Android APK (Capacitor 6)          │
│  ├─ WebView → server.url           │  ← admin React app, served live
│  ├─ FCM (push notifications)       │
│  ├─ Biometric (fingerprint/face)   │
│  ├─ Camera (one-tap evidence)      │
│  ├─ Send-intent (share to attach)  │
│  ├─ Hardware back button           │
│  └─ Badge count                    │
└────────────────────────────────────┘
```

`server.url` in `capacitor.config.ts` is what the WebView loads. Pointing it
at the deployed Replit URL means a normal `vite build` → deploy is enough
to ship a UI change to every staff phone — no APK rebuild needed.

## One-time setup (per workstation)

1. Install **Android Studio** (Hedgehog or newer) + JDK 17 + an Android
   emulator image (API 33 / Android 13 recommended).
2. From the repo root, install root deps (`pnpm install` in `One-File-Rest/`).
3. From this `mobile/` folder:
   ```bash
   pnpm install
   pnpm run add:android      # creates ./android with the gradle project
   ```
4. Drop your branded source images into `mobile/resources/`:
   - `icon.png` — 1024×1024 PNG, no transparency
   - `splash.png` — 2732×2732 PNG, logo centered on the brand background
   Then:
   ```bash
   pnpm run icons            # generates every density via @capacitor/assets
   ```

## Day-to-day dev (live reload onto a phone/emulator)

```bash
# Terminal 1: run the backend + Vite dev server in Replit (port 5000)
# (the normal `Start application` workflow)

# Terminal 2 on your laptop, with phone plugged in or emulator running:
cd One-File-Rest/mobile
MOBILE_SERVER_URL=http://10.0.2.2:5000 pnpm run sync   # 10.0.2.2 = host from emulator
pnpm run run:android
```

The app loads your laptop's dev server and hot-reloads on every save.

## Producing a debug APK (sideload)

```bash
cd One-File-Rest
pnpm run build:android         # vite build + cap sync + ./gradlew assembleDebug
# Output: One-File-Rest/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Send `app-debug.apk` to staff. They install it via *Files → tap the APK*
after enabling "Install unknown apps" for the Files app.

## Producing a signed release APK + AAB (Play Store)

You need a **release keystore**. Generate it once:

```bash
keytool -genkey -v -keystore elite-tok-admin-release.keystore \
  -alias elite-tok-admin -keyalg RSA -keysize 2048 -validity 10000
```

Store these as Replit secrets (used by the build script):

| Secret                     | Value                                       |
|----------------------------|---------------------------------------------|
| `ANDROID_KEYSTORE_BASE64`  | `base64 elite-tok-admin-release.keystore`   |
| `ANDROID_KEYSTORE_PASSWORD`| Keystore password                           |
| `ANDROID_KEY_ALIAS`        | `elite-tok-admin`                           |
| `ANDROID_KEY_PASSWORD`     | Key password (often same as keystore pwd)   |

Then:

```bash
cd One-File-Rest
pnpm run build:android:release
# Outputs:
#   mobile/android/app/build/outputs/apk/release/app-release.apk
#   mobile/android/app/build/outputs/bundle/release/app-release.aab   ← upload to Play Console
```

Upload the `.aab` to the **internal testing** track in the Play Console
for staff distribution without a public listing.

## Bumping the version

Edit `mobile/android/app/build.gradle`:

```gradle
versionCode 2          // monotonically increasing integer
versionName "1.0.1"    // human-readable string shown in About
```

Then `pnpm run build:android:release`.

## FCM (push notifications) setup

1. Create a Firebase project (free tier is fine).
2. Add an Android app with package `club.elitetok.admin`.
3. Download `google-services.json` and drop it into `mobile/android/app/`.
4. Project Settings → Cloud Messaging → enable the **legacy server key**,
   copy it, and set as the `FIREBASE_SERVER_KEY` Replit secret.
5. Restart the server. The startup checklist should now show
   `✅ FIREBASE_SERVER_KEY — set`.

The app registers its FCM token with `POST /api/devices/register` on every
launch, and `services/fcm.ts` fans every new admin notification out to every
registered staff device.

## Secret rotation

- **FCM server key**: regenerate in Firebase → Cloud Messaging, then update
  `FIREBASE_SERVER_KEY`. Existing tokens keep working — only the *server*
  side changes.
- **Release keystore**: never rotate if avoidable; the Play Store requires
  the same signing key for every update. If it leaks, you must enroll in
  Play App Signing and request a key reset (manual Google review).

## Troubleshooting

| Symptom                                     | Fix                                                                           |
|---------------------------------------------|-------------------------------------------------------------------------------|
| App opens to a white screen                 | `server.url` is unreachable. Check the deployed URL in `capacitor.config.ts`. |
| Push notifications never arrive             | `FIREBASE_SERVER_KEY` not set on the server, or wrong package name in Firebase. |
| Biometric prompt shows but app stays locked | The native plugin isn't installed; re-run `pnpm install && pnpm run sync`.    |
| Share intent does nothing                   | `send-intent` plugin missing — `pnpm install send-intent && pnpm run sync`.   |
| Hardware back button closes the app         | `attachBackButton()` failed silently. Check ADB logs for `[native]` lines.    |
