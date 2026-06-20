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
