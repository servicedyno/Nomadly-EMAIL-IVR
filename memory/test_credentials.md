# Test Credentials

This app uses Telegram bot authentication (chatId-based) — there is no email/password
login for the panel. Auth flows are exercised via the bot / dev endpoints.

## Sandbox runtime config (set up this session)
- Pod URL: https://f06fe503-30a9-4c4e-a049-cc26f354ea86.preview.emergentagent.com
- Env source of truth: /app/backend/.env  (/app/.env is a symlink to it)
- BOT_ENVIRONMENT = development  → uses TELEGRAM_BOT_TOKEN_DEV (safe dev bot, no live user traffic)
- SKIP_WEBHOOK_SYNC = true        → prod Telegram webhook preserved; infra-mutating jobs disabled
                                    (AntiRed worker upgrade + Cloudflare Discovery sync auto-skip in dev)
- MONGO_URL points to the PRODUCTION Railway Mongo (DB_NAME=test) — REAL data, treat as read-mostly
- SELF_URL / SELF_URL_PROD rewritten by setup-nodejs.sh to <pod>/api
- Node bot Express :5000  |  FastAPI :8001 (proxies /api/* → node)  |  React :3000
- Start Node bot: `bash /app/scripts/setup-nodejs.sh` (supervisor program: nodejs)

## Keys for diagnostic / admin endpoints
- Admin key for diagnostic endpoints: `o/Qb8ArGahlquhCQ` (first 16 chars of SESSION_SECRET)
- TELEGRAM_ADMIN_CHAT_ID: 5590563715
- Dev-only endpoints (/api/dev/*) are ENABLED because BOT_ENVIRONMENT=development
  (they return 404 when BOT_ENVIRONMENT=production).

## Telegram dev bot
- Dev bot token is loaded from TELEGRAM_BOT_TOKEN_DEV in /app/backend/.env
- Message the dev bot to exercise flows; production users are unaffected.

## Health checks
- http://127.0.0.1:5000/api/health  → {status: healthy, database: connected}
- FastAPI proxy: <pod>/api/health
