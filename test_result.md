# Test Results

## User Problem Statement
Nomadly - Telegram Bot + Cloud Phone Platform.

### Issue Report (May 25, 2026) — @Icemangod6 (chatId 8414700715, Golden plan)
1. Bought `digital-businesscibc.com` from the bot then tried to add as cPanel addon — NS never updated for 3 days
2. Golden plan user but cannot manage Captcha from hosting panel (all addons show "CAPTCHA N/A")

## Investigation Results (Icemangod6)

### Issue 1 — NS pending for 3 days
- OP NS at registrar: ✅ correctly set to `anderson.ns.cloudflare.com, leanna.ns.cloudflare.com` since May 22 13:02 UTC
- `.com` TLD NS: ✅ delegated to Cloudflare for 3 days
- **Root cause:** stale DNSSEC DS record at `.com` TLD (`316 8 2 8c64988e…`). OP randomly enabled `signedDelegation` at registration. After NS moved to Cloudflare (which doesn't sign with the old key), every validating resolver returned **SERVFAIL** → domain appeared "down" everywhere.

### Issue 2 — Captcha N/A for all addon domains
- Frontend gates captcha on `info.hasCloudflare` (backend = `cfZoneId && nameserverType==='cloudflare'`)
- `registeredDomains` only had a doc for the main hosting domain — none of the 6 addon domains had cfZoneId stored, despite all having live CF zones + worker routes deployed
- **Root cause:** `add-enhanced` route's `isOwnDomain` check is broken — it queried `domainsOf` by `{_id: domain, chatId}` but the schema is `{_id: chatId, "domain@com": true}`. The check always returned false, so the `registeredDomains` write was skipped. Same broken pattern in `ns-status`. Then `updateAllNameservers` downgraded the NS type to `'custom'` (because `meta.cfZoneId` was missing) when the user later tried to fix it manually.

## Fixes Applied

### Production hotfix (Mongo + OP, applied live)
- Disabled DNSSEC at OP for `digital-businesscibc.com` (`dnssec: unsigned`) — DS withdrawn from `.com` TLD within minutes, `8.8.8.8` now resolves OK
- Backfilled all 7 `registeredDomains` docs with `val.cfZoneId`, `val.nameserverType: 'cloudflare'`, `val.chatId` so captcha panel works

### Code fixes (for everyone)
- **`js/cpanel-routes.js`**
  - New helper `isDomainOwnedByChat(db, domain, chatId)` understands both legacy + new ownership schemas (legacy `{_id: chatId, "domain@com": true}`, new `{_id: domain, chatId}`, and `registeredDomains.val.chatId`)
  - `add-enhanced` and `ns-status` now use the helper
  - `add-enhanced` now **unconditionally** persists `cfZoneId`, `nameserverType: 'cloudflare'`, and `chatId` into `registeredDomains` after zone resolution AND stamps the legacy `domainsOf` doc
- **`js/op-service.js`** `updateNameservers`: after a successful NS update, if new NS are non-OP and DNSSEC is currently enabled at OP, automatically call `disableDnssec()` (best-effort, never breaks the NS update)
- **`js/domain-service.js`** `updateAllNameservers`: if NS target contains `cloudflare.com` and `meta.cfZoneId` is missing, looks up the CF zone by name and uses it instead of downgrading to `'custom'`; persists `cfZoneId` on the resulting record

## Testing Protocol

**Communication protocol with testing sub-agent:**
- Always update this file before invoking any testing agent
- Document test scenarios and expected outcomes
- Record test results and any failures

**Backend testing:** Use `deep_testing_backend_v2`
**Frontend testing:** Use `auto_frontend_testing_agent` (only with user permission)

## Incorporate User Feedback
- Follow user's specific requests
- Do not make changes not requested
- Ask before making minor fixes
