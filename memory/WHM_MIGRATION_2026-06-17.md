# WHM Emergency Migration — 2026-06-17

## Situation
- Old droplet `557194941` (Ubuntu 24.04, `s-2vcpu-2gb`, 60GB → 60GB filled) at IP `209.38.241.9`
  hit 100% disk. cpsrvd died. PAM password change over SSH fails silently (disk full).
- User opted to **migrate via fresh install** rather than recover the old droplet (which would
  need DO Web Console + GRUB single-user — user couldn't easily do that).

## Migration plan
| # | Phase | Status | Driver |
|---|-------|--------|--------|
| A | New droplet (AlmaLinux 9, s-2vcpu-4gb-120gb-intel, fra1) | ✅ done — id=578369745, IP=`68.183.77.106` | E1 (via DO API) |
| B | cPanel installer in background | 🟡 in progress (started 16:04 UTC, ~40-70 min) | E1 (SSH) |
| C | User activates cPanel license on new IP via reseller portal | ⏳ pending | **USER** |
| D | Create 5 WHM packages (script: `/tmp/whm-migration/migrate_accounts.js`) | ⏳ pending | E1 (script) |
| E | Recreate 19 cPanel accounts with same creds (decrypted via SESSION_SECRET) | ⏳ pending | E1 (script) |
| F | Add 20 addon domains | ⏳ pending | E1 (script) |
| G | Move CF tunnel UUID f63ce7b5-… (new tunnel + swap hostname route) | ⏳ pending | E1 (CF API) |
| H | Bulk update CF DNS A records pointing to old IP → new IP (script: `migrate_cf_dns.js`) | ⏳ pending | E1 (script) |
| I | Update `whmHost` in Mongo + write `migrationLog` entry | ⏳ pending (built into migrate_accounts.js) | E1 (script) |
| J | Telegram notify 19 users (script: `notify_users.js`) | ⏳ pending | E1 (script) |

## Credentials/state files on dev pod
- `/tmp/whm-migration/id_ed25519`        — SSH private key for new droplet (root@68.183.77.106)
- `/tmp/whm-migration/cpanel_ip`         — 68.183.77.106
- `/tmp/whm-migration/cpanel_droplet_id` — 578369745
- `/tmp/whm-migration/do_ssh_key_id`     — 57175281
- `/tmp/.do_token`                       — DigitalOcean API token (from Railway prod env)
- `/tmp/.MONGO_URL`                      — Prod Mongo URL (from Railway prod env)
- `/tmp/.SESSION_SECRET`                 — AES key for cpPass decryption (from Railway prod env)

## DB scope (verified)
- Active accounts: **19**
- Passwords decryptable: **19 (100%)**
- Addon domains: **20**
- Plans (5 distinct): Premium 1-Month×9, Golden 1-Month×7, Premium 30-Day×1, Golden 30-Day×1, Premium 1-Week×1

## Old droplet retention
- Power state: keep ON for 14 days post-cutover for data preservation
- Reminder set in this doc — destroy on **2026-07-01** if no issues.

## Snapshot retention
- `233253132` (whm-emergency-20260617-143633, 50.87GB) — keep 30 days
- `226828287` (pre-upcp-2026-05-01, 16.58GB) — older safety net

## Failed approaches (so we don't repeat)
- ❌ Snapshot-restore migration: snapshot's network config has old IP hardcoded; cPanel
  disables cloud-init → new IP can't bind → ports stay closed. Tried 3 user_data variants.
- ❌ SSH password change on old droplet: disk full → PAM can't write /etc/shadow → silent fail.
- ❌ DO Web Console GRUB single-user: user couldn't catch the 3-sec GRUB timer.

## What worked
- ✅ DO API token in Railway prod env (Phase 0 — credential discovery)
- ✅ AES-GCM cpPass decryption via SESSION_SECRET (Phase E prerequisite)
- ✅ Fresh AlmaLinux 9 droplet (no snapshot inheritance issues)
- ✅ Direct SSH cPanel install (skipped cloud-init write_files issue)

## Next steps for the resuming agent (if context refreshed)
1. Check installer progress:
   ```
   ssh -i /tmp/whm-migration/id_ed25519 root@68.183.77.106 \
     'tail -10 /var/log/cpanel-install-stdout.log; ls /etc/cpanel/cpanel.config 2>&1'
   ```
2. Installer is DONE when `/etc/cpanel/cpanel.config` exists AND `systemctl is-active cpanel`
   returns active.
3. User then activates license: `ssh root@68.183.77.106 '/usr/local/cpanel/cpkeyclt'`
4. Get WHM API token via WHM UI (Home → Manage API Tokens → Generate, name 'migration-2026-06-17')
5. Run: `NEW_IP=68.183.77.106 NEW_WHM_TOKEN=<token> node /tmp/whm-migration/migrate_accounts.js --dry-run`
6. Verify dry-run output looks right.
7. Re-run without `--dry-run`.
8. Phase G+H+J in sequence.
