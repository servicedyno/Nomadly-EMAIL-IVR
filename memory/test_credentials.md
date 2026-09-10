# Test Credentials — Smadav/Nomadly Platform

## Run mode (this Emergent pod)
- Mode: **Safe Dev Sandbox** (per user choice)
- BOT_ENVIRONMENT=development
- SKIP_WEBHOOK_SYNC=true  → production Telegram webhook is PRESERVED (points to https://smadav.up.railway.app/telegram/webhook), NOT this pod
- Database: **LIVE Railway production MongoDB** (MONGO_URL → sakura.proxy.rlwy.net, DB_NAME=smadav)

## Web dashboards / panels
- Sales & Profit Dashboard password: `Nomadly123@`  (env: SALES_DASHBOARD_PASSWORD)

## Telegram
- Bot username: `@smadavv_bot`
- Admin chat id: `5590563715`  (env: TELEGRAM_ADMIN_CHAT_ID)
- Bot token (dev==prod): 8822506525:... (env: TELEGRAM_BOT_TOKEN_PROD / _DEV)

## URLs
- Frontend/preview: https://8c5fc3ec-c82f-49de-82f7-0941dc4f4ecd.preview.emergentagent.com
- Backend API base (proxied to Node :5000): <preview>/api
- Re-provisioned 2026-09-11 (WhiteLabel branch): fresh backend/.env + frontend/.env from user creds (BOT_ENVIRONMENT=development, SKIP_WEBHOOK_SYNC=true overrides); ran scripts/setup-nodejs.sh; restarted backend (had crashed on boot before .env existed — KeyError MONGO_URL — fixed by restart). All services verified: nodejs RUNNING, external /api/health healthy + DB connected, frontend title "SmadavHost | Hosting Panel".
- Panel domain: panel.smadavhost.com | SIP domain: sip.smadavspeech.com

## Panel (cPanel management UI) testing
- No live customer panel credentials are stored here. cPanel/WHM operations run
  against the LIVE production WHM (68.183.77.106) + live customer accounts.
- DO NOT run destructive cPanel ops (add/delete subdomain/domain, MySQL
  create/delete, file rename/move) against real accounts from this pod.

### Bulk-Subdomain feature test — VERIFIED then TORN DOWN (2026-08-30)
- An isolated throwaway cPanel account (btpk8j / btpk8jbulk.com) was created on
  the WHM only to verify the Bulk Subdomain Import UI end-to-end (4/4 subdomains
  created, display-name doubling fix confirmed), then DELETED via
  /tmp/teardown_bulk_test_account.js. No artifacts remain on the WHM or DB.
- To re-run this E2E test later, recreate the account:
    set -a; source /app/backend/.env; set +a; NODE_PATH=/app/node_modules node /tmp/setup_bulk_test_account.js
  (prints fresh PANEL_USERNAME / PANEL_PIN / PRIMARY_DOMAIN), then tear down with
    NODE_PATH=/app/node_modules node /tmp/teardown_bulk_test_account.js

- The cPanel "broken user-auth" WHM-root fallback fix is verified with the
  fully-mocked jest suite: `cd /app && npx jest tests/cpanel-auth-broken-fallback.test.js`
  (nock — no live cPanel/WHM/DB calls).



## Architecture
- Frontend (React, :3000) → FastAPI (:8001) → proxy → Node Express (:5000) → MongoDB (live).
- All destructive background jobs (billing reconcilers, protection heartbeat, NS retry,
  CF discovery sync, phone health monitor) are DISABLED in sandbox mode.
- Note: webhook-crond (supervisor) is an Emergent platform cron daemon (FATAL: no cron in base image); it is NOT part of this app and does not affect functionality.
