# Test Credentials

This app uses Telegram bot authentication (chatId-based) — there is no email/password
login for the panel. Auth flows are exercised via the bot / dev endpoints.

## Sandbox runtime config (re-bootstrapped on NEW fresh pod 2026-09-08b, creds re-supplied by user)
- Pod URL: https://58c88981-d657-4261-a0ef-d0bf97774064.preview.emergentagent.com
  (previous pods: credential-staging.preview..., api-integration-hub-55.preview..., config-deploy-17.preview..., 84449d7e-...preview... — decommissioned)
- Dev Telegram bot webhook (token TELEGRAM_BOT_TOKEN_DEV = 6597817067 @Nomadlytestbot) SET to
  https://58c88981-d657-4261-a0ef-d0bf97774064.preview.emergentagent.com/api/telegram/webhook (verified ok, 0 pending)
- NOTE: user's credential dump had BOT_ENVIRONMENT="production" — deliberately OVERRIDDEN to
  `development` + `SKIP_WEBHOOK_SYNC=true` in backend/.env per README "Critical Safety Rules".
- Extra vars added beyond the dump: SELF_URL_DEV, SKIP_WEBHOOK_SYNC, PORT=5000, CORS_ORIGINS=*,
  RAILWAY_PROJECT_TOKEN (=API_KEY_RAILWAY), RAILWAY_PROJECT_ID / RAILWAY_ENVIRONMENT_ID / RAILWAY_SERVICE_ID (from README).
- frontend/.env: REACT_APP_BACKEND_URL=<pod>, WDS_SOCKET_PORT=443, DISABLE_ESLINT_PLUGIN=true
- Boot-time warning seen (pre-existing, non-blocking): `[PhoneMonitor] Error checking number +18883304418: 401`
- Verified this bootstrap: node:5000 + FastAPI:8001 + external <pod>/api/health all healthy/DB connected;
  frontend :3000 → "HostBay | Hosting Panel"; PROD bot (6292288341) webhook confirmed STILL on Railway (0 pending), UNTOUCHED.
- PROD bot (6292288341) webhook confirmed still on Railway (https://nomadly-email-ivr-production.up.railway.app/telegram/webhook) — UNTOUCHED
- Env source of truth: /app/backend/.env  (/app/.env is a symlink to it)
- BOT_ENVIRONMENT = development  → uses TELEGRAM_BOT_TOKEN_DEV (safe dev bot, no live user traffic)
- SKIP_WEBHOOK_SYNC = true        → prod Telegram webhook preserved; infra-mutating jobs disabled
                                    (AntiRed worker upgrade + Cloudflare Discovery sync auto-skip in dev)
- MONGO_URL points to the PRODUCTION Railway Mongo (DB_NAME=test) — REAL data, treat as read-mostly
- SELF_URL / SELF_URL_PROD rewritten by setup-nodejs.sh to <pod>/api
- Node bot Express :5000  |  FastAPI :8001 (proxies /api/* → node)  |  React :3000
- Start Node bot: `bash /app/scripts/setup-nodejs.sh` (supervisor program: nodejs)

## Panel Test Account (created for frontend testing)
- Username: nbayftest
- PIN: 241743
- Domain: testingbays.sbs
- Plan: Golden-Anti-Red-HostPanel-1-Month
- WHM Host: 68.183.77.106
- Login URL: https://credential-staging.preview.emergentagent.com/panel
- NOTE: User-level cPanel auth is broken for this account. All API calls work via WHM-root fallback.
- Password was rotated via WHM /passwd to force cPanel auth recognition (2026-08-30).
- Existing subdomains: shop, blog, api, dev (all under testingbays.sbs with public_html/<name> docroot)

## Railway production access (CONFIRMED WORKING 2026-08-09)
- `API_KEY_RAILWAY` in backend/.env is a **PROJECT-scoped token** — use header `Project-Access-Token: <API_KEY_RAILWAY>` (NOT `Authorization: Bearer`, which returns "Not Authorized" for account-scoped `me`/`projects` queries).
- Endpoint: `POST https://backboard.railway.app/graphql/v2`
- Project "New Hosting": projectId `c23ac3d9-51c5-4242-8776-eed4e3801abe`, envId (production) `889fd56a-720a-4020-884c-034784992666`, main bot serviceId (Nomadly-EMAIL-IVR) `b9c4ad64-7667-4dd3-8b9a-3867ede47885`.
- Verified `projectToken` query returns those IDs; `deployments`/`deploymentLogs(deploymentId, limit, filter)` work. Filter by chatId / "Azure" / etc.

## Keys for diagnostic / admin endpoints
- Admin key for diagnostic endpoints: `o/Qb8ArGahlquhCQ` (first 16 chars of SESSION_SECRET)

## Reseller API (added 2026-09-08)
- Base: {REACT_APP_BACKEND_URL}/api/reseller/v1  (Node route /reseller/v1)
- API key (bound to @onarrival1 / chatId 5590563715, wallet $5.00) — send as `Authorization: Bearer <key>` or `X-API-Key: <key>`:
    rsk_live_cdc3f785ac3cfd813c6143d7813e1a59cc15fc42327ab736
- Re-mint / rotate: `node /app/scripts/seed_reseller_key.js --rotate`  (raw key printed once; only sha256 stored in `resellerApiKeys`)
- Mode: dry_run on this sandbox (SKIP_WEBHOOK_SYNC=true). Go live on prod pod with RESELLER_API_LIVE=true.
- TELEGRAM_ADMIN_CHAT_ID: 5590563715
- Dev-only endpoints (/api/dev/*) are ENABLED because BOT_ENVIRONMENT=development
  (they return 404 when BOT_ENVIRONMENT=production).

## Health checks
- http://127.0.0.1:5000/api/health  → {status: healthy, database: connected}
- FastAPI proxy: <pod>/api/health
