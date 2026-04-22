# PRD - Nomadly Platform

## Architecture
- React Frontend (port 3000)
- FastAPI Backend (port 8001) - reverse proxy to Node.js
- Node.js Express (port 5000) - core business logic
- MongoDB (port 27017)

## Recent Fixes (Railway Log Anomalies)
1. **Fix 1**: Added notifyGroup() to all 4 hosting payment paths (Wallet, Bank NGN, BlockBee, DynoPay)
2. **Fix 2**: Added displayMainMenuButtons to goto object (was called but never defined)
3. **Fix 3**: Fixed SSH key PEM-to-OpenSSH conversion (proper SSH wire format)
4. **Fix 4**: Added Contabo NVMe↔SSD product fallback for unavailable products
5. **Fix 5**: Added WHM CERT_NOT_YET_VALID retry + admin alert for clock skew
6. **Fix 6**: Added Contabo createSecret password validation guard

## Original Problem Statement
Multi-service platform (Telegram bot + React frontend + Node.js backend) managing domains, hosting, URL shortening, wallet/payments, and Cloud Phone (SIP/IVR/voice).

## Core Architecture
- **Backend**: Node.js monolith (`js/_index.js`) — Telegram bot state machine (22k+ lines)
- **Frontend**: React app via `cpanel-routes.js`
- **Database**: MongoDB
- **Key Integrations**: Telegram, Cloudflare, cPanel/WHM, ConnectReseller, OpenProvider, OpenExchangeRates, Twilio, Telnyx, BlockBee/DynoPay

## Completed (Current Session — Feb 2026)

### Domain Pricing: "Show worst-case, charge best-case"
- Shows higher registrar price; charges cheaper when possible; credits savings
- Tests: 10/10 passing

### BulkIVR Smart Wallet
- $50 min only for first-time or zero-balance; returning users run freely
- `BULK_CALL_MIN_WALLET` configurable via .env
- Tests: 10/10 passing

### SIP Outbound Call Fix (Twilio numbers on Telnyx SIP)
- **Bug**: @lamanifestor calls rejected — Telnyx D51 error (Twilio number not verified on Telnyx)
- **Root Cause (from Railway logs)**:
  1. `transferCall(callControlId, sipUri, twilioNumber)` → D51 rejection
  2. Connection ANI override set to Twilio number → auto-routed calls also rejected
  3. Fallback code referenced undefined `_twilioClient` variable
- **Fix**:
  1. `TELNYX_DEFAULT_ANI=+18556820054` — valid Telnyx number used as `from` for SIP bridge transfers
  2. ANI override reset to default before transfer (prevents auto-routing race)
  3. `_attemptTwilioDirectCall()` helper — proper Twilio sub-account credential lookup + direct call fallback
- **Files**: `js/voice-service.js`, `backend/.env`

## Prioritized Backlog
- P2: Add monitoring for OpenExchangeRates API
- Backlog: Refactor `_index.js` into feature modules

## Feb 2026 — SMS App "Network Error" on Login (stale Railway hostname baked into APK)
- **Reported**: User `@onlicpe` (chatId `7080940684`) on Samsung can't log into Nomadly SMS App — shows "Network error. Check your internet connection and try again." immediately after tapping **Connect to Account**.
- **Diagnosis via Railway GraphQL logs**:
  - Server **never receives** any `/sms-app/auth/7080940684` request (0 hits across 500-line log tail on the active deployment). The failure is client-side; the server is healthy and `[SmsApp] Service initialized` / `Routes registered` on startup.
  - Extracted the APK (`backend/static/nomadly-sms.apk`) and read `assets/public/js/api.js`: `productionUrl: 'https://nomadlynew-production.up.railway.app'` — hardcoded.
  - Direct probe of that hostname returns **HTTP 404 "Application not found"** (Railway response for a renamed/removed service slug).
  - The Railway service is now served at **`nomadly-email-ivr-production.up.railway.app`** (matches `SELF_URL` env var on the live service). Probing that URL with the exact user's endpoint returns HTTP 200 with valid user `onlicpe`, 100-SMS trial active.
  - The referenced `Moxxcompany/NomadlySMSfix` repo is a **different app** (React Native + native Kotlin `MySendSmsModule`), not the current Capacitor build — unrelated to this issue. The "Samsung device" framing was misleading; the stale URL breaks every device equally.
- **Root cause**: Railway service slug was renamed from `nomadlynew-production` → `nomadly-email-ivr-production`, but the APK (Capacitor web bundle) still carries the old hostname. Every installed APK globally is dead until the APK is rebuilt with the new URL.
- **Source fix applied** (`/app/sms-app`):
  - `www/js/api.js` — `productionUrl` updated to `https://nomadly-email-ivr-production.up.railway.app` + comment warning that Railway slugs change on rename.
  - `README.md` — 3 references updated (Architecture, Server API Endpoints, Railway Deployment sections) with a warning note.
  - `npx cap sync android` run — change is already mirrored into `android/app/src/main/assets/public/js/api.js`.
- **APK rebuilt in pod** (`/app/sms-app/android/app/build/outputs/apk/debug/app-debug.apk` → **3,842,182 bytes after the config-endpoint + error-classification update**; earlier 3,800,466 bytes plain URL fix).
  - Emergent pod is `aarch64`; Google's official `aapt2` is x86-64-only. Prior agents worked around this by placing a native-aarch64 `aapt2` at `/opt/aapt2/aapt2` (referenced by `sms-app/android/gradle.properties → android.aapt2FromMavenOverride`). Reproducible recipe now committed to `sms-app/README.md` under "Rebuilding the APK inside the Emergent pod":
    1. `apt install openjdk-17-jdk-headless unzip curl`.
    2. Install Google cmdline-tools + `platform-tools`, `platforms;android-34`, `build-tools;34.0.0` via `sdkmanager` (x86-64 binaries; fine for everything except `aapt2`).
    3. `curl` the `Lzhiyong/sdk-tools` `android-sdk-tools-static-aarch64.zip` release asset and copy `build-tools/aapt2` to `/opt/aapt2/aapt2` — this is the native-aarch64 replacement Gradle picks up via `aapt2FromMavenOverride`.
    4. `npm install && npx cap sync android && ./gradlew assembleDebug` inside `sms-app/`. ~1 m 50 s fresh, ~20 s incremental.
  - Both rebuilt APKs pass the URL check (`grep -oE 'https?://[a-zA-Z0-9./_-]+' assets/public/js/api.js` returns only the intended hostname).
  - Copied into both serving paths (`/app/backend/static/nomadly-sms.apk`, `/app/static/nomadly-sms.apk`) and verified the preview download endpoint serves the freshly-built bytes.
- **P1 "URL rewrite without rebuild" also implemented** — per user request, don't want to rebuild the APK every time the backend moves.
  - **New unauthenticated endpoint** `GET /sms-app/config` in `js/sms-app-service.js` returns `{apiBase, minAppVersion, maintenance, maintenanceMessage}`, all driven by env vars (`SMS_APP_API_BASE`, `SMS_APP_MIN_VERSION`, `SMS_APP_MAINTENANCE`, `SMS_APP_MAINTENANCE_MESSAGE`) — all optional, unset by default.
  - **APK client** (`sms-app/www/js/api.js`) completely rewritten around an `async baseUrl()` resolver:
    - On first API call fetches `${seedUrl}/sms-app/config` with a 5 s timeout.
    - If response carries a non-empty `apiBase`, every subsequent request hits that URL instead (memoised per launch).
    - If the config fetch fails (DNS / timeout / HTTP error), silently falls back to the seed URL so the app still works.
    - Introduces an `APIError` class with `{status, type, detail}` — types: `network` (fetch-level failure), `timeout`, `http` (4xx/5xx), `parse` (non-JSON body). This is what the user-facing error messages key off.
  - **Login UI** (`sms-app/www/js/app.js`) rewritten to surface the new error taxonomy:
    - `type=network` → "Can't reach the server. Check your internet connection, then try again. If the problem persists, the server may be down — contact @NomadlyBot support."
    - `type=timeout` → "The server is responding slowly. Try again in a moment."
    - `status=401` → "Invalid activation code. Get a fresh code from @NomadlyBot."
    - `status=403` → device-limit message (exact text from the server response).
    - `status>=500` → "Server error. Please try again in a few minutes."
    - Old blanket "Network error" collapse (which made the stale-URL outage look like a connectivity issue and cost real diagnostic time) is gone.
- **Operational recipe for the next Railway migration** (documented in README):
  - Ideal: bake `https://api.<operator-domain>` as the seed, CNAME it at Cloudflare (DNS-only / grey cloud) to the current Railway slug. Any future Railway rename is 1 DNS record edit; every installed APK recovers within DNS TTL (~5 min).
  - Emergency: set `SMS_APP_API_BASE=https://<new-host>` on Railway and redeploy — APKs pick up the override on next launch without touching DNS.
- **User re-install required for onlicpe & existing installs**: they must open the bot, tap "📲 Download the app" and re-install to pick up the rebuilt APK.
- **Problem**: "Choose Your Plan" copy was duplicated across 5 files — `js/lang/{en,fr,hi,zh}.js` + `js/config.js` — so every wording/price tweak had to be mirrored 5 times and drifted easily.
- **Fix**: Extracted the template to **`js/lang/plan-copy.js`** which exposes `buildChooseSubscription(lang)` built from:
  - a shared structural template (title → perks line → 3 plan rows → "best value" Monthly marker)
  - per-language `LABELS` dictionary (`title`, `perksIntro`, `daily/weekly/monthly`, `domain/validations/smsDevices` callables, `bestValue`)
  - env-driven pricing + quotas (read at call time so restarts pick up changes)
- Each of the 5 files now imports `buildChooseSubscription` and calls it with its locale code (`'en'`/`'fr'`/`'hi'`/`'zh'`).
- **Output is byte-for-byte identical** to the pre-refactor copy — verified via diff across all locales.
- **Regression test**: `js/tests/test_plan_copy.js` (8 assertions) locks the invariant that every locale + `config.js` stays in lockstep with the builder, and that `HIDE_SMS_APP` branching works.

## Feb 2026 — "Choose Your Plan" Copy Refresh
- **Goal**: Replace verbose plan listings with a compact, scannable template — single intro line with inline perks, one row per plan (price inline), "best value" marker on Monthly.
- **Template** (applied to both `HIDE_SMS_APP` branches):
  ```
  <b>Choose Your Plan</b>
  All plans: 🔗 Unlimited links · 📱 Validations w/ owner names · [📧 BulkSMS ·] 📞 Cloud IVR
  🟢 <b>Daily — $X</b>    N domain · N validations [· 3 SMS devices]
  🔵 <b>Weekly — $X</b>   N domains · N validations [· 10 SMS devices]
  ⭐ <b>Monthly — $X</b> · best value   N domains · N validations [· unlimited SMS devices]
  ```
- **Files updated (all 4 locales + fallback config)**:
  - `js/lang/en.js` (done in previous turn)
  - `js/lang/fr.js` — French translation preserving structure
  - `js/lang/hi.js` — Hindi translation preserving structure
  - `js/lang/zh.js` — Chinese translation preserving structure
  - `js/config.js` — default fallback copy also updated to match
- **Verification**: All 5 files load without syntax errors via `node -e "require(...)"`; Node.js bot restarted cleanly (Telegram webhook verified, all services initialized).

## Key Files
- `js/voice-service.js` — SIP outbound/inbound, IVR, call forwarding
- `js/telnyx-service.js` — Telnyx API wrapper
- `js/bulk-call-service.js` — BulkIVR campaigns
- `js/domain-service.js` — Domain registration, dual-registrar pricing
- `js/tests/test_domain_price_fix.js` — Domain pricing tests
- `js/tests/test_bulkivr_wallet.js` — BulkIVR wallet tests


## Recent Changes
- **Telnyx Race Condition Fix** — Suppressed error 90018 ("Call has already ended") across all Telnyx call control functions. Added `_endedCalls` tracker in voice-service.js with guards in all gather/speak/hangup handlers.
- **Feb 2026 — Domain Restoration for @pacelolx (chatId 6395648769)** — Restored 27 OpenProvider domains to user's account (no wallet debit) via `/app/scripts/restore-pacelolx-domains.js`. Script fetches live OP metadata (opDomainId, status, renewal_date, nameservers) for each domain and upserts into `domainsOf` (KV map with `@`-escaped keys) and `registeredDomains` (_id=domain, val={registrar, opDomainId, opExpiry, opStatus, nameservers, nameserverType='cloudflare', ownerChatId, …}). 1 domain (`qbreverse.com`) skipped — not found on OpenProvider. Verified: bot's `getPurchasedDomains(6395648769)` returns all 27 domains; all have complete `registeredDomains` metadata.


## Feb 2026 — Hosting Anti-Red Plan "2-Month Bug" Defensive Fix
- **Report**: User reported that a monthly Anti-Red hosting purchase was granting ~2 months of validity instead of 1 (affected user's DB record was no longer available; Scenario C per plan).
- **Audit result**: All code paths writing `expiryDate` at initial creation already use `now + 30 days`. Most plausible root cause is duplicate invocation of `registerDomainAndCreateCpanel` (webhook retry / user double-tap / race between callbacks) producing stacked records or extended expiry.
- **Fixes (files `js/cr-register-domain-&-create-cpanel.js`, `js/_index.js`)**:
  1. **Idempotency guard** at the top of `registerDomainAndCreateCpanel`: DB lookup on `cpanelAccounts.{ domain, deleted: {$ne: true} }`. If found, abort with `{ success: false, duplicate: true }` — no WHM create, no storeCredentials, no expiry extension.
  2. **Single source of truth for plan duration** — replaced inline `(info.plan.includes('1-Week') ? 7 : 30)` with `getPlanDuration(info.plan)` from `js/hosting-scheduler.js`. Creation, manual renew, and auto-renew now agree.
  3. **Audit log** on every provisioning: `[Hosting] AUDIT provisioning <domain> cpUser=… chatId=… plan="…" durationDays=… expiryDate=<ISO>`.
  4. **All 4 payment entry points** (wallet USD, bank NGN, crypto BlockBee, crypto DynoPay) now honor `hostingResult.duplicate` and skip refund/error pipelines so legitimate payments aren't double-credited on webhook retries.
- **Deployment**: Fix is in the local repo; **NOT yet deployed to Railway production** (also still pending: earlier `chatId` string fix + unified call-billing fix).


## Feb 2026 — SMS App v2.6.0 (Delivery Fix + Version Display Fix)
- **Reports**: User @onlicpe (1) downloaded the "latest" APK but Settings still showed old version (2.1.5/2.4.1), (2) Sent a campaign but received "0 sent" — messages never actually dispatched.
- **Root causes**:
  1. **Version mismatch** — three places hardcoded old version strings: `android/app/build.gradle` (`versionName "2.4.1"`), `package.json` (`2.0.0`), `www/index.html#setVersion` (`2.1.5`), `www/js/app.js` fallback (`2.4.1`). Also `www/js/api.js` sent `appVersion=2.2.0` to the server.
  2. **SMS delivery failure** — the new foreground-service path (`SmsBackgroundService`) introduced in v2.5.x starts via `startForegroundService(Intent type=dataSync)`. On some Android 13/14 devices the service starts successfully but the BroadcastReceiver for the SMS-sent PendingIntent never fires (POST_NOTIFICATIONS missing, OEM battery-kill, or `foregroundServiceType=dataSync` restrictions), so `sentCount` sits at 0 forever and UI shows "0 sent".
- **Fix (v2.6.0)**:
  1. **Version bumps everywhere** — `build.gradle` (14/2.6.0), `package.json` (2.6.0), `index.html` meta + `#setVersion` (2.6.0), `app.js` console/fallback (2.6.0), `api.js` sync default (2.6.0). Settings screen now reads version dynamically from the `meta[name="app-version"]` tag to eliminate future drift.
  2. **Revert to proven JS-loop sending** — `startSending()` no longer calls `DirectSms.startBackgroundSending`. All campaigns now flow through the per-contact `DirectSms.send()` BroadcastReceiver path that worked reliably in 2.3.x. Background-service code is kept in the APK for future opt-in but is inert.
  3. **Backend-side version bumps** — `js/sms-app-service.js` (`SMS_APP_VERSION`, changelog, `latestVersion` in sync endpoint) and `js/_index.js` (`/sms-app/download/info` returns `2.6.0`).
  4. **APK rebuilt** — `3.84MB` at `/app/static/nomadly-sms.apk`, `versionCode=14`, `versionName=2.6.0` (verified via `aapt2 dump badging`).
- **Files touched**: `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`, `sms-app/www/js/app.js`, `sms-app/www/js/api.js`, `js/sms-app-service.js`, `js/_index.js`, `static/nomadly-sms.apk`.
- **Deployment**: Local only. Users still need the Railway deployment to receive the new APK via Telegram bot broadcast.


## Feb 2026 — SMS App v2.6.1 (One-Tap "Send Test SMS")
- **Feature**: New button in Settings → Diagnostics section lets users send a single test SMS to their own number to verify delivery before running a campaign. First tap prompts for phone (saved to localStorage); subsequent taps send instantly. Includes a "Change" button to update the saved number.
- **Test message** (fixed, single-segment): `Nomadly SMS test - your device can send SMS. Sent at HH:MM:SS` — short on purpose so the test isolates the SMS path from multipart complications.
- **Flow**: Uses the same `nativeSms()` → `DirectSms.send()` BroadcastReceiver path as campaign sending, so a successful test proves campaigns will work. Error reasons are surfaced with the same hint map as the campaign error screen (no_service, radio_off, generic_failure, permission_denied, etc.).
- **Version**: bumped to `2.6.1` everywhere (gradle 15/2.6.1, package.json, index.html meta + #setVersion, app.js, api.js, `js/sms-app-service.js` SMS_APP_VERSION + latestVersion, `js/_index.js` download/info).
- **APK rebuilt** — 3.80MB at `/app/static/nomadly-sms.apk` (`versionCode=15`, `versionName=2.6.1`).
- **Files touched**: `sms-app/www/index.html` (Diagnostics section), `sms-app/www/js/app.js` (`promptTestPhone`, `saveTestPhone`, `sendTestSms`, `_testSmsErrorHint`), `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/js/api.js`, `js/sms-app-service.js`, `js/_index.js`.
- **Data test IDs**: `send-test-sms-btn`, `change-test-phone-btn`.


## Feb 2026 — SMS App v2.7.0 (SIM Selector + Auto-Rotate + Background Service + Auto-Canary + Test Logs)

A bundled feature release addressing user feedback and operational intelligence.

### 1. SIM card selector (user-requested)
- **Native (DirectSmsPlugin.java)**: New `listSims()` and `requestPhonePermission()` methods. Enumerates active SIMs via `SubscriptionManager.getActiveSubscriptionInfoList()`, returns `[{subscriptionId, slotIndex, carrierName, displayName, phoneNumber, mcc, mnc}]`. Added `READ_PHONE_STATE` permission (Capacitor alias `phone`).
- **Native `send()`**: accepts optional `subscriptionId`; routes through `SmsManager.getSmsManagerForSubscriptionId(subId)` (or `createForSubscriptionId` on S+) with fallback to default SIM.
- **Per-SIM sender helper**: `getSmsManagerForSub(context, subId)` — resolves SmsManager for any user-picked SIM. Swallowed exception falls back to default SIM so the send never silently dies.
- **UI**:
  - Settings → "SIM Card" section: default-SIM dropdown + "Refresh SIM list" button.
  - Campaign wizard → Advanced Settings: per-campaign SIM override dropdown with options `Use default SIM`, `Auto-rotate across all SIMs` (when 2+ SIMs present), and each specific SIM.
  - Test SMS uses the default SIM and shows which SIM was used in the status line.

### 2. Auto-rotate SIMs (bonus)
- `startBackgroundSending()` accepts `subscriptionIds: JSON-array` and persists it in SharedPreferences.
- `SmsBackgroundService` reads the list and picks `subs[currentIndex % subs.length]` for each message. Evens out carrier rate limits (2 SIMs ≈ 2× throughput).
- JS-loop path has the same rotation logic in `sendNext()`.

### 3. Background-service toggle (opt-in beta)
- Settings → "Advanced" → "Keep sending when app is closed" toggle (`bgServiceEnabled` in localStorage).
- When ON, `startSending()` routes through `DirectSms.startBackgroundSending()` which persists state in SharedPreferences and runs as a foreground service (`foregroundServiceType=dataSync`). Automatic fallback to JS-loop if the service call throws.
- When OFF (default), campaigns use the proven JS-loop path.
- Added `POST_NOTIFICATIONS` permission (Android 13+ requires it for foreground-service progress notifications).

### 4. Auto-canary (silent-failure guard)
- `_checkAutoCanary(state)` fires one-time after every `sendNext()`: if 30s elapsed, at least 3 attempts made, and zero successes, it paints a red warning banner on the Sending screen and toasts the user pointing to Settings → Diagnostics → Send Test SMS.
- Prevents users from burning their contact list on a broken SIM / permission / carrier block.

### 5. Server-side test-SMS logging
- **Endpoint**: `POST /api/sms-app/test-log/:chatId` — writes to `testSmsLogs` collection with `{chatId, phoneHash(16ch SHA-256 prefix), carrierPrefix, success, errorReason, errorCode, appVersion, simCarrier, simSlot, ts}`. No raw phone numbers stored.
- **Client**: `App._reportTestSmsResult()` fires after every test SMS (success or fail), POSTing hashed phone + carrier prefix for carrier-specific intelligence.
- **Admin bot command**: `/testlogs [days=7]` — aggregates last N days into:
  - total count, OK/fail split, distinct users
  - top 10 failure reasons with counts
  - top 10 country/carrier prefixes with OK-rate per prefix
- Lets operator spot *"MTN Nigeria: 8 generic_failure in last 48h"* before individual users complain.

### Version bumps (end-to-end 2.7.0)
- `android/app/build.gradle` → versionCode 16, versionName 2.7.0
- `package.json`, `www/index.html` meta + Settings display, `www/js/app.js` (init log + `getAppVersion` fallback + `showSettings` fallback)
- `www/js/api.js` sync default
- `js/sms-app-service.js` SMS_APP_VERSION + new conversational release note
- `js/_index.js` `/sms-app/download/info`

### APK verified
- Path: `/app/static/nomadly-sms.apk` (3.81MB)
- aapt2 badging: `versionCode=16 versionName=2.7.0` with `SEND_SMS`, `READ_PHONE_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_DATA_SYNC` declared.

### Data test IDs
`wz-sim-select`, `set-default-sim`, `refresh-sims-btn`, `set-bg-service`, `send-test-sms-btn`, `change-test-phone-btn`.

### Files touched
Frontend/mobile: `sms-app/android/app/src/main/java/com/nomadly/sms/plugins/DirectSmsPlugin.java`, `sms-app/android/app/src/main/java/com/nomadly/sms/services/SmsBackgroundService.java`, `sms-app/android/app/src/main/AndroidManifest.xml`, `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`, `sms-app/www/css/style.css` (switch toggle CSS), `sms-app/www/js/app.js`, `sms-app/www/js/api.js`.

Backend: `js/sms-app-service.js` (test-log endpoint + version bump + release note), `js/_index.js` (`/testlogs` admin command + download/info version).


## Feb 2026 — SMS App v2.7.1 (Per-SIM Auto-Throttle + Carrier Precheck)

Follow-on to v2.7.0: turns the newly-collected `testSmsLogs` data into an active UX loop and makes per-SIM sending carrier-aware.

### Per-SIM auto-throttle (mid-campaign)
- In `sendNext()` the app keeps a rolling window of the last 5 outcomes per SIM (`simStats[subId].recent`).
- If ≥ 4 of the last 5 from a SIM are rate-limit-style failures (`generic_failure`, `send_timeout`, `multipart_timeout`):
  - **Multi-SIM mode**: that SIM is added to `throttledSims` and silently skipped in the rotation for the remainder of the campaign (as long as ≥ 1 live SIM remains). Toast: *"Carrier rate limit detected — pausing SIM 2 — Airtel for this campaign."*
  - **Single-SIM mode (or all SIMs rotated out)**: the gap time is doubled via `throttleMultiplier` (capped at 4×). Toast: *"Carrier appears to rate-limit — slowing send rate 2×."*
- Tracker resets after each decision so we don't re-throttle on the same 5-sample window.
- The JS-loop `setTimeout(..., s.gapTime * s.throttleMultiplier)` applies the multiplier automatically.

### Campaign precheck banner (pre-send recommendation)
- New endpoint `GET /sms-app/carrier-stats?prefixes=1,234,44` aggregates `testSmsLogs` over the last 14 days by carrier dial-prefix and returns `{sample, success, rate}` per prefix.
- Wizard Step 4 (Review & Send) now fires `_runCarrierPrecheck(contacts)` which:
  1. Bins target contacts by their country/carrier prefix (first 1–3 digits).
  2. Fetches stats for those prefixes.
  3. If any prefix with ≥ 5 samples has < 70% success rate, renders a red banner listing the prefix, sample size, success %, and how many contacts it affects.
  4. Shows an **"Enable Auto-rotate across my SIMs"** button that flips `wzSimSelect` → `rotate` (only when ≥ 2 SIMs are available).

### Version bumps (2.7.1)
- `build.gradle` 17/2.7.1, `package.json`, `index.html` meta + setVersion, `app.js`, `api.js`, `sms-app-service.js` SMS_APP_VERSION + new conversational release note, `_index.js` download/info.

### APK verified
- Path: `/app/static/nomadly-sms.apk` (3.81MB) — `versionCode=17`, `versionName=2.7.1` (aapt2). All new logic present in bundled `assets/public/js/app.js`.

### Data test IDs
`carrier-precheck-banner`, `enable-rotate-btn`.

### Files touched
`js/sms-app-service.js` (new `/sms-app/carrier-stats` endpoint + version bump + release note), `js/_index.js` (download/info version),  
`sms-app/android/app/build.gradle`, `sms-app/package.json`,  
`sms-app/www/index.html` (precheck banner slot + version meta/setVersion),  
`sms-app/www/js/api.js` (`getCarrierStats()` + sync version),  
`sms-app/www/js/app.js` (`_runCarrierPrecheck`, `_enableAutoRotateFromPrecheck`, `_recordSimOutcome`, `_applyAutoThrottle`, `_simLabelForId`, throttle-aware sendNext + timer, sending-state init for `simStats`/`throttledSims`/`throttleMultiplier`).
