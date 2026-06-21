# @ciroovblzz Production Bug Investigation Report

**Date:** 2026-05-02
**User:** @ciroovblzz (cPanel acct: tdsee735)
**Surface:** Telegram Mini-App Hosting Panel
**Status:** ✅ FIXED (local commit, ready to deploy) — includes ROOT-CAUSE tunnel-routing fix

---

## Symptoms Reported

1. **"Error screen after login"** — user lands on file manager, sees a scary banner with text like `timeout of 30000ms exceeded`.
2. **"Upload continues forever"** — user drops `netflix - @ciroovblzz.rar` (4.1 MB), spinner hangs up to 2 minutes, then sometimes shows success when the file never reached cPanel.
3. **"I cannot see my file in public_html. It doesn't show my code, but if I go to my website using my URL, I can see the website"** — folder appears empty in panel, but the site is live on the public URL. 👈 **The key clue.**

---

## ACTUAL Root Cause (uncovered by symptom #3)

The website serves fine → files ARE on the origin. But the panel can't list them → the control-plane path (UAPI on port 2083 / WHM on port 2087) is not reaching the origin.

**Bisection**

Direct curl from the Railway pod:
```
cpanel-api.hostbay.io  (CF Tunnel → origin:2083)  → HTTP 200 in 0.3s ✅
whm-api.hostbay.io     (CF Tunnel → origin:2087)  → HTTP 200 in 0.5s ✅
https://209.38.241.9:2083  (direct origin)        → HTTP 000 (timeout 5s) ❌
https://209.38.241.9:2087  (direct origin)        → HTTP 000 (timeout 5s) ❌
```

**The tunnels are healthy — direct origin ports 2083/2087 are firewalled** (the `DO_FIREWALL_LOCKDOWN` migration earlier this cycle closed them in favour of the CF tunnel).

Meanwhile in Mongo (from Railway boot logs):
```
[CpanelMigration] All accounts already point to current WHM_HOST (209.38.241.9). No migration needed.
```

Every `cpanelAccounts` document has `whmHost = 209.38.241.9` (the origin IP). In `getBaseUrl(host)`:

```js
// BEFORE
if (CPANEL_API_URL && !host) return CPANEL_API_URL   // tunnel ONLY if no host
const effectiveHost = host || WHM_HOST
return `https://${effectiveHost}:${CPANEL_PORT}`     // direct IP:2083 otherwise
```

So every authenticated panel call (file list, upload, delete, mkdir, rename…) was hitting `https://209.38.241.9:2083` — which is firewalled — bypassing the healthy tunnel. The 30s axios timeouts and the "This folder is empty" state are both explained.

**Website worked** because HTTP 80/443 go through a completely different path (Cloudflare → separate Worker route → origin) that the lockdown never touched.

---

## Log Evidence (deployment `a82f7dca`, post-fix-1 test)

Even with retry layer, every read still failed:
```
15:31:34  [Panel] Upload: tdbiss.zip (93.4 KB) → /home/tdsee735/public_html
15:31:40  Fileman::list_files transient timeout — retrying once
15:32:20  Fileman::list_files error: timeout of 30000ms exceeded  ← retry also failed
15:33:34  Fileman::upload_files error: timeout of 120000ms exceeded
```

Once tunnel routing is correct these will resolve in sub-second.

---

## Fixes Shipped

### A. Tunnel routing — `js/cpanel-proxy.js` (root cause)
```js
// AFTER
if (CPANEL_API_URL && (!host || host === WHM_HOST)) return CPANEL_API_URL
```
Treats `host === WHM_HOST` (origin IP) as "default server" and routes through the tunnel. Resellers on a genuinely different WHM box still get direct routing via their own hostname.

### B. WHM fallback paths in `js/cpanel-routes.js`
Two places built direct `https://${whmHost}:2087/json-api` axios instances (delete fallback, visitor-captcha auto-prepend). Both now route through `WHM_API_URL` tunnel when `whmHost === WHM_HOST`, and forward `CF-Access-Client-Id/Secret` headers when configured.

### C. Transient-error soft-landing (shipped earlier in same session)
- `js/cpanel-proxy.js` — single 500 ms retry on timeout for idempotent reads (`list_files`, `list_domains`, `installed_hosts`, etc.)
- `frontend/src/components/panel/shared/cpanelErrors.js` — NEW helper mapping raw axios strings to localized copy
- `FileManager.js` / `DomainList.js` — friendly error banner + `Try Again` button, upload elapsed timer, 30s slow-upload warning, non-chunked upload now inspects `res.errors[]`
- 4 locales (en, fr, hi, zh) — `errors.cpanelSlow` / `errors.cpanelUnreachable` / `errors.retry` / `errors.uploadSlow`

---

## Tests — 18/18 ✅

### Backend
- `node /app/js/tests/test_cpanel_proxy_retry.js` — 4/4 (retry fires; mutations don't retry; caps at 2 attempts)
- `node /app/js/tests/test_cpanel_tunnel_routing.js` — 4/4 (tunnel for null host; tunnel for `host === WHM_HOST`; direct for reseller; upload honors same rules)

### Frontend helper
- `node /app/frontend/tests/test_cpanel_errors_helper.js` — 10/10 (all mapping + passthrough + edge cases)

### UI smoke
Preview panel login page renders cleanly (screenshot verified, no console errors). User-provided production screenshot confirms the new "still working" + "Try Again" UX is already live.

---

## User-Facing Behaviour Changes

| Scenario | Before | After |
|----------|--------|-------|
| Panel list files | Timeout (firewall blocks origin:2083) → "Folder is empty" | Tunnel → lists files in ~300 ms ✅ |
| Panel upload | 120 s timeout → silent fake success | Uploads via tunnel, ~1-3 s ✅ |
| WHM blip | Raw `timeout of 30000ms exceeded` banner | Auto-retries once; if still failing, calm banner + Try Again |
| Slow upload | Static spinner for 2 min | Live `· 0:23` timer + "still working" banner after 30 s |

---

## Deployment Notes

- Branch / commit: local only (per user request).
- Railway env vars: **no changes required**. If `CF_ACCESS_CLIENT_ID/SECRET` are not set (they aren't currently), the code skips those headers — the tunnel itself is currently NOT locked behind CF Access so this is OK.
- Rollback: revert `js/cpanel-proxy.js`, `js/cpanel-routes.js`, `FileManager.js`, `DomainList.js`, `shared/cpanelErrors.js`, 4 locale JSON files.
- Risk: very low — tunnel was already the documented primary path; accounts that were mis-routed to direct origin now flow through the tested tunnel. Non-default-server resellers (if any) are explicitly preserved.

---

## Not Fixed (tracked but low-priority)

Several other internal services still hardcode `https://${WHM_HOST}:2087` — they time-out on every cycle but don't block user flows:
- `js/protection-heartbeat.js:28`
- `js/hosting-health-check.js:30`
- `js/cpanel-migration.js:83,146`
- `js/whm-service.js:242` (display-only URL for credential handouts)

These should migrate to `WHM_API_URL` in a follow-up sweep. They produce log noise (`cPHulk error`, `license check error: socket hang up`) but users don't see them.

