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


## Railway Log Analysis & Fixes (May 26, 2026)

### Issues identified from production Railway logs (~9.5h window)
1. **P0 — Twilio AU toll-free purchase failed 3× for @kathyserious (8690991604)** — stale cached Twilio Address SID (`AD17040132…`) didn't exist in Twilio account; refund worked but user got infinite-loop UX and 3 orphaned draft bundles.
2. **P0 — Connect Reseller 17h+ outage** — API 401 + browser-automation login rejecting credentials; log noise + admin not re-paged.
3. **P1 — Openprovider 500 on `itsonlytravel.com` nameservers** — single transient 5xx, no retry; user message contained broken `support.registrar.eu` URL.
4. **P2 — UX bug: stale "✅ Yes" presses after failure** caused "Unrecognized message → main menu" loops.
5. **AI Support** — auto-replied even when user typed "human agent"; escalation alert lacked recent-error context.

### Fixes Applied (code)
- **`js/_index.js`** (cached-address bundle catch ~9887):
  - Detect `Address … does not exist` errors via regex
  - Invalidate stale cache (`$unset val.twilioAddresses.<countryCode>` in `phoneNumbersOf`)
  - Best-effort delete the orphaned draft bundle in Twilio
  - Localized user-friendly message ("Address on file is no longer valid — please re-enter")
  - `recordUserError()` so AI Support has context if user opens a ticket
- **`js/_index.js`** (fresh-address bundle catch ~22987): same orphan-bundle cleanup + `recordUserError`
- **`js/_index.js`** (unrecognized-message handler ~28534): silently ack stale Yes/No/Cancel presses when `action === 'none'` (no menu reset spam)
- **`js/_index.js`** (support handler ~11080): detect human-request patterns (EN/FR/ZH/HI) → suppress AI auto-reply, hard escalate with `reason=human_requested`
- **`js/_index.js`** (`recordEscalation` ~1620): auto-attach last 5 user-facing errors (30min window) to admin escalation alert
- **`js/_index.js`** (loadData ~2900): added `[OrphanBundles]` sweeper — every 6h, deletes Twilio draft bundles >24h old
- **`js/twilio-service.js`**: added `deleteBundle(sid)` + `cleanupOrphanDrafts(olderThanMs)`
- **`js/sanitize-provider.js`**: strip broken `support.registrar.eu` / `*.registrar.eu` URL artifacts that resulted from openprovider→registrar string substitution; clean up leftover `(see )` parentheses
- **`js/op-service.js`** (`_sendNsUpdate`): retry on transient 5xx with 1.5s + 4s exponential backoff (was only retrying on timeouts)
- **`js/cr-auto-whitelist.js`**: suppress repeated "IP needs whitelisting" log spam after first retry; cap retry escalation — after 24 retries (~17h+) re-page admin and slow to 6h cadence

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
