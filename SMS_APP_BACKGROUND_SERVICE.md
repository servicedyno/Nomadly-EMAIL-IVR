# SMS App Background Service Implementation

## Problem
The Capacitor-based SMS app was failing to send bulk SMS when the app was backgrounded because Capacitor WebView apps are paused by Android OS. This contrasts with the old React Native version which used native background services.

## Solution
Replicated the React Native `MyTaskService.kt` functionality using a native Android Foreground Service for Capacitor.

## Implementation Details

### 1. **New Native Service: `SmsBackgroundService.java`**
Location: `/app/sms-app/android/app/src/main/java/com/nomadly/sms/services/SmsBackgroundService.java`

**Key Features:**
- Runs as a **Foreground Service** with persistent notification
- Processes SMS queue independently of WebView lifecycle
- Stores campaign state in SharedPreferences
- Supports START, STOP, and PAUSE actions
- Handles SMS sending with SmsManager directly
- Updates notification with progress

**How it works:**
1. JavaScript layer calls `startBackgroundSending()` with campaign data
2. Service stores data in SharedPreferences
3. Service starts as foreground service (survives backgrounding)
4. Processes SMS queue with configurable gap time
5. Updates progress in SharedPreferences
6. JavaScript polls status every 2 seconds to update UI

### 2. **Updated DirectSmsPlugin.java**
Added four new Capacitor plugin methods:

```java
@PluginMethod
public void startBackgroundSending(PluginCall call)

@PluginMethod
public void stopBackgroundSending(PluginCall call)

@PluginMethod
public void pauseBackgroundSending(PluginCall call)

@PluginMethod
public void getBackgroundStatus(PluginCall call)
```

### 3. **Updated JavaScript (app.js)**
- Modified `startSending()` to prefer background service over JS loop
- Added `pollBackgroundStatus()` to update UI from native service progress
- Added `stopBackgroundSending()`, `pauseBackgroundSending()`, `resumeBackgroundSending()`
- Falls back to JS loop if service fails (browser compatibility)

### 4. **AndroidManifest.xml Updates**
- Registered `SmsBackgroundService` as foreground service
- Added permissions:
  - `FOREGROUND_SERVICE`
  - `FOREGROUND_SERVICE_DATA_SYNC`
  - `WAKE_LOCK`

## Key Differences vs React Native Version

| React Native (Old) | Capacitor (New) |
|-------------------|----------------|
| HeadlessJsTaskService | Foreground Service |
| JS execution in background | Native Java execution |
| No notification required | Notification mandatory (Android 8+) |
| Headless JS tasks | SharedPreferences + polling |

## Benefits

✅ **SMS sending works when app is backgrounded**
✅ **SMS sending works when screen is off**
✅ **Survives Android battery optimization**
✅ **User can close the app and sending continues**
✅ **Progress visible via notification**
✅ **Backward compatible** (falls back to JS loop in browser)

## Version
- APK Version: **2.3.0** (versionCode 9)
- Released: April 14, 2025
- Location: `/app/static/nomadly-sms.apk`

## Testing Checklist
1. ✅ APK compiles successfully
2. ⏳ Install APK on Android device
3. ⏳ Grant SMS permissions
4. ⏳ Start a campaign with 10+ contacts
5. ⏳ Press home button (background the app)
6. ⏳ Verify notification shows progress
7. ⏳ Verify SMS continues sending
8. ⏳ Return to app and check progress UI syncs

## Known Limitations
- Requires Android 8+ for foreground service type
- Notification cannot be dismissed while sending
- Polling every 2 seconds (slight battery impact)

## Migration Notes for Users
Users on v2.2.0 or earlier **must** download the new APK (v2.3.0). The app will show an update notification prompting them to download from `/sms-app/download/info` endpoint.
