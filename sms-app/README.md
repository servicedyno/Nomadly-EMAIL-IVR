# Nomadly SMS App — Build & Deployment Guide

## Overview
Nomadly SMS is a Capacitor-based hybrid Android app that enables users to send bulk SMS campaigns directly from their phone's SIM card. Campaigns can be created from either the Telegram bot (@NomadlyBot) or directly in the app, and sync automatically with the server.

## Architecture
- **Frontend**: Vanilla JS/HTML/CSS web app (in `www/`)
- **Native Layer**: Capacitor 6 with custom DirectSms plugin (Android SmsManager)
- **Backend**: Node.js Express server on Railway (`nomadlynew-production.up.railway.app`)
- **Database**: MongoDB (campaigns stored in `smsCampaigns` collection)

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
- **Android SDK** (Android Studio or command-line tools)
  - Android SDK Platform 34
  - Android SDK Build-Tools 34.0.0
- **Node.js 18+**

## Quick Build Steps

### 1. Install dependencies
```bash
cd /path/to/sms-app
npm install
```

### 2. Set environment variables
```bash
export ANDROID_SDK_ROOT=$HOME/Library/Android/sdk  # macOS
# OR
export ANDROID_SDK_ROOT=$HOME/Android/Sdk  # Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk  # Linux
```

### 3. Sync web assets to Android
```bash
npx cap sync android
```

### 4. Build Debug APK
```bash
cd android
./gradlew assembleDebug
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Build Release APK (signed)
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

## Server API Endpoints
All endpoints are on the Railway server: `https://nomadlynew-production.up.railway.app`

| Method | Endpoint | Description |
|--------|----------|-------------|
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
- Domain: `nomadlynew-production.up.railway.app`
- The app auto-detects environment (browser vs native) for API routing
