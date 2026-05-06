# 🔍 Railway Deployment Analysis — Last 12h (CloudIVR focus)

**Window:** 2026-05-05 21:12 UTC → 2026-05-06 09:08 UTC (≈11h55m)
**Service:** `Nomadly-EMAIL-IVR` (project `New Hosting` / production)
**Log lines analyzed:** 3,713 (deduped, merged across 5 deployments)
**Deployments in window:** 5 (1 long-running + 4 from today's `SHORTIT_ENABLED` toggles)

---

## 1. 📞 CloudIVR Usage Summary

**Only ONE user used outbound CloudIVR in the last 12h:**
`8273560746` / **Scoreboard44**

| # | Time UTC | Callee | Wallet pre | Rate | Status | Duration | AMD | Billed |
|---|---|---|---|---|---|---|---|---|
| 1 | 22:49:45 | +1 207 669 0820 (ME) | $64.46 | $0.15/min | completed | 73s | machine_start | $0.30 (2m) |
| 2 | 22:51:23 | +1 207 669 0820 (ME) | $64.16 | $0.15/min | completed | 72s | machine_start | $0.30 (2m) |
| 3 | 23:59:43 | +1 919 614 1538 (NC) | $63.86 | $0.15/min | no-answer | 0s | – | $0.15 (1m min) |
| 4 | 00:03:23 | +1 919 614 1538 (NC) | $63.71 | $0.15/min | no-answer | 0s | – | $0.15 (1m min) |
| 5 | 01:03:51 | +1 360 691 4682 (WA) | $63.56 | $0.15/min | completed | 76s | machine_start | $0.30 (2m) |
| 6 | 01:05:12 | +1 360 691 4682 (WA) | $63.26 | $0.15/min | completed | 74s | machine_start | $0.30 (2m) |

- **Calls placed:** 6
- **Calls answered by a human:** 0 (all 4 "completed" hit voicemail / `machine_start`; 2 went `no-answer`)
- **Total minutes billed:** 10
- **Total billed:** **$1.50**
- **Source ANI used:** `+18339561373` (Twilio toll-free, plan=`business`, owned by Scoreboard44)

---

## 2. ✅ Billing Correctness — VERIFIED CORRECT

Wallet drift exactly matches the bill log:

```
$64.46 → $64.16 → $63.86 → $63.71 → $63.56 → $63.26 → expected: $62.96
```

MongoDB `walletOf` for chatId `8273560746` shows `usdIn=80, usdOut=17.04` → balance = **$62.96** ✓ matches expected post-6th-call balance to the cent.

**Rate model verified:** $0.15/min US/CA, ceiling-rounded to whole minutes:
- 73s → 2 min × $0.15 = **$0.30** ✓
- 72s → 2 min × $0.15 = **$0.30** ✓
- 0s no-answer → 1 min minimum × $0.15 = **$0.15** ✓
- 76s, 74s → 2 min each = **$0.30** each ✓

Pre-flight wallet check `[OutboundIVR] Wallet check passed: $X.XX (IVR rate: $0.15/min)` fires before each `Twilio` outbound. No phantom charges, no double-billing, no missed charges, no rounding errors.

---

## 3. 🚨 CRITICAL SECURITY FINDING — Vishing Fraud Operation

The 6 IVR calls were **bank-impersonation phishing attacks**. The full template-building UX in Telegram captured **everything**:

### The fraud playbook (executed 3× in 12h)
1. **Reverse-lookup a real US phone number** → bot enriched with real name (`Banks Terry`, `Bedier Jeff`, etc.)
2. **Build IVR script** impersonating the victim's actual bank:
   - **+1 207 669 0820:** "BAR HARBOR BANK & TRUST" / Ewan Tunney / unauthorized $89.71 charge at Barnes & Noble San Diego
   - **+1 919 614 1538:** "FSNB" / Terry Banks / unauthorized $28.97 at KFC Wake Forest, NC
   - **+1 360 691 4682:** "Community Healthcare Federal Credit Union" / Jeffrey Bedier / unauthorized $89.71 at Barnes & Noble San Diego
3. **Social-engineering script:** *"If you authorized this transaction press 1. If you did not authorize this payment, please press 2, to block this transaction immediately."*
4. **Mode:** `🔑 OTP Collection` — when victim presses 2, IVR asks for **6-digit code "being sent to the number we have on file"** → harvests the bank's 2FA OTP
5. **Confirmation message:** *"Your code has been verified. We've blocked the transaction and secured your account. A specialist will contact you within 24 hours. Thank you for choosing [bankName]."*
6. **Reject-retry loop:** *"Sorry, that doesnt seem right. Please re-enter the new verification code being sent to the number we have on file."* → tries up to 3 OTPs to bypass bank rate-limit
7. **Voice:** OpenAI TTS, **Onyx**, 0.7× speed (sounds slow + authoritative + human)
8. **Caller ID:** spoofed-feel toll-free `+18339561373`

### Continuity with prior analysis
This corroborates the **22:01–00:01 prior report (RAILWAY_LOG_ANALYSIS_LATEST.md)** that already flagged `Scoreboard44` for IVR greeting "card self service" — i.e., bank impersonation. The behavior is **persistent**, not a one-off.

### Saving grace this 12h
All 6 calls hit voicemail or no-answer → **0 OTPs harvested in this window**. But the infrastructure, intent, and operational pattern are unmistakable.

---

## 4. ⚠️ UX Friction Issues Observed

### 4A. CloudIVR-specific (Scoreboard44's session)
Even ignoring the fraud context, the IVR-builder flow shows several UX problems:

| Issue | Evidence (timestamp) | Impact |
|---|---|---|
| **No-answer still billed $0.15** | calls 3 & 4 at 23:59 / 00:03 — recipient never picked up, charged anyway | Industry norm: free until connected. **$0.30 charged for 0s of conversation.** |
| **Voicemail / `machine_start` billed full duration** | calls 1, 2, 5, 6 — all hit voicemail, billed 2 min each | No "abort on AMD" feature. **$1.20 charged for 4 voicemail playbacks.** |
| **Audio-preview generation: 2:20 wait** | preview started 22:47:19, "✅ Confirm" at 22:49:39 — **140s spinner** | User-perceived freeze. No progress indicator. |
| **Cancel → re-do loses all state** | 23:46–23:50 cycle: user re-typed name/bank/card/amount from scratch after Cancel | 4+ minutes wasted re-entering identical fields |
| **"Please select a category from the buttons"** dead-end | 00:01:15 — user typed `Terry Banks` instead of tapping button | Free-text drop into menu state; no graceful recovery |
| **Card last-4 with spaces** | user typed `9 9 4 3`, `1 9 0 8`, `1 5 2 3` (with spaces) | Bot did accept it, but the recurrence suggests possibly not the first attempt — **strip whitespace + validate length=4 numeric**. |
| **"📌" sticky-default echo** | repeated `message: 📌 FSNB` / `message: 📌 KFC` etc. | Telegram sticky-keyboard default tokens are being passed back as user input — works but cluttered |
| **`[Dedup]` triggered** | 23:46:47 dropped a duplicate "↩️ Back" within 1984ms | Suggests double-tap by user — debounce window may be too long |

### 4B. Non-IVR friction (other users)

| User | Issue | Friction |
|---|---|---|
| **thestreetplug** (1838537498) | Wallet $5 vs lead-batch price $25.00 → user kept hitting **Back**, never deposited | Paywall has no inline "💵 Deposit" CTA — user has to find Wallet menu manually |
| **dropszones** (5766320268) | New user, browsed Telnyx Main Account ($400) and eSIM ($60), abandoned both at "Select payment method" | Sticker shock + no "Talk to a human" inline; welcome offer sent 2h later but they never came back |
| **cvvjedi** (5285007353) | Looked at VPS plans (Cloud VPS 60 list), abandoned without selecting any plan | Plan cards are dense; no "Recommended for X workload" guidance |
| **8737927506** | Sent 2 free SMS, then idle for 1h+ | Free trial successful, but no nudge to continue using the campaign builder |

### 4C. Backend integration issues (not user-facing)

| Issue | First seen | Last seen | Severity |
|---|---|---|---|
| **`[CR-Whitelist] API test failed: 401`** — Connect Reseller whitelist API auth broken | 21:32 | 08:30 (still failing) | 🔴 P1 — 40+ retries logged in 12h. Likely expired API key or revoked credential. |
| **`[AntiRed] Worker auto-deploy timeout for sechtsft.de`** | 00:00:17 | one-off | 🟡 P3 — recovered on next cron |
| **5× `npm SIGTERM`** during deploys | 08:30, 08:51, 09:01, 09:04 | self-induced (your `SHORTIT_ENABLED` toggles) | 🟢 normal |

---

## 5. 📊 Activity Profile (12 active users in 12h)

| chatId | name | activity | outcome |
|---|---|---|---|
| **8273560746** | Scoreboard44 | 388 lines — fraud IVR campaign | 🚨 Security review |
| 817673476 | johngambino | $98 BTC deposit completed | ✅ smooth |
| 1838537498 | thestreetplug | abandoned $25 lead batch (wallet too low) | ⚠️ deposit-CTA missing |
| 5285007353 | cvvjedi | new user, browsed VPS, abandoned | ⚠️ welcome flow |
| 5766320268 | dropszones | new user, browsed digital products | ⚠️ welcome flow |
| 7252192229 | forrlong | reseller inquiry → AI support → escalated | ✅ |
| 8625434794 | ciroovblzz | viewed hosting plan + got cPanel creds (FR locale) | ✅ |
| 8737927506 | (unnamed) | new BulkSMS user, sent 2 free SMS | ✅ |
| 5590563715 | onarrival1 | admin notifications + 1 reply to forrlong | ✅ admin |
| 1167900472 | wizardchop | 1 click then idle | – |
| 7400991223 | – | received WELCOME25 conversion ping | – |
| 7394693056 | Night_ismine | 1× /start | – |

**Total revenue events in window:** 1 ($98 deposit by johngambino)
**Total IVR billings:** $1.50 (Scoreboard44)
**Net wallet OUT for IVR:** $1.50

---

## 6. 🎯 Recommendations (prioritized)

| Pri | Action | Category |
|---|---|---|
| 🔴 **P0** | **Ban / suspend chatId `8273560746` (Scoreboard44)** for vishing fraud. Two consecutive 12h analysis windows show identical bank-impersonation pattern (real victim names + real banks + 2FA harvesting + spoofed scenarios). Disable both numbers `+18888370876` and `+18339561373` from outbound IVR. | Security |
| 🔴 **P0** | **Add IVR script content moderation**: regex-screen for keywords like `verification code`, `2FA`, `OTP`, `unauthorized transaction`, `blocked your card`, `[CardLast4]`, real-bank brand names → require human review before activation. | Trust & Safety |
| 🔴 **P0** | **Fix `[CR-Whitelist] 401` retry loop** — Connect Reseller API key revoked/expired. 40+ failed retries in 12h. Rotate `API_KEY_CONNECT_RESELLER` on Railway. | Operations |
| 🟠 **P1** | **Don't bill IVR `no-answer`** (calls 3 & 4) — match Twilio's no-answer SHAQ behavior or refund users automatically. Saves PR/refund headaches. | Billing |
| 🟠 **P1** | **Hang up + don't bill on AMD `machine_start`** when caller selects "skip voicemail" → today every AMD-detected voicemail still plays the full TTS and bills 2 minutes. | Billing |
| 🟡 **P2** | **State preservation across `Cancel`** in IVR builder — store partial wizard state and offer "↩️ Resume previous draft" instead of restart-from-scratch. | UX |
| 🟡 **P2** | **Inline Deposit CTA** on insufficient-wallet paywalls (thestreetplug case) — single tap to top-up flow. | Conversion |
| 🟡 **P2** | **Audio preview progress** — replace 2:20 spinner with "Generating audio… 0:30 elapsed (typically ~2 min)". Reduce abandonment. | UX |
| 🟡 **P2** | **Strip whitespace + validate** card last-4 input (`9 9 4 3` should auto-normalize to `9943`). | UX |
| 🟢 **P3** | Tighten **Telegram message dedup window** — 1984ms triggered a Cancel. Maybe drop to ~800ms. | UX |
| 🟢 **P3** | Track per-tier conversion: cvvjedi/dropszones browsed expensive items but bounced — A/B test "Talk to sales" CTA on items >$200. | Growth |

---

## 7. 📈 12h Health Snapshot

```
Total log lines:            3,713
Errors (non-deploy):           24 (all transient: SIGTERMs, 1 worker timeout, 401 retries)
IVR sessions:                   6
IVR success-to-human:           0
IVR billed total:           $1.50
Active users:                  12
New users (welcome bonus):      2 (cvvjedi, dropszones)
Deposits completed:             1 ($98 BTC, johngambino)
Support escalations:            1 (forrlong → reseller request)
Phone number suspensions:       0 (PhoneMonitor: 10 numbers checked × ~24 cycles, all healthy)
```

**Infrastructure:** Stable. No OOM, no crashes outside the deploy-restart cycle from your `SHORTIT_ENABLED` toggles. Hourly schedulers (PhoneScheduler, AutoPromo, AntiRed-Cron, BalanceMonitor, etc.) all running on time.

**Bottom line:**
- 🟢 Billing: **correct to the cent**.
- 🔴 Trust & Safety: **active fraud operation** (Scoreboard44) — needs immediate action.
- 🟡 UX: real friction in IVR builder + paywall flow, all addressable.
- 🟠 Ops: CR-Whitelist API auth broken, blocking nothing user-facing yet but accumulating retry noise.
