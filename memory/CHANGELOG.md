# CHANGELOG — Nomadly Bot

## 2026-02 — Railway log-analysis follow-up fixes (Issues 1–6)

Source: `/app/RAILWAY_LOG_ANALYSIS_LATEST.md` + previous-job triage. The five
backend anomalies identified in the production Railway logs were all
addressed and verified with a 74-test Node unit suite (`/app/tests/test_*_fixes.js`).

### Issue 1 — DnsHealer "attempt 1/3" infinite loop (P0)
**File:** `js/dns-healer.js`
- **Root cause:** every healthy probe wrote `attempts: 0`, so a flapping
  domain (healthy → unhealthy → healthy → unhealthy …) was reset on each
  blip and could never advance past attempt 1.
- **Fix:** only reset `attempts` once the domain reaches `stable` status
  (3 consecutive healthy probes). Added `Math.min(attempts, MAX_ATTEMPTS)`
  clamp + explicit `status === 'escalated'` short-circuit in the heal path
  so the worker never re-enters `attemptHeal()` once escalated.

### Issue 2 — ProtectionHeartbeat "3x consecutive" guard ineffective (P0)
**File:** `js/protection-heartbeat.js`
- **Root cause:** `consecutiveRepairs` counter was an in-memory `{}` object —
  every Railway container restart reset the map to empty, so the 3-strike
  skip-guard never actually fired in production.
- **Fix:** persist the counter to `cpanelAccounts.protectionRepairCount` in
  Mongo via new `getRepairCount` / `setRepairCount` helpers. Once an account
  hits `MAX_CONSECUTIVE_REPAIRS`, it's also pre-filtered out of the heartbeat
  scan query, saving 2 WHM round-trips per cycle. Stuck accounts now record
  `protectionLastSkipReason` + `protectionStuckAt` for admin debugging.

### Issue 3 — Sustained V8 heap pressure (P1)
**Files:** `js/_index.js`, `package.json`, `scripts/setup-nodejs.sh`,
`/etc/supervisor/conf.d/supervisord_nodejs.conf`
- **Root cause (a):** Node was running with the default ~50MB old-space cap,
  pinning heap usage at 95-97% (cited in log analysis).
- **Root cause (b):** the `[Memory]` warning calculated `heapUsed/heapTotal`
  instead of `heapUsed / v8.heap_size_limit`. Because V8 grows `heapTotal`
  lazily, every memory tick reported "HIGH" no matter the real headroom —
  6 false-positive warnings per minute.
- **Fix:** raised the cap to `--max-old-space-size=2048` everywhere (npm
  start script, supervisor conf, setup script). Rewrote the memory-tick to
  compare against `v8.getHeapStatistics().heap_size_limit`. Live logs now
  show `limit=2072.0MB heapPct=2.3%` instead of `heapPct=96% ⚠️ HIGH`.

### Issue 4 — AI Support routing for MySQL (P1)
**File:** `js/ai-support.js`
- **User override:** route users to the hosting panel for ALL MySQL tasks
  (NOT to any in-bot `/mysql` command).
- **Fix:** added a dedicated "🗄️ MySQL Databases (managed in the hosting
  panel)" section to the system prompt. Tells the LLM exactly which panel
  tab to send users to (Databases → MySQL Databases / MySQL Users /
  phpMyAdmin / Remote MySQL), explicitly forbids pointing users at any
  in-bot `/mysql` command, and reminds the model about the `<cpUser>_`
  prefix that cPanel applies.

### Issue 5 — cPanel Health WHM probe false-positive DOWNs (P2)
**File:** `js/cpanel-health.js`
- **Root cause:** `PROBE_TIMEOUT_MS=6000` + `DOWN_THRESHOLD_MISSES=2` was
  too aggressive for CF-tunnel edge reroutes that occasionally take 6–8s.
- **Fix:** bumped timeout to 10s and the consecutive-miss threshold to 3.
  Adds ~40s to true-outage detection in exchange for eliminating
  false-positive admin alerts and false-positive cPanel-queue pauses.

### Issue 6 — MySQL Manager smoke test (P2)
**File:** `tests/test_mysql_manager_smoke.js`
- 40-assertion test verifying:
  - All 16 MySQL helper functions exported from `cpanel-proxy.js`.
  - All 17 `/mysql/*` routes mounted in `cpanel-routes.js` under the
    Gold-only auth gate (`requireGold`).
  - Each helper routes to UAPI `module=Mysql` with the correct `func` name
    (list_databases, create_database, set_privileges_on_database, add_host)
    and joins multi-privilege arrays with `,` per cPanel's API contract.

### Verification
- **Unit tests:** 74/74 passing.
  ```
  tests/test_dns_healer_fixes.js              18/18
  tests/test_protection_heartbeat_fixes.js     7/7
  tests/test_ai_support_and_health_fixes.js    9/9
  tests/test_mysql_manager_smoke.js           40/40
  ```
- **Live process logs** after restart confirm:
  - `[Memory] limit=2072.0MB heapPct=2.3%` (was: 96% ⚠️ HIGH)
  - `[cPanel Health] DOWN — confirmed after 3 consecutive probe misses` (was: 2)
  - `[DnsHealer] tick: probed=0 healthy=0 … escalated=0` (no spam)

### Files touched
| File | Change |
|------|--------|
| `js/dns-healer.js` | attempts no longer reset on every healthy probe; escalated state sticky |
| `js/protection-heartbeat.js` | counter persisted to Mongo; scan pre-filters stuck accounts |
| `js/_index.js` | memory metric uses `v8.heap_size_limit` instead of `heapTotal` |
| `js/ai-support.js` | new MySQL → hosting panel routing in system prompt |
| `js/cpanel-health.js` | `PROBE_TIMEOUT_MS=10000`, `DOWN_THRESHOLD_MISSES=3` |
| `package.json` | npm start uses `--max-old-space-size=2048` |
| `scripts/setup-nodejs.sh` | supervisor template uses `--max-old-space-size=2048` |
| `/etc/supervisor/conf.d/supervisord_nodejs.conf` | live supervisor config updated |
| `tests/test_dns_healer_fixes.js` | new |
| `tests/test_protection_heartbeat_fixes.js` | new |
| `tests/test_ai_support_and_health_fixes.js` | new |
| `tests/test_mysql_manager_smoke.js` | new |
