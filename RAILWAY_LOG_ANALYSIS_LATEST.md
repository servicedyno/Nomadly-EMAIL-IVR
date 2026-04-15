# Railway Log Anomaly Analysis Report
**Generated:** April 15, 2026  
**Time Range:** 2026-04-14 21:28 → 2026-04-15 00:52 (~3.5 hours)  
**Total Logs Analyzed:** 2,004 unique entries  
**Deployment:** `504cfc11-7125-4818-bda8-dd6d817cb8fc` (SUCCESS)

---

## Executive Summary

| Metric | Count | Severity |
|--------|-------|----------|
| Critical Anomalies | 3 | 🔴 |
| Warnings | 17 | 🟡 |
| Active Users | ~10 unique | — |
| Orphaned Number Events | 16 | 🔴 |
| Telnyx API Errors | 1 | 🟡 |
| Payment Failures | 1 | 🟡 |
| System Anomalies | 1 | 🟡 |
| Spike Minutes (>2.5x avg) | 6 | 🟡 |

---

## 🔴 CRITICAL ANOMALY 1: Orphaned Phone Number — 16 Rejected Inbound Calls

**Number:** `+18775877003`  
**Caller:** `+17609950033` (same caller every time)  
**Time Window:** 00:40 → 00:52 (12 minutes, 16 calls)  
**Pattern:** Calls arriving every ~45–75 seconds

### What Happened
- `+18775877003` exists on the Telnyx connection but has **no owner** in the `phoneNumbersOf` MongoDB collection
- Every inbound call from `+17609950033` is immediately **rejected** with `ORPHANED NUMBER` warning
- The caller is **persistently retrying** — 16 attempts in 12 minutes suggests either:
  - An automated dialer / robocall targeting this number
  - A real person who previously had this number's contact and keeps calling back

### Recommended Action
1. **Investigate** if this number was once assigned to a user and got orphaned (e.g., user deleted or number released without cleanup)
2. **Either re-assign** the number to the correct user OR **release it** from the Telnyx connection to stop receiving traffic
3. Consider adding a **rate-limit on orphaned number logs** — 16 identical warnings in 12 min is log spam

---

## 🔴 CRITICAL ANOMALY 2: Suspicious Social Engineering Activity — New User 8349211535

**User:** `8349211535` (no Telegram username set — `undefined`)  
**Joined:** 2026-04-15 00:20:02 (brand new account)  
**Welcome Bonus:** $3.00 awarded immediately

### Timeline of Suspicious Activity

| Time | Action |
|------|--------|
| 00:20:02 | `/start` — brand new user, no username |
| 00:21:42 | Selected English, received $3 welcome bonus |
| 00:21:45 | Immediately went to **📞 Try Free IVR Call** |
| 00:23:52 | Entered target: **+233502851292** (Ghana number) |
| 00:23:55 | Selected **💳 Payment Notification** template |
| 00:24:02 | Filled: Name=**Owusu**, Bank=**Huttington**, Amount=**$10,000** |
| 00:24:38 | Set **transfer mode** to forward to **+233509506846** (2nd Ghana number) |
| 00:25:36 | Confirmed call — **Call 1 initiated** |
| 00:26:17 | **Call 1 timed out** — recipient didn't answer. Trial NOT consumed |
| 00:27:14 | Started **Call 2** — same target +233502851292 |
| 00:28:57 | Selected **🔒 Account Verification** template |
| 00:29:04 | Filled: Company=**Apple**, Reason=**unauthorized transaction**, Location=**Tarkwa** (Ghana city) |
| 00:30:29 | **Call 2 initiated** to +233502851292 |
| 00:30:55 | **Call 2 answered** — AMD detected as **machine** (voicemail) |
| 00:34:12 | Call ended after 198 seconds. **Trial marked as used** |

### Analysis
- **This is a textbook social engineering / vishing attempt:**
  - "Payment Notification" from "Huttington" (likely misspelling of Huntington bank) for $10,000
  - "Account Verification" impersonating **Apple** about "unauthorized transaction"
  - Both calls target the same Ghana number with transfer to a second Ghana number
  - Location "Tarkwa" is a city in Ghana's Western Region — strongly suggests the user is Ghanaian
  - The user has no Telegram username set (typical of throwaway/scam accounts)
- The transfer mode means: if the victim presses a key, they get connected to the scammer's number

### Recommended Action
1. **Flag/ban** chatId `8349211535` for investigation
2. **Block** the Ghana numbers (`+233502851292`, `+233509506846`) from being used as IVR targets
3. Consider adding **country-based restrictions** on free trial IVR calls (especially to high-fraud regions)
4. Add **template content review** — "Payment Notification" + "unauthorized transaction" patterns should trigger review

---

## 🔴 CRITICAL ANOMALY 3: User Scoreboard44 — "Card Self Service" IVR Auto-Attendant

**User:** Scoreboard44 (`8273560746`) — established power user  
**Activity:** 191 log entries in this window (most active user)

### What They Did
- Ended a support session (`/done`) then immediately went to Cloud IVR
- Set up IVR auto-attendant on their number with this greeting:
  > *"Welcome to card self service. All of our agents are currently assisting other callers. Press 1 for a callback, and one of our agents will be right with you shortly. Press 2 if you would like..."*
- Configured:
  - **Key 1** → Send to Voicemail
  - **Key 2** → Forward to `+19106516884`
- During setup, received **real inbound calls** from `+15073273809` who pressed digit 1 (got voicemail)

### Analysis
- The greeting text **"Welcome to card self service"** is designed to impersonate a **bank/credit card company**
- This is a known vishing technique: set up an IVR that sounds like a bank, then use social engineering calls to get victims to call this number
- Scoreboard44 is an established user with wallet balance ($61.35) — not a new throwaway

### Recommended Action
1. **Review** IVR greeting content for this user — "card self service" is a red flag
2. The inbound calls from `+15073273809` may be **victims** calling the fake bank number
3. Consider implementing **greeting text content moderation** for keywords like "bank", "card service", "credit card", "account verification"

---

## 🟡 WARNING 1: Telnyx speakOnCall Error — Race Condition

**Error Code:** `90018` — "Call has already ended"  
**Call:** `+18889020132` → `+233502851292`  
**Context:** The Ghana call from user 8349211535

### What Happened
1. Call answered at 00:30:55 — AMD detected as **machine** (voicemail)
2. Two `call.gather.ended` events with empty DTMF (00:32:58, 00:34:06)
3. Call hung up at 00:34:06 — but system tried to `speakOnCall` after hangup
4. Buffer timeout at 00:34:12 — "no matching call.initiated — likely post-deploy orphan"

### Root Cause
The `speakOnCall` was issued **after** the call.hangup event but before the hangup was fully processed. This is a known edge case where Telnyx webhooks arrive out of order.

### Impact
Low — the error is caught and logged. The call was already ending anyway.

### Recommended Fix
Add a call-state check before `speakOnCall` — if the call is already in hangup/ended state, skip the speak command silently.

---

## 🟡 WARNING 2: Payment Session NOT FOUND — ref: Oao21

**Time:** 22:10:32  
**Webhook Source:** `nomadlynew-production.up.railway.app/webhook`

### Details
- Fincra webhook arrived with `merchantRef: Oao21`
- `fincraRef: undefined` — the webhook payload is missing the Fincra reference
- No matching payment session found in the database

### Possible Causes
1. **Stale webhook replay** — payment was created long ago, session expired and was cleaned up by the Fincra reconciliation system
2. **Orphaned Fincra payment** — user abandoned the payment flow before completing
3. **Webhook from production hitting the wrong endpoint** (note: webhook URL points to production Railway)

### Impact
Low — no money was lost. The webhook was safely rejected.

---

## 🟢 NORMAL ACTIVITY

### User View_Essential (7465683699) — Window Shopping
- Browsed multiple product categories: Hosting, VPS, Domains, Email Validation
- Evaluated Golden Anti-Red HostPanel ($100) and Premium ($75)
- Reached coupon code step but backed out without purchasing
- **Assessment:** Normal prospective customer behavior, no anomalies

### User AQX1k (7366890787) — SIP Test + DNS
- Has domain `revenue-process-incometax.com` (⚠️ potentially suspicious domain name)
- Used `/testsip` to test SIP functionality, OTP generated: 844877
- Then did `/start` and went back to main menu
- **Assessment:** Normal usage, but domain name warrants monitoring

### User davion419 (404562920) — VPS Management
- Managed 2 VPS instances (Linux + Windows RDP)
- Viewed SSH keys for `vmi3228089`
- Restarted Windows VPS `vmi3220843` successfully
- **Assessment:** Normal power user VPS management

### User pirate_script (1005284399) — Just Started Bot
- Did `/start` at 22:29 — received welcome message
- **Assessment:** Normal new user

### User flmzv2 (7304424395) — Domain Shopping
- Browsed Bulletproof Domains, searched for `37558aprl.com`
- Domain available at $39 on both ConnectReseller and OpenProvider
- **Assessment:** Normal domain search behavior

---

## System Health Metrics

### Social Proof / Conversion Numbers (Stable)
| Service | Count |
|---------|-------|
| Hosting | 507 |
| Domains | 9,003 |
| Cloud Phone | 111 |
| Digital Products | 36 |
| VPS | 63 |
| Virtual Card | 27 |
| General | 7,740 |

- Numbers **unchanged** between 22:01 and 00:01 refreshes — no new purchases in that 2-hour window

### Phone Monitor Health Check
- 6 Twilio subaccounts checked
- 1 Telnyx number checked
- 0 newly suspended numbers
- **Status:** Healthy

### Infrastructure
- No OOM, crash, or restart events
- No `ECONNREFUSED` or socket errors
- 1 post-deploy orphan call (expected after deployment)
- Fincra reconciliation: no stale payments to clean

---

## Recommendations Summary

| Priority | Action | Category |
|----------|--------|----------|
| 🔴 P0 | Investigate & likely ban user `8349211535` for social engineering (impersonating Apple/Huntington bank) | Security |
| 🔴 P0 | Review Scoreboard44's IVR greeting ("card self service") — potential bank impersonation | Security |
| 🔴 P1 | Resolve orphaned number `+18775877003` — either reassign or release from Telnyx | Operations |
| 🟡 P2 | Add IVR greeting content moderation (flag keywords: bank, card service, account verification) | Feature |
| 🟡 P2 | Add rate-limiting on orphaned number log warnings | Performance |
| 🟡 P2 | Add call-state check before `speakOnCall` to prevent race condition errors | Bug Fix |
| 🟡 P3 | Consider country restrictions on free trial IVR calls to high-fraud regions | Security |
| 🟢 P4 | Monitor domain `revenue-process-incometax.com` (user AQX1k) | Security |
