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
  `REACT_APP_BACKEND_URL=https://vault-setup-8.preview.emergentagent.com` (current pod; earlier forks had a different preview host — always trust the live value in frontend/.env, not older docs)

## Admin panel
- Frontend admin dashboard is open (no login) at the pod root URL.

## Reseller API (sandbox, local Mongo `test`)
- Key label `golden e2e sandbox key` (`resellerApiKeys._id = e2e-golden-key`)
- `X-API-Key: nmdly_e2e_51573577f5db956c5c0cb039` (or `Authorization: Bearer ...`)
- Base: `${REACT_APP_BACKEND_URL}/api/reseller/v1` — e.g. `GET /rdp/plans`, `POST /rdp`
