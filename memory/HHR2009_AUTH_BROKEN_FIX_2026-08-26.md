# HHR2009 File Manager upload/delete fix — v3 (WHM impersonation session)

## Retired approaches (do not re-implement)

**v1 — `uploadFileAsRoot()` (multipart via WHM json-api gateway)**
Retired. WHM's `/json-api/cpanel` gateway silently strips multipart bodies
even with `Authorization: whm root:$WHM_TOKEN` + `cpanel_jsonapi_user=X`.
cPanel returns `"You must specify at least one file to upload"`.
Helper kept exported for legacy compat, no route calls it.

**v2 — `_repairCpPass()` (rotate cpPass via WHM `/passwd`)**
Retired. WHM `/passwd` returns `"Password changed"` and the new pass gets
saved back into Mongo (AES-GCM), but `cpsrvd` is still denying Basic Auth
even with the fresh password. cPHulk / underlying auth-state stickiness.
Helper removed from `cpanel-routes.js` entirely.

## Current fix — v3 WHM impersonation session

Three-step ladder against WHM impersonation (implemented in
`js/cpanel-proxy.js::uploadFileViaSession`):

1. **WHM** `GET {WHM_API_URL}/json-api/create_user_session?api.version=1&user=<cpUser>&service=cpaneld`
   with `Authorization: whm root:$WHM_TOKEN` → response carries a
   one-shot `session` token and a `url` containing the `/cpsess<N>/`
   cp_security_token.
2. **cPanel** `GET {CPANEL_API_URL}/cpsess<N>/login/?session=<token>`
   with **`maxRedirects: 0`** (critical — the 307 response's set-cookie
   header carries the real `cpsession=...` cookie; following the redirect
   overwrites it with a `~pre` pre-auth marker).
   Cookie parsed manually with `set-cookie.match(/cpsession=([^;]+)/)`.
   No tough-cookie / axios-cookiejar-support (they conflict with the
   existing `overrides.tough-cookie` entry — Railway EOVERRIDE).
3. **cPanel** `POST {CPANEL_API_URL}/cpsess<N>/execute/Fileman/upload_files`
   with `Cookie: cpsession=<value>` and multipart form (`dir`, `file-1`).
   Multipart works here because we're POSTing to cPanel directly (port 2083
   via the cPanel CF tunnel), NOT the WHM json-api gateway.

**Env URL distinction (easy to get wrong):**
- `WHM_API_URL`    → CF tunnel to port 2087 (WHM). Only step 1.
- `CPANEL_API_URL` → separate CF tunnel to port 2083 (cPanel). Steps 2 & 3.
  The `/cpsess<N>/login/` and `/cpsess<N>/execute/...` paths ONLY work on
  the cPanel tunnel — hitting them on the WHM tunnel returns a 401 login page.

**via: tags emitted on failure paths (for ops grep):**
- `whm-session` — success
- `session-unavailable` — missing WHM_TOKEN / WHM_API_URL / CPANEL_API_URL
- `session-create-failed` — `/create_user_session` returned non-success
- `session-cookie-missing` — `/login` step didn't return a cpsession= cookie
- `session-upload-rejected` — upload POST returned cPanel Login HTML
- `session-upload-failed` — upload POST returned non-status:1
- `session-exception` — thrown exception during ladder

## Three companion fixes carried over

### 1. `uploadFile()` HTTP-200-with-cPanel-Login-HTML detection
`cpsrvd` sometimes returns HTTP 200 with `<html><title>cPanel Login</title>`
in the body (Basic Auth silently rejected mid-request, ModSecurity/cPHulk).
Without body-based detection this leaks to the client as a false "successful"
upload. Fix: after `axios.post(...)`, if
`typeof res.data === 'string' && /<title>cPanel Login<\/title>|<!DOCTYPE html>/i.test(res.data)`,
return `{status:0, code:'CPANEL_AUTH_FAILURE', httpStatus:res.status, errors:[...]}`
so the route triggers the session fallback.

### 2. `_verifyDeleted` / `deleteFile` false-positive fix
- `_verifyDeleted` used to return `true` (gone) whenever the verifying
  `listFiles` returned `data:null` — which is exactly what a broken UAPI
  does. Combined with `deleteFile` promoting `status:0 → status:1` on
  `gone===true`, this silently made every failed delete look successful.
- Fix: `_verifyDeleted` returns **null** (unknown) unless
  `listing.status===1 && Array.isArray(listing.data)`.
- Fix: `deleteFile` only promotes to `status:1` when the **original op** was
  already `status:1`. Never promotes purely on `gone===true`.
- New `verified_via` values: `primary`, `fallback`, `unknown` (verify
  couldn't be trusted), `unverified` (verify said gone but original op
  didn't succeed).

### 3. Route wiring
`/files/upload` and `/files/upload-chunk`: on `_isAuthBroken(result)`, call
`cpProxy.uploadFileViaSession(req.cpUser, dir, fileName, buffer, req.whmHost)`.
Log tag: `WHM session fallback`. Return the session result directly.
- **NO call to `_repairCpPass()`** (retired, helper removed)
- **NO call to `uploadFileAsRoot()`** (retired, helper kept in proxy for
  legacy compat)

## Dev endpoint — READ-ONLY
`GET /api/dev/cpanel-auth-broken-check?key=$SESSION_SECRET`
- 13 classifier truth-table cases
- **25** wiring greps covering: session helper implementation (7 checks),
  HTTP-200-HTML detection, `_verifyDeleted`/`deleteFile` fixes (2), upload
  routes wired to session (2), retired helpers absent from upload branches
  (4), via: tags emitted (1), `/files/delete` untouched (1), env presence (4)
- 4 exports checks

## Package.json hygiene
`tough-cookie` remains in `overrides` (transitive). NOT added to
`dependencies`. NOT added: `axios-cookiejar-support`. Cookie parsing is a
manual regex on `res.headers['set-cookie']`.

`adm-zip` for the .zip extract test in the live script belongs in
`devDependencies` if you want to enable that assertion — the script skips
gracefully when it's missing.

## Live end-to-end script
`js/tests/live_test_hhr2009_session_upload.js` — 18 assertions:
mkdir → list (retry for WHM cache lag) → single-shot upload → chunked
(2.5 MB × 3) → .zip upload → extract → verify extracted content → delete
each artifact → delete folders → verify parent listing shows test dir gone
→ **assert `cpPass_encrypted` UNCHANGED** (session doesn't rotate passwords).

Test artifacts live under `/home/<cpUser>/nomadly_selfheal_test/` — OUTSIDE
`public_html`, so the live website is untouched. Cleaned up at the end.

**Status on this pod (SMADAV whitelabel):** cluster has 0 `cpanelAccounts`
docs (fresh brand, 25 signups, no hosting purchases yet). Live script
correctly detects this and exits with code 2 (SKIP). Run it against the
sister-repo prod DB where accounts exist to get the full 18/18.

## Local test suite
`node js/tests/test_hhr2009_auth_broken_fallback.js` → **59 passed, 0 failed**

Covers: classifier, EPERM mutual exclusion, proxy exports,
uploadFileViaSession implementation (create_user_session, service=cpaneld,
whm root header, CPANEL_API_URL, maxRedirects:0, cpsession regex,
upload_files path, Cookie header), uploadFile HTML detection,
_verifyDeleted/deleteFile fixes, route wiring (session in, retired
helpers absent), via: tags, env vars, package.json hygiene.
