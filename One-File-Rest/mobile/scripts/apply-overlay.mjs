#!/usr/bin/env node
// Copies our committed Android overlay (manifest snippets, signing config,
// FCM service Java, notification channel resources) into the freshly
// generated `mobile/android/` project. Idempotent — safe to re-run on
// every `cap sync`.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(__dirname, '..');
const OVERLAY = path.join(MOBILE, 'android-overlay');
const ANDROID = path.join(MOBILE, 'android');

if (!(await exists(ANDROID))) {
  console.error('❌ android/ does not exist yet. Run `npx cap add android` first.');
  process.exit(1);
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function copyTree(src, dst) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dst, { recursive: true });
    for (const entry of await fs.readdir(src)) {
      await copyTree(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    console.log('  ↳', path.relative(ANDROID, dst));
  }
}

async function injectOnce(file, marker, snippet) {
  if (!(await exists(file))) {
    console.warn('  ⚠ skipped (file missing):', path.relative(ANDROID, file));
    return;
  }
  const cur = await fs.readFile(file, 'utf8');
  if (cur.includes(marker)) return;
  await fs.writeFile(file, cur + '\n' + snippet);
  console.log('  ↳ patched', path.relative(ANDROID, file));
}

console.log('▶ Applying Android overlay…');

// 1. Copy file overlays (Java sources, res/, signing.gradle, manifest snippets)
if (await exists(path.join(OVERLAY, 'files'))) {
  await copyTree(path.join(OVERLAY, 'files'), ANDROID);
}

// 2. Patch AndroidManifest.xml — inject share-target intent-filter inside
//    the MainActivity tag. We do a string replace because Capacitor owns
//    the manifest and rewrites it on every sync.
const manifestPath = path.join(ANDROID, 'app/src/main/AndroidManifest.xml');
if (await exists(manifestPath)) {
  let manifest = await fs.readFile(manifestPath, 'utf8');
  const SHARE_MARKER = '<!-- elite-tok-share-intent -->';
  if (!manifest.includes(SHARE_MARKER)) {
    const shareFilter = `
            ${SHARE_MARKER}
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="image/*" />
                <data android:mimeType="text/plain" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="image/*" />
            </intent-filter>
            <!-- Deep-link handler so OAuth callbacks open the app and not the browser. -->
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="club.elitetok.admin" />
            </intent-filter>`;
    // Inject right before MainActivity's closing </activity>.
    manifest = manifest.replace(/(<activity[^>]*android:name="\.MainActivity"[\s\S]*?)(<\/activity>)/, `$1${shareFilter}\n        $2`);
    // Add the FCM service registration once, just before </application>.
    const FCM_MARKER = '<!-- elite-tok-fcm-service -->';
    if (!manifest.includes(FCM_MARKER)) {
      manifest = manifest.replace(
        /<\/application>/,
        `        ${FCM_MARKER}
        <service
            android:name=".EliteTokFcmService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="elite_tok_admin_alerts" />
    </application>`
      );
    }
    await fs.writeFile(manifestPath, manifest);
    console.log('  ↳ patched app/src/main/AndroidManifest.xml');
  }
}

// 3. Patch app/build.gradle to wire signing config + google-services plugin.
const appGradle = path.join(ANDROID, 'app/build.gradle');
await injectOnce(
  appGradle,
  '// elite-tok-signing',
  `// elite-tok-signing
apply from: '../signing.gradle'
apply plugin: 'com.google.gms.google-services'
`
);

// 4. Patch root build.gradle to add google-services classpath.
const rootGradle = path.join(ANDROID, 'build.gradle');
if (await exists(rootGradle)) {
  let g = await fs.readFile(rootGradle, 'utf8');
  if (!g.includes('com.google.gms:google-services')) {
    g = g.replace(/(dependencies\s*\{)/, `$1\n        classpath 'com.google.gms:google-services:4.4.2'`);
    await fs.writeFile(rootGradle, g);
    console.log('  ↳ patched build.gradle (google-services classpath)');
  }
}

console.log('✅ Overlay applied.');
