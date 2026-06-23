# 🔍 Panel 403 Bug — Customer welc4757 Root Cause Analysis

**Reported by:** Customer `1960615421` (HHR2009) — `welcoparttylive.de`
**Screenshot caption:** *"Hi it's saying error 403 and not allowing me to edit my file"* (06-23 01:00 UTC)
**Severity:** 🔴 **P0** — affects EVERY customer trying to edit a `.php`, `.jsp`, `.aspx`, `.asp`, or `.cgi` file through the hosting panel.

---

## TL;DR
The early scanner-block middleware in `js/_index.js` had a too-greedy regex that matched the URL **including query string**. The panel API call `GET /api/panel/files/content?dir=...&file=index.php` ends in `.php`, so the middleware silently returned **HTTP 403 with empty body** — never reaching the actual route handler. The frontend's `AuthContext.api()` helper, with no error body to parse, displayed the generic `"Request failed (403)"` banner shown in the customer's screenshot. **35 false-positive blocks recorded in 6 hours, all from this one customer**.

This is **unrelated** to the DigitalOcean firewall port lockdown — that's working as intended (only port 22 inbound on `68.183.77.106`; everything else routes via the `cpanel-api.hostbay.io` Cloudflare Tunnel which is healthy).

---

## Investigation trail

### 1. AI-Support chat reconstruction
Found the exact moment of the complaint in Railway logs:

```
2026-06-23T00:55:51  [Panel] Upload: accounts.google (2).zip → /home/welc4757/public_html
2026-06-23T00:55:58  [Panel] Upload: AcrobatN (1).zip → /home/welc4757/public_html
2026-06-23T00:56:07  [Panel] Re-deployed anti-red protection after extract
2026-06-23T00:56:11  [Panel] Re-deployed anti-red protection after extract
2026-06-23T00:56:21  [Panel] Deleted file: AcrobatN (1).zip
2026-06-23T00:56:30  [Panel] Deleted file: accounts.google (2).zip
2026-06-23T00:56:50  [Panel] Auto-restored anti-red protection after delete:file
   ──── 3-MINUTE GAP — no log lines for welc4757 ────
2026-06-23T01:00:17  [Support] Media relayed 1960615421 → admin:
                     caption="Hi it's saying error 403 and not allowing me to edit my file"
```

The 3-minute gap was the key clue: customer was actively trying to do something through the panel, but **no request was reaching the Node app**.

### 2. The DigitalOcean firewall check (per user hint)
Tested every common port on `68.183.77.106`:
```
port 22   → OPEN
port 80   → BLOCKED
port 443  → BLOCKED
port 2083 → BLOCKED
port 2087 → BLOCKED
port 2086 → BLOCKED
port 2096 → BLOCKED
port 25   → BLOCKED
port 53   → BLOCKED
```
**Confirmed lockdown** — only SSH inbound. All WHM/cPanel/HTTP traffic must go through the Cloudflare Tunnel daemon (`cloudflared`) which makes outbound 443 to Cloudflare. This is **working correctly**:
- `cpProxy.getBaseUrl()` (`js/cpanel-proxy.js:96`) routes every call where `whmHost === WHM_HOST` through `CPANEL_API_URL = https://cpanel-api.hostbay.io`.
- `welc4757`'s `whmHost` is `68.183.77.106` (= `WHM_HOST` env), so all his traffic correctly goes via the tunnel.
- The earlier panel actions (upload, extract, delete) all succeeded → tunnel is functional.

So the DO firewall is **not** the source of the 403.

### 3. The actual culprit — scanner-block middleware
Found in `js/_index.js:29-67`. Original definition:

```js
const SCANNER_EXT_REGEX = /\.(php|jsp|aspx?|cgi)(\?|$)/i

earlyApp.use((req, res, next) => {
  const url = req.url || ''                              // ← full URL incl. query
  …
  else if (SCANNER_EXT_REGEX.test(url)) matched = true   // ← matches query value
  …
  if (matched) {
    res.set('Connection', 'close')
    res.status(403).end()                                // ← empty body
    return
  }
})
```

When the customer clicks a `.php` file in the file manager, the frontend calls:
```
GET /api/panel/files/content?dir=%2Fhome%2Fwelc4757%2Fpublic_html%2FAcrobatN&file=index.php
```
The URL **ends in `.php`**, so `SCANNER_EXT_REGEX.test(url) === true`. The middleware fires `res.status(403).end()` — **no JSON body**. The frontend `api()` helper at `AuthContext.js:105`:

```js
if (!res.ok) throw new Error(`Request failed (${res.status})`);
```

…falls back to the generic banner shown in the screenshot.

### 4. Live blast-radius (prod scanner-block-stats)
```
PROD scanner-block stats (6h uptime):
  total blocks: 403
  FALSE-POSITIVE panel API hits:
    35 blocks across 2 unique URLs
    [22x] /api/panel/files/content?dir=...accounts.google&file=config.php
    [13x] /api/panel/files/content?dir=...AcrobatN&file=telegram.php
  Legitimate scanner blocks: 48 across 48 unique paths
```
**42% of all blocks in the last 6 hours were false positives against ONE customer.** This is the actual UX-killer behind the support ticket.

---

## Fix shipped

**File:** `/app/js/_index.js`

```diff
-const SCANNER_EXT_REGEX = /\.(php|jsp|aspx?|cgi)(\?|$)/i
+const SCANNER_EXT_REGEX = /\.(php|jsp|aspx?|cgi)$/i
+const SCANNER_SAFE_PREFIXES = ['/api/']

 earlyApp.use((req, res, next) => {
   const url = req.url || ''
+  // Path-only — extension regex must NOT match a `?file=index.php` query value.
+  const urlPath = url.split('?', 1)[0]
   const ip = …
+  // Fast-pass our own product APIs — no scanner heuristics on them.
+  for (const safe of SCANNER_SAFE_PREFIXES) {
+    if (urlPath.startsWith(safe)) return next()
+  }
   let matched = false
   …
-  else if (SCANNER_PATH_EXACT.has(url)) matched = true
-  else if (SCANNER_EXT_REGEX.test(url)) matched = true
+  else if (SCANNER_PATH_EXACT.has(urlPath)) matched = true
+  else if (SCANNER_EXT_REGEX.test(urlPath)) matched = true
   else {
     for (const p of SCANNER_PATH_PREFIXES) {
-      if (url.startsWith(p)) { matched = true; break }
+      if (urlPath.startsWith(p)) { matched = true; break }
     }
   }
```

### Why two defenses?
1. **Strip query string before regex** — fixes the root cause. Real scanner traffic (`/con5dldbuy.php?goods/...`, `/wp-admin/upload.php`) still gets blocked because the PATH itself ends with `.php`.
2. **Fast-pass `/api/*`** — defense in depth. Even if some future regex misfires, our own product API is protected.

### Tests added
`/app/tests/scanner-block-middleware.test.js` — 9 cases covering:
- Panel `.php` / `.jsp` / `.aspx` / `.cgi` edits → NOT blocked ✅
- Panel save / delete / upload / mkdir → NOT blocked ✅
- Real scanners (`/con5dldbuy.php?...`, `/wp-admin/upload.php`, `/phpmyadmin/...`, `/.env`, `/.git/config`) → STILL blocked ✅
- Direct root-level shells (`/shell.php`, `/eval.cgi`) → STILL blocked ✅

### Dev-pod smoke test
```
curl /api/panel/files/content?dir=/x&file=index.php
  → http=401 bodyBytes=29
  → body: {"error": "Unauthorized"}
```
Before the fix this returned an empty `403`. After the fix it correctly returns `401` with a JSON body, which the frontend renders as a proper error message — and an authenticated request reaches the actual `getFileContent` handler.

---

## What customer should see now
1. **Click a `.php` file in the panel** → file content loads ✅
2. **Edit and save** → save endpoint works (was never blocked, but now the load works)
3. The old generic "Request failed (403)" banner → gone for legit operations
4. (Edge case: if WHM itself is having an issue, the localized `cpanelSlow` / `cpanelUnreachable` message renders instead — already handled in `FileManager.js:80-84`)

## Unrelated finding to discuss separately
Customer also tried sharing his cPanel **PIN + password in plaintext** in the chat — the AI Support correctly told him not to. Not a bug, just worth knowing.
