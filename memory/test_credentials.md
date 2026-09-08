# Test Credentials

## Reseller REST API (js/reseller-api.js)
- Base (external): {REACT_APP_BACKEND_URL}/api/reseller/v1
- Base (local):    http://127.0.0.1:5000/reseller/v1
- API key (Bearer / X-API-Key): rsk_live_cdc3f785ac3cfd813c6143d7813e1a59cc15fc42327ab736
- Owner chatId: 5590563715 (@onarrival1 reseller)
- Wallet balance (bot wallet, usdIn-usdOut): $5.00
- Mode on this pod: dry_run (SKIP_WEBHOOK_SYNC=true — no real provisioning/charges)

## Notes
- This pod shares the PRODUCTION Railway MongoDB. Do NOT enable RESELLER_API_LIVE here.
- Telegram webhook is left pointing at production (SKIP_WEBHOOK_SYNC=true).
