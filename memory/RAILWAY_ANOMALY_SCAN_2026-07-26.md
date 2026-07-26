# Railway log anomaly scan (last 72h) — 2026-07-26

Project "New Hosting" (id c23ac3d9-...). Scan tooling added:
- scripts/railway_list_services.js — list services + live deployments
- scripts/railway_deploy_history.js <svc> — deploy history
- scripts/railway_anomaly_scan.js <hours> — per-service error-filtered anomaly report (dedupes,
  groups by normalized signature, counts + first/last seen). Uses deploymentLogs (DateTime
  startDate/endDate + filter). Auth: API_KEY_RAILWAY as Project-Access-Token.

## Services
- Nomadly-EMAIL-IVR (svc b9c4ad64, THIS node codebase) — live dep d25621b5 (redeployed Jul 25
  08:58 → only ~36h of logs retained). NOTE: retention = current deployment lifetime.
- HostingBotNew (svc 0a453645, python webhook front) — CLEAN, 0 anomalies.
- LockbayNewFIX (svc 96ee768e, SEPARATE python payments service, NOT in /app).

## Findings & disposition
| # | Anomaly (Nomadly node bot) | Freq | Disposition |
|---|---|---|---|
| 1 | Contabo `invalid_client` / VPS Self-heal auth fail (inst 203378282) | 71x | DEFERRED (config): Contabo OAuth creds now invalid (regression from Jun 26 working state). Contabo phased out; self-heal hammers a dead instance. Fix = update Contabo creds on Railway OR disable Contabo self-heal. |
| 2 | Connect Reseller `checkDomainPriceOnline` 401 "Unauthenticated user / IP Not Whitelisted" + `[CR-Whitelist] 401` + browser login fail | 42x | DEFERRED (config): prod Railway egress IP not whitelisted with Connect Reseller (sandbox IP 34.170.12.145 IS). Whitelist prod IP / rotate CR key. Degrades live price checks (has fallback). |
| 3 | Orphaned number +13513540093 inbound storm → answerCall(90102)+speakOnCall(90034) errors | 31x+ | **FIXED (code)**. See below. |
| 4 | `[ProtectionHeartbeat] WHM read unreliable (empty after 3 retries) → SKIPPING` (~18 accts) + `CpanelMigration timeout 30000ms` | ~250x | ALREADY HANDLED gracefully (skips, no false alert). Root = WHM host latency (infra). No code change. |
| 5 | `[AudioProxy] Error fetching audio 404` 7706898844_64037b3c-5e9.mp3 | 16x (2-min burst Jul 25) | SELF-RESOLVED. Legacy pre-persistence file; NOT in ivrAudioStore (789 other docs OK); chatId owns 0 numbers; NO remaining DB reference. Nothing to fix. |

Benign/expected (no action): AutoPromo 403 "bot blocked by user", Twilio "+120724323318 not valid"
(bad bulk-campaign number), Voice PRE-DIAL BLOCK low_balance, Express request aborted
/honeypot/report, transient OpenAI 500, CF Origin CA rejected *.usbankportal.click (known/throttled).

LockbayNewFIX (separate repo, needs its owner): fincra_service BALANCE_FETCH_FAILED (800x) +
balance_guard CRITICAL OPERATIONS_BLOCKED fincra_NGN/kraken_USD (401x) → wrong/expired
FINCRA_API_KEY (LIVE/TEST mismatch) + kraken underfunded. DB schema bug: column "provider" of
relation "balance_alert_state" does not exist.

## Fix #3 (js/voice-service.js, handleCallInitiated orphaned branch, ~L2016)
Root cause: a robocaller floods a de-provisioned/orphaned number with bursts of call.initiated
that hang up in <1s. The handler used to answerCall→speakOnCall("not in service")→hangup, which
on already-gone/outbound legs threw 90102 (answer on outbound) + 90034 (speak before answered)
error storms, and fired an admin alert on EVERY call (spam).
Fix:
- Replace answer+speak+delayed-hangup with a single `_telnyxApi.rejectCall(cc,'CALL_REJECTED')`
  (SIP reject BEFORE answering → no billed answer, no error storm).
- Throttle admin alert to once per number per 6h via module-level `_orphanAlertThrottle` Map.
Verified: js/tests/test_orphaned_number_reject.js → reject×3, answer×0, speak×0, alerts×2 (one per
distinct number). node -c OK, clean boot.
Note: +13513540093 is not in DB at all (fully abandoned). Recommend releasing it from Telnyx
(manual: telnyxApi.releaseByPhoneNumber) to stop routing/cost — NOT auto-done (destructive).
