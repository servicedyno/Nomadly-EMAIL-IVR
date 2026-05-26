# Twilio Sub-Account Regulatory Bundle Fix (Feb 2026)

## Bug
Production Twilio "Address … does not exist for account …" errors when
purchasing numbers in BUNDLE_REQUIRED_COUNTRIES (GB/IE/AU/NZ/HK/EE/CZ/KE/MY/PL/ZA/TH).

Root cause: `createAddress` was correctly scoped to the user's Twilio
**sub-account**, but the follow-up regulatory ops (`createEndUser`,
`createBundle`, `createSupportingDocument`, `addBundleItem`,
`submitBundle`, `deleteBundle`) were silently falling back to the
**main account** client because they did not accept sub-account creds.
Twilio regulatory resources are account-scoped — crossing accounts
fails with the misleading "Address does not exist" error.

## Fix
1. `js/twilio-service.js`
   - Added optional `subSid, subToken` params to all regulatory functions
     (`createEndUser`, `createBundle`, `createSupportingDocument`,
     `addBundleItem`, `submitBundle`, `getBundleStatus`, `deleteBundle`).
   - Each function selects `getSubClient(subSid, subToken)` when both
     are provided, else falls back to `getClient()` (main).
   - Added `account=sub|main` to all related log lines for traceability.

2. `js/_index.js`
   - **Cached-address path (~L9888-9962)**: looks up `_subSid/_subToken`
     from `phoneNumbersOf.val.twilioSubAccountSid/Token`. If missing,
     refunds and instructs user to re-enter address. Passes the creds
     through every regulatory call + the orphan-bundle `deleteBundle`.
   - **Fresh-address path (~L23056-23169)**: now passes
     `subSidForAddr/subTokenForAddr` (the same creds used to create the
     Address) to every regulatory call + cleanup.

## Verification
- `node -c` passes on both files ✅
- ESLint: no issues ✅
- All 29 sanitize-provider unit tests pass ✅
- Function arities verified (createEndUser=5, createBundle=9, etc.) ✅
- `requireSubClient` still blocks operations missing sub-account creds ✅
- `nodejs` supervisor service restarted cleanly, port 5000 bound,
  all schedulers (incl. `[OrphanBundles]`, `[RegulatoryFlow]`) ready,
  zero entries in `nodejs.err.log` ✅

## Files changed
- /app/js/twilio-service.js
- /app/js/_index.js
