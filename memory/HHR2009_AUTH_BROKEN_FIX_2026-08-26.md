# HHR2009 auth-broken fallback — RCA + fix (2026-08-26)

## Bug
cpUser `nnliae74` (owned by @HHR2009 / chatId `1960615421`, WHM `68.183.77.106`,
domain `evitesapp.org`) reported:
- "Create folder failed: Access denied" in the File Manager
- "Upload failed (401)" for any file upload

## Root cause
User's cached `cpPass` in Mongo drifted out of sync with the real WHM
password (rotation on the server / restore-from-backup / manual admin
change). Every user-level HTTP Basic Auth call hit the transport layer:
- UAPI `/execute/Fileman/upload_files`, `list_files` → **401** (body: cPanel
  HTML login page)
- API2 `/json-api/cpanel?...Fileman::mkdir` → **403 "Access denied"**

The existing WHM-root fallback ladder (uses `WHM_TOKEN` + `cpanel_jsonapi_user`
impersonation to bypass user auth entirely) only fired on:
- `httpStatus >= 500`, OR
- an EPERM regex match ("permission denied" / "status 1" / EPERM)

So `401`/`403 "Access denied"` leaked to the panel UI. The fallback that
would have succeeded (root credentials sidestep the stale password) never
got a chance.

Verified via sister-repo Railway deployment `3719705c` (main branch, same
project) which committed the exact same fix pattern after independent RCA
on the same customer 2026-08-26 22:37 UTC.

## Fix (mirror of sister-repo commit)

### `js/cpanel-proxy.js`
- Added `looksLikeAuthFailure(status, msg)` classifier: `true` for `status ===
  401 || status === 403`, or body matches `/access\s*denied/i`, or matches
  axios generic `/Request failed with status code 40[13]/i`.
- `uapi()`, `api2()`, `uploadFile()` all now tag response with
  `code: 'CPANEL_AUTH_FAILURE'` when auth-broken detected. **Mutually
  exclusive with `CPANEL_UAPI_EPERM` — EPERM is checked first.**
- `uploadFile()` now exposes `httpStatus` (it didn't before).
- New `uploadFileAsRoot(cpUser, dir, fileName, buf, whmHost)`: multipart
  POST to WHM `/json-api/cpanel` with `Authorization: whm root:${WHM_TOKEN}`
  + query params `cpanel_jsonapi_user=<user>&…apiversion=3&…module=Fileman&…func=upload_files`.
  Returns `{ status, data, errors, httpStatus, via }`.
- Both new functions **exported**.

### `js/cpanel-routes.js`
- Added `_isAuthBroken(result)` helper: `true` if `result.code ===
  'CPANEL_AUTH_FAILURE'` OR `result.httpStatus === 401|403` OR classifier's
  body check.
- Extended the `looksBroken` gate in:
  - `router.get('/files', …)` (list_files)
  - `router.post('/files/mkdir', …)`
  - `router.post('/files/extract', …)`
- New `reasonTag` logged so ops can grep `user-auth-broken` alongside
  `eperm` / `http5xx` in Railway logs.
- `router.post('/files/upload', …)`: on auth-broken, retry via
  `cpProxy.uploadFileAsRoot()`.
- `router.post('/files/upload-chunk', …)`: same fallback after chunk
  assembly.
- `router.post('/files/delete', …)`: **NOT touched** — already unconditionally
  hits WHM-root on any non-status:1 result (regression-guarded in tests).

### `js/_index.js`
- New READ-ONLY dev endpoint `GET /api/dev/cpanel-auth-broken-check?key=…`
  (registered as `/dev/cpanel-auth-broken-check` — the `/api` prefix is
  stripped by the ingress middleware at the top of the file, line ~36686).
  - Returns 404 in prod without admin key
  - Runs 13 classifier truth-table cases + 6 route wiring greps + 3 export
    checks
  - Zero WHM traffic, zero DB mutation
- Also fixed `apiPrefixes` list in the SPA catch-all (line 48188) to
  include `/api/` so any async-registered `/api/*` handler can be reached
  (previously only `/panel/`, `/telnyx/` etc. were whitelisted).

### `js/tests/test_hhr2009_auth_broken_fallback.js`
- 37 assertions covering:
  1. `looksLikeAuthFailure` truth table (7 auth-yes cases)
  2. Non-auth cases return false (8 cases incl. File exists, 404, 502, ECONNRESET)
  3. EPERM vs AUTH mutual exclusion (EPERM wins on "permission denied")
  4. Proxy exports (arity of `uploadFileAsRoot` = 5)
  5. Routes reference `_isAuthBroken()` / `uploadFileAsRoot()` (6 greps)
  6. `/files/delete` unconditional-fallback regression guard (no
     `_isAuthBroken` gate introduced)
  7. Result-shape semantics (auth vs eperm vs File-exists)

Run: `node js/tests/test_hhr2009_auth_broken_fallback.js` → **37 passed, 0 failed**

## What this does NOT do (intentional)
- Does NOT reset the user's cPanel password
- Does NOT mutate Mongo (auto-resync is a separate enhancement)
- Does NOT SSH into WHM
- The WHM-root fallback is the whole fix — root credentials + impersonation
  sidestep the stale-password problem completely

## How to verify without hitting real WHM
```
curl "https://<pod>/api/dev/cpanel-auth-broken-check?key=$SESSION_SECRET" | jq .passed
```
Expect `true`. Detail JSON: `classifier[]`, `wiring{}`, `exports{}`.

## Regression safety confirmed
- Existing EPERM path still classifies "permission denied" / EPERM /
  status 1 as `CPANEL_UAPI_EPERM` (not AUTH) — verified by test [3]
- Legit errors ("File exists", 404) return `code: undefined` — verified
  by test [7]
- `/files/delete`'s unconditional root-fallback path is untouched —
  verified by test [6]
