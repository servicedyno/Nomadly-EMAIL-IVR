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
