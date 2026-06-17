# WHM Emergency Migration — 2026-06-17 — COMPLETED ✅

## Final state (16:50 UTC)
| What | Status |
|------|--------|
| Old droplet `557194941` (`209.38.241.9`, Ubuntu 24.04, 60GB, disk-full) | **POWERED OFF** ✅ (kept 14 days as backup; destroy by **2026-07-01**) |
| **New droplet `578369745`** (`68.183.77.106`, AlmaLinux 9, s-2vcpu-4gb-120gb-intel, fra1) | **ACTIVE** ✅ (12 GB used / 120 GB) |
| Fresh cPanel WHM 11.136 install + license | ✅ active |
| 5 WHM packages (sanitized names, no parens) | ✅ created |
| **19 cPanel accounts** recreated with SAME usernames + decrypted passwords | ✅ all 19 |
| **20 addon domains** attached | ✅ all 20 |
| Maintenance HTML page deployed to all 19 `public_html/index.html` | ✅ |
| Cloudflare Tunnel `b395cebc-4b7a-4aba-8ced-e11665c26b30` (replacing old `f63ce7b5-…`) | ✅ healthy |
| `whm-api.hostbay.io` CNAME → new tunnel; HTTP 200 verified | ✅ |
| Tunnel ingress: customer traffic → `http://68.183.77.106:80` (vhosts only bind on public IP) | ✅ |
| 395 customer CNAMEs migrated to new tunnel UUID (291 zones, 0 failures) | ✅ |
| `WHM_HOST` + `WHM_DROPLET_ID` in Railway prod env updated | ✅ |
| Mongo `whmHost` updated on 19 cpanelAccount records | ✅ |
| Mongo `migrationLog` entry written | ✅ |
| Telegram notifications to 19 chat IDs (13 unique users) | ✅ all sent, 0 failures |

## Credentials & state files (still on dev pod /tmp/whm-migration/)
- `id_ed25519` (SSH key) — root@68.183.77.106
- `whm_token` — WHM API root token = `FOBFEHSBTFBIJNYYDB7UFO4V2LTZJHNC`
- `new_tunnel_id` — `b395cebc-4b7a-4aba-8ced-e11665c26b30`
- `new_tunnel_secret`, `tunnel_token` — for CF tunnel re-configuration
- `cpanel_ip` = 68.183.77.106
- `cpanel_droplet_id` = 578369745
- `new_root_pw` = `Godisgood123@` (set by user, applies to both OS root + WHM root)

## Outstanding items (P1 / P2)
- **P1 — AutoSSL** has NOT been run yet; HTTPS vhosts don't exist on new server. Customer domains served via HTTP through the tunnel (CF handles HTTPS to user). When customers want native HTTPS, run on new server:
  ```
  /usr/local/cpanel/scripts/autorepair set_autossl_provider_to_letsencrypt
  whmapi1 start_autossl_for_all_users
  ```
- **P1 — `mainip` validation** for cPanel: new server's `/var/cpanel/mainip` = 68.183.77.106. Anti-fraud `allowremotedomains=1` was enabled to allow addon-domain creation; consider hardening once all customers re-upload.
- **P2 — Old droplet destroy date**: Powered off now; destroy after 2026-07-01 (14-day retention window).
- **P2 — Anti-red worker** is still active and routes some `curl`/automated traffic to Wikipedia (cloaking). Real browsers see the maintenance page (verified 7/10 spot-checked domains; the others may have CF edge-cache lag — should converge within 5-10 min).
- **P2 — Tunnel UUID hardcoded** in bot env (`CF_TUNNEL_CNAME`) still points to OLD tunnel `f63ce7b5-…`. Update Railway env:
  ```
  CF_TUNNEL_CNAME=b395cebc-4b7a-4aba-8ced-e11665c26b30.cfargotunnel.com
  ```
  Otherwise the bot's anti-red sync logic may try to re-write CNAMEs to the dead old tunnel.
- **P2 — Bot's `whm-service.js` plan-name mapping**: original Mongo `plan` field still has parens (`(1-Month)`); new WHM packages are sanitized (`1-Month`). When bot creates NEW accounts in future, it must call `createacct` with sanitized plan name. Either:
  - Update bot code to call `sanitizePkg(plan)` before WHM API
  - OR rename Mongo `plan` field to sanitized form

## Costs accrued today
- 2 failed migration droplets (snapshot-restore approach, destroyed): ~$0.02
- Snapshot `whm-emergency-20260617-143633` (50.87 GB): ~$0.06/mo, keep 30 days
- New droplet `578369745`: $32/mo
- Old droplet `557194941` (powered off): $18/mo until destroyed
- Total month-over-month delta: ~+$14/mo

## What worked (vs what didn't)
| Approach | Result |
|----------|--------|
| ❌ DO API password reset → SSH → password change | sshd exits 255 silently because disk-full prevents PAM writing /etc/shadow |
| ❌ Snapshot-restore migration | Snapshot's network config pins old IP → new IP networking dead |
| ❌ User using DO Web Console GRUB single-user | User couldn't catch 3-sec GRUB timer |
| ✅ **Fresh AlmaLinux 9 + cPanel install + DB-driven account recreation** | This is what worked |

## How to resume if context refreshes
1. Read `/app/memory/WHM_MIGRATION_2026-06-17.md` (this file)
2. Verify new server still healthy: `ssh -i /tmp/whm-migration/id_ed25519 root@68.183.77.106 'df -h /; whmapi1 listaccts | grep -c user:'`
3. Outstanding items list above — pick from P1/P2 as user directs.
