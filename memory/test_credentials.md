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
- Frontend/preview: https://multi-api-deploy.preview.emergentagent.com
- Backend API base (proxied to Node :5000): <preview>/api
- Panel domain: panel.smadavhost.com | SIP domain: sip.smadavspeech.com

## Architecture
- Frontend (React, :3000) → FastAPI (:8001) → proxy → Node Express (:5000) → MongoDB (live).
- All destructive background jobs (billing reconcilers, protection heartbeat, NS retry,
  CF discovery sync, phone health monitor) are DISABLED in sandbox mode.
- Note: webhook-crond (supervisor) is an Emergent platform cron daemon (FATAL: no cron in base image); it is NOT part of this app and does not affect functionality.
