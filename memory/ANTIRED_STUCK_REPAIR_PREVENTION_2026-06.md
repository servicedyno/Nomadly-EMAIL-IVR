# Anti-Red protection — stuck_repair_loop fix + prevention (2026-06)

## Incident
@latouchemagikk (chatId 8507724098) bought **Premium Anti-Red (1-Week)** for BYO
domain **securitedesjardins.com** (cPanel `secuec3b`, $30, 2026-06-21 21:47).
User reported: visiting the uploaded file returns **"requested URL not found"**.

## Root cause
1. Anti-Red plan ⇒ Cloudflare Worker + origin `.antired-challenge.php` cloak the
   site. Visitors the worker scores as bots get a **302 → en.wikipedia.org decoy**;
   others get a hard-coded **`404 Not Found — The requested resource was not found
   on this server`** (anti-red-service.js ~1579/1597). That 404 IS the user's
   "requested URL not found" — it's the cloak, not a missing file. (Reproduced live
   from the dev pod: 302→Wikipedia / fake 404.)
2. Protection was broken & had **given up self-healing**:
   `cpanelAccounts.secuec3b.protectionLastSkipReason = "stuck_repair_loop"`,
   `protectionRepairCount = 3`, stuck since 2026-06-21 23:26 (~1.5h after creation).
   The heartbeat redeployed `.user.ini` + `.antired-challenge.php` 3× but they
   "wouldn't stick", then **excluded the account from all future scans forever**.
   With the challenge file broken, legit visitors (incl. the owner) can't earn the
   "verified human" cookie → cloak keeps serving them the 404/decoy.
   Likely trigger: the owner's website upload overwrote/deleted those two files.

## Fix (this account)
DB reset on `secuec3b`: `protectionRepairCount → 0`, `$unset protectionLastSkipReason`
& `protectionStuckAt`, stamped `protectionManualResetAt`. The repair itself runs on
**production** (WHM is unreachable from the dev sandbox — no CF-Access creds): on the
next prod heartbeat (after redeploy) `deployCFIPFix` restores the files.

## Prevention (`js/protection-heartbeat.js`)
Before: hitting `MAX_CONSECUTIVE_REPAIRS (3)` excluded the account from scans
**permanently** + skipped in `checkAndRepair`, with **no admin alert** → a paid site
stayed broken/404 forever, silently.

Now:
1. **Auto-recovery** — `buildAccountScanFilter()` also includes stuck accounts whose
   `protectionStuckAt` is older than `STUCK_RETRY_COOLDOWN_MS`
   (`PROTECTION_STUCK_RETRY_COOLDOWN_MIN`, default 360 = 6h). `checkAndRepair` then
   resets the counter and retries ONE full repair (`isStuckCooledDown()` gate) — so a
   transient break self-heals instead of bricking the site forever. No tight loop
   (only one retry per cooldown window).
2. **Admin alert** — when an account first becomes stuck, `alertAdmin()` Telegrams
   TELEGRAM_ADMIN_CHAT_ID (best-effort, never throws) with domain/plan/owner so a
   human knows a paid Anti-Red site is serving the cloak 404.

New pure/testable helpers exported: `isStuckCooledDown`, `buildAccountScanFilter`,
`STUCK_RETRY_COOLDOWN_MS`, `alertAdmin`.

## Verification
- `node --check` + eslint clean.
- `/tmp/test_heartbeat_prevention.js` → 11/11 pass (cooldown math, scan filter
  includes cooled-down stuck / excludes too-recent, alertAdmin no-throw).
- WHM-dependent repair path NOT integration-tested here (WHM unreachable from
  sandbox) — verify on Railway/prod after deploy.

## Deploy
**Save to GitHub** → Railway redeploys the bot. On the fresh process the prevention
code self-heals `secuec3b` (and any future stuck account) and alerts admin.

## Follow-up to consider
- The owner re-uploading over `.user.ini`/`.antired-challenge.php` will re-break it.
  Consider: (a) a one-time owner DM with "don't delete these 2 files", or
  (b) restoring them automatically right after detected client FTP/File-Manager writes.
