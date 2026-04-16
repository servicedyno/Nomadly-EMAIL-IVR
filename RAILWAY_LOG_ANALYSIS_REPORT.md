# Railway Log Analysis Report — April 16, 2026

**Time window:** 07:08 UTC → 12:09 UTC (~5 hours)  
**Total log entries:** 3,374  
**Active users:** 9 unique users  
**Deployment:** `bec5c251` (SUCCESS, deployed at 07:05 UTC)

---

## 🔴 BUGS (Code-Level Issues)

### B1: Duplicate "Custom Script" Button in IVR Template Chooser
- **User:** 2130773719 (Sepcialk, French)
- **Evidence:** Template chooser keyboard shows:  
  `✍️ Custom Script, 💳 Payment Alerts, 🔒 Account Security, 📦 Delivery & Service, ✍️ Custom Script, Retour, Annuler`
- **"✍️ Custom Script" appears TWICE** — once at the beginning and once after "Delivery & Service"
- **Impact:** Confusing UI, wastes keyboard space
- **File:** Likely in `js/_index.js` or `js/lang/*.js` where IVR Quick Call template keyboard is built

### B2: Race Condition — Concurrent Button Presses Processed Simultaneously
- **User:** 5276709597 (gwalasix) at 09:24:07
- **Evidence:** Two messages arrived in the same millisecond:
  ```
  09:24:07.116368 message: 🌐 Register a New Domain
  09:24:07.116374 reply: Enter your desired domain...
  09:24:07.116432 message: 📂 Use My Domain  
  09:24:07.116437 reply: You have no registered domains...
  ```
- **Impact:** User received TWO conflicting prompts simultaneously. The second response ("no registered domains") overwrote the expected flow ("enter your domain").
- **Root cause:** Telegram may queue rapid button presses and deliver them together. No deduplication or lock preventing concurrent processing.
- **Also affected:** Same user at 09:23:40 — two messages ("⚡ Premium Anti-Red" + "🛡️🔥 Anti-Red Hosting") processed simultaneously

### B3: User 6695164281 — State Lost, Username "undefined", Message Flood
- **Evidence:** At 10:34:06, 5+ messages arrived simultaneously:
  ```
  [reset] Unrecognized "Check DNS" (was action: none)
  [reset] Unrecognized "Update DNS Record" (was action: none)
  [reset] Unrecognized "Check DNS" (was action: none)  
  [reset] Unrecognized "Update DNS Record" (was action: none)
  [reset] Unrecognized "Update DNS Record" (was action: none)
  ```
- **5 welcome menu messages sent back-to-back** to the same user
- Username is `undefined` — user record may have corrupt/missing data
- **Root cause:** User received a WinBack campaign message at 10:12:17, then clicked old cached keyboard buttons ("Check DNS", "Update DNS Record") from a previous DNS management session. Session state was `none`, so all messages reset to main menu.
- **Impact:** 5 duplicate menu messages = spam experience. No deduplication guard.

### B4: Fincra Payment Session NOT FOUND (ref: A2JxN)
- **Time:** 11:20:49 UTC
- **Evidence:**
  ```
  [auth] Resolved ref: A2JxN | merchantRef: A2JxN | fincraRef: undefined | queryRef: undefined
  [auth] ⚠️ Payment session NOT FOUND for ref: A2JxN — no matching active session or historical record
  ```
- **Impact:** If this is a real payment, the user paid but credit wasn't applied. If stale/duplicate, the warning creates false alarm noise.
- **Note:** A previous fix (B7 in test_result.md) addressed stale Fincra webhooks for ref `srD3V`. This new ref `A2JxN` suggests the issue may still occur with different refs.

---

## 🟡 UX ISSUES

### U1: Abandoned Hosting Purchase — No Cart Recovery
- **User:** 5276709597 (gwalasix)
- **Journey:** Anti-Red Hosting → Buy Premium 1-Week → Register domain `a25high-t.com` ($39) → Skip email → Reached payment screen → **Pressed /start (abandoned)**
- **The payment screen said "Pay within 1 hr to activate"** but user walked away
- **Suggestion:** Implement cart abandonment recovery for hosting purchases (similar to CartRecovery already tracking 50 payment action states). Send a reminder after 30 min.

### U2: "Crypto" Button Text Not Recognized After State Loss
- **User:** 8588202400 (hitmyinvoice)
- **Evidence:** Sent "Crypto" as free text → `[reset] Unrecognized message "Crypto" (was action: none)`
- **Root cause:** User had previously been in a payment flow, the "Crypto" button was cached in their keyboard. After state was lost, the text wasn't recognized.
- **Suggestion:** Add a global handler for common payment button texts ("Crypto", "Bank", "Wallet") that redirects to wallet/payment instead of resetting to menu.

### U3: SMS App Version Mismatch — Outdated Users
- **User:** 8246464913 (heimlich_himmler)
- **Evidence:** 3 sync requests all show version 2.2.0 (latest is 2.4.1)
- Admin manually told user via support: "please download the latest app version and delete the old one"
- The `[SmsApp] Update reminder sent` was triggered, but user hasn't updated
- **Suggestion:** Make the update notification more prominent/blocking if critical fixes are in newer versions.

### U4: New User (slaveauctioned) — Explored but Didn't Convert
- **User:** 8658466470 — New user onboarded at 08:46
- **Journey:** Language → Welcome ($3 gift) → Browse Domains → Buy Domain Names → Back → Back → Ship & Mail → **Gone**
- **The user clicked "Ship & Mail" (a niche feature) as their last action**
- Conversion engine sent follow-up offers 2 hours later (browse domains follow-up + WELCOME25 coupon)
- **Observation:** The onboarding "Pick one to explore" screen led to domain browsing → purchase flow → user backed out → went to Ship & Mail → disappeared. The initial exploration path may have been too transactional.

### U5: French IVR Flow — Mixed Language Issues
- **User:** 2130773719 (Sepcialk, lang: fr)
- **Issues:**
  1. Template names are in **English**: "Payment Alerts", "Account Security", "Delivery & Service", "Delivery Confirmation", "Appointment Reminder"
  2. Transfer prompt has **franglais**: "Enter the number to transfert the caller" — "transfert" is not proper English or French
  3. OTP Collection option shown to unpaid user — may need plan gating check
- **Suggestion:** Translate IVR template names and descriptions for French users. Fix "transfert" typo.

### U6: URL Shortener — Same URL Shortened Twice (Wasted Trial)
- **User:** 7304424395 (flmzv2) — Subscriber with "BulkSMS ✅" and "Unlimited" shortener
- **Evidence:** Shortened `https://cdrvnapr26.com` twice within 20 seconds, getting two different short links:
  - `https://02w.me/Qk3iP`
  - `https://02w.me/WLrgh`
- **Impact:** For trial users this would waste their free link allocation. Even for subscribers, it creates unnecessary duplicate links.
- **Suggestion:** Add URL deduplication — if same URL was shortened in the last N minutes, return the existing short link instead of creating a new one.

---

## 🟠 INFRASTRUCTURE / OPERATIONAL NOTES

### I1: CSF Firewall Whitelist Failing
```
[WHM-Whitelist] CSF response: {"result":0,"reason":"Unknown app ("csf_allow") requested for this version (1) of the API."}
[WHM-Whitelist] Complete — cPHulk: true, CSF: false
```
- cPHulk whitelist works, but CSF firewall whitelist fails due to API version mismatch
- Not critical (IP is still whitelisted via cPHulk + Host Access) but CSF protection is incomplete

### I2: Telnyx Balance Approaching Warning Threshold
- **Telnyx: $10.64** (warn at $10, critical at $5) — stable across 3 checks (no spend = no calls in this window)
- **Twilio: $19.65** — also stable
- **Risk:** One medium bulk IVR campaign could push Telnyx below $10 and trigger warning

### I3: AutoPromo / WinBack Error Rates
| Campaign | Total | Success | Errors | Error Rate |
|----------|-------|---------|--------|------------|
| AutoPromo (EN) | 2,797 | 2,177 | 522 | **18.7%** |
| AutoPromo (FR) | 104 | 83 | 21 | **20.2%** |
| WinBack | 1,676 | 1,133 | 543 | **32.4%** |
| AutoPromo (ZH) | 7 | 6 | 0 | 0% |

- Most errors are `bot_blocked` (403 Forbidden) — users who blocked the bot
- WinBack has the highest error rate (32.4%) which makes sense — these are inactive users
- 15+ users marked dead in this window alone
- **Good:** Dead user marking prevents future wasted sends

### I4: Node.js Deprecation Warning
```
(node:15) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```
- Non-critical but should be addressed to prevent future Node.js version breakage

---

## 📊 USER ACTIVITY SUMMARY

| User | Username | Activity | Status |
|------|----------|----------|--------|
| 8246464913 | heimlich_himmler | Support → BulkSMS → Download App → SMS Sync (v2.2.0) | Returning, outdated app |
| 8658466470 | slaveauctioned | **NEW** — Domains → Ship & Mail → Gone | Churned after onboarding |
| 5276709597 | gwalasix | Hosting purchase → **Abandoned** → BulkSMS → IVR HowItWorks | High intent, didn't pay |
| 2130773719 | Sepcialk | **NEW** (FR) — IVR Quick Call → Support (package question) | Confused about services |
| 8588202400 | hitmyinvoice | Virtual Card → SMS Leads (Premium Targeted) | Active explorer |
| 1118822404 | aZeidMcCain | Support close → Cloud Phone → Business $120/mo plan → Canada | **High-value prospect** |
| 7304424395 | flmzv2 | URL Shortener (shortened same URL twice) | Active subscriber |
| 6695164281 | undefined | WinBack recipient → stale button clicks → flooded | Reactivation attempt |
| 5590563715 | onarrival1 | Admin — replied to 2 support tickets | Admin |

---

## 🎯 RECOMMENDED FIXES (Priority Order)

1. **B1 — Fix duplicate "Custom Script" button** (Quick fix, 5 min)
2. **B3 — Add message deduplication guard** to prevent 5+ identical menu messages (Medium, 30 min)
3. **U5 — Translate IVR template names for French users** (Medium, 1 hr)
4. **B2 — Add concurrent message lock per user** to prevent race conditions (Medium, 1 hr)
5. **U2 — Add global handlers for common payment button texts** (Quick fix, 15 min)
6. **B4 — Investigate Fincra ref A2JxN** — is it stale or a real missed payment?
7. **U6 — URL deduplication** to prevent shortening same URL twice (Medium, 30 min)
8. **U1 — Hosting cart abandonment reminder** (Enhancement, 2 hr)
9. **I1 — Fix CSF API version for WHM whitelist** (Low priority)
10. **I2 — Monitor Telnyx balance** — consider auto-reload or alert threshold increase
