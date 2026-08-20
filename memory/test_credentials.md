# Test Credentials

This app uses Telegram bot authentication (chatId-based) — there is no email/password
login for the panel. Auth flows are exercised via the bot / dev endpoints.

## Sandbox runtime config (re-bootstrapped 2026-08-20 — NEW fresh pod, creds re-supplied by user)
- Pod URL: https://9580a447-7f59-44aa-bde3-723cb22d03ff.preview.emergentagent.com
- Dev Telegram bot webhook (token TELEGRAM_BOT_TOKEN_DEV = 6597817067 @Nomadlytestbot) SET to <pod>/api/telegram/webhook (verified ok)
- PROD bot (6292288341) webhook confirmed still on Railway (https://nomadly-email-ivr-production.up.railway.app/telegram/webhook) — UNTOUCHED
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
- Re-verified 2026-08-13 on the new pod: node :5000 healthy/DB connected, FastAPI :8001 healthy,
  external <pod>/api/health + /api/sms-app/download/info 200, frontend :3000 → 200,
  /api/dev/ai-support-health pass:true, /api/admin/cnam-circuit all 3 providers CLOSED,
  /api/admin/dns-heal-status reads live prod data. UI: / (admin dashboard) + /phone/test both render.
- NOTE: uvicorn `--reload` keeps the supervisor parent RUNNING even when the app import fails.
  If /api/* returns 502 but `supervisorctl status backend` says RUNNING, the import crashed —
  `sudo supervisorctl restart backend` (this happens when backend/.env is created AFTER first boot).

## Credential health audit (read-only probes, 2026-08-13)
LIVE (13): Telnyx (balance $9.53 — LOW, credit_limit $0), Twilio (active, "Speechcue"),
Cloudflare (expressdrop247@gmail.com), OpenExchangeRates (1 USD = 1361.86 NGN), OpenAI (124 models),
DigitalOcean (active, 10-droplet limit), Railway project token, WHM via https://whm-api.hostbay.io
(v11.136.0.33), OpenProvider (token issued), ConnectReseller, Azure (token issued),
Brevo SMTP relay smtp-relay.brevo.com:587 (AUTH accepted), DynoPay (auth accepted).
BROKEN (3):
- BREVO_API_KEY → 401 "API Key is not enabled". Only affects inbound-SMS→email forwarding
  (js/sms-service.js forwardSmsToEmail via api.brevo.com/v3/smtp/email). Main transactional
  email is unaffected because it uses the SMTP relay creds (MAIL_AUTH_*), which ARE live.
  Fix: re-enable/regenerate the key in Brevo → SMTP & API → API Keys.
- VULTR_API_KEY → 401 Unauthorized. Likely Vultr "Access Control" IP allow-list (the key only
  accepts calls from whitelisted subnets, e.g. Railway's egress IP, not this pod).
  Non-blocking: VPS_DEFAULT_PROVIDER=digitalocean.
- Contabo OAuth → "Invalid client credentials". Non-blocking: VPS_CONTABO_FALLBACK_ENABLED=false.
IMPORTANT: direct WHM probes to https://68.183.77.106:2087 time out BY DESIGN (origin IP/port
lockdown). Always call WHM through WHM_API_URL (Cloudflare Tunnel) as anti-red-service.js does.

## Telegram webhook state (verified 2026-08-13)
- PROD bot (6292288341) webhook = https://nomadly-email-ivr-production.up.railway.app/telegram/webhook
  → UNTOUCHED by this sandbox (SKIP_WEBHOOK_SYNC=true worked). Never overwrite it from a dev pod.
- DEV bot = @Nomadlytestbot (id 6597817067). Its webhook URL is EMPTY, so the dev bot receives
  nothing and messaging it does nothing. To exercise bot flows from this pod, point ONLY the dev
  bot at this pod:
    curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN_DEV>/setWebhook?url=<pod>/api/telegram/webhook"
  (Safe: separate token from prod. Caveat: it writes to the LIVE production Mongo.)
