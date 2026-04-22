# Nomadly SMS App — Build & Deployment Guide

## Overview
Nomadly SMS is a Capacitor-based hybrid Android app that enables users to send bulk SMS campaigns directly from their phone's SIM card. Campaigns can be created from either the Telegram bot (@NomadlyBot) or directly in the app, and sync automatically with the server.

## Architecture
- **Frontend**: Vanilla JS/HTML/CSS web app (in `www/`)
- **Native Layer**: Capacitor 6 with custom DirectSms plugin (Android SmsManager)
- **Backend**: Node.js Express server on Railway. The APK does **not** point at the raw Railway slug — it points at a stable URL the operator controls and resolves the runtime API base at launch (see *URL Resolution* below).
- **Database**: MongoDB (campaigns stored in `smsCampaigns` collection)

## URL Resolution (how the APK finds the server)

The APK uses a two-layer strategy so a Railway rename / provider migration no longer requires rebuilding and redistributing the APK to every installed user.

1. **Baked seed URL** — `www/js/api.js → API.productionUrl`. Set this **once** to a hostname the operator owns (recommended: an `api.<your-domain>` subdomain that `CNAME`s to the current Railway service). When the backend moves, you change the DNS record — the APK keeps working, no rebuild needed.
2. **Server-side config override** — on launch the APK calls `GET /sms-app/config` against the seed URL. If the response contains a non-empty `apiBase` string, the APK uses that value for every subsequent request. This gives a second failsafe for cases where DNS can't be changed immediately (blue-green cutovers, emergency redirect, regional routing, etc.). If the config endpoint is unreachable, the APK silently falls through to the seed URL.

### Recommended one-time setup for a stable seed URL

Use a domain you own on Cloudflare (or any DNS host) and a Railway custom domain:

1. **Railway dashboard → service → Settings → Networking → Custom Domains**
   Add `api.<your-domain>`. Railway returns a CNAME target (e.g. `xxxx.up.railway.app`) and starts issuing a Let's Encrypt cert for your hostname.
2. **Cloudflare (or your DNS host)**
   Add a `CNAME api → xxxx.up.railway.app`.
   **Use DNS-only mode (grey cloud)** — Railway terminates TLS itself; Cloudflare's proxy would require re-wrapping the cert and introduces a 100 s edge timeout. For this API you want direct traffic.
3. **APK** — set `productionUrl: 'https://api.<your-domain>'` in `www/js/api.js` and rebuild once.

After that, a Railway rename is a single Cloudflare CNAME edit — every installed APK auto-recovers within DNS TTL.

### Server-side config endpoint

```
GET /sms-app/config
```

Returns (all fields optional, `null` when unset):
```json
{
  "apiBase": "https://api.nomadly.example",
  "minAppVersion": "2.2.0",
  "maintenance": false,
  "maintenanceMessage": null
}
```

Controlled by these env vars on the Railway service (all unset by default):
- `SMS_APP_API_BASE` — overrides the baked seed URL on the next APK launch
- `SMS_APP_MIN_VERSION` — minimum app version (for future kill-switch / upgrade prompts)
- `SMS_APP_MAINTENANCE` / `SMS_APP_MAINTENANCE_MESSAGE` — flip traffic to a maintenance screen

## Features
- ✅ Code-based activation (no camera/QR needed)
- ✅ Server-synced campaigns (bot ↔ app)
- ✅ Create campaigns from app or Telegram bot
- ✅ Bulk SMS sending with configurable gap time
- ✅ Message rotation ([name] personalization, multiple templates)
- ✅ Import contacts from .txt/.csv files
- ✅ Pause/Resume/Stop sending
- ✅ Progress tracking synced to server
- ✅ Background sending with native Android SmsManager
- ✅ Campaign scheduling

## Prerequisites for APK Build
- **Java JDK 17+** (`brew install openjdk@17` / `apt install openjdk-17-jdk`)
- **Android SDK**
  - Android SDK Platform 34
  - Android SDK Build-Tools 34.0.0
- **Node.js 18+**

## Quick Build Steps (x86-64 host)

```bash
# 1. Install JS deps
cd /path/to/sms-app
npm install

# 2. Point tooling at your Android SDK + JDK
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk    # macOS
# export ANDROID_SDK_ROOT=$HOME/Android/Sdk          # Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk        # Linux
echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties

# 3. Sync web assets into the Android project
npx cap sync android

# 4. Build debug APK
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# 5. Deploy (copy into the served static paths and redeploy)
cp app/build/outputs/apk/debug/app-debug.apk /app/backend/static/nomadly-sms.apk
cp app/build/outputs/apk/debug/app-debug.apk /app/static/nomadly-sms.apk
```

### Build Release APK (signed)
```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore nomadly-sms.keystore -alias nomadly -keyalg RSA -keysize 2048 -validity 10000

# Build release
cd android
./gradlew assembleRelease

# Sign APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore ../nomadly-sms.keystore \
  app/build/outputs/apk/release/app-release-unsigned.apk nomadly

# Align
zipalign -v 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/nomadly-sms.apk
```

## Rebuilding the APK inside the Emergent pod (aarch64)

The Emergent development pod runs on **aarch64** (ARM64). Google's official `build-tools/34.0.0/aapt2` is **x86-64 only**, so a plain `./gradlew assembleDebug` fails with either `aapt2 executable does not exist` or `AAPT2 aapt2 Daemon #N: Daemon startup failed` (qemu-user emulation cannot keep aapt2's daemon process alive across Gradle's multi-resource transforms).

The workaround — baked into `android/gradle.properties` via `android.aapt2FromMavenOverride=/opt/aapt2/aapt2` — is to drop a **native-aarch64** `aapt2` binary at that exact path. Use the community build published by [`lzhiyong/sdk-tools`](https://github.com/Lzhiyong/sdk-tools/releases) (the `android-sdk-tools-static-aarch64.zip` asset; statically linked, ~13 MB).

### Verified working sequence (reproducible end-to-end)

```bash
# — Dependencies —
apt-get update -qq
apt-get install -y -qq openjdk-17-jdk-headless unzip curl

# — Android SDK (Google cmdline-tools + platform-34 + build-tools 34.0.0) —
export ANDROID_SDK_ROOT=/opt/android-sdk
export ANDROID_HOME=$ANDROID_SDK_ROOT
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-arm64
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$JAVA_HOME/bin:$PATH"

mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
curl -sSL -o /tmp/cmdtools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q -o /tmp/cmdtools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools/"
mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
yes | sdkmanager --licenses > /dev/null 2>&1
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# — Native-aarch64 aapt2 (the only non-obvious piece) —
mkdir -p /opt/aapt2
curl -sSL -o /tmp/sdk-aarch64.zip \
  https://github.com/lzhiyong/sdk-tools/releases/latest/download/android-sdk-tools-static-aarch64.zip
unzip -o -q /tmp/sdk-aarch64.zip -d /tmp/aarch64
cp /tmp/aarch64/build-tools/aapt2 /opt/aapt2/aapt2
chmod +x /opt/aapt2/aapt2
# Sanity check — should print "Android Asset Packaging Tool (aapt) 2.19-…"
/opt/aapt2/aapt2 version

# — Build the APK —
cd /app/sms-app
npm install
echo "sdk.dir=/opt/android-sdk" > android/local.properties
npx cap sync android
cd android
./gradlew assembleDebug --no-daemon
# ⇒ android/app/build/outputs/apk/debug/app-debug.apk

# — Ship the APK through both serving paths —
cp app/build/outputs/apk/debug/app-debug.apk /app/backend/static/nomadly-sms.apk
cp app/build/outputs/apk/debug/app-debug.apk /app/static/nomadly-sms.apk
```

Expected build time on the pod: ~1 m 50 s (134 tasks). Output APK is ~3.8 MB. After the copy step, `GET /api/sms-app/download` (FastAPI proxy) and `GET /sms-app/download` (Node bot) immediately serve the rebuilt APK. `git add backend/static/nomadly-sms.apk static/nomadly-sms.apk && git commit` then push to ship to Railway production.

### Sanity check the baked URL inside the APK

```bash
mkdir -p /tmp/apk && rm -rf /tmp/apk/* && \
  unzip -o -q /app/backend/static/nomadly-sms.apk -d /tmp/apk && \
  grep -oE "https?://[a-zA-Z0-9./_-]+" /tmp/apk/assets/public/js/api.js | sort -u
```

Should list exactly the URL you set in `www/js/api.js → productionUrl` — nothing else. If the old hostname shows up, `npx cap sync android` didn't run before the build.

## Server API Endpoints

All endpoints are served by the Node.js bot (same deployment as the Telegram bot). Current baseline URL: `https://nomadly-email-ivr-production.up.railway.app`. Use the seed URL documented in *URL Resolution* — don't hardcode the raw Railway slug anywhere else.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sms-app/config` | Bootstrap config (apiBase override, maintenance flag, min version). Unauthenticated. |
| GET | `/sms-app/auth/:code` | Authenticate with activation code |
| POST | `/sms-app/logout/:code` | Logout |
| GET | `/sms-app/plan/:code` | Get subscription info |
| GET | `/sms-app/campaigns/:chatId` | Get all campaigns |
| POST | `/sms-app/campaigns` | Create new campaign |
| PUT | `/sms-app/campaigns/:id` | Update campaign |
| DELETE | `/sms-app/campaigns/:id?chatId=` | Delete campaign |
| PUT | `/sms-app/campaigns/:id/progress` | Update sending progress |
| POST | `/sms-app/sms-sent/:chatId` | Report SMS sent (analytics) |
| GET | `/sms-app/sync/:chatId` | Full sync (user + campaigns) |

## Telegram Bot Commands
- `📱 Create SMS Campaign` — Start guided campaign creation flow
- `/smscampaign` — Same as above
- User can upload .txt/.csv files with contacts during campaign creation

## Browser Testing
The app can be tested in the browser at:
```
https://your-server.com/api/sms-app-web
```
In browser mode, SMS sending is simulated (95% success rate) for testing purposes.

## Native SMS Plugin
The custom `DirectSmsPlugin` (Java) uses Android's `SmsManager` to:
- Send SMS directly without user interaction
- Handle multi-part messages (>160 chars)
- Report sent/failed status back to JavaScript
- Request SMS permissions at runtime

Location: `android/app/src/main/java/com/nomadly/sms/plugins/DirectSmsPlugin.java`

## Railway Deployment
The server is already configured for Railway:
- Project ID: `dee2dbf2-3781-40d6-97cd-99f01b26c17f`
- Service: `Nomadly-IVR-EMAIL`
- Baseline Railway hostname: `nomadly-email-ivr-production.up.railway.app`
- Stable seed URL baked into the APK: set per *URL Resolution* above.
