# Nomadly — Dev Pod PRD / Setup Notes

## Original problem statement
Read the README file and set up using the provided `.env` variables, ensuring the development pod **does not** affect the production Telegram bot or production Telnyx/Twilio webhooks.

## Architecture (per /app/README.md)
- React frontend (port 3000)
- FastAPI backend (port 8001) — reverse-proxies `/api/*` to Node.js
- Node.js Express (port 5000) — Telegram bot, Telnyx voice/SIP/SMS, business logic
- MongoDB (local + shared Railway prod DB via `MONGO_URL`)

## Critical safety rules (enforced on this dev pod)
| Variable | Dev value (this pod) | Why |
|----------|----------------------|-----|
| `BOT_ENVIRONMENT` | `development` (was `production` in user-provided list — OVERRIDDEN) | Prevents bot from activating `TELEGRAM_BOT_TOKEN_PROD` and hijacking real users |
| `SKIP_WEBHOOK_SYNC` | `true` (added) | Blocks `initializeTelnyxResources`, `initializeTwilioResources`, ANI overrides, etc. from mutating prod Telnyx/Twilio state |
| `SELF_URL` / `SELF_URL_PROD` | Set to `<dev pod URL>/api` by `setup-nodejs.sh` | In dev mode `SELF_URL_PROD` is unused; safe to overwrite |
| `TELEGRAM_BOT_TOKEN_*` | DEV token active, PROD token stored but unused | Verified via `[AntiRed] Startup worker upgrade SKIPPED (BOT_ENVIRONMENT!=production)` |
| `MONGO_URL` | Railway prod DB (shared) | This is the documented behaviour — dev reads/writes the shared DB but token+webhook isolation keep traffic separated |

## Current pod state (2026-02-20)
- `/app/frontend/.env` — `REACT_APP_BACKEND_URL` set to current dev pod URL
- `/app/backend/.env` — full user-provided env list + safety overrides (`BOT_ENVIRONMENT=development`, `SKIP_WEBHOOK_SYNC=true`); `SELF_URL`/`SELF_URL_PROD` rewritten by setup script to `https://api-keys-setup-3.preview.emergentagent.com/api`
- `/app/.env` — symlink → `/app/backend/.env` (Node.js dotenv root)
- Supervisor: `backend`, `frontend`, `mongodb`, `nodejs` all RUNNING
- Node.js logs confirm: AntiRed worker upgrade SKIPPED, CF-Sync skipped (dev mode), health monitor DISABLED on backend

## Verified smoke tests
| Test | Result |
|------|--------|
| `GET /api/` via dev pod URL | 200 (proxied to Node.js Express) |
| `GET /api/sms-app/download/info` | 200 — `{"version":"2.4.1","name":"Nomadly SMS","size":3823287,"available":true}` |
| `GET /api/admin/subaccount-status` | 200 |
| Frontend `/` (port 3000) | 200 |

## What's been implemented (this session — 2026-02-20)
- Created `/app/frontend/.env` with `REACT_APP_BACKEND_URL`
- Created `/app/backend/.env` from user-provided list with critical overrides:
  - `BOT_ENVIRONMENT="production"` → `"development"` (CRITICAL)
  - Added `SKIP_WEBHOOK_SYNC="true"` (CRITICAL)
  - Stripped stale `SELF_URL` so setup script could write the correct dev pod URL
- Ran `bash /app/scripts/setup-nodejs.sh` → installed Node deps via yarn, created `/app/.env` symlink, wrote `/etc/supervisor/conf.d/supervisord_nodejs.conf`, started Node.js
- Restarted `backend` so FastAPI loads `MONGO_URL` from the newly-created `.env`
- Verified end-to-end proxy: ingress → FastAPI (8001) → Node.js Express (5000)

## Roadmap / Backlog
None requested. Pod is initialised and idle, ready for development work.

## How to re-run setup (e.g. after pod URL changes)
```bash
bash /app/scripts/setup-nodejs.sh
sudo supervisorctl restart backend
```
The script auto-detects the new pod URL from `frontend/.env` and updates `SELF_URL` accordingly. The hard-coded safety check in the script refuses to touch `SELF_URL` if `BOT_ENVIRONMENT=production` (extra defence against accidental hijack).

---

## 2026-06-20 — Railway 6-day sales drop-off RCA (current session)

User asked: investigate Railway logs from the last 6 days to identify anomalies / sales drop-off.

### Findings (full report at `/app/RAILWAY_6DAY_RCA_REPORT.md`)

1. 🔴 **P0 — Fincra (NGN fiat) auth broken since 2026-06-10** (10 days).
   `services.fincra_service - ERROR - Fincra authentication failed: {'message': 'Unauthorized'}` — 1,102 occurrences over 10 days. Kills all NGN deposits. **Fix: rotate `FINCRA_API_KEY` in Railway → verify LIVE env → redeploy.**

2. 🔴 **`payment confirmed` down 77%** (53/day 06-10 → 12/day 06-20). **`deposit confirmed` down 73%**.

3. 🟠 **Referral channel collapsed** — `/start ref_…` peak 11/day → 2/day (-82%).

4. 🟠 **`/start` rate down 65%** (156 → 54).

5. 🟠 **Twilio errors spike on 06-16** (2,208 errors that day; resolved to 200/day by 06-20). Some users likely lost their numbers that day.

6. 🟡 **Deploy churn**: 49 deploys in 7 days (15 deploys on 06-17, 15 on 06-19). Each one = 30-90s webhook downtime.

7. 🟡 **4xx flood is a vulnerability scanner** hitting `/con5dldbuy.php` (~95% of 4xx). Not customer traffic. Recommend edge-blocking it.

8. 🟢 **Telegram webhook itself is healthy** — `getWebhookInfo` reports 0 pending updates, no `last_error_message`.

### Investigation artifacts created
- `/app/RAILWAY_6DAY_RCA_REPORT.md` — full markdown report
- `/app/scripts/analyze_railway_6day.py` — fixed (added Mozilla UA header)
- `/app/scripts/dig_http_logs.py` — per-deployment httpLogs analyzer
- `/app/scripts/dig_real_traffic.py` — scanner-filtered traffic breakdown
- `/app/scripts/dig_events_v2.py` — environmentLogs business events (anchorDate paginated)
- `/app/logs_prod/_6day_summary.json`, `_6day_business_events.json`, `_real_traffic.json`, `_http_dig_output.txt` etc.

### Status
Diagnostic phase complete. **No code changes applied** — fixes (rotating Fincra key, referral test, Twilio retro) require user action on Railway env + payment dashboards. Awaiting user direction on which fix to implement first.


---

## 2026-06-20 — Follow-up actions on the 3 lower-priority items

### 1. 🟠 Twilio 06-16 post-mortem → **NO ACTION REQUIRED (false alarm)**
The earlier "2,208 Twilio errors on 06-16" was caused by a too-broad filter (`Twilio` substring matched info logs like `SIP dial timeLimit: 7860s` and `[Twilio Sync] Webhook sync complete: 16 updated, 0 failed`). Re-filtered with strict error patterns:
- Actual user-impacting Twilio failures across full 6-day window: **2 users**.
- `8186560549` — phone purchase failed on 06-15, **auto-refunded $75 immediately** by `CloudPhone` handler. No DM needed.
- `1794625076` — 2 SIP bridge calls had no-answer at destination on 06-16, system explicitly logged "not billed... is correct". No DM needed.
- Report: `/app/TWILIO_06_16_POSTMORTEM.md`. The original RCA section #4 is superseded by this addendum.

### 2. 🟡 Edge-block scanner → **IMPLEMENTED in dev pod, ready to deploy**
Added an early-exit middleware to `/app/js/_index.js` (lines 10–66, right after `const earlyApp = express()`):
- Drops the socket instantly (`res.socket.destroy()`) for any request matching: known scanner IPs (`74.7.243.245`), scanner path prefixes (`/con5dld`, `/wp-`, `/.git`, `/.env` etc.), exact paths (`/.htaccess` etc.), or scanner extensions (`.php`, `.jsp`, `.aspx`, `.cgi`).
- Exposes `GET /admin/scanner-block-stats` for live observability.
- Verified locally: scanner paths get HTTP 000 / 0 bytes / "Empty reply from server" in < 2 ms; `/health` and all legitimate routes are unaffected.
- ESLint clean. Node bot restarts cleanly.
- Doc: `/app/SCANNER_EDGE_BLOCK.md`.
- Expected prod impact: 4xx rate drops from ~96% → <10%, Railway dashboards become useful again.

### 3. 🟡 Deploy churn → **DOC + recommended process change (no code yet)**
Root cause: Emergent's `auto-commit for <uuid>` on every code change pushes to `main` → Railway redeploys on every push. 97 commits → 49 deploys in 7 days (15 on 06-17, 15 on 06-19).

Recommendation: create a long-lived `production` branch in GitHub, point Railway's `Nomadly-EMAIL-IVR` source at it, and use a manual `git push origin main:production` to promote a batch of confirmed-good commits. One deploy per batch, regardless of how many auto-commits landed on `main`. Estimated effort: 5 minutes in Railway UI + GitHub.

Doc: `/app/DEPLOY_CHURN_REDUCTION.md` (includes optional `promote-to-prod.sh` script).

### Net status
- 🔴 P0 — Fincra `Unauthorized` since 06-10 → **still requires user to rotate `FINCRA_API_KEY` in Railway**. Highest-ROI fix.
- 🟠 P1 — Referral channel collapse (11→2/day) → **still requires end-to-end test of `t.me/<bot>?start=ref_TEST`**.
- 🟡 Twilio 06-16 → **closed (false alarm)**
- 🟡 Scanner block → **code change done, awaiting deploy**
- 🟡 Deploy churn → **process doc delivered, awaiting Railway settings change**

---

## 2026-06-21 — Bot UX Anomaly Scan (current session)

User asked: access Railway logs and determine if there are any anomalies or UX issues for bot users.

### Top findings (full report: `/app/UX_ANOMALY_REPORT.md`)

1. 🔴 **P0 — Insufficient-balance wall has a 100 % bounce rate.** 6 distinct users hit the wall (8 events). **0 of them** deposited and recovered. The bounced users showed strong intent (multi-day return visits) but the deposit CTA from the wall isn't compelling enough. Every wall-event traced back to the "Custom Leads → Select institution → pay" funnel.

2. 🔴 **P0 — 12 Twilio sub-accounts permanently failing 401.** Each is checked every 30 min by PhoneMonitor; all 48 checks in 6 days returned 401. Each = at least one customer's phone number now unmanageable. Sub-accounts: `AC98bdf45…`, `AC01e40ee…`, `AC649e0f1…`, `AC28b0850…`, `AC23f043f…`, `ACde9f00e…`, `ACf08d768…`, `ACa1626b5…`, `AC50fe935… (toll-free +18886146831)`, `ACf65175b…` + 2 more. Fix: rotate Auth Tokens per sub-account.

3. 🔴 **P0 — VPS Start button silently fails.** 108 Contabo API errors across 8 VPS in 6 days (91 × HTTP 404 = orphans; 6 × 423 = locked). Users see `❌ Failed to start VPS` with no explanation; specific user `davion419` retried 5×.

4. 🟠 **P1 — `/start` spam not debounced.** Users tap `/start` 3-5× in a row; bot re-renders the full main menu each time. Wastes Telegram API calls + suggests laggy bot.

5. 🟠 **P1 — "Custom Leads" is the deposit-wall trap.** Every insufficient-balance event came from this single funnel.

6. 🟡 **P2 — CartRecovery nudges feel pushy.** Auto-nudges within 1-2 hours of abandonment (`"Tap /start → 📦 Digital Products"`).

7. 🟡 **P2 — 1 explicit 👎 BAD support rating** from user `shallowxx` on 06-21 00:49.

### What's NOT broken (clearing earlier hypotheses)
- AutoPromo correctly skips blocked users (0 distinct blocked targets)
- TTS timeouts: 0 in window
- Telegram callback "query is too old": 0
- Auto-refund on failed phone purchase: working

### Artifacts created
- `/app/UX_ANOMALY_REPORT.md` — full report
- `/app/scripts/dig_ux_signals.py`, `dig_user_replies.py`, `dig_ux_journey.py` — analyzers
- `/app/logs_prod/_ux_signals.json`, `_ux_replies.json`, `_ux_user_journey.json` — data

### Status
Diagnostic phase complete. No code changes applied to fix UX issues yet (waiting for user direction). The earlier 🔴 P0 (Fincra `Unauthorized`) is still pending user action in Railway dashboard.



---

## 2026-06-21 (later same day) — UX fixes implemented per user direction

User asked to fix #2 (with paid-customer audit first) and items #3, #4, #5, #7, #8 from yesterday's UX scan list.

### #2 Twilio sub-account 401 — paid-customer audit + code change DONE
- **Paid-customer audit**: 7 paid customers with 8 actively-subscribed phone lines confirmed affected. 2 have auto-renew in just 2 days (`+18889233702` chat 817673476, `+18886043141` chat 6604316166). Lifetime phone-line spend: $1,318.75.
- **Code fix**: `phone-monitor.js` now detects HTTP 401 specifically, collects them into `authFailedSubs[]`, and sends a once-per-day **admin Telegram digest** listing every affected sub-account + customer line. User-facing notification is deliberately skipped for 401s (vs `'suspended'` which still triggers user notification).
- Manual remaining: admin must rotate each sub-account auth token in Twilio Console.

### #3 VPS Start root cause — DONE
- `vm-instance-setup.js` returns `{ error, status, providerMessage }`. `_index.js` branches on status code: 404 → orphan-VPS message; 423 → "locked, retry in 2 min"; 409 → "conflicting state"; 5xx → "provider unreachable".

### #4 Insufficient-balance UX wall — DONE
- Prepended wallet-balance banner on Custom-Leads catalog (`targetSelectTarget`).
- Reframed wall message to "Just $X short — tap Deposit below" with reassurance order is saved + crypto suggestion.

### #5 /start debounce — DONE
- Tracks last /start per chat. < 3 sec re-tap gets a small reminder instead of full menu re-render.

### #7 Soften copy + mute opt-out — DONE
- Rewrote EN `BROWSE_FOLLOWUP_MESSAGES` to feel helpful, dropped pressure, added mute hint.
- Added `mute` / `unmute` keyword handler wired to existing `promoOptOut` collection.

### #8 Funnel metric — DONE
- Emits `insufficient_balance_wall` + `deposit_confirmed` events to `funnelEvents` collection.
- New `GET /admin/funnel-stats?key=…&days=7` endpoint returns recovery-rate percentage and bounced-user list.

### Smoke tests passed
- ESLint clean across all 4 modified files
- Node bot restarts clean, 70+ services initialise
- `/admin/funnel-stats` returns valid JSON, 403 without key
- MongoDB writes verified for promoOptOut + funnelEvents

### Full report: `/app/UX_FIXES_IMPLEMENTATION_REPORT.md`

### Files modified
- `/app/js/phone-monitor.js` (Twilio 401 handler + admin digest)
- `/app/js/_index.js` (5 separate fixes)
- `/app/js/vm-instance-setup.js` (preserve provider status code)
- `/app/js/new-user-conversion.js` (softer EN copy)

### Status
Code changes ready. `logs_prod/` is gitignored from yesterday's cleanup so this round of changes is push-safe.

---

## 2026-06-21 — Fresh Railway 6-day RCA + Referral funnel fixes

### Step 1 — Dev setup refreshed
- `SELF_URL` + `SELF_URL_DEV` updated to current pod `https://api-keys-setup-3.preview.emergentagent.com/api`
- `SELF_URL_PROD` left intact (still points to real Railway prod URL)
- Production isolation reconfirmed: `BOT_ENVIRONMENT=development`, `SKIP_WEBHOOK_SYNC=true`, dev bot token in use
- Nodejs restarted clean, all `/api/*` routes reachable

### Step 2 — Railway 6-day RCA v2 (`/app/RAILWAY_6DAY_RCA_REPORT_v2.md`)
- Fixed broken v1 analyzer — Railway changed GraphQL to require `anchorDate` + `beforeLimit` (was `afterDate/afterLimit`)
- **🔴 P0 confirmed**: Fincra auth failing 96/day for 11+ days — unchanged from yesterday's RCA, still not fixed
- **🔴 P0**: Wallet credits 06-21 = **0** (was 10/day peak)
- **🟠 P1**: Domain registrations down 45%, `/start` halved
- **🟡 Cosmetic**: 595 5xx in 32h were 100% scanner traffic mis-classified as 5xx (edge block was destroying sockets without headers)
- **🟡 Marketing**: Referral funnel collapsed — only 6 `/start ref_` in 8 days, **all self-referrals**

### Step 3 — Code fixes shipped
- **Edge-block 5xx → 4xx cosmetic fix** (`/app/js/_index.js`):
  - Replaced `res.socket?.destroy()` with `res.status(403).end()` + `Connection: close`
  - Scanner paths now reported as 4xx (deny) instead of inflating 5xx in Railway dashboards
  - Verified live: `GET /api/con5dldbuy.php` → 403, `/api/.env` → 403
- **Referral funnel instrumentation** (`/app/js/_index.js` lines 11123-11187):
  - Every `/start ref_X` now emits structured `[Referral] outcome=<bucket>` log line
  - 7 outcome buckets: `sip_test_credited`, `wallet_referral_saved`, `already_referred`, `self_referral`, `referrer_not_found`, `empty_refcode`, `error`
  - Previous code silently dropped 5/7 of these — Railway logs had **zero `[Referral]` lines for 8 days**
- **New `/admin/referral-stats` endpoint** (`/app/js/routes/admin.js`):
  - Auth: `?key=<SESSION_SECRET[:16]>`
  - Returns all-time and window-bound counts: refs, qualified, pending, payout, top referrers, web-click conversion
  - Live test against prod DB: 19 lifetime refs, **5 qualified ($25 paid out)**, 14 pending, 26% qualification rate

### Verification
- Lint clean (`mcp_lint_javascript`) on both files
- All 4 Jest suites pass (`jest --silent`): 20 passed, 1 skipped
- Curl smoke tests against dev pod confirmed both edge-block and admin endpoints behave as expected

### Artifacts
- `/app/RAILWAY_6DAY_RCA_REPORT_v2.md` — fresh full RCA
- `/app/REFERRAL_FUNNEL_FIX.md` — referral investigation + action recommendations
- `/app/scripts/analyze_railway_6day_v2.py` — fixed analyzer
- `/app/scripts/dig_5xx_spike.py` — 5xx drilldown
- `/app/scripts/dig_sales_pulse.py` — sales pulse pulse
- `/app/scripts/dig_referral_funnel.py` — referral funnel scraper

### Pending (not picked up this round)
- 🔴 **P0 Fincra 401 fix** — still the highest-leverage revenue lever; needs key rotation in Railway env (user-side action) + a verify-token call from code
- 🟡 Set `BOT_USERNAME=NomadlyBot` in Railway (currently unset; works because t.me is case-insensitive but it's tech debt)
- 🟡 Referral incentive redesign (lower $30 threshold, double-rewards promo, surface link in more places) — product decisions
- 🟡 Deploy churn protection (branch protection / staging) — still unaddressed

---

## 2026-06-21 — UX P-Funnel batch (#3, #4, #5, #11, #12)

User selected 6 UX recommendations (3, 4, 5, 7, 11, 12) for implementation.  #7 (always-on wallet balance) was already implemented (line 7030 of `_index.js` — `getMainMenuGreeting` shows `${tierBadge} ${tierName} <b>${usdStr}</b>`), so we skipped it.

### What shipped

#### #4 — Split referral bonus + automatic payout pipeline (`applyReferralCredit`)
- New `applyReferralCredit(refereeChatId, amountUsd, source)` helper in `_index.js` line 4067
- Wired into DynoPay deposit success (line 34669) — fires on every confirmed deposit
- Pays the **referrer**:
  - **$1 instant** on referee's first deposit ≥ $5 (was missing entirely)
  - **$5 reward** at $30 cumulative spend (existing reward — but `cumulativeSpend` was never actually being incremented; now it is)
- Idempotent via `firstDepositBonusPaid` / `rewardPaid` flags on the `referrals` doc
- Sends Telegram DM to referrer for each payout: "🎉 +$1 referral bonus!" / "🚀 +$5 referral reward!"
- Live-data context: only 5 of 19 referees ever qualified (26%); first-deposit bonus cuts time-to-payout from "median never" to minutes

#### #3 — Post-purchase referral nudge (after domain registration)
- Added in `buyDomainFullProcess` (line ~30330) — 16-second delay after `t.domainBought`
- Surfaces **only** to users with **zero existing referees** (`referrals.countDocuments({referrerChatId})`) so we don't nag regulars
- Localized in en/fr/zh/hi with the new $1 + $5 bonus copy + tappable share link
- Sits on the post-purchase dopamine moment — highest-leverage share window

#### #12 — Domain → hosting + VPS cross-sell
- Same hook in `buyDomainFullProcess` — 8-second delay (before the ref nudge)
- Localized cross-sell card: "🚀 Pair {domain} with hosting + VPS?" → cPanel from $3.99/mo, VPS from $5/mo
- Existing audience, zero acquisition cost

#### #5 — Self-referral friendly redirect
- In the `outcome=self_referral` branch (line ~11155), now sends:
  - "💡 You can't refer yourself — but here's YOUR share link, send it to a friend instead"
  - Includes the user's actual `t.me/...?start=ref_<chatId>` link as a tap-to-copy `<code>` block
- Mentions the new $1 instant / $5 lifetime bonus to motivate sharing
- Previously: silently dropped (no message at all)

#### #11 — Daily low-balance proactive alert (`sendLowBalanceNudges`)
- New scheduled job at 11:00 UTC daily (line 4220)
- Pulls `funnelEvents` for `insufficient_balance_wall` in last 7d
- Excludes users who have a `deposit_confirmed` after that wall hit (already recovered)
- Excludes users alerted in last 7d (deduped via `lowBalanceAlerts` collection, upsert pattern)
- Sends localized DM (en/fr/zh/hi) with current balance + deposit hint
- **Production-only** guard (`process.env.BOT_ENVIRONMENT !== 'production'` → skip) so dev pod never DMs prod users with a different bot token

#### #7 — Already present (no change)
- `getMainMenuGreeting()` at line 7030 already shows `${tierBadge} ${tierName} <b>${usdStr}</b>` as the first content line below the welcome — wallet balance is always-on on the main menu

### UI copy update
"Refer & Earn" page (line 13912) — restated the new bonus structure: instant $1 at $5 deposit + $5 at $30 cumulative. `totalEarned` calculation now includes first-deposit bonuses ($1 per `firstDepositBonusPaid: true`) on top of qualified payouts ($5 each).

### Verified
- ESLint clean
- Jest: 20 passed, 1 skipped (4 suites, same as before)
- Nodejs restart clean, schedulers register without error
- `/api/admin/referral-stats?key=...` returns expected JSON
- `/api/con5dldbuy.php` → 403 (cosmetic fix from earlier round still working)

### Files touched
- `/app/js/_index.js` — 5 edits: applyReferralCredit helper, low-balance scheduler, DynoPay hook, self-ref redirect, post-purchase nudges, Refer&Earn copy
- `/app/memory/PRD.md` — this entry

### Still pending
- 🔴 **P0 Fincra 401 fix** — still the highest-leverage revenue lever; needs key rotation in Railway env (user-side) + verify-token call
- 🟡 Set `BOT_USERNAME=NomadlyBot` in Railway (works via case-insensitive t.me but it's tech debt)
- 🟡 Deploy churn protection (branch protection / staging)
- 🟡 Other Tier 2/3 UX (#1 smart insufficient-balance wall, #2 dead-rail banner, #6 recoverable cart, #8 FX equivalents, #9 /deposit slash, #10 wizard)

---

## 2026-06-22 — Hosting Plan 3-Week RCA + 6 fixes shipped (current session)

User asked: "our hosting plan is having many issues these days compared to last 3 weeks." Investigation done → user picked fix set 1, 4, 5, 7, 8, 9. (Skipped #2 because the suspended accounts' plans were already migrated to new instance, #3 confirmed: `inviowelcoparty.de` was successfully created 06-06, ran the full 7-day plan, and expired naturally on 06-13 — no recovery needed.)

### Top finding from RCA — 🔴 P0 silent account killer
**Auto-renew price mismatch — 12 of 39 active cpanelAccounts (31%) were "suspended" in DB**.

`js/hosting-scheduler.js:getPlanPrice` looked up renewal price from hardcoded env map ($50/$75/$100). cpanelAccounts records the plan name but never persisted what the user actually paid. So a customer who bought a "Premium HostPanel (30 Days)" at a $30 promo got billed $75 at renewal, wallet short → "low funds" → silent suspension.

Worst overcharges:
- `everwise-secure.com` paid $30 → was renewing $100 (+$70) — bug FIXED
- `tdsecurity-portal.com` paid $30 → was renewing $75 (+$45) — bug FIXED
- `03seucre-auth.click` paid $30 → was renewing $75 (+$45) — bug FIXED

### Code changes shipped (commits expected on next auto-commit)
1. **`js/cpanel-auth.js storeCredentials`** — persists `priceUsd`, `renewalPriceUsd`, `priceLockedAt` on new cpanelAccount inserts.
2. **`js/cr-register-domain-&-create-cpanel.js`** — passes `priceUsd: info.hostingPrice` to `storeCredentials`.
3. **`js/hosting-scheduler.js getPlanPrice`** — now accepts an account object and prefers `account.renewalPriceUsd` over the env map. Falls through to the plan-name map for legacy accounts. All 8 call sites in `_index.js` + 3 in `hosting-scheduler.js` updated to pass the account doc.
4. **`js/_index.js` upgrade-flow** (line ~14046) — fixed "undefined" user-visible error. Now shows specific message + refund amount + admin notify when `unsuspendAccount` returns false or `changePackage` returns no error message.
5. **`js/_index.js` cancel-flow** (line ~13741) — when WHM `/removeacct` returns false, soft-delete in DB with `whmTerminatePending: true` + admin notify (instead of stranding the user with "❌ Failed to cancel"). Closes the loop that stranded chat `1130252395 / docxsndr.com`.
6. **`js/anti-red-service.js deployCFIPFix`** — SHA-256 hashed payload + per-account `lastCfIpFixSig + lastCfIpFixAt`. Skips both WHM writes if same content was deployed in last 7 days. Cuts the ~800-redundant-deploys-per-21-days noise by ~95%.
7. **`js/whm-service.js createAccount`** — HTTP 5xx now treated as `CPANEL_DOWN` (queued for retry, not surfaced to user). Disk-full ("No space left on device") matched specifically and fires an immediate admin Telegram DM with link to recovery doc. Would have caught the 06-05 issue 12-24h earlier.
8. **`js/whm-disk-monitor.js` (new)** — every-6h proactive WHM `accounts_summary` probe. Dedupes alerts (once per 24h), checks HTTP 5xx and account count vs threshold. Production-only (skipped in dev pod). Wired into `_index.js` startup.

### Production DB back-fill
- `scripts/backfill_renewal_prices.js` — idempotent dry-run / APPLY=1 modes.
- **APPLIED** on prod MongoDB: 44 of 47 cpanelAccounts price-locked. 3 skipped (no successful txn match — legacy `sechtsft.de`, `homepage-navyfed.com`, test account `primary-doctest.example`).
- Verification re-run shows 44 already-set, 0 to-set — idempotent ✅.

### Tests
- New: `tests/hosting-renewal-price-lock.test.js` — 7 cases covering the price-lock fix, legacy fallback, fractional prices, invalid values, null inputs.
- Full Jest suite: **27 passed + 1 skipped + 7 new = 34 pass / 1 skip** ✅.
- ESLint clean on `cpanel-auth.js`, `whm-service.js`, `whm-disk-monitor.js`, `_index.js`. Pre-existing empty-catch lint warnings in `anti-red-service.js`, `hosting-scheduler.js`, `cr-register-domain-&-create-cpanel.js` are NOT from this change (existed before).
- Smoke test: bot restart clean (`[HostingScheduler] Initialized`, `[WhmDiskMonitor] Skipping monitor — BOT_ENVIRONMENT != production` ✅), `/api/.env` → 403, `/api/con5dldbuy.php` → 403, `/api/sms-app/download/info` → 200.

### Files modified
- `/app/js/cpanel-auth.js`
- `/app/js/cr-register-domain-&-create-cpanel.js`
- `/app/js/hosting-scheduler.js`
- `/app/js/_index.js` (6 edits across upgrade, cancel, renew, monitor wiring, 7 getPlanPrice call sites)
- `/app/js/anti-red-service.js`
- `/app/js/whm-service.js`
- `/app/js/whm-disk-monitor.js` (new file, 132 lines)
- `/app/scripts/backfill_renewal_prices.js` (new)
- `/app/tests/hosting-renewal-price-lock.test.js` (new)
- `/app/HOSTING_3WEEK_RCA.md` (RCA from earlier this session)

### Still pending (not picked up this round)
- 🟠 **Domain price discrepancy** (carry-over from prior fork) — ConnectReseller silently falls back to OpenProvider with higher price; user is charged more than displayed.

---

## 2026-06-21 — Domain purchase flow UX (Tier 1 #3 + #4, Tier 3 #9)

User-selected three domain-purchase improvements after the previous batch.  All shipped + verified.

### #3 — Auto-default NS (drop NS picker from new-purchase flow)
- `/app/js/_index.js` `askDomainToUseWithShortener` handler (line ~18254)
- Previously: Yes-on-shortener → auto-Cloudflare; **No-on-shortener → showed a Default/Cloudflare/Custom NS picker** that 99% of users found confusing
- Now: **both Yes and No paths auto-default to Cloudflare** and go straight to `domain-pay`
- The NS picker (`domainNsSelect`) is still in the codebase as a safety net but no longer reachable from the new-purchase flow; power users can still change NS post-purchase via "🔧 DNS Management"
- Also fixed the `domain-pay` back-button — previously sent users to the now-unreachable NS picker when `shortener=false`; now always returns to the shortener question
- **Follow-up (same session, after user-raised concern)**: power users were temporarily losing the ability to set custom NS at registration. Re-added access via an opt-in **⚙️ Advanced (custom NS)** button on the shortener-question screen — 1 extra tap, routes to the existing NS picker. Localized en/fr/zh/hi.  95% majority still gets the simplified Yes/No → auto-Cloudflare path; power users who want custom NS at registration tap Advanced.

### #4 — Action buttons in post-purchase card
- `/app/js/_index.js` post-purchase cross-sell timer (line ~30400)
- Replaced the **text-only** cross-sell card from the previous batch with an **inline-keyboard** card carrying 3 single-tap shortcuts:
  - 🌐 Add hosting          → `callback_data: pd:host`
  - 🔧 Manage DNS           → `callback_data: pd:dns:<domain>`
  - 🔗 Launch shortener     → `callback_data: pd:short:<domain>`
- "Set up email" intentionally **omitted** per user request
- New callback handler added to the existing `bot.on('callback_query')` block (line ~4341)
  - Acks the callback
  - Reuses existing menu trigger words (`hostingDomainsRedirect`, `dnsManagement`, `activateDomainShortener`) via `bot.processUpdate({...message: {text: ...}})` to navigate
  - For shortener: auto-picks the just-purchased domain after a 1.5s delay so the user skips the domain-picker step
  - Localized button labels in en/fr/zh/hi
  - Soft fallback if `processUpdate` fails: tells the user which menu key to tap

#### #4 extension — Same pattern for VPS + Phone purchase (2026-06-21 same session)

**VPS post-purchase card** (`_index.js` ~31474, fires 10s after `vpsSuccessMsg`):
- 🌐 Add a domain     → `callback_data: pv:domain`
- 🛡️ Add hosting     → `callback_data: pv:hosting`
- 📞 Add cloud number → `callback_data: pv:phone`

**Phone post-purchase card** (`_index.js` `postActivationNudge` ~1500, fires 10s after the SIP-creds reply keyboard — doesn't compete with that primary nudge):
- 📧 Try BulkSMS       → `callback_data: pp:sms`
- 🌐 Add a domain     → `callback_data: pp:domain`
- 🖥️ Add a VPS        → `callback_data: pp:vps`

**Unified callback handler** (`bot.on('callback_query')` ~line 4373) now routes `pd:*`, `pv:*`, and `pp:*` prefixes to the matching menu trigger word with the same `processUpdate` pattern. All 9 trigger words verified to have matching handlers in the message dispatcher. No callback_data prefix collisions with existing inline keyboards.

#### Advanced NS button renamed
"⚙️ Advanced (custom NS)" → **"🔧 I have my own nameservers"** in all 4 locales. More discoverable wording — describes what the user has, not what's hiding behind the button.

#### Domain-pay back-button — path-aware
Added a `cameViaAdvancedNS: true` state flag on the Advanced opt-in path. The `domain-pay` back-button now checks this flag:
- If user took Advanced path → back returns to NS picker (preserves their selection context)
- If standard fast-path → back returns to shortener question (the existing simplified behaviour)
Flag is also explicitly cleared on the fast-path Yes/No branch so a previous Advanced choice doesn't bleed across new searches.

### #9 — Step indicator + ETA in domain-link status
- `/app/js/lang/en.js` lines 462 / 465
- **`t.domainLinking`** (sent after domain registration, before DNS records add) now reads:
  > ✅ Step 1 of 3 — Registered.
  > 🔄 Step 2 of 3 — Linking DNS now… *typically <60 seconds*
  > Full propagation can take up to 30 min in rare cases.
  > Live status: https://www.whatsmydns.net/#A/{domain}
- **`t.domainBought`** (final success message) now reads:
  > ✅ Step 3 of 3 — Done!
  > Your domain **{{domain}}** is fully registered and linked to your account.
  > *DNS propagation completes automatically — usually within 5 minutes, max 30. You can start using it now.* 🚀
- en updated; fr/zh/hi keep their existing copy (fallback works correctly)

### Verified
- ESLint clean on `_index.js` and `lang/en.js`
- Jest: 20 passed, 1 skipped (4 suites)
- Nodejs restart clean
- Edge-block (403), health (200), `/admin/referral-stats` (200) all still working
- Callback handler `pd:*` wired into existing `bot.on('callback_query')` flow

### Files touched
- `/app/js/_index.js` — 4 edits: shortener-Q auto-Cloudflare, callback handler, post-purchase inline keyboard, domain-pay back-button fix
- `/app/js/lang/en.js` — copy update for `t.domainLinking` + `t.domainBought`

### Net flow impact
Before: search → found card → shortener Q → **NS picker** → pay screen → wait (no step indicator) → success (plain text)
After: search → found card → shortener Q → pay screen → **3-step progress with ETA** → success with **3 single-tap action buttons**

Removed one screen, added decision-shortcuts at the end, made the wait feel shorter.

