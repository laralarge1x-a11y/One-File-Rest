#!/usr/bin/env node
// Decode ANDROID_KEYSTORE_BASE64 → mobile/android/release.keystore so the
// release build can sign the APK/AAB without a keystore in source control.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, '..', 'android', 'release.keystore');
const b64 = process.env.ANDROID_KEYSTORE_BASE64;

if (!b64) {
  console.error('❌ ANDROID_KEYSTORE_BASE64 is not set. Release build will be unsigned.');
  console.error('   Generate one with `keytool -genkey -v -keystore ks.jks ...` and');
  console.error('   set ANDROID_KEYSTORE_BASE64 / _PASSWORD / KEY_ALIAS / KEY_PASSWORD.');
  process.exit(1);
}

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, Buffer.from(b64, 'base64'));
console.log('✅ Wrote', target, `(${(await fs.stat(target)).size} bytes)`);
