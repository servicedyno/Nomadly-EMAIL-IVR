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
- P2: Consolidate duplicate plan-text templates between `js/config.js` and `js/lang/*.js` into a single source of truth (avoid drift when editing copy)
- Backlog: Refactor `_index.js` into feature modules

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
