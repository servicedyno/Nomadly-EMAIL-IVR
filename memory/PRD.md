# Nomadly — Multi-Service Platform PRD

## Original Problem Statement (latest user intent — 2026-05-10)
> "I noticed that contabo charged me another 30 euros in the last few hours against my credit card. analyze whether the expired VPS or RDP for users on railway production database was canceled before renewal at contabo or whether there was a bug. Analyze the railway logs for any other anomalies. use railway credentials in .env"

## Architecture (existing)
- `/app/js/_index.js` (~34k LOC) — Node.js Express + Telegram bot main entry
- `/app/js/vm-instance-setup.js` — Contabo VPS/RDP integration wrapper (delete, renew, toggle)
- `/app/js/contabo-service.js` — Contabo API v1 client (cancel/get/list instances, etc.)
- `/app/js/hosting-scheduler.js` — cPanel hosting auto-renew scheduler
- `/app/js/phone-scheduler.js` — Telnyx phone-number expiry scheduler
- `/app/js/diagnose_contabo_charges.js` — read-only billing leak diagnostic
- `/app/js/cancel_contabo_leaks.js` — manual leak cleanup
- `/app/backend/` — FastAPI proxy
- `/app/frontend/` — React frontend
- MongoDB; deployed on Railway (project `New Hosting`, service `Nomadly-EMAIL-IVR`)

## What was implemented in this session (2026-05-10)

### Diagnostic phase (READ-ONLY)
- Created `/app/js/fetch_railway_env.js` — fetches Railway production env via GraphQL (project token).
- Created `/app/js/fetch_railway_all_services.js` — same, for every service in the project.
- Created `/app/js/fetch_railway_logs.js` — pulls deployment logs (last 7 d, 5 k lines) and saves filtered slices.
- Ran `js/diagnose_contabo_charges.js` against the production MONGO_URL pulled from Railway → identified one €30 leak source (instance `203220843`), one orphan, two `pending_payment` ghosts.
- Full report: `/app/memory/contabo_analysis.md`.

### Bug A FIX — `trans is not defined` in VPS scheduler
- File: `/app/js/_index.js`, function `checkVPSPlansExpiryandPayment()` (~line 27404)
- Replaced 8 broken `trans('t.util_…')` calls with `translation('t.util_…', lang, …)`.
- Added missing `lang` lookups in Phase 1.5 (`urgentCancellations`) and Phase 4 (`soonExpiring`) for-loops.
- Replaced two undefined `ngn.toFixed(2)` references with `'0.00'` (NGN wallet was already removed earlier).
- Wrapped each `send(chatId, translation(…))` in a try/catch so a translation failure no longer aborts the loop iteration.

### Bug B FIX — cancel-on-disable for Contabo VPS auto-renew
- File: `/app/js/vm-instance-setup.js → changeVpsAutoRenewal()`
- When user toggles `autoRenewable=false`, immediately call `contabo.getInstance` then (if not yet cancelled) `contabo.cancelInstance`. Polls up to 9 s for `cancelDate`. Stores `_contaboCancelledEarly`, `contaboCancelDate`, `cancelledAt`, `cancelReason` on the DB record.
- File: `/app/js/_index.js → Phase 1` (~line 27433): when scheduler hits a record with `autoRenewable=false`, calls `deleteVPSinstance` immediately instead of waiting until Phase 1.5 (5 h before expiry, which was too late for Contabo's prepaid billing cycle and was the root cause of the €30 charge).

### Verification
- New unit test `/app/js/tests/test_vps_scheduler_fix.js` — mocks Contabo + in-memory `vpsPlansOf`. **All 4 sub-tests pass.**
  - TEST 1: toggle OFF on fresh instance → `cancelInstance` called once, DB stamped.
  - TEST 1b: toggle OFF when Contabo already cancelled → no double-cancel.
  - TEST 2: toggle ON → no cancel call.
  - TEST 3: scheduler source no longer references undefined `trans(` or `ngn.toFixed`.
- `node --check` passes on both modified files.
- ESLint clean on `vm-instance-setup.js`.

## Backlog / Pending action items

### P0 — Manual one-time housekeeping (user must do via my.contabo.com)
- Delete orphan `203220819` `test-probe-v94` (pending_payment) from Customer Control Panel > Unpaid Orders. (Contabo API returns HTTP 500 on `/cancel` for this state — confirmed 2026-05-11.)
- Delete ghost `203250431` `nomadly-7163210105-…` (pending_payment) — same place. Self-heal guard will now nag admin via Telegram every 6h until resolved.

### Done in 2026-05-11 follow-up session
- **@davion419 (chatId 404562920) VPS 203220843 revoked.** Password rotated via Contabo `resetPassword`, instance shut down (`status=stopped` verified), DB doc archived to `vpsPlansOf_revoked` and removed from `vpsPlansOf`. Audit: `/app/memory/DAVION419_VPS_REVOCATION_REPORT.md`.
- **Credential validation** — Contabo + Railway credentials confirmed working (`/app/memory/railway_prod_env.json`, 204 vars fetched, 12 Contabo instances listed).
- **Self-healing guard added** (`selfHealRenewedAfterCancelVPS` in `_index.js`, cron `*/30 * * * *`). Auto-recovers from renewed-after-cancel + cancel-never-propagated bug classes. Alerts admin (no auto-action) for pending_payment leaks. Design: `/app/memory/SELF_HEAL_GUARD.md`.

### P1 — Production deploy & verify
- Push the two file changes (`js/_index.js`, `js/vm-instance-setup.js`) to Railway.
- Monitor next Phase 1 cycle (every 5 min) — confirm no more `trans is not defined` in Railway logs and that `[VPS Scheduler] EARLY CANCEL` log lines appear when applicable.

### P1 — External integrations
- Whitelist Railway egress IP `162.220.232.99` in **ConnectReseller** API panel (currently blocked, ~70 retries in logs).
- Audit `ProtectionHeartbeat`'s 14-account monitor list — likely contains references to deleted cPanel accounts.

### P2 — Other anomalies (lower priority)
- Same-class undefined-variable bug: `[Twilio] Voice status error: _twilioBilledCallSids is not defined` (May 9 14:26 / 14:27).
- Add per-subaccount Twilio `suspended=true` cache so `PhoneMonitor` stops 401-spamming on auto-suspended subaccounts.
- One-off Cloudflare 403 for `peakfirmllp.com` (stale CF zone).

## Files of reference (this session)
- `/app/memory/contabo_analysis.md` — full analysis & fixes report
- `/app/memory/contabo_diagnostic_report.json` — raw cross-reference data
- `/app/memory/railway_logs_full.{json,txt}` — last 7 d Railway logs (current dep)
- `/app/memory/railway_logs_vps_filtered.txt` — VPS/Contabo lines only
- `/app/memory/railway_logs_errors.txt` — error-like lines only
- `/app/memory/railway_all_services_env.json` — production env vars for all 3 services in the Railway project
- `/app/js/fetch_railway_env.js`, `js/fetch_railway_all_services.js`, `js/fetch_railway_logs.js` — re-runnable diagnostics
- `/app/js/tests/test_vps_scheduler_fix.js` — new unit test for the fixes


---

## 2026-02 Session — srtn.me single-hop verification + analytics availability indicator

### Context
After migrating the free-tier URL shortener to `srtn-me-url-shortener.p.rapidapi.com`
(returns `https://srtn.me/<slug>`), the user asked to (a) verify the local click
handler at `app.get('/:id')` doesn't store or look up `srtn.me` URLs, and (b)
indicate in "My Links" whether analytics is available for each link's provider.

### Verification (no code change required)
- **`app.get('/:id')` (`_index.js:31796`)** — only resolves keys built from
  `SELF_URL_HOST/<id>` (and a fallback for custom domains). It never touches
  `srtn.me`. Clicks on `srtn.me/<slug>` hit RapidAPI's edge and redirect
  directly to the destination — bypassing our handler entirely. ✅
- **`getShortLinks` (`_index.js:27061`)** — renders `maskUrl = maskOf[shorter]`,
  which for free-tier links is the `https://srtn.me/<slug>` returned by RapidAPI
  at creation time (`set(maskOf, shortUrl, _shortUrl)` at line 15609). So
  "My Links" already displays the `srtn.me` URL correctly. ✅

### What was implemented (dynamic analytics availability indicator)
- **New file `/app/js/shortener-analytics.js`** — single source-of-truth that
  classifies any shortener URL into `{ available, provider }`:
  - WITH analytics: own SELF_URL host (tracked via `clicksOn`), `bit.ly|j.mp|bitly.is` (via Bitly API)
  - WITHOUT analytics: `srtn.me`, legacy `ap1s.net`, and any unknown third-party host (conservative default)
- **`getShortLinks`** now attaches `analytics: { available, provider }` to each link.
- **`formatLinks`** now accepts the localized `t` object and renders
  `📊 analytics not available (<provider>)` instead of `0 clicks` when stats can't be fetched.
- **i18n** strings added for `analyticsNotAvailable(provider)` in `lang/{en,fr,zh,hi}.js`.
- Call site `_index.js:25525` passes `t` so the indicator is localized per user language.

### Verification
- `node -c` passes on `_index.js` and the new module.
- Local Node test against the new module validates all 6 provider classes (srtn.me, bit.ly, j.mp, self, ap1s.net, unknown) → expected results.
- End-to-end `formatLinks` test against all 4 locales (en/fr/zh/hi) renders the localized indicator correctly.
- `sudo supervisorctl restart nodejs` → clean startup, no errors in stderr.

### Files touched
- `/app/js/shortener-analytics.js` (new)
- `/app/js/_index.js` (require, `getShortLinks`, `formatLinks`, single caller updated)
- `/app/js/lang/en.js`, `fr.js`, `zh.js`, `hi.js` (added `analyticsNotAvailable`)

### Backlog
- Optional: add a one-time housekeeping pass to backfill `analytics` cache for stored links if performance becomes a concern (current implementation computes capability at render time — O(N) per "My Links" view, negligible).
- Optional: introduce a stats-capable provider switch (e.g. Bitly for free tier) if losing click counts hurts engagement.



---

## 2026-02-15 — Hosting Plan Upgrade: 50% Prorated Credit (plan-specific window)

### Problem (user-reported)
> @iMr_Brown upgraded from Premium Anti-Red Weekly to Golden Anti-Red Monthly
> and was charged the full $100 — he should have received a 50% credit ($15)
> from his still-active weekly plan.

### Requirements (final, after clarification)
1. Apply 50% of the OLD plan's price as a credit toward the NEW plan when the
   user upgrades within the credit window.
2. **Credit window is plan-specific** (because plan durations differ):
   - **Weekly plan** → upgrade within **3 days** of latest renewal/creation.
   - **Premium monthly plan** → upgrade within **14 days** of latest renewal/creation.
   - **Golden** plan → no upgrade path → no credit.
3. The Telegram inline-keyboard prices MUST reflect the deducted credit
   **dynamically** — the button label shows the FINAL discounted price.
4. The wallet must be charged the discounted price (not the list price).

### Implementation
- **New module** `/app/js/hosting-upgrade-credit.js` — shared helper:
  - `getCycleAnchorDate(planDoc)` → most recent of `lastRenewedAt || createdAt`.
  - `getCreditWindowDays(planName)` → returns 3 for weekly, 14 for premium-monthly, 0 otherwise.
  - `computeUpgradeQuote({ planDoc, oldPrice, newPrice, now? })` →
    `{ eligible, anchorDate, daysSinceAnchor, windowDays, creditApplied, originalPrice, chargeAmount }`.
  - `getUpgradeTargets(planName)` → single source of truth for which tier can upgrade to which.
  - `getBestUpgradeQuote({ planDoc, oldPrice })` → returns the best nudge target (highest credit, tie-breaks by higher tier) plus deadlineDate + daysRemaining.
  - Constants: `CREDIT_WINDOW_WEEKLY_DAYS = 3`, `CREDIT_WINDOW_PREMIUM_MONTHLY_DAYS = 14`, `CREDIT_RATE = 0.5`.
  - All currency values rounded to 2 decimals; charge floored at $0.
- **`/app/js/_index.js`** (3 sites updated):
  1. **Upgrade menu builder** (~line 10935 → `a.upgradeHostingPlan`):
     - Calls `computeUpgradeQuote` per option.
     - Modal shows a loyalty-credit banner + a "🎁 Credit: -$X.XX" line.
     - Button label renders `($CHARGE_AMOUNT)` (dynamic, discounted).
  2. **Confirm modal** (~line 11774 → `a.confirmUpgradeHosting`):
     - Matches the dynamic button label.
     - Displays List Price / Loyalty Credit / You Pay.
     - "💵 Pay $X.XX USD" button uses the discounted amount.
  3. **Wallet deduction** (~line 11815 → `a.confirmUpgradeHostingPay`):
     - Charges `selected.chargeAmount` (not `selected.price`).
     - Persists `upgradeOriginalPrice`, `upgradeCreditApplied`, `upgradeChargedAmount`
       on `cpanelAccounts` for auditability.
     - Admin DM + success summary show both list price and credit.

### Verification
- **Unit tests** `/app/js/__tests__/hosting-upgrade-credit.test.js` — 28/28 pass:
  constants, rounding, anchor selection, eligibility window (within / boundary /
  outside), edge cases (oldPrice=0, credit > newPrice), @iMr_Brown scenario.
- **Integration test** `/app/js/__tests__/hosting-upgrade-credit.integration.test.js`
  — 15/15 pass: seeds real `cpanelAccounts` docs in MongoDB, uses env-driven
  prices, mirrors `_index.js` keyboard/modal builders. Confirms:
  - Weekly user 6 days in → button shows `$85.00` (not `$100`), credit `$15.00` ✅
  - Same user 30 days later → no credit, button shows `$100.00` ✅
  - 14-day boundary → still eligible ✅
- `node -c js/_index.js` passes; `supervisorctl restart nodejs` clean.

### Files touched
- `/app/js/hosting-upgrade-credit.js` (new)
- `/app/js/_index.js` (3 in-place edits — no behavioural change to non-upgrade paths)
- `/app/js/__tests__/hosting-upgrade-credit.test.js` (new — unit)
- `/app/js/__tests__/hosting-upgrade-credit.integration.test.js` (new — integration)

### Backlog
- (P2) Surface the loyalty credit in the AI-support quick-reply suggestions so
  the bot can answer "why was I charged $85?" autonomously.
- (P2) Apply the same prorated-credit pattern to VPS plan upgrades (currently
  handled in `vps-upgrade-service` with its own pricing logic — separate task).

---

## 2026-02-15 — Loyalty Credit Nudge (revenue enhancement on top of upgrade-credit feature)

### Goal
Convert the 50% fairness fix into a measurable revenue lever by surfacing a
one-tap "🎁 You have a $X.XX upgrade credit — use it before {date}" nudge
during the 14-day window — directly on the screens users already visit.

### Implementation
- **`/app/js/hosting-upgrade-credit.js`** — extended with two new helpers:
  - `getUpgradeTargets(currentPlanName)` — single source of truth for which
    plan tiers a given plan can upgrade to (weekly → premium+golden,
    premium-monthly → golden, golden → none).
  - `getBestUpgradeQuote({ planDoc, oldPrice, now })` — returns the best
    upgrade nudge `{ target, quote, deadlineDate, daysRemaining }` or `null`
    when the user has no eligible upgrade. On tied credits the higher-tier
    target wins (Gold beats Premium for the upsell).
- **`/app/js/_index.js`**:
  - **`goto.myHostingPlans`** — adds a one-line credit indicator under each
    plan row (`🎁 $15.00 upgrade credit — expires Feb 22 (10d left)`) plus a
    dedicated `🎁 Use $X.XX credit on <domain>` button at the TOP of the
    keyboard for every plan with an active credit window.
  - **`goto.viewHostingPlanDetails`** — adds a prominent banner with the
    credit amount, the best target plan, the discounted price, the deadline
    date, and a `🎁 Use $X.XX credit by <date>` deep-link CTA. The premium-
    monthly upgrade button (which used to be hidden) is also now surfaced.
  - **Action router** (`a.myHostingPlans` and `a.viewHostingPlan`) — adds
    two new prefix matchers that decode the CTA labels and replay them as
    `user.upgradeHostingPlan` so the existing upgrade flow handles them
    with zero duplication.

### Verification
- Unit tests **44/44 pass** (`hosting-upgrade-credit.test.js`) — including
  the new gating, tie-break-by-tier, deadline, and daysRemaining math.
- Integration tests **23/23 pass** (`hosting-upgrade-credit.integration.test.js`)
  — verifies the exact CTA label strings match the production deep-link
  router regex so the live bot will route the taps correctly.
- `node -c` clean; `supervisorctl restart nodejs` clean.

### Files touched
- `/app/js/hosting-upgrade-credit.js` (extended)
- `/app/js/_index.js` (3 small in-place edits: `myHostingPlans`, `viewHostingPlanDetails`, router prefixes)
- `/app/js/__tests__/hosting-upgrade-credit.test.js` (added gating + nudge sections)
- `/app/js/__tests__/hosting-upgrade-credit.integration.test.js` (added case 4)


---

## 2026-02-15 — Proactive Hosting Upgrade Credit Nudge (daily DM scheduler)

### Goal
Capture the users who DON'T re-open the bot during their credit window by
sending a one-time Telegram DM exactly 2 days before the window closes —
mirroring the existing `sendDay12UpgradeCreditNudges` pattern used for phone plans.

### Sweet-spot rule (per the corrected plan-specific windows)
- **Weekly plan**  (window=3 days)  → fire on days **1.0–2.0** since anchor
- **Premium monthly** (window=14 days) → fire on days **12.0–13.0** since anchor
- **Golden**  → no upgrade path → no nudge

### Implementation
- **New module** `/app/js/hosting-upgrade-nudge.js`:
  - `inSweetSpot(planDoc, now)` — returns `{ daysSince, windowDays, anchor }` or `null`.
  - `alreadyNudgedThisCycle(planDoc)` — true iff `creditNudgeAt >= anchorDate`.
    A renewal advances the anchor past the old stamp → nudge becomes re-eligible
    automatically. No housekeeping job needed.
  - `buildMessage(lang, args)` — localized en/fr/zh/hi DM bodies.
    Headline rounds days up ("Last day"/"2 days left") with the credit amount.
  - `runNudgeSweep({ bot, db, now? })` — scans `cpanelAccounts` filtered by
    plan-name regex (`/week/i` OR `/premium.*30\s*days/i`) and `suspended != true`,
    fires nudges for matches in the sweet spot, stamps `creditNudgeAt`
    atomically. Returns `{ scanned, sent, errors }`.
  - `init({ bot, db })` — registers a `node-schedule` cron at **14:15 UTC daily**
    (15 minutes after the phone-plan nudge to spread Telegram API load).
- **`/app/js/_index.js`** — single line added in the service-init block
  right after `initHostingScheduler`:
  ```
  require('./hosting-upgrade-nudge').init({ bot, db })
  ```

### Idempotency & failure modes
- A bot send failure does NOT stamp `creditNudgeAt` → next sweep retries.
- A successful send DOES stamp `creditNudgeAt` → idempotent until the user's
  next renewal advances the anchor past the stamp.
- The cron job is safe to re-run any time (e.g. after a redeploy mid-day).

### Verification
- **Unit tests** `/app/js/__tests__/hosting-upgrade-nudge.test.js` —
  **32/32 pass**: sweet-spot bounds for weekly & monthly, anchor preference
  (lastRenewedAt over createdAt), idempotency math, localized bodies.
- **Integration tests** `/app/js/__tests__/hosting-upgrade-nudge.integration.test.js`
  — **20/20 pass** against real MongoDB with a captured fake bot:
  - Weekly day 1.5 → sent (golden target, $15 credit)
  - Premium-monthly day 12.5 → sent ($37.50 credit)
  - Too-early / too-late / suspended → skipped
  - Idempotency: second sweep on same data sends 0
  - Renewal-driven re-fire: anchor advance unblocks the next sweep
  - Bot failure: no stamp written → retryable
- **End-to-end suite (all four files): 147 tests, 100% green.**
- `supervisorctl restart nodejs` clean; log line confirmed:
  `[HostingUpgradeNudge] Initialized — daily at 14:15 UTC`.

### Files touched
- `/app/js/hosting-upgrade-nudge.js` (new)
- `/app/js/_index.js` (1 line added in init block)
- `/app/js/__tests__/hosting-upgrade-nudge.test.js` (new — unit)
- `/app/js/__tests__/hosting-upgrade-nudge.integration.test.js` (new — integration)

### Backlog (remaining)
- (P2) Apply the same prorated-credit pattern to VPS plan upgrades.
- (P2) Wire credit explanation into AI-support quick replies ("why was I charged $85?").


---

## 2026-05-15 — DNS Hostname Normalizer + AI-Support DNS Context

### Problem (user-reported via Railway log audit)
@Night_ismine added an A record on `verify-navy.com` typing `www.verify-navy.com`
as the hostname. Cloudflare appended the zone, producing `www.verify-navy.com.verify-navy.com`.
The AI support then gave generic URL-shortener boilerplate because it had no
visibility into the user's actual DNS records.

### Implementation
- **New module** `/app/js/dns-hostname-normalizer.js`:
  - `normalizeHostname(raw, zone)` — auto-strips trailing `.{zone}` (FQDN
    form), collapses zone-apex to `@`, rejects hostnames belonging to a
    different domain (`foreign-domain`).
  - `detectDuplicatedZone(recordName, zone)` — recovers the original
    sub-label from already-broken records like `www.zone.zone`.
- **`/app/js/_index.js`**:
  - `dns-add-hostname` action now normalizes input through the helper. Logs
    `[DNS] Normalized hostname for ...` when it strips a trailing zone.
  - `choose-dns-action` scans the live DNS records for duplicated-zone names
    and surfaces a **`🛠️ Fix N broken record(s)`** button.
  - New `dns-fix-duplicated-menu` goto + action handler with two paths:
    - **✅ Auto-fix all** — add the corrected record first, then delete the
      broken one (safe order).
    - **🗑️ Delete all** — straight delete.
    - All ops are best-effort with per-record try/catch + counters.
- **`/app/js/lang/{en,fr,zh,hi}.js`**: added the helpful "don't include
  your full domain" hint to all `askDnsHostname` prompts (A/AAAA/CNAME/MX/TXT)
  and added 6 new keys (`dnsHostnameForeignDomain`, `dnsFixDuplicatedBtn`,
  `dnsFixDuplicatedHeader`, `dnsFixDuplicatedAutoFixBtn`,
  `dnsFixDuplicatedDeleteBtn`, `dnsFixDuplicatedDone`) translated for all 4
  languages.
- **`/app/js/ai-support.js`** — `getUserContext(chatId, userMessage)`:
  - When `userMessage` matches `/dns|a record|aaaa|cname|mx|txt|nameserver|subdomain|propagat|zone|cloudflare/i`,
    the function now:
    1. Loads up to 5 domains from `registeredDomains` for the user.
    2. For up to 3 of them, fetches LIVE records via `domainService.viewDNSRecords`.
    3. Lists each record (`TYPE name → value`) in the system prompt.
    4. Runs `detectDuplicatedZone` on every record and, when broken records
       are found, injects an explicit instruction telling the AI to point
       the user to the new `🛠️ Fix N broken record(s)` button instead of
       giving generic answers.
  - `getAiResponse` updated to pass `userMessage` into `getUserContext`.

### Verification
- **Unit tests** `/app/js/__tests__/dns-hostname-normalizer.test.js` —
  **31/31 pass**: pass-through, trailing-zone strip (FQDN with/without dot,
  case insensitive, multi-label sub), foreign-domain rejection, underscore
  labels (DKIM/DMARC), apex collapse, detect-duplicated round-trip and the
  exact `@Night_ismine` scenario `www.verify-navy.com.verify-navy.com → www`.
- Full regression suite (credit + nudge + DNS): **178 tests, 100% green**.
- `node -c` clean for `_index.js`, `ai-support.js`, `dns-hostname-normalizer.js`.
- `supervisorctl restart nodejs` clean; webhook verified.

### Files touched
- `/app/js/dns-hostname-normalizer.js` (new)
- `/app/js/_index.js` (3 sites: dns-add-hostname normalization, choose-dns-action
  detection + CTA, dns-fix-duplicated-menu goto + action handler)
- `/app/js/lang/{en,fr,zh,hi}.js` (askDnsHostname hint + 6 new keys)
- `/app/js/ai-support.js` (getUserContext signature + DNS context injection)
- `/app/js/__tests__/dns-hostname-normalizer.test.js` (new — unit)
- `/app/js/fetch_railway_24h_anomalies.js`,
  `/app/js/fetch_night_ismine_thread.js` (audit utilities)

### Recovery for @Night_ismine (7394693056)
Next time he opens **🌍 Domains → verify-navy.com → DNS Records**, the bot
will surface a `🛠️ Fix 1 broken record` button on his keyboard; one tap
auto-renames the record to `www.verify-navy.com → 89.168.98.102` and removes
the duplicated-zone copy. Or he can ask AI support again — the AI now has
his real DNS records as context and will guide him correctly.

### Backlog (remaining)
- (P2) Apply the same prorated-credit pattern to VPS plan upgrades.
- (P2) Wire credit explanation into AI-support quick replies.
- (P2) Apply identical zone-strip normalization to SRV/CAA hostname inputs
  (separate handlers; same fix pattern when needed).


---

## 2026-02 — IVR "📞 New Call" Auto-Loading Previous Template (@LBHAND23)

### Problem (user-reported via Railway AI-support logs)
@LBHAND23 repeatedly complained that tapping **📞 New Call** in the Cloud
IVR menu launched the bot's template/voice flow pre-filled with the
**previous** call's template (e.g. Navy Federal), skipping the template
and mode-selection wizard entirely. He couldn't make a fresh call against
a different bank IVR.

### Root cause
In `_index.js` the IVR-Outbound entry block (≈line 18671) intentionally
preserves `ivrObData` across menu opens so a half-finished draft survives
Cancel. Combined with the "📞 New Call" handler at ≈line 18827 — which
just rendered the caller-ID keyboard without resetting state — the prior
call's `fromPreset=true`, `templateText`, `audioUrl`, `placeholderValues`,
`scriptText`, `activeKeys`, `ivrMode`, `voiceName`, `holdMusic`, `otp*`
fields lingered in state. Then at `ivrObEnterTarget` (≈line 19031 & 19099)
the preset-shortcut branch fired and short-circuited the wizard:

  if (ivrObData.fromPreset && ivrObData.audioUrl) { … skip template+voice }
  if (ivrObData.fromPreset && ivrObData.templateText && !audioUrl) { … }

### Fix
- **`/app/js/_index.js` (line 18826-18839)** — In the `📞 New Call`
  handler, reset `ivrObData` to a clean `{ isTrial: false }` BEFORE
  prompting for caller-ID selection. All per-call leak-prone fields
  (templateName, templateText, placeholderValues, audioUrl, fromPreset,
  voiceKey, holdMusic, otp*, etc.) are wiped. The Saved-Preset (`💾 …`)
  and Recent-call (`📋 …`) paths still populate `ivrObData` explicitly
  and are unaffected. The legitimate `ivr_redial:` callback handler
  (≈line 3952) is untouched — Redial *should* reuse last call params.

### Verification
- **New regression test** `/app/js/__tests__/ivr-new-call-reset.test.js`
  — **7/7 pass**: handler exists, reset is present, reset runs BEFORE
  the caller-ID prompt, reset object carries none of the 24 leak-prone
  fields, redial handler still uses `lastIvrCallParams`, menu-entry
  draft-preservation still intact.
- Full regression suite (dns + credit + nudge + ivr-reset):
  **135 tests, 100% green**.
- `node -c js/_index.js` passes.
- `sudo supervisorctl restart nodejs` clean; production-token bot booted
  with no errors.

### Files touched
- `/app/js/_index.js` (1 site, +9/-1 LOC at the `📞 New Call` handler)
- `/app/js/__tests__/ivr-new-call-reset.test.js` (new)

### Backlog
- **P1** — Push the `_index.js` change to Railway production after user
  confirmation (awaiting approval).


---

## 2026-02-XX — AI Support: public_html / file-upload knowledge gap (@jasonthekidd, @Icemangod6)

### Problem
Multiple Telegram users (e.g. `@jasonthekidd`, `@Icemangod6`) reported the same flow:
they bought an Anti-Red Hosting plan, logged into cPanel, uploaded their website
files via File Manager, but their domain still didn't serve the site. They asked
the AI things like *"I dont see public_html"*, *"I can't find the public folder"*,
*"so I upload via file manager, now where is public_html?"* — and the AI gave
vague, unhelpful replies because **the system prompt had zero coverage for
"where do my files go / why doesn't my site show"**.

### Fix — `/app/js/ai-support.js`
Added 4 new dedicated Q&A entries to `SYSTEM_PROMPT`:
1. **"Where do I upload my website files? / Where is public_html? / I can't find the public folder"** — step-by-step File Manager → `public_html` → Upload → extract `.zip` → name entry file `index.html`/`index.php`.
2. **"I uploaded my files but my domain still doesn't show them"** — 4 numbered fixable causes (wrong folder, wrong entry-file name, un-extracted `.zip`, addon-domain folder), plus hard-refresh + CDN cache note, and a clean escalation if all 4 are eliminated.
3. **"Where do I upload files for my addon domain?"** — `public_html/<addon-domain>/` clarification, references the addon welcome message's "document root" path.
4. (Reinforces existing) — FTP/SFTP also lands in `public_html`.

### Verification
- Extended `/app/js/tests/test_ai_support_kb.js` with 3 new sections (upload-location, "site not showing" diagnostic, addon-domain path). **All 9 sub-tests pass.**
- Existing `/app/js/tests/test_ai_support_phase1.js` — **all 19 tests still pass** (no regression).
- `node --check` clean. Bot service restarted cleanly; `[AI Support] OpenAI initialized` and `[AI Support] MongoDB collections initialized` logged.

### Files changed
- `/app/js/ai-support.js` (+49 LOC, system prompt only)
- `/app/js/tests/test_ai_support_kb.js` (+17 LOC, new assertions)

### Backlog
- **P2** — Railway log API still returns 403 (Cloudflare). Workaround used here: local MongoDB + handoff context was sufficient. Revisit only if remote-log fetching is needed for a future task.

---

## 2026-02-XX — VPS credentials "password not right" report (@spoofed, chat 6996287179)

### Problem
A bot user (@spoofed) reported "password not right" immediately after purchasing a VPS, pasting back the exact generated password (`wKuwMo8rA=R#R0!J7Vh=`) — proving the credentials were delivered correctly but login was failing. Root causes identified:

1. **Cloud-init timing race (P0)** — `vm-instance-setup.js` lines 591–633 injects a cloud-init script that, on first boot, enables `PasswordAuthentication`, unlocks the root account (Ubuntu 24.04+ ships it locked), and syncs the password to the default user. The bot delivers credentials the moment Contabo's API returns `status=running`, but cloud-init can take 2–5 min (Linux) or 5–10 min (Windows/RDP) to finish. Users who SSH within seconds get "Permission denied" / "password not right".
2. **Credentials-message copy UX (P1)** — `vpsBoughtSuccess` in all 4 lang files wrapped the password in `<tg-spoiler>` but not `<code>`, breaking Telegram's tap-to-copy. Manual selection often drops trailing `=`, `!`, etc. IP and username were also plain text.
3. **AI Support KB gap (P1)** — `ai-support.js` had no entry for "VPS password not working / can't login", so the AI gave generic vague replies.

### Fix
**`/app/js/lang/{en,fr,zh,hi}.js → vpsBoughtSuccess`**
- Wrapped password in `<tg-spoiler><code>${credentials.password}</code></tg-spoiler>` → reliable tap-to-reveal-then-tap-to-copy on every Telegram client.
- Wrapped IP and username in `<code>...</code>` → one-tap copy.
- Added a new `readinessNote` block prepended to the warning section, telling users:
  - Linux: wait **2–5 minutes** after activation before first SSH attempt; explains cloud-init runs once on first boot.
  - RDP/Windows: wait **5–10 minutes** for Windows to finish initializing.
  - Reassurance: "the password is correct, the server just isn't finished provisioning yet."

**`/app/js/ai-support.js → SYSTEM_PROMPT`**
Added 2 new dedicated Q&A entries:
1. "My VPS/RDP password is not working / Password not right / Can't login to VPS / Permission denied / Credentials wrong / RDP rejects my password" — 4 numbered fixable causes (cloud-init timing → wait, wrong username, copy-paste error dropping trailing symbols, shell escaping for `!`/`$`) + Reset Password remedy + clean escalation with VPS instance ID.
2. "Where do I find my VPS/RDP credentials again?" — points to 🖥️ VPS/RDP → View/Manage VPS, explains Reset Password caveats (Linux = OS reinstall, RDP = just password rotation).

### Verification
- New test: `/app/js/tests/test_vps_credentials_message.js` — verifies all 4 lang files have password wrapped in `<code>` inside `<tg-spoiler>`, IP+username in `<code>`, and the readinessNote block with correct timing for both RDP (5–10 min) and Linux (2–5 min). **All 28 sub-tests pass (7 per language × 4 langs).**
- Extended `/app/js/tests/test_ai_support_kb.js` with 2 new sections (VPS-login diagnostic, find-credentials-again). **All 11 sub-tests pass.**
- Existing `/app/js/tests/test_ai_support_phase1.js` — **all 19 tests still pass** (no regression).
- `node --check` clean on all 5 modified files. Bot service restarted cleanly; `[AI Support] OpenAI initialized` and webhook re-registered.

### Files changed
- `/app/js/ai-support.js` (+27 LOC)
- `/app/js/lang/en.js` (+5 LOC, modified credentials template)
- `/app/js/lang/fr.js` (+5 LOC, modified credentials template)
- `/app/js/lang/zh.js` (+5 LOC, modified credentials template)
- `/app/js/lang/hi.js` (+5 LOC, modified credentials template)
- `/app/js/tests/test_ai_support_kb.js` (+11 LOC, new assertions)
- `/app/js/tests/test_vps_credentials_message.js` (new, 86 LOC)


---

## 2026-02-XX — "Could not find domain at registrar" bug (@Mrdoitright53)

### Problem
Production bot user @Mrdoitright53 (and likely others) hit this exact error when trying to update nameservers from the bot:

> ❌ Failed to update nameservers: Could not find domain at registrar

### Root cause
`/app/js/domain-service.js` line ~489 inside `updateAllNameservers`:

```js
const registrar = meta.registrar || 'ConnectReseller'
```

If the local DB record (in `domainsOf` or `registeredDomains`) was missing the `registrar` field (legacy doc, schema drift, or mis-tagged migration), the code **blindly defaulted to ConnectReseller**. It then called CR's `getDomainDetails(...)`, CR didn't have the domain (it was actually at OpenProvider), and the function returned the confusing legacy error string. Same symptom would occur if the registrar field was simply mis-tagged as CR but the domain was registered at OP.

### Fix — `/app/js/domain-service.js`

1. New helper **`detectRegistrarForDomain(domain, db)`** — probes OpenProvider and ConnectReseller in parallel and returns whichever finds the domain. On success it **persists** the detected registrar (and `opDomainId` if OP) to both `domainsOf` and `registeredDomains` so the next call goes straight to the correct API without re-probing. Returns `null` only when neither registrar has the domain.
2. **`updateAllNameservers` now self-heals**:
   - If `meta.registrar` is missing → call `detectRegistrarForDomain` BEFORE making any update API call.
   - If `meta.registrar === 'ConnectReseller'` but CR returns no `domainNameId` → fall back to probing OP, and if found, perform the update at OP and correct the registrar tag in the DB.
3. The legacy error string is preserved for the genuine "domain truly doesn't exist anywhere" case, so existing copywriting still applies.
4. Exported `detectRegistrarForDomain` so it can be tested + reused by other code paths in future.

### Verification
- New unit test: `/app/js/tests/test_domain_registrar_autodetect.js` — stubs OP + CR network layers via `Module._load` hooks; covers all 7 scenarios:
  1. OP-only → detected + persisted to both collections
  2. CR-only → detected + persisted
  3. Neither → returns null + no DB writes
  4. Both → OP wins tie-break (more authoritative for our flow)
  5. Untagged record + OP has the domain → end-to-end self-heal via auto-detect (registrar persisted + NS updated)
  6. Mis-tagged CR record + domain actually at OP → silent OP fallback + registrar tag corrected in DB
  7. Domain genuinely missing at both → legacy "Could not find domain at registrar" string still surfaced
- **All 7 tests pass** offline.
- `node --check` + ESLint clean.
- Bot service restarted; `[AI Support] OpenAI initialized` and `✅ Webhook verification passed` logged.

### Files changed
- `/app/js/domain-service.js` (+85 LOC: new helper + refactor of `updateAllNameservers` CR branch into else-block so OP fallback drops naturally into the shared persist block)
- `/app/js/tests/test_domain_registrar_autodetect.js` (new, 211 LOC)

### Follow-up (not yet done — out of scope for this turn)
- `updateNameserverAtRegistrar` (single-slot variant, line ~712) has the same pattern (`if (meta?.registrar === 'OpenProvider') { ... } else { CR }`). If a user hits the same untagged/mis-tagged case via single-slot edit, they'll silently get `{ useDefaultCR: true }` and fall into a different code path. Should adopt the same auto-detect helper there for consistency, but the user-visible "Could not find domain at registrar" string only comes from the bulk path (this fix).


---

## 2026-02-XX — VPS "password not right" — REAL root cause (@spoofed, chat 6996287179)

### Background
Earlier in this session we shipped a "cloud-init timing race" fix for @spoofed's complaint (added a 2-5 min wait note + `<code>`-wrapped password + AI KB entry). The user pushed back: that theory doesn't explain why the **initial password never worked even after waiting**, yet the **password reset (reinstall) worked immediately**. They were right — that was a partial fix. Today's Railway log analysis nailed the real bug.

### Investigation (Railway logs, 2026-05-19)
Reconstructed the full incident from `HostingBotNew` deployment logs:

- 18:42:00 — @spoofed (6996287179) opens bot
- 18:42:23 — Selects: Linux VPS / India / Cloud VPS 10 SSD / **Ubuntu 22.04** / password login (skipped SSH key)
- 18:45:35 — Crypto (ETH) payment confirmed
- 18:51:22 — `[Contabo] Creating instance: productId=V92, imageId=afecbb85-... (Ubuntu 22.04), rootPassword=370656 (secret-ID number, not the password)`
- **18:51:46 — Bot sends "🎉 VPS active!" with credentials**
- 18:58:39 — `"password not right?? wKuwMo8rA=R#R0!J7Vh="` ← 7 min later
- 19:09:23 — `[VPS] Password reset successful (reinstall) - ChatId: 6996287179, Instance: 203310799`
- No further complaints

Then live-queried `contabo.getInstance(203310799)` from this fork and got:
```json
{ "defaultUser": "admin", "osType": "Linux", "imageId": "d64d5c6c..." (Ubuntu 24.04 — reset switched the OS!) }
```

### Root cause
**`/app/js/vm-instance-setup.js:673`** had:
```js
credentials: {
  username: instance.defaultUser || (isRDP ? 'admin' : 'root'),
  password: rootPassword
}
```

`POST /compute/instances` returns `defaultUser: undefined` (the OS hasn't finished provisioning yet — Contabo only reports `defaultUser` after install completes). So the code's `||` fallback fires and the user is told `Username: root`.

But Contabo provisioned the box with `defaultUser=admin` (modern Ubuntu cloud images have **root locked by default**; the rootPassword from the secret gets applied to the `admin` user, not root). So:

- User typed `ssh root@host` with the correct password → **permission denied** (root is locked)
- User retried for 7+ minutes → **still denied** (root never gets unlocked / no password ever applies to it; cloud-init's bi-directional sync was supposed to copy admin's hash to root but didn't work reliably for this user)
- User clicked Reset Password → reset path uses `userVPSDetails.defaultUser` (which was correctly stored as `admin` at line 692, ironically using the same broken `||` pattern but Contabo's API had populated `defaultUser` by the time of reset) → reset success message correctly shows `Username: admin` → user types `ssh admin@host` → ✅ works

So the earlier "cloud-init timing" fix was wrong — the real issue is the bot was telling users the wrong username from the start. Waiting wouldn't help because root is permanently locked on these images.

### Fix — `/app/js/vm-instance-setup.js`

After `createInstance` returns, **poll `getInstance(instanceId)` up to 5×3s** until `defaultUser` populates. Use the resolved value in BOTH the credentials message AND the persisted `_vpsPlansOf` record. Skip the poll for RDP (Windows always uses `admin`).

Bonus: when the polled snapshot has fresher data (e.g., real IP instead of `provisioning...`), update `instance.ipConfig` / `instance.status` so the credentials message has the final IP, not a stale placeholder.

If `defaultUser` never populates within 15s (edge case), fall back to the legacy `'root'` default — same behaviour as before but now logged so we can detect it in Railway.

### Verification
- New unit test: `/app/js/tests/test_vps_credentials_default_user.js` — stubs Contabo via `Module._load` and covers 4 scenarios:
  1. Contabo returns `defaultUser=admin` immediately → username=admin (direct, no polls wasted)
  2. Contabo initially returns `undefined`, populates on 2nd poll → username=admin, host updated to refreshed IP
  3. Contabo never returns `defaultUser` → falls back to `root` with a clear log line
  4. RDP/Windows skips the Linux-specific poll branch, uses `admin`
- **All 4 tests pass** offline.
- `node --check` + ESLint clean.
- Bot restarted; `[AI Support] OpenAI initialized` and `✅ Webhook verification passed` logged.

### Files changed
- `/app/js/vm-instance-setup.js` (+37 LOC: defaultUser-polling block before `vpsData` construction, single-source-of-truth `defaultUser` variable used by both the credentials message and the DB insert)
- `/app/js/tests/test_vps_credentials_default_user.js` (new, 197 LOC)

### Why the earlier "wait 2–5 min" fix was incomplete
The wait-note IS still useful for the small minority of users on legacy images where root IS the default user and cloud-init genuinely needs a few minutes to enable PasswordAuthentication. We keep it. But for the ~majority on modern Ubuntu images, the username fix is what actually unblocks them.

### Open follow-up (out of scope this turn)
- The password reset at 19:09:23 silently switched @spoofed's OS from Ubuntu 22.04 to Ubuntu 24.04 (current `imageId=d64d5c6c... = Ubuntu 24.04`). Either Contabo's `PUT /compute/instances/{id}` reinstall doesn't accept all image UUIDs, or our reset-path code is silently using the Ubuntu 24.04 fallback when `opts.imageId` is technically passed but rejected. Worth investigating in a future turn — users ordering Ubuntu 22.04 shouldn't end up on 24.04 after a reset.


---

## 2026-05-22 — Shortener Deactivation Race Fix + Reconciler

### Trigger
User `Thugnificent_0018` (chatId 5515344236) couldn't reach `https://nymcub.com/review`. Investigation traced to a **half-deactivated state**: the bot's Deactivate flow deleted the Cloudflare CNAME, but the upstream (Railway) `removeDomainFromRailway` call returned HTTP 503. The handler ignored the upstream failure, deleted the CF CNAME anyway, and told the user "✅ Shortener deactivated." The Cloudflare zone served the apex via CNAME flattening was now empty (only TXT remained), so Cloudflare returned HTTP 530 for every request.

### Root cause (single line)
`/app/js/_index.js` deactivation handler ignored `removeDomainFromRailway` errors and proceeded to delete the Cloudflare CNAME + report success.

### Changes (4 commits worth of work, all landed)

1. **`/app/js/rl-save-domain-in-server.js`** — `removeDomainFromRailway` now classifies errors (`transient: true` for 5xx / network / timeout) and returns the HTTP status code. Added `listRailwayCustomDomains()` helper for the reconciler's orphan check.

2. **`/app/js/_index.js`** — All 3 deactivation handlers patched (main deactivate, switch-to-provider deactivate, shortener-conflict resolver):
   - Transient error → enqueue retry, show `dns_3_busy` message ("⏳ Our shortener service is briefly busy…"), **do NOT touch CF CNAME**
   - Hard error → show generic `dns_3` failure, do NOT touch CF CNAME
   - Success → proceed with CF CNAME cleanup + success message
   - No "Railway" mentions in any user-facing string — copy uses "shortener service"

3. **`/app/js/shortener-activation-persistence.js`** — Added deactivation queue (`shortenerDeactivations` collection) with `enqueueDeactivation`, `incrementDeactivationRetry`, `markDeactivationDone`, `markDeactivationFailed`, `findPendingDeactivations`. `MAX_DEACTIVATION_RETRIES = 5`.

4. **`/app/js/shortener-reconciler.js`** (new, 222 LOC) — periodic tick (5 min after a 30 s warm-up) does two things:
   - **Drain pending deactivations** — retry `removeDomainFromRailway` for queued tasks; on success, finish the CF cleanup the handler skipped and DM the user a success message; after 5 transient retries or any hard error, mark `failed` and DM the user to retry manually.
   - **Heal orphans** — for each `completed` activation, if upstream still claims the domain but CF has no shortener CNAME, fully remove the upstream claim, mark activation `needs_reactivation`, and DM the user once with a "tap Activate URL Shortener" guidance.

5. **Admin command** `/repairshortener <domain>` — runs the full repair flow (drain queue + orphan check + final state snapshot) on demand. Available to `TELEGRAM_ADMIN_CHAT_ID`. Idempotent. Inserted next to `/hostingstatus` in `_index.js`.

6. **i18n strings** — Added `dns_3_busy` for `en` / `fr` / `hi` / `zh`.

### Tests
`/app/js/tests/test_shortener_reconciler.js` — 4 behavioural unit tests with in-memory mocks (no live DB). All pass:
1. Transient upstream error → handler does NOT delete CF, retry task is queued ✓
2. Reconciler tick on healthy upstream → deactivation completes, user notified, CF CNAME removed ✓
3. After 5 transient retries → task marked `failed`, user notified with escalation message ✓
4. Orphan heal (upstream claims, CF empty) → upstream cleared, activation marked `needs_reactivation`, user notified once, second pass is no-op ✓

End-to-end against live Railway + Cloudflare APIs: `repairDomain('nymcub.com', …)` returns clean state `healthy / no upstream claim / no CNAME` — confirming the manual recovery earlier in this session.

### Files changed / added
- `/app/js/rl-save-domain-in-server.js`  (modified)
- `/app/js/_index.js`                     (modified — 3 handlers + boot wiring + admin cmd)
- `/app/js/shortener-activation-persistence.js`  (modified — deactivation queue)
- `/app/js/lang/{en,fr,hi,zh}.js`         (modified — dns_3_busy string)
- `/app/js/shortener-reconciler.js`       (new)
- `/app/js/tests/test_shortener_reconciler.js`  (new)

### Bot boot confirms
`[ShortenerReconciler] Scheduled every 5min` printed at startup.

---

## 2026-05-22 — AI Support context + crash trail + KB navigation fix

### 1. AI Support hallucination fix (P0)
The `EIN_5050` bad-rated session traced to the AI not knowing the user's actual phone plan facts. AI literally told the user *"I don't have direct access to your purchase dates or plan age"* and then invented 4 different upgrade quotes.

**Fix** — `/app/js/ai-support.js` `getUserContext()`:
- Replaced the 3-line "Cloud phones: N (plan)" summary with a rich per-number block that includes:
  - `phoneNumber · {plan} plan ($X/cycle) · purchased YYYY-MM-DD (Nd ago) · expires YYYY-MM-DD (Nd left) · unused credit ~$X.XX`
- Injected concrete tier prices from env: `Starter $50/mo, Pro $75/mo, Business $120/mo`
- Added an explicit **UPGRADE MATH RULE** to the prompt: prorated upgrade = `new_plan_price − unused_credit_of_current_plan`; do NOT invent figures; if user mentions a price the system didn't compute, restate the math instead of confirming
- Computes `unused credit` as `(planPrice / cycleDays) * remainingDays`

**Verification**: `/app/js/tests/test_ai_support_plan_context.js` — 2 tests pass:
1. With a seeded Starter ($50, 10d ago, 20d left) phone record, the system prompt contains plan facts, tier prices, upgrade rule, and a $33 unused credit (mathematically correct).
2. With no phone records, the upgrade-math rule is absent (no prompt pollution).

### 2. Crash trail + memory-tick logging (P1)
Three SIGTERMs in 33 min on May 22 with no stack trace. The early handlers in `start-bot.js` were too thin.

**Fix** — `/app/js/_index.js` near the SIGTERM handlers:
- `[Memory] rss=… heap=…/… external=… heapPct=…%` ticker: prints every 60s, or immediately if heap utilization ≥ 80% (already caught the bot at 95% heap right after boot — confirmed root cause direction is OOM territory)
- Rich `uncaughtException` + `unhandledRejection` handlers that:
  - Log a memory snapshot at the moment of the crash
  - Persist the crash to `botCrashes` MongoDB collection (kind, message, stack, memory, uptime, pid, createdAt) for postmortem
  - DM admin via Telegram with a `<pre>` formatted stack (throttled to once per 30 s to avoid storms)
- `SIGTERM` now also logs memory at signal-receive time, so we can correlate kills with memory state in Railway logs

### 3. KB navigation rewrite fix (P1)
The "🔗✂️ URL Shortener — Unlimited" → `urlShortener` mapping in `_index.js` AI_BUTTON_TO_USER_KEY rerouted users to the *inner* `✂️🌐 Custom Domain Shortener` submenu instead of the main shortener landing.

**Fix** — line ~10696:
- Changed mapping from `'urlShortener'` (inner submenu) to `'urlShortenerMain'` ("🔗 URL Shortener", the actual top-level button)
- Also added FR/ZH/HI variants of the same AI label so the pause-session-on-AI-button-tap behaviour works in all 4 languages, not just EN

### Files changed
- `/app/js/ai-support.js`         (context builder + `__setOpenAIForTest` hook)
- `/app/js/_index.js`             (memory ticker + crash handlers + AI_BUTTON map fix)
- `/app/js/tests/test_ai_support_plan_context.js`  (new — 2 tests, both pass)

### Bot boot confirms
- `[AI Support] OpenAI initialized` ✓
- `[ShortenerReconciler] Scheduled every 5min` ✓
- `[Memory] rss=110.3MB heap=45.7MB/48.1MB external=20.7MB heapPct=95% ⚠️ HIGH` ← already actionable signal
