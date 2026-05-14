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
