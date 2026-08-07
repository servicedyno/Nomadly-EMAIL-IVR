# Nomadly (Nomadly-EMAIL-IVR) — Railway Prod Log Scan
Window: 2026-08-05 01:36Z → 2026-08-07 01:36Z (last 48h) | 49,992 log lines analyzed
Source: Railway deploymentLogs via project token (API_KEY_RAILWAY)

## A. USER-REPORTED ISSUES (from in-bot Support sessions)
1. SMS App download + sign-in broken — user 8571206732 (FreemanHuey0), 08-05 09:50
   "the app download link ... just tells you to buy a Domain, you don't even land in the download page ...
    whether you input that 10 digit code or any 6 digit code the sign in button is inactive doesn't work"
   Admin: "We will investigate and resolve if there is a bug." → likely UNFIXED. Sent video "same on phone".
2. Site not resolvable / Cloudflare Error 1016 — user 1056249916 (ApuNahasapemapeti), 08-05 22:05-22:36
   "my site is not resolvable", "why it's not working", "cloudflare Error 1016". Correlates w/ CF token 403 below.
3. Domain nameserver problem — user 8868602470 (Grrt2231), 08-07 00:52 (very recent)
   "What's wrong with my domain? Rbc". Correlates w/ NS-update failures below.

## B. STILL-ACTIVE TECHNICAL ANOMALIES (last-seen near window end = unfixed)
1. [P0] ConnectReseller availability/price API 401 — "Maybe IP Not Whitelisted / Unauthenticated user"
   x77, last 08-06 23:16. Breaks domain availability+pricing; suspected root of OpenProvider price-fallback overcharge.
2. [P1] Contabo VPS auth invalid_client — "Invalid client or Invalid client credentials"
   x95, last 08-07 01:30 (ongoing). [VPS Self-heal] Could not fetch 203378282: provider auth failed.
3. [P1] Support AI editMessageText failed → fallback send — x43, last 08-07 00:52 (ongoing). Support chat UX bug.
4. [P2] Voice ORPHANED NUMBER +13513540093 — inbound calls rejected, x28, last 08-06 22:22. No owner in DB; needs cleanup.
5. [P2] Cloudflare token missing Zone:DNS:Read (listDNSRecords 403), x6, last 08-06 19:22 → causes Error 1016 (item A2).
6. [P2] Nameserver update failures: "This action is prohibited for current domain status" x3 (to 8868602470, last 08-06 23:41);
   OP updateNameservers 500 code 524 "Domain update is failed" (salopytrew.de). Root of item A3.
7. [P3] CF createDNSRecord 81053 "record already exists" x5; CF deleteDNSRecord 404 x2 — DNS idempotency bugs.
8. [P3] Express unhandled route error: request aborted (POST /honeypot/report) x5, last 08-07 00:40.
9. [P3] TelegramError 403 "user is deactivated" — UNHANDLED promise rejection x2 (should be caught).
10.[P3] cPanel Health license check socket hang up x5; WHM tweak skiphttpdomaincheck FAIL x3 (flaky/non-critical).
11.[P3] Telnyx CALL_REJECTED (few) — ties to Telnyx API 401 seen at runtime.
12.[Ops] Railway rate limit 500 logs/sec reached — 363 messages dropped. Monitors too chatty.
