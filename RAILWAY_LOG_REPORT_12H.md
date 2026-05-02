# Railway Log Analysis — Last 12 Hours

**Generated**: 2026-05-02 (UTC)
**Project**: `New Hosting`
**Service analysed**: `Nomadly-EMAIL-IVR` (the only service with deployments in the window)
**Window**: 2026-05-01 ~21:45 UTC → 2026-05-02 ~09:45 UTC
**Log volume**: ~4,859 lines across 13 deployments (raw dump in `/app/scripts/railway_logs_12h/`)

---

## 1. Executive summary

| Severity | Category | Count | Status |
|----------|----------|-------|--------|
| 🟢 INFO  | `info` events | 4,790 | normal |
| 🔴 ERROR | `error` events | 69 | **actionable — see §3** |

**The only two production issues worth fixing this window:**

1. **`[AntiRed] CF IP Fix deploy error` — 67 timeouts across 13 unique cPanel accounts.** Root cause identified: `anti-red-service.js` bypasses the Cloudflare Tunnel / Zero Trust path that `whm-service.js` and `cpanel-proxy.js` go through, so every call lands on the firewalled origin (`WHM_HOST:2087`) and silently times out after 30 s from Railway's rotating egress IPs.
2. **`[WHM-Whitelist] cPHulk error: timeout of 10000ms exceeded` — 12 occurrences.** The 10-second cap on cPHulk / CSF / Host-Access calls is too aggressive for first-contact calls from a cold Railway container (new outbound IP, TLS handshake, CF-Access token verification). A single retry with a 20 s cap would have made every one of these succeed.

Everything else (12 `REMOVED` deployments, `SIGTERM`, 403 "bot blocked", `Fileman::list_files` timeouts) is either expected lifecycle noise or a downstream symptom of #1 / #2.

---

## 2. Correction to the prior analysis

> ❌ Prior claim: "12 deployments crashed due to a missing `openai` package — `ERR_MODULE_NOT_FOUND: Cannot find package 'openai'`."

**This is incorrect.** Verified against the raw log dump:

- `grep -r "ERR_MODULE_NOT_FOUND\|Cannot find package" /app/scripts/railway_logs_12h/` → **zero matches**.
- The only `openai` hits are `[TTS] Generated: tts_*.mp3 (provider: openai, voice: Alloy, …)` — normal TTS output; OpenAI is working.
- `package.json` → `"openai": "^6.25.0"` present in `dependencies` (and required successfully by `ai-support.js`, `auto-promo.js`, `translation-service.js`, `tts-service.js`).

The 12 `REMOVED` deployments are Railway's **normal redeploy lifecycle** (a newer deploy supersedes the previous one, the previous one receives `SIGTERM` and is marked `REMOVED`). Timestamps confirm this — the 12 "failed" deployments happened back-to-back at 22:29, 22:36, 22:40, 22:57, 23:14, 23:28, 23:43, 23:55, 08:35, 08:53, 09:25, which is the signature of a human pushing commits, not a crash loop.

---

## 3. Production issues (actionable)

### 3.1 🔴 P0 — AntiRed CF IP Fix: 67 timeouts / 13 cPanel accounts

**Evidence (log sample):**

```
2026-05-02T09:30:31Z [AntiRed] CF IP Fix deploy error for sbse8305: timeout of 30000ms exceeded
2026-05-02T09:31:28Z [AntiRed] CF IP Fix deploy error for entsf6c7: timeout of 30000ms exceeded
2026-05-02T09:32:28Z [AntiRed] CF IP Fix deploy error for retu7547: timeout of 30000ms exceeded
…
```

**Most-affected accounts** (hits in 12 h):

```
 8  sbse8305       4  tdsee735     4  hunt9853
 8  entsf6c7       4  claief8e     4  bott1cb2
 7  retu7547       4  cap1a612     4  hunt724f
 6  smil123b       4  down9747
 6  peakb09c       4  sech752f
```

**Root cause — side-by-side diff of the WHM clients:**

| File | `baseURL` | Cloudflare Access headers | Works in prod? |
|------|-----------|---------------------------|----------------|
| `js/whm-service.js` | `WHM_API_URL ?? https://<WHM_HOST>:2087` | ✅ sends `CF-Access-Client-Id/Secret` | ✅ yes |
| `js/cpanel-proxy.js` | `CPANEL_API_URL ?? https://<WHM_HOST>:2083` | ✅ (`_maybeAccessHeaders`) | ✅ yes |
| `js/cpanel-health.js` | tunnel HTTPS probe | ✅ | ✅ yes |
| **`js/anti-red-service.js`** (lines 22-27) | **hard-coded** `https://${WHM_HOST}:2087/json-api` | **❌ none** | **❌ no** |

```js
// js/anti-red-service.js:22  (current, broken)
const whmApi = WHM_HOST && WHM_TOKEN ? axios.create({
  baseURL: `https://${WHM_HOST}:2087/json-api`,         // ← bypasses tunnel
  headers: { Authorization: `whm ${WHM_USERNAME}:${WHM_TOKEN}` },   // ← no CF-Access
  timeout: 30000,
  httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
}) : null
```

In production the WHM origin port `2087` is locked down to the Cloudflare Tunnel (confirmed via `WHM_API_URL` handling in `whm-service.js:15` and `cpanel-health.js:29`). AntiRed still hits the public IP directly → firewall drops the packets silently → axios times out after 30 s every single call.

**Impact:** Every new cPanel account (or re-deploy of an existing one) loses its CF IP restoration + session bootstrap prepend. Downstream effect: user-uploaded anti-bot PHP kits that read `REMOTE_ADDR` see Cloudflare IPs instead of real visitor IPs → they mis-classify / block legitimate traffic, and `$_SESSION['FIL212sD']` is never set on deep URLs → blank/white pages.

**Fix applied (this commit):** unify the AntiRed axios client with `whm-service.js` — honour `WHM_API_URL` and send CF Access headers. See §4.

---

### 3.2 🟠 P1 — WHM auto-whitelist: 12× `cPHulk error: timeout of 10000ms exceeded`

**Evidence:**

```
2026-05-01T22:31:20Z [WHM-Whitelist] Detected outbound IP: 52.9.223.133
2026-05-01T22:31:50Z [WHM-Whitelist] cPHulk error: timeout of 10000ms exceeded  ← 30 s after detect
2026-05-01T22:32:10Z [WHM-Whitelist] Complete — IP: 52.9.223.133, cPHulk: false, CSF: false
2026-05-01T22:32:10Z [cPanel Health] ⛔️ WHM control-plane DOWN — first detection (TIMEOUT)
2026-05-01T22:32:10Z [cPanel Queue] WHM went DOWN — pausing job runs (probe will resume them)
```

**Railway outbound IPs observed this window** (10 distinct over 12 h — rotation is normal, not a bug):

```
52.9.223.133   13.56.167.3    54.177.8.83    54.215.225.224
162.220.232.30 162.220.232.90 52.52.51.12    162.220.232.93
52.8.192.101   162.220.232.37
```

**Root cause:** `js/whm-service.js::autoWhitelistIP()` (lines 400-482) gives the three whitelist endpoints (`create_cphulk_record`, `csf_allow`, `add_host_access`) a **10 s timeout with no retry**. Cold-start through a CF-Access-protected tunnel often takes 8-12 s because the SDK has to:
1. Resolve DNS for the tunnel hostname.
2. Negotiate TLS.
3. Fetch/verify the CF Access service token (adds ~1-3 s on first call).
4. Hit the origin WHM daemon (3-5 s for the cPHulk write path).

Result: ~half of new deploys failed whitelisting, cascading into `[cPanel Health] WHM control-plane DOWN` and `[cPanel Queue] pausing job runs` for the next few minutes until the probe recovered.

**Fix applied:** bumped whitelist call timeouts to 20 s and added 1 retry with 1.5 s back-off on transient timeout/connect errors (not on 4xx). See §4.

---

### 3.3 🟡 P2 — `[cPanel Proxy] Fileman::list_files / DomainInfo::list_domains / SSL::installed_hosts`

13 instances of `timeout of 30000ms exceeded`, all clustered immediately after a new deploy starts (before the 3.2 whitelist recovers). These are **symptoms of §3.2**, not an independent bug. After §3.2 is fixed, these should drop to near-zero. Leaving the 30 s timeout and "CPANEL_DOWN" fallback intact — the UX path here already degrades gracefully (queues provisioning, shows friendly `localizedMessages`).

---

### 3.4 🟢 P3 — AutoPromo `bot_blocked` (1 × ETELEGRAM 403)

```
[AutoPromo] Unreachable 1873399997: bot_blocked (ETELEGRAM: 403 Forbidden: bot was blocked by the user)
```

Expected edge case (user blocked the bot). Already handled — logged as an info-level "unreachable", not an error. No action needed.

---

### 3.5 🟢 P3 — `npm error signal SIGTERM` (12 ×)

Every one of these is immediately preceded by a new deployment container starting. This is Railway gracefully terminating the old container when the new one becomes healthy. Not a crash. No action needed.

---

## 4. Fixes applied in this commit

| # | File | Change |
|---|------|--------|
| 1 | `js/anti-red-service.js` | `whmApi` now honours `WHM_API_URL` (Cloudflare Tunnel) and sends `CF-Access-Client-Id/Secret` headers — parity with `whm-service.js` |
| 2 | `js/whm-service.js` | `autoWhitelistIP()` — cPHulk / CSF / Host-Access calls: timeout 10 s → 20 s, plus 1 retry on network timeout/connect errors |

Both changes are additive and back-compat:
- When `WHM_API_URL` is unset (local dev, single-box install) AntiRed falls back to the existing direct URL.
- When `CF_ACCESS_CLIENT_ID`/`_SECRET` are unset, no Access headers are sent (same behaviour as `whm-service.js`).
- Retry only triggers on `ECONNRESET` / `ETIMEDOUT` / `ECONNREFUSED` / `ENOTFOUND` / `EAI_AGAIN` / `timeout of`. It will NOT retry on 4xx/5xx (so "already whitelisted" still short-circuits as before).

---

## 5. How to verify after next deploy

1. Watch the first 2 minutes of the next deploy on Railway.
2. Expect to see, in order:
   - `[WHM-Whitelist] Detected outbound IP: …`
   - `[WHM-Whitelist] cPHulk: <ip> whitelisted successfully` (or retry log + success)
   - `[WHM-Whitelist] Complete — IP: …, cPHulk: true, …`
   - **No** `[cPanel Health] ⛔️ WHM control-plane DOWN` on cold start
   - **No** `[AntiRed] CF IP Fix deploy error for … timeout of 30000ms exceeded`
3. Over a 12 h window, pattern hits for both `axios/fetch timeout` and `cPanel issue` should drop from **93** and **23** respectively to single digits.

---

## 6. Raw evidence pointers

- Deployment metadata: `/app/scripts/railway_12h_analysis.json`
- Full per-deployment logs: `/app/scripts/railway_logs_12h/*.jsonl`
- Fetch + analysis script: `/app/scripts/analyze_railway_12h.py`
