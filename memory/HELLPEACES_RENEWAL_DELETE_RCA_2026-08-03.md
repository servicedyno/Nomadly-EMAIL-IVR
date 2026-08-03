# @hellpeaces (chatId 5522767823) — cPanel renewal + file-delete RCA — 2026-08-03

Investigated from Emergent dev pod. Env set up from provided .env with BOT_ENVIRONMENT=development +
SKIP_WEBHOOK_SYNC=true (protects prod Telegram bot). MONGO_URL/WHM/Railway = PRODUCTION (read-mostly).
Current time of investigation: 2026-08-03 ~15:25 UTC.

## Identity
- @hellpeaces = chatId **5522767823**
- cPanel user **prevc2b4**, domain **previteletterviews.com**, plan "Premium Anti-Red HostPanel (1-Month)"
- WHM host 68.183.77.106, renewalPriceUsd (price-locked) = $75

## ASK 1 — What triggered the cPanel renewal (last 2-4h)?
**AUTO-RENEW CRON (HostingScheduler), NOT the user.**
Railway (Nomadly-EMAIL-IVR) proof:
  [2026-08-03T13:02:12] [HostingScheduler] Auto-renewed previteletterviews.com (Premium Anti-Red HostPanel (1-Month)) for 5522767823 — charged $75
  [2026-08-03T13:02:12] [HostingScheduler] Check complete: 1 renewed, 0 notified, 0 suspended, 0 deleted
Trigger chain:
  - Plan expired; account suspendedAt 2026-08-02 11:40.
  - 2026-08-03 12:15:50 user deposited $81 (USDT-TRC20 ref y0pd3) + $5 first-deposit bonus → bal ~$91.
    (User intended this to BUY A NEW plan — admin @onarrival1 told him at 12:43 to buy new.)
  - `autoRenew` was NEVER set on the account → hosting-scheduler treats `autoRenew !== false` as TRUE (default ON).
  - 13:00 scheduler tick → 13:02:12 auto-renewed: smartWalletDeduct($75) [no metadata → generic ledger],
    extended expiry to 2026-09-02, unsuspended, redeployed anti-red.
  - User upset: 14:15 "I DON KNOW WHY THE CPANNEL AUTO RENEW ITS SELF"; 15:10 "...i have no other options then to walk away".

## ASK 2 — Why can't he delete/extract files? (root cause)
**COMMA-IN-FILENAME cPanel API limitation.** NOT the July EPERM (account is HEALTHY now:
WHM accountsummary suspended=0, quota under limit 3495M/5000M, inodes OK).
- Stuck file: **`Downloader,withName.zip`** (372,286 B) present in BOTH
  /home/prevc2b4/public_html/scren and /home/prevc2b4/public_html/july (verified live via WHM API).
- cPanel `Fileman::fileop` `sourcefiles` is a COMMA-delimited list with no escape. `Downloader,withName.zip`
  splits into `Downloader` + `withName.zip` → "Failed to move 'Downloader' to trash (No such file or directory)".
- Railway logs 13:45–13:57 show repeated Panel delete failures + user's 13:57 "PLEASE THE CPANNEL IS STILL
  NOT ALLOW ME TO EXTRACT OR DELETE".
- Empirically ruled out ALL API workarounds (live tests):
  * api2 scalar → split. UAPI (apiv3) has NO `fileop`. api2/UAPI array (repeated key) → still split.
  * backslash-escape → split. rename-to-strip-comma → source splits (fails).
  * root SSH:22 reachable BUT password auth DISABLED (publickey only, no key available here).
- Affected code (all build `${dir}/${file}` into sourcefiles): cpanel-proxy.js deleteFile/renameFile/
  extractFile/copyFile/moveFile + WHM fallback in cpanel-routes.js /files/delete & /files/extract.
- No filename sanitization at upload → comma uploads get permanently stuck.
=> Programmatic removal of the 2 stuck files is IMPOSSIBLE with available creds; needs operator root
   console `rm` on the WHM box.

## ASK 3 — How much was debited for the renewal?
**Exactly $75.00.** walletLedger: one entry [2026-08-03T13:02:07.542Z] type=wallet_deduction amount=-75
balanceAfter=16. walletOf now usdIn=91 / usdOut=75 → **balance $16.00**. No double-charge; payments legacy
had NO "HostingRenew" row (confirms auto-renew path, not manual).

## Recommended fixes (pending user decision)
1. FILE FLOW (code): detect comma (and other fileop-delimiter) filenames on delete/rename/extract → stop the
   silent success-but-present loop, return honest localized message + page ops with exact `rm` command;
   reject/auto-rename comma filenames at UPLOAD to prevent recurrence.
2. OPS: operator with root console removes /home/prevc2b4/public_html/{scren,july}/Downloader,withName.zip
3. BILLING/UX: autoRenew defaults ON — decide whether to (a) refund @hellpeaces $75, (b) turn his autoRenew
   off, and/or (c) change the product so auto-renew is opt-IN. (Money/policy = operator's call.)
