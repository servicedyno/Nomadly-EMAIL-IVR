# HHR2009 stale-cpPass self-heal — v2 fix (2026-08-26)

## Why v2
v1 wired `/files/upload` and `/files/upload-chunk` to fall back to
`cpProxy.uploadFileAsRoot()` on 401/403 — a multipart POST against WHM's
`/json-api/cpanel` with `Authorization: whm root:$WHM_TOKEN`.

Ops confirmed this doesn't actually work: WHM's json-api gateway silently
drops the multipart file body. Users saw
"You must specify at least one file to upload" instead of the original
"Upload failed (401)". No net improvement.

## Real fix — self-heal the underlying stale cpPass

The root cause is a stale `cpPass_encrypted` in `cpanelAccounts` (drifted
out of sync with the real WHM password — rotation, restore-from-backup,
manual admin change). Instead of routing around WHM's gateway with
impersonation, we rotate the password on WHM, persist the new value in
Mongo (AES-256-GCM), and retry the SAME user-level upload path — the
exact code path a healthy account uses.

### New helper: `_repairCpPass(getCpanelCol, cpUser, whmHost)` in `js/cpanel-routes.js`

Contract:
- **60-min cool-down** (`CPPASS_COOLDOWN_MS`): if `doc.cpPassRotatedAt` is
  within 60 min, decrypt and return the cached pass with `rotated:false,
  reason:"cool-down (Xm left)"`. Prevents cPHulk / ModSecurity thrash.
- **Password**: 24 chars, `crypto.randomBytes(32)` → mapped into a
  `[A-Za-z0-9]` alphabet (`CPPASS_ALPHABET`). URL-safe (avoids WHM
  shell-encoding quirks). ~143 bits entropy.
- **WHM call**: `whmApi.get('/passwd', { params: { 'api.version': 1,
  user: cpUser, password: newPass, db_pass_update: 0 } })`.
  - `db_pass_update:0` is **critical** — rotating bound MySQL passes
    silently breaks the customer's live site (their app config still
    points at the old MySQL pass).
  - Success gate: `res.data?.metadata?.result === 1`.
- **Persist**: `cpAuth.encrypt(newPass)` → `{encrypted, iv, tag}`. Update
  the account doc with:
  - `cpPass_encrypted`, `cpPass_iv`, `cpPass_tag`
  - `cpPassRotatedAt: new Date()`
  - `cpPassLastRotateReason: 'CPANEL_AUTH_FAILURE'`
- **Returns**: `{ ok, cpPass?, rotated?, reason?, error? }`.

### Route wiring
- `POST /files/upload` and `POST /files/upload-chunk`: on
  `_isAuthBroken(result)`, call `_repairCpPass(getCpanelCol, req.cpUser,
  req.whmHost)`. On `ok:true`, retry `cpProxy.uploadFile(req.cpUser,
  repair.cpPass, ...)` — the SAME user-level upload path. Also
  `req.cpPass = repair.cpPass` so any downstream op in the same request
  uses the fresh pass.
- Failure taxonomy for ops:
  - `via: 'cppass-repair-failed'` — the repair itself failed (Mongo
    lookup, WHM /passwd non-1 metadata result, exception)
  - `via: 'cppass-repaired-retry-failed'` — the repair succeeded but the
    retry upload still failed. Probably a real cPanel-side lockout, not
    a stale-pass problem.
  - `via: 'cppass-repaired-retry-ok'` / `via: 'cppass-cooldown-retry-ok'`
    — success paths.
- **`uploadFileAsRoot()` REMOVED from the upload flow.** Kept in
  `js/cpanel-proxy.js` for legacy compat (still exported).

### Untouched
- `POST /files/mkdir`, `GET /files` (list_files), `POST /files/extract` —
  keep using `_isAuthBroken()` + WHM-root GET impersonation. These are
  read-only URL-encoded calls, the gateway handles them fine.
- `POST /files/delete` — untouched (already unconditional WHM-root path).

## Dev endpoint (READ-ONLY)
`GET /api/dev/cpanel-auth-broken-check?key=$SESSION_SECRET`
- 404 in prod without admin key
- Runs 13 classifier truth-table cases
- Runs 15 route wiring greps:
  1. `list_files_gate` — /files still uses _isAuthBroken
  2. `mkdir_gate`
  3. `extract_gate`
  4. `repair_helper_defined` — `_repairCpPass(getCpanelCol, cpUser, whmHost)`
  5. `repair_cooldown_60min` — `CPPASS_COOLDOWN_MS = 60*60*1000`
  6. `repair_uses_crypto_randomBytes` — no Math.random
  7. `repair_calls_whm_passwd` — /passwd with db_pass_update:0
  8. `repair_persists_all_fields` — all 5 fields
  9. `upload_calls_repair`
  10. `upload_chunk_calls_repair`
  11. `upload_no_root_upload` — NO uploadFileAsRoot in upload branch
  12. `upload_chunk_no_root_upload` — same
  13. `emits_repair_failed_tag`
  14. `emits_repaired_retry_failed_tag`
  15. `delete_untouched_by_repair` — regression guard

## Local test suite
`node js/tests/test_hhr2009_auth_broken_fallback.js` → **52 passed, 0 failed**

Covers:
- Classifier truth table (13 cases)
- EPERM vs AUTH mutual exclusion
- `_repairCpPass` signature, cool-down constant, password gen, WHM call
  shape, persistence field list
- Both upload routes wired to repair, NOT to `uploadFileAsRoot`
- Failure via: tags emitted
- `/files/delete` untouched
- proxy exports preserved

## Verify in production (Railway)
Look for these tags in logs after the next 401/403:
- `[Panel] cpPass repair: rotating <user>` — repair attempted
- `[Panel] cpPass repair OK for <user>` — repair succeeded, doc persisted
- `[Panel] Upload recovered via cpPass repair` — retry succeeded
- `tag: user-auth-broken` — auth failure detected
- `tag: cppass-repair-failed` — the rotation itself failed
- `tag: cppass-repaired-retry-failed` — probably cPHulk lockout

## What this does NOT do
- Does NOT rotate MySQL passwords (`db_pass_update:0`)
- Does NOT mutate any other account
- Does NOT SSH into WHM
- Does NOT delete `uploadFileAsRoot()` (kept exported for legacy compat,
  just not called from any route)
