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

### CRITICAL Re-investigation (Round 2)
The "stale cached address" hypothesis from round 1 was a SYMPTOM, not the root cause. New Railway logs (08:43–08:46 UTC) showed @kathyserious tried again with my fix:
1. Cached address invalidated ✓
2. User entered NEW address `9 Cobram Street, Tarneit, VICtoria, 3029` → Twilio created **fresh** address `AD980e785e4b4d28d55b150c7b317e4711`
3. Bot called `createSupportingDocument` referencing that brand-new address SID
4. Twilio: **"Address AD980e785e4b4d28d55b150c7b317e4711 does not exist for account AC754fb3aedb907b12c79a7d31b67937a0"**

### True Root Cause: Cross-account Twilio resource mismatch
The CloudPhone purchase flow created the **Address on the user's Twilio sub-account** (via `requireSubClient(subSid, subToken)`) but then created the **Bundle / End-User / Supporting Document on the main account** (`getClient()` with no sub). Twilio resources are account-scoped — addresses in a sub-account are invisible from the main account, hence the perpetual "does not exist for account" error.

### Fix Applied (Round 2)
- **`js/twilio-service.js`** — added optional `subSid, subToken` params to:
  - `createEndUser`, `createBundle`, `createSupportingDocument`, `addBundleItem`, `submitBundle`, `getBundleStatus`, `deleteBundle`
  - When provided, uses `getSubClient(subSid, subToken)` matching the address's account scope
- **`js/_index.js`** (CloudPhone fresh-address flow ~22950–23080):
  - All regulatory ops now pass `subSidForAddr, subTokenForAddr` (sub-account creds collected at start of flow)
- **`js/_index.js`** (CloudPhone cached-address flow ~9783–9920):
  - Reads sub-account creds from `phoneNumbersOf` (twilioSubAccountSid/Token) before regulatory ops
  - If no sub-creds found, refunds + clears cache + asks user to retry (no more silent loop)
- **`js/_index.js`** (BundleChecker, PendingDetail, Refresh Status handlers):
  - All `getBundleStatus` calls now fetch sub-account creds first and pass them through
- **`js/_index.js`** (orphan cleanup in both catch blocks):
  - `deleteBundle` calls now use the same sub-account creds the bundle was created with

### Round 1 fixes (still active)

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
- **`js/sanitize-provider.js`**: complete rewrite of URL/hostname/name scrubbing:
  - All provider URLs stripped FIRST (before name substitution) — catches the original `support.openprovider.eu` so it can never morph into a broken `support.registrar.eu` link
  - Handles all subdomains (`api.`, `support.`, `login.`, `docs.`, `www.`) and 13 TLDs (`.eu .com .net .io .co .nl .be .de .uk .fr .us .ca .app`)
  - Bare hostnames (no scheme) like `api.openprovider.eu` → "our provider"
  - Provider nameserver hostnames (`ns1.openprovider.nl`, `ns3.openprovider.eu`, etc.) → "default nameserver" — scrubbed BEFORE name substitution so they don't morph into `ns1.registrar.nl`
  - Bracketed/parenthesized leftovers (`(see )`, `[ ]`, `visit:`) cleaned up
  - Stray punctuation collapse + double-space cleanup
  - Empty-output fallback ("Service temporarily unavailable")
  - **Unit tests** added: `js/__tests__/sanitize-provider.test.js` — 29 cases, all pass. Run with: `node js/__tests__/sanitize-provider.test.js`
- **`js/op-service.js`** (`_sendNsUpdate`): retry on transient 5xx with 1.5s + 4s exponential backoff (was only retrying on timeouts)
- **`js/cr-auto-whitelist.js`**: suppress repeated "IP needs whitelisting" log spam after first retry; cap retry escalation — after 24 retries (~17h+) re-page admin and slow to 6h cadence


## Hosting Upgrade Bug Fix (Jun 3, 2026) — @ft33n3tx (chatId 1130252395)

### User Report
Tried to upgrade/renew/cancel hosting for `docxsndr.com` — all operations failed with "Upgrade failed: undefined" or generic error.

### Root Cause
1. **`whm-service.js:changePackage()`** returned `{success: false, package: pkg}` without an `error` field when WHM API returned a non-success result (not an exception). Caller logged `changeResult.error` → `undefined`.
2. **Upgrade flow** didn't handle suspended accounts — WHM rejects `changepackage` on suspended accounts. The user's 1-week plan expired May 26, WHM suspended the account, and every subsequent upgrade attempt failed silently.
3. **Renewal/upgrade flows** didn't clear `deleted`/`cancelledByUser` flags after successful payment.

### Fixes Applied
- **`js/whm-service.js`** — `changePackage()` now extracts `metadata.reason` from WHM response and returns it as `error` field
- **`js/_index.js`** (upgrade flow ~13242): auto-unsuspends the WHM account before calling `changePackage` if `plan.suspended === true`; after success, `$unset`s `suspendedAt`, `deleted`, `deletedAt`, `cancelledByUser`, `deletedBy`, `expiryNotified`, `expiryUserNotified`
- **`js/_index.js`** (renewal flow ~13075): added `$unset` for `suspendedAt`, `deleted`, `deletedAt`, `cancelledByUser`, `deletedBy`, `expiryUserNotified` on successful renewal
- **Production data fix**: Reset `deleted`/`cancelledByUser`/`deletedBy`/`deletedAt` on `cpanelAccounts._id=docxabcc` so the user can retry the upgrade

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
