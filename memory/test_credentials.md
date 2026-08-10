# Test Credentials

This app uses Telegram bot authentication (chatId-based) — there is no email/password
login for the panel. Auth flows are exercised via the bot / dev endpoints.

## Sandbox runtime config (re-bootstrapped 2026-08-10 — fresh pod)
- Pod URL: https://be242688-a29d-420d-844e-e7b6bc5d0595.preview.emergentagent.com
- Env source of truth: /app/backend/.env  (/app/.env is a symlink to it)
- BOT_ENVIRONMENT = development  → uses TELEGRAM_BOT_TOKEN_DEV (safe dev bot, no live user traffic)
- SKIP_WEBHOOK_SYNC = true        → prod Telegram webhook preserved; infra-mutating jobs disabled
                                    (AntiRed worker upgrade + Cloudflare Discovery sync auto-skip in dev)
- MONGO_URL points to the PRODUCTION Railway Mongo (DB_NAME=test) — REAL data, treat as read-mostly
- SELF_URL / SELF_URL_PROD rewritten by setup-nodejs.sh to <pod>/api
- Node bot Express :5000  |  FastAPI :8001 (proxies /api/* → node)  |  React :3000
- Start Node bot: `bash /app/scripts/setup-nodejs.sh` (supervisor program: nodejs)

## Railway production access (CONFIRMED WORKING 2026-08-09)
- `API_KEY_RAILWAY` in backend/.env is a **PROJECT-scoped token** — use header `Project-Access-Token: <API_KEY_RAILWAY>` (NOT `Authorization: Bearer`, which returns "Not Authorized" for account-scoped `me`/`projects` queries).
- Endpoint: `POST https://backboard.railway.app/graphql/v2`
- Project "New Hosting": projectId `c23ac3d9-51c5-4242-8776-eed4e3801abe`, envId (production) `889fd56a-720a-4020-884c-034784992666`, main bot serviceId (Nomadly-EMAIL-IVR) `b9c4ad64-7667-4dd3-8b9a-3867ede47885`.
- Verified `projectToken` query returns those IDs; `deployments`/`deploymentLogs(deploymentId, limit, filter)` work. Filter by chatId / "Azure" / etc.

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
- Verified 2026-08-09: node:5000, fastapi:8001, external <pod>/api/health + /api/sms-app/download/info all 200; frontend :3000 → 200 ("HostBay | Hosting Panel")
