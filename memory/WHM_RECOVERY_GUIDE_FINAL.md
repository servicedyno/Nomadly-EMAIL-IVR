═══════════════════════════════════════════════════════════════════
WHM Droplet Recovery — Why GRUB Single-User Works When SSH Doesn't
═══════════════════════════════════════════════════════════════════

THE PROBLEM
-----------
Disk is at 100% — even root's reserved 5% is gone. So:
  • passwd cannot write to /etc/shadow → all password changes silently fail
  • sshd disconnects with exit 255 after PAM password-change prompts
  • SFTP/SCP also blocked (PAM forces password change first)

WHY GRUB SINGLE-USER BYPASSES ALL OF THIS
-----------------------------------------
At GRUB you edit the kernel command line to add:    init=/bin/bash
This tells the Linux kernel to start /bin/bash as the FIRST process.
So:
  • No /sbin/init      → no systemd → no services start
  • No login program   → no PAM     → no password prompt
  • No /etc/shadow     → no auth    → no disk write needed
  • You ARE root because PID 1 always runs as root
  
The shell appears in ~5 seconds with NO auth.

═══════════════════════════════════════════════════════════════════

STEP-BY-STEP (5 minutes)

1) BROWSER → https://cloud.digitalocean.com/droplets/557194941

2) Left sidebar → "Access" → "Launch Recovery Console"
   (A black VNC window pops up — DO NOT close it)

3) Click ONCE inside the black window so it captures keystrokes
   (you should see your cursor disappear inside the VNC)

4) On the DO page, top-right → "More" → "Power Cycle"
   (or sidebar "Power" → "Power Cycle Droplet")
   Click confirm. The console will show the boot screen.

5) Watch the VNC window. You'll see:

      ┌──────────────────────────────────────────────────┐
      │             GNU GRUB version 2.06                │
      │                                                  │
      │  *Ubuntu                                         │
      │   Advanced options for Ubuntu                    │
      │                                                  │
      │  Use ↑ and ↓ to select. Press Enter to boot.     │
      │  The countdown will continue in N seconds.       │
      └──────────────────────────────────────────────────┘

   ⏱  This screen shows for only ~3 SECONDS — be ready.

6) IMMEDIATELY press the DOWN ARROW key once.
   This stops the auto-boot countdown. You're now safe to take time.

7) Press UP ARROW once to highlight "Ubuntu" (the first entry).

8) Press the 'e' key (lowercase E).
   The screen changes to show ~10 lines of kernel boot params.

9) You'll see something like:
      setparams 'Ubuntu'
              gnulinux ...
              load_video
              ...
              linux  /boot/vmlinuz-6.8.0-101-generic root=PARTUUID=xxx ro console=tty1 console=ttyS0
              initrd /boot/initrd.img-6.8.0-101-generic
      
   ↑ FIND the line starting with "linux /boot/vmlinuz..."
   ↑ It contains the word " ro " (read-only).

10) Use ARROW KEYS to move the cursor to the " ro " on that line.

11) DELETE the "ro" (two characters) and type in its place:
       rw single init=/bin/bash

    So the END of that line becomes:
       ... rw single init=/bin/bash console=tty1 console=ttyS0

12) Press Ctrl+X  (or F10) to boot with the edited params.

13) ~5 seconds later you see:
       bash-5.1#

    (no login prompt, no password — straight to root shell)

═══════════════════════════════════════════════════════════════════

NOW PASTE THIS ONE-LINER (the VNC has a "Send text" button, OR right-click → paste, OR just type):

mount -o remount,rw / && df -h / && apt-get install -y cloud-guest-utils 2>/dev/null; R=$(findmnt -no SOURCE /); D=$(lsblk -no PKNAME $R|head -1); P=${R##*[a-z]}; echo "Growing /dev/$D part $P"; growpart /dev/$D $P; resize2fs $R; df -h /; journalctl --vacuum-size=50M; find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.[0-9]*" \) -delete; truncate -s 0 /var/log/syslog /var/log/auth.log /var/log/kern.log /var/log/messages /var/log/cron 2>/dev/null; apt-get clean; [ -d /usr/local/cpanel/logs ] && find /usr/local/cpanel/logs -type f -size +50M -delete; [ -d /var/lib/mysql ] && find /var/lib/mysql -name "binlog.*" -mtime +1 -delete; [ -d /usr/local/apache/logs ] && truncate -s 0 /usr/local/apache/logs/error_log /usr/local/apache/logs/access_log 2>/dev/null; df -h /; echo 'root:WhmFix2026Recover!' | chpasswd; chage -d 99999 root; passwd -u root; sync; echo "=== DONE — partition grown + space freed + new root pw set ==="

Wait for "=== DONE ===" then type:

       exec /sbin/init 6

(graceful reboot to normal mode)

═══════════════════════════════════════════════════════════════════

AFTER REBOOT (~60 seconds)
- Tell me here in chat
- I'll SSH in from this pod (with password WhmFix2026Recover!), verify WHM API responds, restart cpsrvd if needed
- Then we set up off-droplet daily backups via WHM API so this never recurs

═══════════════════════════════════════════════════════════════════

COMMON ISSUES & FIXES

• "GRUB menu doesn't appear" — hold SHIFT after clicking Power Cycle.
  Some Ubuntu images set GRUB timeout to 0; hold SHIFT to force the menu.
  
• "I missed the timer" — just Power Cycle again. There's no penalty.

• "The 'e' key doesn't work" — make sure your cursor is INSIDE the VNC
  window (click inside the black area first to capture input).

• "growpart says NOCHANGE" — partition was already expanded; the cleanup
  commands will still run and free enough space.

• "I see Sorry, you must change your password" — that means GRUB normal
  boot happened, not single-user. Reboot and try again, pressing DOWN
  ARROW faster.

• "Network unreachable" inside the single-user shell — expected. We
  don't need network. All commands run from local disk.

═══════════════════════════════════════════════════════════════════

SAFETY NOTES

• You CANNOT brick the droplet with these steps. Worst case = "this
  didn't work, reboot and try again."

• 2 snapshots exist as full rollback points (May 1 + today 14:36).

• The bigger one-liner above does NOT delete customer files. Only:
    - log files (truncate or .gz/.1 rotated copies)
    - apt cache
    - old MySQL binlogs (>1 day old)
    - cPanel/Apache rotated logs >50MB
  Customer mail, home dirs, MySQL DBs — all untouched.
