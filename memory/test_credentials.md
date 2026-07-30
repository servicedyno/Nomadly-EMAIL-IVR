# Test Credentials

This app uses Telegram bot authentication (chatId-based) — there is no email/password
login for the panel. Auth flows are exercised via the bot / dev endpoints.

## Sandbox runtime config (set up this session)
- Pod URL: https://96f02a4a-6484-4572-a99c-06ca36b38ae6.preview.emergentagent.com
- BOT_ENVIRONMENT = development  → uses TELEGRAM_BOT_TOKEN_DEV (safe dev bot, no live traffic)
- SKIP_WEBHOOK_SYNC = true        → prod Telegram webhook preserved; infra-mutating jobs disabled
- MONGO_URL points to the PRODUCTION Railway Mongo (DB_NAME=test) — real data, read-mostly
- SELF_URL / SELF_URL_DEV auto-updated by setup-nodejs.sh to point at this pod's `/api`
- SELF_URL_PROD kept at Railway prod URL for reference; NOT used while BOT_ENVIRONMENT=development
- Node bot Express :5000  |  FastAPI :8001 (proxies /api/* → node)  |  React :3000

## Keys for diagnostic / admin endpoints
- Admin key for diagnostic endpoints: `o/Qb8ArGahlquhCQ` (first 16 chars of SESSION_SECRET)
- TELEGRAM_ADMIN_CHAT_ID: 5590563715
- Dev-only endpoints (/api/dev/*) are ENABLED because BOT_ENVIRONMENT=development
  (they return 404 when BOT_ENVIRONMENT=production).

## Telegram dev bot
- Dev bot token is loaded from TELEGRAM_BOT_TOKEN_DEV in /app/backend/.env
- Message the dev bot to exercise flows; production users are unaffected.
