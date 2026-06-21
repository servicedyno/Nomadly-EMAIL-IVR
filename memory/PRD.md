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
- `/app/backend/.env` — full user-provided env list + safety overrides (`BOT_ENVIRONMENT=development`, `SKIP_WEBHOOK_SYNC=true`); `SELF_URL`/`SELF_URL_PROD` rewritten by setup script to `https://test-bot-deploy.preview.emergentagent.com/api`
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
