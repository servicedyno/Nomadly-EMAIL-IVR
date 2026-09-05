# Nomadly PRD

## Overview
Multi-service Telegram bot platform: React frontend, FastAPI backend, Node.js bot server.

## Core Services
- **Frontend**: React on port 3000
- **Backend**: FastAPI on port 8001
- **Node.js Bot**: Express + Telegram Bot on port 5000
- **Database**: MongoDB (production on Railway)

## 3rd Party Integrations
- Telegram Bot API
- Twilio (Voice/SIP/SMS, sub-account architecture)
- Telnyx (Voice/SIP/SMS)
- Stripe (Payments)
- Cloudflare (Domain Management)
- Railway (Production Deployment)

## Completed Features

### 2026-09-05: Inactive Released Number Detection & Auto-Cleanup
**Problem**: Production user @johngambino could not make calls with caller ID +1 (888) 923-3702. Root cause: number was silently released by Twilio but DB still showed `status: active`.

**Solution implemented across 4 files:**

1. **phone-monitor.js** — New `checkTwilioNumberExists()` function
   - Verifies each active Twilio number SID still exists on its sub-account via API
   - Uses sub-account credentials (parent-auth returns 401 for IncomingPhoneNumbers)
   - On 404: marks number as `inactive_released`, sets `_inactiveSince` timestamp
   - Sends localized notification to user and admin

2. **phone-config.js** — Updated user-facing displays (all 4 languages: EN/FR/ZH/HI)
   - `myNumbersList()`: Shows `🚫 Inactive (released by provider)` with countdown timer
   - `manageNumber()`: Shows warning block and early-returns (no management options for released numbers)

3. **phone-scheduler.js** — New `runInactiveReleasedCleanup()` job
   - Runs every 6 hours
   - Removes numbers with `inactive_released` status where `_inactiveSince` > 48 hours
   - Logs transaction in `phoneTransactions` collection
   - Sends final removal notification to user in their language
   - Notifies admin group

4. **_index.js** — Updated number list filters
   - "My Plans" and "My Numbers" views now include `inactive_released` numbers for visibility
   - Caller ID selection (Quick IVR, Bulk IVR) still excludes `inactive_released` (existing `status === 'active'` filter)
   - `findNumberOwner()` in voice-service.js already excludes non-active numbers

**DB Schema changes:**
- New fields on number objects: `_inactiveSince` (ISO string), `_releaseDetectedBy` (string)
- New status value: `inactive_released` (joins `active`, `suspended`, `released`)

### 2026-09-05: Fix IVR Self-Transfer Bypass (trillionboy complaint)
**Problem**: User @trillionboy reported that Quick IVR calls play a "default prompt" (press 1/2) before their custom script. Root cause: when the outbound IVR transfers the callee to the user's OWN number (From === To), the inbound IVR auto-attendant activates, replaying the IVR greeting menu on the transfer leg.

**Fix**: Two-layer defense:
1. **Runtime bypass** (`_index.js` voice-webhook): Added `isSelfTransfer` detection — when `From` digits === `To` digits, the IVR auto-attendant is bypassed and the call rings through to SIP/forwarding/voicemail.
2. **Setup-time guard** (`_index.js` — 3 outbound IVR flows): Blocks self-call at the source:
   - Quick IVR single transfer number (`ivrObEnterIvrNumber`) — rejects if transfer target === callerId
   - Quick IVR per-key menu forward (`ivrObMenuForwardInput`) — rejects if forward target === callerId
   - Bulk IVR transfer number (`bulkEnterTransfer`) — rejects if transfer target === callerId
   - All guards show a clear localized message (EN/FR/ZH/HI) explaining the conflict and asking for a different number
   - Note: Inbound IVR already had this guard (`cpIvrOptionMsg` line ~31339)

**Files changed**: `_index.js` (voice-webhook handler + 3 outbound IVR setup flows)

## Known Issues
- `[PhoneMonitor] Error checking number +18883304418: Request failed with status code 401` — pre-existing auth issue with a different number's Telnyx check

## Architecture Notes
- Phone numbers stored in `phoneNumbersOf` collection, `val.numbers[]` array per user (keyed by chatId)
- Twilio uses sub-account architecture (each user gets their own sub-account)
- Phone monitor runs every 30 minutes; scheduler runs hourly + daily jobs
