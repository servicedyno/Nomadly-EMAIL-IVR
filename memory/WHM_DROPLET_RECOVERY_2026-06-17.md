WHM DROPLET RECOVERY — STEP-BY-STEP (open in DO Web Console)
============================================================

Droplet: ubuntu-s-1vcpu-2gb-fra1-01  (id 557194941, IP 209.38.241.9)
Safety net: 2 snapshots exist (May 1 + today). You can always rollback.

--------------------------------------------------------------------
PATH A — GRUB SINGLE-USER (RECOMMENDED — bypasses PAM completely)
--------------------------------------------------------------------
1) Open https://cloud.digitalocean.com/droplets/557194941
2) Click "Console" → "Launch Recovery Console" (or "Console" in the sidebar)
3) A black VNC window opens. Click into it.

4) Force a reboot — in the DO sidebar click "Power" → "Power Cycle"
   (or wait for the console to refresh as droplet boots)

5) When the GRUB menu appears (very brief, ~3 sec showing
   "Ubuntu" / "Advanced options for Ubuntu"), press the DOWN ARROW
   key once to STOP the auto-boot timer.

6) With "Ubuntu" highlighted, press 'e' to EDIT this entry.

7) You'll see kernel boot lines. Find the line that starts with
       linux /boot/vmlinuz-...
   It usually ends with:    ...ro console=tty1 console=ttyS0
   ATTENTION: replace " ro " with " rw single init=/bin/bash "
   so the line becomes:
       linux /boot/vmlinuz-... rw single init=/bin/bash console=tty1 console=ttyS0

8) Press Ctrl+X (or F10) to boot with these edits.

9) The system boots and you're DROPPED to a root shell with NO password.
   You'll see a prompt like:    bash-5.1#

10) Now paste these commands EXACTLY (line by line is fine):

mount -o remount,rw /
df -h /

# expand the partition that the resize gave us extra space for
apt-get install -y cloud-guest-utils 2>/dev/null || true
ROOT_DEV=$(findmnt -no SOURCE /)
ROOT_DISK=$(lsblk -no PKNAME "$ROOT_DEV" | head -1)
PART_NUM=$(echo "$ROOT_DEV" | grep -oE '[0-9]+$')
growpart "/dev/$ROOT_DISK" "$PART_NUM"
resize2fs "$ROOT_DEV"
df -h /

# free common hogs
journalctl --vacuum-size=50M
find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.[0-9]*" -o -name "*.old" \) -delete
truncate -s 0 /var/log/syslog /var/log/auth.log /var/log/kern.log /var/log/messages /var/log/cron /var/log/dmesg 2>/dev/null
apt-get clean
[ -d /usr/local/cpanel/logs ] && find /usr/local/cpanel/logs -type f -size +50M -delete
[ -d /var/cpanel/logs ] && find /var/cpanel/logs -type f -size +50M -delete
[ -d /usr/local/apache/logs ] && truncate -s 0 /usr/local/apache/logs/{error,access,suexec}_log 2>/dev/null
[ -d /var/lib/mysql ] && find /var/lib/mysql -name "binlog.*" -mtime +1 -delete
[ -d /var/cache/cpcache ] && rm -rf /var/cache/cpcache/*
find /tmp -type f -atime +1 -delete
df -h /

# set a fresh root password while we are here (no PAM history checks in single-user)
echo 'root:WhmFix2026Recover!' | chpasswd
# (yes, this will be your new permanent root password — you can change it after recovery)

# clear the expired flag
chage -d 99999 root
chage -l root

sync
echo "All good — rebooting"
exec /sbin/init 6        # graceful reboot to normal multi-user

--------------------------------------------------------------------
11) After ~30 sec the droplet will reboot. Wait ~1 min. Then either:
    a) SSH from your laptop:  ssh root@209.38.241.9  (password: WhmFix2026Recover! )
    b) Paste the password here so I can drive the rest of the recovery
       (restart cpsrvd, verify WHM API returns 200, set up off-droplet
        backups, monitor for re-fill).

--------------------------------------------------------------------
SAFETY NOTES
--------------------------------------------------------------------
• If GRUB doesn't show (some DO images hide it) — hold SHIFT or ESC
  immediately after power cycle to force the menu.
• If you don't see GRUB at all after 2 tries: tell me and I'll prepare
  Path B (rebuild from snapshot to a new larger droplet).
• If `growpart` says "NOCHANGE: partition X is size Y, it cannot be grown":
  that means cloud-init already expanded the partition and the disk
  fullness is NOT due to unexpanded FS. Skip to the cleanup commands.
• Don't run `rm -rf /var/cpanel/backups/*` blindly — those are customer
  backups. We'll relocate them off-droplet via WHM API after recovery.
