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

## Admin panel
- Frontend admin dashboard is open (no login) at the pod root URL.
