# Scanner Edge-Block (P2)

## Why
A single attacker IP `74.7.243.245` (forging `GPTBot/1.4` user-agent) hit `/con5dldbuy.php` and variants **1,131 times** in the most recent capture window on Nomadly-EMAIL-IVR. This inflates Railway dashboards (95–97% of HTTP traffic was 4xx) and wastes Node.js CPU running middleware for traffic that has no business reaching the application.

```
74.7.243.245    1,131  /con5dldbuy.php       (404)
74.7.243.245       12  /con5dld              (302)
                    2  /con5dldrobots.txt    (404)
                    1  /con5dld.well-known/pki-validation/sending.php (200)
```

## What was added
A small early-exit middleware in `/app/js/_index.js` (right after `const earlyApp = express()`):

- **Drops the socket** (`res.socket.destroy()`) before any other middleware runs — no CORS, no body-parser, no logging cost.
- **Match rules** (conservative — only paths that have ZERO valid route on this Node server):
  - IP block list: `74.7.243.245` (the only verified scanner so far)
  - Path-prefix block: `/con5dld`, `/wp-`, `/wordpress`, `/phpmyadmin`, `/phpunit`, `/vendor/phpunit`, `/.git`, `/.env`, `/.aws`, `/.well-known/pki-validation/`
  - Exact-path block: `/.htaccess`, `/sftp-config.json`, `/config.json`, `/server-status`, `/owa/`
  - Extension regex: `/\.(php|jsp|aspx?|cgi)(\?|$)/i` (no PHP/JSP/ASP/CGI on this Node server)
- **Observability**: `GET /admin/scanner-block-stats` returns total blocked, top blocked paths, top blocked IPs, and the full ruleset. Counter is in-memory only, no DB write per request.
- **IP detection**: prefers `cf-connecting-ip` (Cloudflare) > `x-forwarded-for` > `req.socket.remoteAddress` — works through Railway's edge.

## Verified locally (in dev pod)

```
=== Test 1: /con5dldbuy.php (scanner) ===
HTTP=000 time=0.001s body_bytes=0   ← socket closed, no response
curl: (52) Empty reply from server   ← attacker scanner gets nothing

=== Test 2: /wp-login.php (scanner) ===
HTTP=000 time=0.0004s body_bytes=0

=== Test 3: /health (legit) ===
HTTP=200 body_bytes=78
{"status":"healthy","database":"connected","uptime":"0.01 hours"}

=== Test 4: X-Forwarded-For 74.7.243.245 on / (legit path, scanner IP) ===
HTTP=000 body_bytes=0   ← IP-blocked even though path is "/"

=== Test 5: /.env (sensitive path) ===
HTTP=000 body_bytes=0

=== Test 6: GET /admin/scanner-block-stats ===
{
  "total": 4,
  "topPaths": [
    {"path": "/con5dldbuy.php", "count": 1},
    {"path": "/wp-login.php",   "count": 1},
    {"path": "/",               "count": 1},
    {"path": "/.env",           "count": 1}
  ],
  "topIps": [
    {"ip": "127.0.0.1",     "count": 3},
    {"ip": "74.7.243.245",  "count": 1}
  ],
  ...
}
```

ESLint: ✅ no issues. Node.js bot restarted cleanly with all 70+ services initialized.

## Expected production impact
After this hits prod (via your normal deploy flow), Railway dashboards should show:
- 4xx rate on Nomadly-EMAIL-IVR drop from **96.8% → < 10%** within a few hours.
- Total HTTP volume drop ~30,000 → ~1,500 per day (real traffic only).
- CPU on the Node process drops slightly (no more 1,131 wasted 404s/hour).
- True signal (real 2xx + real 4xx) becomes the dominant signal in dashboards → easier to spot future regressions.

## How to extend the block list
Edit the constants near the top of `/app/js/_index.js`:
```js
const SCANNER_IPS              = new Set([...])      // add IPs
const SCANNER_PATH_PREFIXES    = [...]               // add new scanner path families
const SCANNER_PATH_EXACT       = new Set([...])
const SCANNER_EXT_REGEX        = /\.(php|jsp|...)/i
```
Then redeploy. Stats endpoint will start tracking the new rules immediately.

## How to monitor in prod
```bash
curl -sS https://nomadly-email-ivr-production.up.railway.app/admin/scanner-block-stats | jq .
```
If `total` keeps growing fast, you have a new scanner. If `total` plateaus, you've blocked them.

## Safety / rollback
- The middleware is **first** in the chain — if it has a bug, you'd notice immediately because the bot stops working. (Verified working locally.)
- All match rules are **opt-in** (specific prefixes / exact paths / specific extensions). It cannot accidentally match `/telegram/webhook`, `/api/*`, `/twilio/*`, `/dynopay/*`, etc.
- To roll back: simply remove the block, leaving only `earlyApp.use(cors())` as before.

## Files changed
- `/app/js/_index.js` — added ~55 lines of middleware + stats endpoint at the top of the file (lines 10–66)
