# Nameserver Update Fix — itsonlytravel.com / @Mrdoitright53 (Feb 2026)

## Bug
User typed `ns1.leland.ns.cloudflare.com` / `ns2.megan.ns.cloudflare.com` as
custom Cloudflare nameservers. These hostnames do not exist (correct form
is `leland.ns.cloudflare.com` / `megan.ns.cloudflare.com` — Cloudflare's
named nameservers do NOT use `ns1./ns2.` prefixes).

Registry rejected the operation. OP returned a generic 500:
```
desc: "An error has occurred; for more details, please refer to the
registry message below. For more information please check
https://support.openprovider.eu/hc/en-us/articles/7265441900946"
```

After our provider-URL sanitizer scrubbed the OP support link, the user
saw a useless message ending mid-sentence: "❌ Failed to update
nameservers: ... For more information please".

## Fix

### 1. Pre-validation (catches the typo BEFORE hitting the registry)
`/app/js/_index.js` (`dns-update-all-ns` handler ~L18760):
- **Double-NS Cloudflare detector**: regex `^ns\d+\.([a-z0-9-]+)\.ns\.cloudflare\.com$`
  matches the malformed input and replies with the corrected hostname.
- **DNS pre-resolve**: each NS is resolved via `dns.promises.resolve(ns, 'A'|'AAAA')`
  with a 4 s per-NS budget. Unresolvable nameservers are rejected with a
  clear list of which ones failed, before we ever call OP.

### 2. Better error message when registry rejects (`/app/js/op-service.js`)
- Detects OP's generic "An error has occurred ... registry message below"
  template and replaces it with: *"The registry rejected these nameservers.
  Common causes: the hostnames are misspelled, not yet registered, or do
  not resolve to an IP address. Please double-check each nameserver
  against your DNS provider's control panel and try again."*
- Bumped error-payload log truncation from 500 → 2000 chars so the real
  registry message survives in logs for future RCA.

### 3. Sanitizer fix (`/app/js/sanitize-provider.js`)
- Strips trailing "For more (information|details|info) please [check|visit|see]"
  fragments that get left behind after URL removal.
- Strips trailing bare "please check/visit/see".

### 4. Prompt UX (all 4 langs + 2 fallback strings in `_index.js`)
- Added a clear Cloudflare warning to every "Enter new nameservers" prompt:
  *"⚠️ Cloudflare: copy the names as shown in your dashboard (e.g.
  `leanna.ns.cloudflare.com`). Do not add an extra `ns1./ns2.` prefix."*
- Files: `lang/en.js`, `lang/fr.js`, `lang/zh.js`, `lang/hi.js` (both
  occurrences), `_index.js` (lines ~7702, ~18427).

## Verification
- `node -c` clean on all 5 modified files ✅
- ESLint clean ✅
- `sanitize-provider.test.js`: **32 passing** (29 original + 3 new
  regression tests covering the OP "For more information please" pattern) ✅
- Regex unit-check covers the exact user input
  (`ns1.leland.ns.cloudflare.com` → `leland.ns.cloudflare.com`) and
  correctly does NOT match valid Cloudflare hostnames ✅
- `nodejs` supervisor service restarted cleanly, port 5000 bound, zero
  errors in `nodejs.err.log` ✅

## Notes on Twilio
Same Railway log window (12 h, deploy `0dff46c3`) showed:
- All Twilio operations healthy (PhoneMonitor + BalanceMonitor running,
  webhooks synced for all 9 sub-accounts, no failed bundles).
- Only Twilio warning: **balance is $7.83 USD** (below the $10 warn
  threshold). User should top up to avoid future call/SMS failures.
- The previously-fixed regulatory-bundle sub-account routing is holding
  — no "Address does not exist" errors observed.

## Files changed
- `/app/js/_index.js`
- `/app/js/op-service.js`
- `/app/js/sanitize-provider.js`
- `/app/js/__tests__/sanitize-provider.test.js`
- `/app/js/lang/en.js`, `/app/js/lang/fr.js`, `/app/js/lang/zh.js`, `/app/js/lang/hi.js`
