# Anti-Red protection STUCK false-positive — root cause + fix (2026-06-24 v2)

## Incident
Production admin Telegram chat flooded with "⚠️ Anti-Red protection STUCK" alerts.
At time of report, 28 cPanel accounts on prod had `protectionStuckAt` set with
`protectionLastSkipReason="stuck_repair_loop"` and `protectionRepairCount=3`,
including a hosting plan purchased only 37 minutes earlier (`digitalrsvpinview.com`,
cpUser `digice1d`).

Live HTTP probes against the affected domains confirmed the actual anti-red
protection was **working correctly** — scanner UAs received 302/403 cloak
responses, normal Chrome received the real site. So the STUCK state was a
**false positive**.

## Root cause (two compounding bugs)

### A. WHM read returns empty under load — heartbeat treats that as "files missing"
`js/protection-heartbeat.js::checkAndRepair` reads `.user.ini` and
`.antired-challenge.php` via WHM `/json-api Fileman::get_file_content`. When
WHM is slow or `cpsrvd` is under load, the call returns HTTP 200 with empty
content (no error). The heartbeat treated this as "files missing", called
`deployCFIPFix(force:true)`, and incremented `protectionRepairCount`. After
3 consecutive false-positive empty reads → `protectionStuckAt = new Date()`,
admin Telegram alert fired, account excluded from scans for 6h.

The 2026-06-24 v1 fix (single retry with 750ms delay) wasn't enough under
sustained WHM load — the retry just hit the same empty-read condition.

### B. Dev sandbox was polluting production
The dev pod (Emergent sandbox) shares the production `MONGO_URL` but cannot
reach `WHM_HOST=68.183.77.106:2087` (TCP firewall — proven by 30s timeout
on every call). Every heartbeat cycle from the dev pod returned empty
reads for every account → false-positive REPAIR → counter increment →
STUCK + admin alert on PROD accounts. Today's 14:07-14:09 stuck timestamps
(`cap1a612`, `hunt9853`, `veri406e`) were CAUSED BY OUR DEV POD.

## Fix (js/protection-heartbeat.js)

### 1. Dev-safety guard
`runHeartbeat()` and `startScheduler()` now early-return when
`SKIP_WEBHOOK_SYNC === 'true'`. This is the project's canonical "dev sandbox"
marker. The dev pod never again writes to prod `cpanelAccounts` or fires
admin alerts.

### 2. Stronger transient retry
Upgraded from `1 × 750ms` to `3 × [750ms, 2s, 5s]` exponential backoff.
Loops until either content arrives or the budget is exhausted. The
property-name bug (`iniRes.error` → `iniRes.fetchError`) is also fixed.

### 3. Trust-last-deploy fallback (the key false-positive killer)
After all retries, if BOTH files are still empty AND there are no explicit
whmErrors/fetchError-with-status, the heartbeat now consults the account's
`lastCfIpFixSig` field. If a deploy signature is present (= cryptographic
proof we successfully deployed the protection files at some point), the
heartbeat classifies the empty reads as `whm_read_unreliable` and returns
`{ok:true, action:'skipped', reason:'whm_read_unreliable'}` WITHOUT
incrementing the counter, WITHOUT calling `deployCFIPFix`, and WITHOUT
firing the admin alert.

Accounts that have NEVER been deployed (no signature) still go through
the existing repair path — the fix doesn't weaken first-deploy behaviour.

### 4. New pure helpers (unit-testable without WHM)
- `RETRY_DELAYS_MS = [750, 2000, 5000]`
- `isEmptyReadPair(iniRes, phpRes)`
- `hasNoExplicitError(iniRes, phpRes)`
- `shouldSkipAsTransient(snapshot)`

## One-shot cleanup
`scripts/reset_falsely_stuck_protection.js` clears
`protectionStuckAt / protectionLastSkipReason / protectionRepairCount=0`
on every account that has `lastCfIpFixSig` AND was marked
`stuck_repair_loop` — i.e. the false-positive cohort. Records
`protectionManualResetAt/By` for audit. Idempotent.

Ran 2026-06-24: 18 accounts reset (matchedCount=18, modifiedCount=18). The
remaining 10 stuck accounts have `whmHost=undefined` from the 2026-06-17 WHM
migration — they're genuinely orphaned (no WHM record to repair against),
not false-positives, so we left them alone for separate cleanup.

## Tests
- `tests/protection-heartbeat-stuck-false-positive.test.js` — 26 unit tests
  covering the new helpers and dev-safety guard (Jest, no WHM/DB needed).
- `tests/protection-heartbeat-transient-empty-read.test.js` — rewritten to
  source-pin the v2 guard blocks (anti-revert) and re-validate the predicate
  truth table.
- All 337 tests in `tests/` pass; eslint clean.

## Deploy
**Save to GitHub** → Railway auto-redeploys. After the new process boots:
- The dev sandbox heartbeat stays dormant (SKIP_WEBHOOK_SYNC=true).
- The prod heartbeat retries up to 3× with backoff before concluding a file
  is missing.
- Accounts that have ever been deployed (`lastCfIpFixSig` set) are immune to
  WHM-empty-read-driven false STUCK alerts.

## Follow-up to consider
- Investigate WHM `cpsrvd` overload root cause (why is `get_file_content`
  returning empty under load? cpsrvd memory limit? AutoSSL contention?).
  Likely candidate: the WHM Droplet was migrated 2026-06-17 and is
  undersized for current account count.
- Consider adding an HTTP-level health probe (visit the domain and observe
  cloak vs real-site behaviour) as a second-opinion before any STUCK alert
  fires, so the heartbeat's view of WHM state can be cross-checked against
  what visitors actually see.
- Telegram alert dedupe — currently each newly-stuck account fires its own
  message. A digest-by-hour would have prevented the alert flood.
