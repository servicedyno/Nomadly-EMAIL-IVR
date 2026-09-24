# Test / Setup Credentials

## Vault (secrets restore)
- Vault file: `memory/nomadly.vault.enc`
- Unlock: `VAULT_PASSWORD='Katiekendra123@' bash scripts/vault.sh unlock`
- Vault password: `Katiekendra123@`
- Unlocking restores `/app/backend/.env` (all app/API credentials) and refreshes the `/app/.env` symlink.

## Environment mode (this preview pod)
- Configured as DEVELOPMENT sandbox: `BOT_ENVIRONMENT=development`, `SKIP_WEBHOOK_SYNC=true`
- Uses `TELEGRAM_BOT_TOKEN_DEV` (never the production bot on a preview pod)
- `SELF_URL` / `SELF_URL_DEV` point to the current pod `/api`; `SELF_URL_PROD` kept as the Railway URL reference.

## DATABASE ISOLATION (IMPORTANT — 2026 setup)
- This pod's `MONGO_URL` is intentionally repointed to the LOCAL MongoDB: `mongodb://localhost:27017`.
  Reason: the vault's real `MONGO_URL` points at LIVE PRODUCTION (`roundhouse.proxy.rlwy.net:52715`).
  Booting the Node bot against prod immediately resumed a real bulk-call campaign and placed live
  Twilio calls, plus ran prod maintenance jobs (phone/hosting schedulers, DNS healer, protection
  enforcer, balance monitor, email-blast queue). Isolating to local Mongo makes the sandbox safe:
  empty DB ⇒ no campaigns to resume, no numbers/domains/users to act on ⇒ zero prod side-effects.
- The original production `MONGO_URL` is preserved as a comment (`ORIGINAL_PROD_MONGO_URL=`) in
  `/app/backend/.env` and remains inside the encrypted vault.
- To go back to LIVE PRODUCTION data (only if you truly intend to, and Railway prod is stopped):
  restore the prod `MONGO_URL` line and restart `backend` + `nodejs`. Before doing so, gate every
  outbound/mutating startup job behind `SKIP_WEBHOOK_SYNC=true`, otherwise real calls/emails/renewals
  will fire again.

## Frontend env (recreated during setup)
- `/app/frontend/.env` present with:
  `REACT_APP_BACKEND_URL=https://rdp-order-refactor.preview.emergentagent.com` (current pod; earlier forks had a different preview host — always trust the live value in frontend/.env, not older docs)

## Admin panel
- Frontend admin dashboard is open (no login) at the pod root URL.

## Reseller API (sandbox, local Mongo `test`)
- Key label `golden e2e sandbox key` (`resellerApiKeys._id = e2e-golden-key`)
- `X-API-Key: nmdly_e2e_51573577f5db956c5c0cb039` (or `Authorization: Bearer ...`)
- Base: `${REACT_APP_BACKEND_URL}/api/reseller/v1` — e.g. `GET /rdp/plans`, `POST /rdp`
- Re-seed on a fresh pod: `node scripts/seed_rdp_reseller_e2e.js` (idempotent — upserts the key + owner
  wallet $1000 AND the `e2e-rdp-1` RDP record below). The older `seed_e2e_sandbox.js` seeds only the key+wallet.
- Sandbox owned RDP record for the key owner: `vpsPlansOf._id = "e2e-rdp-1"` (provider `digitalocean-rdp`,
  instanceId `rdp-11111111-2222-3333-4444-555555555555`, os_id `ws2022`). Used to exercise the new
  `POST /rdp/:id/password-reset`, `POST /rdp/:id/reinstall`, and `agent_online` on `GET /rdp/:id`
  in dry-run mode (SKIP_WEBHOOK_SYNC=true ⇒ isLive()=false ⇒ every mutating call returns mode:"dry_run").

## RDP golden-image admin endpoints (sandbox)
- `GET/POST ${REACT_APP_BACKEND_URL}/api/admin/rdp-golden/{status|build|sync|transfer|cancel}?key=<first 16 chars of SESSION_SECRET in backend/.env>` (URL-encode the key)
- CLI wrappers: `node js/ops/rdp_golden_build.js status|watch|build|transfer|cancel`, E2E: `node js/ops/rdp_golden_e2e.js --os ws2019|ws2022|ws2025 --region US` (creates + destroys one real droplet)

## Telegram bot simulation harness (sandbox only, added 2026-09-23)
- `backend/.env` has `TELEGRAM_API_BASE_URL=http://127.0.0.1:5099` → the bot talks to the local mock Bot API
  `js/tests/mock_telegram_api.js` instead of Telegram (nothing reaches real users). Start it if not running:
  `nohup node js/tests/mock_telegram_api.js > /tmp/mock_tg.log 2>&1 &`  (health: `GET http://127.0.0.1:5099/_health`)
- Drive the bot: `POST http://localhost:5000/telegram/webhook` with a Telegram update JSON
  (`{"update_id":1,"message":{"message_id":1,"date":<unix>,"chat":{"id":777000123,"type":"private","first_name":"Sim"},"from":{"id":777000123,"is_bot":false,"first_name":"Sim","username":"sim_user"},"text":"<button label or text>"}}`).
- Read replies: `GET http://127.0.0.1:5099/_calls?chat_id=777000123&since=<epoch_ms>&method=sendMessage` → `[{ts,method,chat_id,text,buttons[],reply_markup}]`.
  `DELETE /_calls` clears the log. Reply-keyboard buttons are "tapped" by sending their exact label as the message text.
- Sim user chat_id `777000123`: onboarded (English), wallet `walletOf._id="777000123"` seeded usdIn=500.
- Local `VPS_RDP_PROVIDER="digitalocean-rdp"` (same as production after 2026-09-23) → bot RDP flow = DigitalOcean golden images.
