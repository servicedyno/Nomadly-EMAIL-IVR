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
