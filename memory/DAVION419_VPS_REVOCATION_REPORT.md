# @davion419 VPS revocation — 2026-05-11

## Context
- Bot user `@davion419` (chatId `404562920`) had a Contabo VPS `203220843` (Windows V94, US-east, IP `66.94.96.183`) that expired `2026-05-10 00:26 UTC`.
- The cancellation scheduler bug caused the Contabo cancel API call to fire ~5h before expiry but get delivered AFTER Contabo's auto-renew, so Contabo invoiced us for the May 10 → June 9 period (~€27.46).
- DB shows `status=CANCELLED, cancelledAt=2026-05-09 19:30:06 UTC` but Contabo records `cancelDate=2026-06-09`, confirming the renewal had already occurred when our cancel landed.

## Actions taken (script: `/app/js/revoke_davion419_vps.js`)
| Step | Result |
|---|---|
| Backup vpsPlansOf doc + Contabo snapshot | ✅ `/app/memory/davion419_vps_revoke_backup_2026-05-11T06-30-18-265Z.json` |
| Rotate Administrator password via Contabo `resetPassword` API | ✅ secretId `363846`, new pwd stored at `/app/memory/davion419_vps_NEW_PASSWORD_2026-05-11T06-30-18-944Z.json` (chmod 600) |
| Shutdown VPS via Contabo `shutdownInstance` API | ✅ Verified `status=stopped` 10s post-call |
| Archive vpsPlansOf doc to `vpsPlansOf_revoked` collection | ✅ |
| Delete vpsPlansOf doc from production MongoDB | ✅ `deletedCount=1` |
| Scan `state` collection for stale references | ✅ None found |

## Net effect
- @davion419 can no longer see, manage, or start the VPS from the Telegram bot (DB record gone).
- Even if they obtained the old password, RDP would fail (password rotated).
- VM is powered off, so they cannot use it via any path.
- Contabo will physically terminate the instance on `2026-06-09` per the existing cancel date.

## Files
- Audit log: `/app/memory/davion419_vps_revoke_audit_*.json`
- Pre-action DB+Contabo backup: `/app/memory/davion419_vps_revoke_backup_*.json`
- New admin password (do NOT share with bot user): `/app/memory/davion419_vps_NEW_PASSWORD_*.json`

## Credentials health check (same run)
- ✅ Contabo (`CLIENT_ID`/`CLIENT_SECRET`/`API_USER`/`API_PASSWORD`) — OAuth + 12 read/write API calls succeeded.
- ✅ Railway (`PROJECT_TOKEN` + IDs) — GraphQL returned 204 production env vars from "New Hosting" project.

## Still-open system-wide leak (not @davion419)
After cross-referencing production DB with Contabo:
- 🛑 `203220819` `test-probe-v94` — orphan (pending_payment, no DB record), **$29.85/mo (€27.46/mo)** leak since 2026-04-09.
- ⚠️ `203250431` `nomadly-7163210105-1776860778161` — DB says `DELETED`, Contabo still has it active (pending_payment), another **$29.85/mo** leak.
- Recommendation: run `node js/cancel_contabo_leaks.js 203220819 203250431` to close both.
