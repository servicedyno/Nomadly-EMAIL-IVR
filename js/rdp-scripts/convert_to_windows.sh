#!/bin/bash
#
# Ubuntu -> Windows conversion for DigitalOcean droplets (cloud-init user-data).
#
# The droplet boots Ubuntu with a DigitalOcean block-storage volume attached
# (TARGET_DISK). Windows Setup runs fully unattended under QEMU/KVM against that
# volume - so Ubuntu's own boot disk (where the ISOs live) is never touched
# mid-install - then the finished Windows disk is dd'd over the boot disk and the
# host hard-reboots into Windows. Setup's specialize/OOBE passes run on the real
# DO hardware; apply.ps1 (baked in via autounattend FirstLogonCommands) brings
# up networking from DO metadata (the platform has NO DHCP), enables RDP and
# calls back. The backend confirms "active" only when 3389 answers.
#
# install_method:
#   qemu  - unattended install from a Windows ISO under QEMU/KVM (default).
#   image - stream a prebuilt gzipped raw Windows disk image with dd (no KVM).
set -uo pipefail

CALLBACK_URL="{{CALLBACK_URL}}"
CALLBACK_TOKEN="{{CALLBACK_TOKEN}}"
SERVER_ID="{{SERVER_ID}}"
ISO_URL="{{ISO_URL}}"
VIRTIO_URL="{{VIRTIO_URL}}"
AUTOUNATTEND_B64="{{AUTOUNATTEND_B64}}"
INSTALL_METHOD="{{INSTALL_METHOD}}"
IMAGE_URL="{{IMAGE_URL}}"
TARGET_DISK="{{TARGET_DISK}}"
VNC_PASSWORD="{{VNC_PASSWORD}}"
DRV_VER="{{VIRTIO_DIR}}"
APPLY_SHA256="{{APPLY_SHA256}}"
APPLY_PS1_B64="{{APPLY_PS1_B64}}"
BUILD_MODE="{{BUILD_MODE}}"
IMAGE_TOKEN="{{IMAGE_TOKEN}}"

WORK=/root/win-convert
mkdir -p "$WORK"
exec > >(tee -a "$WORK/convert.log") 2>&1

report() {
  local stage="$1"; local progress="$2"; shift 2; local msg="$*"
  msg="${msg//\"/}"
  curl -s -m 20 -X POST "$CALLBACK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"server_id\":\"$SERVER_ID\",\"token\":\"$CALLBACK_TOKEN\",\"stage\":\"$stage\",\"progress\":$progress,\"message\":\"$msg\"}" >/dev/null || true
}
fail() { report failed "${2:-0}" "$1"; exit 0; }

# After the boot disk has been overwritten only bash builtins are safe to run.
hard_reboot() {
  echo 1 > /proc/sys/kernel/sysrq 2>/dev/null
  echo s > /proc/sysrq-trigger 2>/dev/null
  echo b > /proc/sysrq-trigger 2>/dev/null
  reboot -f
}

report boot 15 "Host booted. Installing tools."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1
apt-get install -y wget curl gzip file >/dev/null 2>&1 || true

# Boot disk = the disk holding / (never trust lsblk order: the attached volume is sda, boot is vda).
ROOT_SRC=$(findmnt -no SOURCE / | sed 's/\[.*//')
BOOT_DISK="/dev/$(lsblk -no PKNAME "$ROOT_SRC" 2>/dev/null | head -1)"
[ -b "$BOOT_DISK" ] || BOOT_DISK="/dev/$(lsblk -ndo NAME,TYPE | awk '$2=="disk" && $1 ~ /^vd/ {print $1; exit}')"
[ -b "$BOOT_DISK" ] || fail "Could not determine the boot disk (root=$ROOT_SRC)." 20

# ---------------- image method (no KVM required) ----------------
if [ "$INSTALL_METHOD" = "image" ]; then
  [ -n "$IMAGE_URL" ] || fail "install_method=image but no image_url configured." 20
  report download_image 30 "Streaming prebuilt Windows image onto the boot disk (this can take a while)."
  systemctl stop rsyslog cron unattended-upgrades snapd 2>/dev/null || true
  if wget -q -O- "$IMAGE_URL" | gunzip | dd of="$BOOT_DISK" bs=16M conv=fsync 2>>"$WORK/convert.log"; then
    report finalizing 90 "Image written to disk. Rebooting into Windows."
    hard_reboot; exit 0
  fi
  fail "Failed to write Windows image (check image_url is a gzipped raw disk image)." 30
fi

# ---------------- qemu method (needs KVM - available on DigitalOcean) ----------------
apt-get install -y qemu-utils qemu-system-x86 genisoimage ntfs-3g >/dev/null 2>&1
[ -e /dev/kvm ] || fail "No /dev/kvm on this droplet - hardware virtualization unavailable, QEMU install not viable." 20

# The attached block-storage volume is the Windows install target.
for _ in $(seq 1 60); do [ -e "$TARGET_DISK" ] && break; sleep 5; done
[ -e "$TARGET_DISK" ] || fail "Install target volume $TARGET_DISK never appeared on the droplet." 20
TARGET_REAL=$(readlink -f "$TARGET_DISK")
[ "$TARGET_REAL" != "$BOOT_DISK" ] || fail "Target disk equals the boot disk - refusing to install over the running system." 20
VOL_GB=$(( $(blockdev --getsize64 "$TARGET_REAL") / 1024 / 1024 / 1024 ))
BOOT_GB=$(( $(blockdev --getsize64 "$BOOT_DISK") / 1024 / 1024 / 1024 ))
[ "$VOL_GB" -le "$BOOT_GB" ] || fail "Target volume (${VOL_GB} GB) is larger than the boot disk (${BOOT_GB} GB)." 20

report download_iso 25 "Downloading Windows ISO (~5-6 GB)."
wget -q -O "$WORK/windows.iso" "$ISO_URL" || fail "Windows ISO download failed (check iso_url)." 25
ISO_SIZE=$(stat -c%s "$WORK/windows.iso" 2>/dev/null || echo 0)
[ "$ISO_SIZE" -gt 2000000000 ] || fail "Windows ISO looks invalid (only $ISO_SIZE bytes - the URL likely returned an error page)." 25

report download_virtio 40 "Downloading VirtIO driver ISO."
wget -q -O "$WORK/virtio.iso" "$VIRTIO_URL" || fail "VirtIO ISO download failed (check virtio_url)." 40
VIRTIO_SIZE=$(stat -c%s "$WORK/virtio.iso" 2>/dev/null || echo 0)
[ "$VIRTIO_SIZE" -gt 50000000 ] || fail "VirtIO ISO looks invalid ($VIRTIO_SIZE bytes)." 40

# Answer disc = autounattend.xml + \$WinPEDriver\$ (only THIS OS's virtio drivers).
# Windows Setup scans the root of every drive for \$WinPEDriver\$, loads those
# drivers in WinPE and injects them into the installed OS - no drive letters,
# no floppy, and no wrong-OS drivers from the full virtio ISO.
report prepare 45 "Building unattended answer disc (autounattend + virtio drivers + boot script)."
DRVDIR="$WORK/answer/\$WinPEDriver\$"
mkdir -p "$DRVDIR" "$WORK/answer/cloudinit" /mnt/virtio
echo "$AUTOUNATTEND_B64" | base64 -d > "$WORK/answer/autounattend.xml"
# apply.ps1 ships on the answer disc; FirstLogonCommands copy it from the CD (no certutil / long
# command lines - certutil -decode silently failed on WS2019).
echo "$APPLY_PS1_B64" | base64 -d > "$WORK/answer/cloudinit/apply.ps1"
[ "$(sha256sum "$WORK/answer/cloudinit/apply.ps1" | cut -d' ' -f1)" = "$APPLY_SHA256" ] || fail "apply.ps1 payload corrupt (sha mismatch before install)." 45
mount -o loop,ro "$WORK/virtio.iso" /mnt/virtio
if [ ! -d "/mnt/virtio/viostor/$DRV_VER" ]; then
  for alt in 2k25 2k22 2k19 2k16; do
    [ -d "/mnt/virtio/viostor/$alt" ] && DRV_VER="$alt" && break
  done
fi
for comp in viostor vioscsi NetKVM Balloon; do
  if [ -d "/mnt/virtio/$comp/$DRV_VER/amd64" ]; then
    mkdir -p "$DRVDIR/$comp"
    cp "/mnt/virtio/$comp/$DRV_VER/amd64/"* "$DRVDIR/$comp/" 2>/dev/null || true
  fi
done
umount /mnt/virtio
[ -f "$DRVDIR/viostor/viostor.inf" ] || fail "viostor driver ($DRV_VER) not found in the VirtIO ISO." 45
[ -f "$DRVDIR/NetKVM/netkvm.inf" ] || fail "NetKVM driver ($DRV_VER) not found in the VirtIO ISO." 45
genisoimage -quiet -J -joliet-long -r -o "$WORK/answer.iso" "$WORK/answer" || fail "Could not build the answer ISO." 45

report install_windows 55 "Running unattended Windows installation under QEMU/KVM onto the ${VOL_GB} GB volume (15-35 min)."
MEM_MB=$(awk '/MemTotal/{printf "%d", $2/1024*0.65}' /proc/meminfo)
[ "$MEM_MB" -lt 2048 ] && MEM_MB=2048
CPUS=$(nproc)
START=$(date +%s)
# -no-reboot: QEMU exits when Setup performs its first reboot after the offline
# apply phase - that is SUCCESS. A genuine crash exits within seconds.
timeout 4800 qemu-system-x86_64 -enable-kvm -cpu host -m "${MEM_MB}" -smp "${CPUS}" \
  -drive file="$TARGET_REAL",format=raw,if=virtio,cache=none \
  -drive file="$WORK/windows.iso",media=cdrom,index=1 \
  -drive file="$WORK/answer.iso",media=cdrom,index=2 \
  -boot d -vnc 0.0.0.0:1,password=on -monitor telnet:127.0.0.1:4444,server,nowait \
  -no-reboot 2>"$WORK/qemu.err" &
QPID=$!
sleep 5
{ exec 3<>/dev/tcp/127.0.0.1/4444 && printf 'set_password vnc %s\n' "$VNC_PASSWORD" >&3 && sleep 1 && exec 3>&-; } 2>/dev/null || true
MIN=0
while kill -0 "$QPID" 2>/dev/null; do
  sleep 300; MIN=$((MIN + 5))
  if kill -0 "$QPID" 2>/dev/null; then
    P=$(( MIN > 30 ? 30 : MIN )); report install_windows $(( 55 + P )) "Windows Setup still running under QEMU (${MIN} min elapsed)."
  fi
done
wait "$QPID"; RC=$?
DUR=$(( $(date +%s) - START ))
[ "$RC" -eq 124 ] && fail "QEMU install timed out after ${DUR}s - Windows Setup never rebooted (answer file / ISO problem)." 60
if [ "$DUR" -lt 240 ]; then
  ERR=$(tr '\n\r\"' '   ' < "$WORK/qemu.err" | tail -c 400)
  fail "QEMU exited after ${DUR}s (rc=$RC) - install did not run. err=[$ERR]" 55
fi

# ---- First boot under QEMU: device setup, OOBE, FirstLogonCommands (bake apply.ps1 +
# boot task, then shut Windows down). RDP answering inside the guest proves the install
# boots on virtio disk+net with RDP enabled; the baked files are then verified OFFLINE
# on the NTFS volume - nothing depends on guest->host networking. Watchable over VNC.
# Metadata is unreachable here by design; apply.ps1 configures DO networking on the
# real hardware afterwards. ----
report firstboot 78 "Offline install done in ${DUR}s. First boot under QEMU (device setup + OOBE + first-logon script, 5-15 min)."
START2=$(date +%s)
timeout 3000 qemu-system-x86_64 -enable-kvm -cpu host -m "${MEM_MB}" -smp "${CPUS}" \
  -drive file="$TARGET_REAL",format=raw,if=virtio,cache=none \
  -drive file="$WORK/answer.iso",media=cdrom,index=2 \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:13389-:3389 -device virtio-net-pci,netdev=n0 \
  -vnc 0.0.0.0:1,password=on -monitor telnet:127.0.0.1:4444,server,nowait 2>"$WORK/qemu2.err" &
QPID=$!
sleep 5
{ exec 3<>/dev/tcp/127.0.0.1/4444 && printf 'set_password vnc %s\n' "$VNC_PASSWORD" >&3 && sleep 1 && exec 3>&-; } 2>/dev/null || true
rdp_probe() {  # real X.224 handshake through the hostfwd (a bare TCP connect always succeeds on slirp)
  python3 - <<'PY'
import socket, sys
try:
    s = socket.create_connection(('127.0.0.1', 13389), timeout=5)
    s.sendall(bytes.fromhex('0300002722e00000000000') + b'Cookie: mstshash=a\r\n' + bytes.fromhex('0100080003000000'))
    d = s.recv(64)
    sys.exit(0 if len(d) >= 11 and d[0] == 3 else 1)
except Exception:
    sys.exit(1)
PY
}
UP=0; TICK=0
while kill -0 "$QPID" 2>/dev/null; do
  if rdp_probe; then UP=1; break; fi
  sleep 15; TICK=$((TICK + 15))
  [ $((TICK % 300)) -eq 0 ] && report firstboot 80 "Windows first boot still running under QEMU ($((TICK / 60)) min)."
done
if [ "$UP" != 1 ]; then
  ERR=$(tr '\n\r\"' '   ' < "$WORK/qemu2.err" | tail -c 300)
  fail "Windows first boot under QEMU ended without RDP answering (after $(( $(date +%s) - START2 ))s). err=[$ERR]" 80
fi
RDP_SECS=$(( $(date +%s) - START2 ))
# RDP opens at FirstLogonCommand #1; the LAST command shuts Windows down (clean NTFS) → QEMU exits.
report firstboot 83 "Windows booted under QEMU: RDP answering after ${RDP_SECS}s. Waiting for the first-logon script to finish and shut Windows down..."
for _ in $(seq 1 90); do kill -0 "$QPID" 2>/dev/null || break; sleep 10; done
if kill -0 "$QPID" 2>/dev/null; then
  { exec 3<>/dev/tcp/127.0.0.1/4444 && printf 'system_powerdown\n' >&3 && sleep 1 && exec 3>&-; } 2>/dev/null || true
  for _ in $(seq 1 60); do kill -0 "$QPID" 2>/dev/null || break; sleep 5; done
  if kill -0 "$QPID" 2>/dev/null; then kill "$QPID"; sleep 3; fi
fi
wait "$QPID" 2>/dev/null
sync

# ---- Offline verification: mount the finished Windows volume read-only and check what
# FirstLogonCommands baked in. This is the authoritative gate before the disk ships. ----
report verify 85 "Windows shut down. Verifying the baked boot task offline on the NTFS volume."
blockdev --rereadpt "$TARGET_REAL" 2>/dev/null || true; partprobe "$TARGET_REAL" 2>/dev/null || true; sleep 3
PARTS=$(lsblk -nrpo NAME,TYPE "$TARGET_REAL" 2>/dev/null | awk '$2=="part"{print $1}')
[ -n "$PARTS" ] || fail "No partition found on the Windows volume after install." 85
LAYOUT=$(lsblk -nro NAME,SIZE,FSTYPE,LABEL,PARTTYPE "$TARGET_REAL" 2>/dev/null | tr -s ' ' | tr '\n' ';' | tr -d '"\\')
mkdir -p /mnt/win
# Windows Server 2025 (24H2 Setup) appends a WinRE recovery partition AFTER the Windows partition even
# with a single-partition answer file -> locate the OS partition by content, never by position.
WINPART=""
for p in $PARTS; do
  mount -t ntfs-3g -o ro "$p" /mnt/win 2>>"$WORK/convert.log" || continue
  if [ -n "$(find /mnt/win -maxdepth 2 -ipath '/mnt/win/windows/system32' -type d | head -1)" ]; then WINPART="$p"; break; fi
  umount /mnt/win
done
[ -n "$WINPART" ] || fail "No partition containing Windows/System32 found on the volume (layout: $LAYOUT)." 85
PS1_FILE=$(find /mnt/win -maxdepth 2 -ipath '/mnt/win/cloudinit/apply.ps1' | head -1)
TASK_FILE=$(find /mnt/win -maxdepth 4 -ipath '/mnt/win/windows/system32/tasks/cloudinitapply' | head -1)
PS1_SHA=missing; [ -n "$PS1_FILE" ] && PS1_SHA=$(sha256sum "$PS1_FILE" | cut -d' ' -f1)
CI_DIR=$(find /mnt/win -maxdepth 1 -iname cloudinit -type d | head -1)
FOUND="apply.ps1=$( [ -n "$PS1_FILE" ] && echo present || echo MISSING) sha=${PS1_SHA:0:12} task=$( [ -n "$TASK_FILE" ] && echo present || echo MISSING) cloudinit-dir=$( [ -n "$CI_DIR" ] && echo "[$(ls -m "$CI_DIR" 2>/dev/null | tr -d '\n' | cut -c1-120)]" || echo ABSENT)"
# What Windows Setup itself logged about the FirstLogonCommands (JSON-safe: no quotes/backslashes/newlines).
win_diag() {
  local f out=""
  for f in $(find /mnt/win -maxdepth 4 \( -ipath '*/panther/unattendgc/setupact.log' -o -ipath '*/panther/setuperr.log' \) 2>/dev/null); do
    out="$out | $(basename "$(dirname "$f")")/$(basename "$f"): $( { cat "$f"; iconv -f UTF-16LE -t UTF-8 -c "$f"; } 2>/dev/null | grep -ai 'FirstLogon\|Shell Unattend\|RunSynchronous\|cmd /c\|Error\|fail' | tail -30 | tr -s ' \t' ' ' | tr '\n\r"\\' '  ~/' | cut -c1-2200)"
  done
  echo "$out"
}
VERIFY_OK=1
{ [ -n "$TASK_FILE" ] && [ "$PS1_SHA" = "$APPLY_SHA256" ]; } || VERIFY_OK=0
[ "$VERIFY_OK" = 1 ] || DIAG=$(win_diag)
umount /mnt/win
[ -n "$TASK_FILE" ] || fail "CloudInitApply boot task not found on the installed Windows (FirstLogonCommands did not complete): $FOUND (partition $WINPART, layout: $LAYOUT) - refusing to ship an image without it. Setup logs:$DIAG" 85
[ "$PS1_SHA" = "$APPLY_SHA256" ] || fail "Baked apply.ps1 does not match the expected script (${PS1_SHA:0:12} != ${APPLY_SHA256:0:12}): $FOUND. Setup logs:$DIAG" 85
# Drop every partition AFTER the Windows partition (WS2025's auto-created WinRE partition): the OS
# partition must be last so apply.ps1 can grow C: to the full droplet disk. Boot files (bootmgr/BCD)
# live on the active Windows partition, so removing the trailing WinRE partition does not affect boot.
WINNUM=$(cat "/sys/class/block/$(basename "$WINPART")/partition" 2>/dev/null || echo 0)
TRAILING=""
for p in $PARTS; do
  n=$(cat "/sys/class/block/$(basename "$p")/partition" 2>/dev/null || echo 0)
  [ "$n" -gt "$WINNUM" ] && TRAILING="$TRAILING $n"
done
NOTE=""
if [ -n "$TRAILING" ]; then
  for n in $TRAILING; do
    sfdisk --delete "$TARGET_REAL" "$n" >>"$WORK/convert.log" 2>&1 || fail "Could not remove trailing partition $n after the Windows partition (layout: $LAYOUT)." 87
  done
  blockdev --rereadpt "$TARGET_REAL" 2>/dev/null || true; sync
  NOTE=" Removed trailing partition(s)$TRAILING (WinRE) so C: can grow to the full disk."
fi
report verify 87 "Offline check passed: $FOUND. RDP answered after ${RDP_SECS}s. Layout: $LAYOUT.$NOTE"

if [ "$BUILD_MODE" = "golden" ]; then
  # ---- Golden build: package the disk as qcow2 and serve it; the backend has DigitalOcean
  # import it as a CUSTOM IMAGE (distribution "Unknown", so DO never touches the NTFS disk -
  # droplet snapshots of a Windows disk fail at create time because DO treats them as Ubuntu).
  # This droplet stays up serving the file until the backend destroys it after the import. ----
  report packaging 88 "Packaging the Windows disk as qcow2 for the DigitalOcean Custom Images import (3-6 min)..."
  rm -f "$WORK/windows.iso" "$WORK/virtio.iso" "$WORK/answer.iso"
  IMG_DIR="$WORK/www/$IMAGE_TOKEN"; mkdir -p "$IMG_DIR"
  qemu-img convert -f raw -O qcow2 "$TARGET_REAL" "$IMG_DIR/windows.qcow2" 2>>"$WORK/convert.log" || fail "qemu-img convert to qcow2 failed." 88
  chmod -R a+rX "$WORK/www"
  IMG_BYTES=$(stat -c%s "$IMG_DIR/windows.qcow2")
  PUB_IP=$(curl -s -m 10 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
  ( cd "$WORK/www" && nohup python3 -m http.server 80 --bind 0.0.0.0 >>"$WORK/http.log" 2>&1 & )
  sleep 3
  IMG_URL="http://${PUB_IP}/${IMAGE_TOKEN}/windows.qcow2"
  while :; do
    R=$(curl -s -m 20 -X POST "$CALLBACK_URL" -H 'Content-Type: application/json' \
      -d "{\"server_id\":\"$SERVER_ID\",\"token\":\"$CALLBACK_TOKEN\",\"stage\":\"image_ready\",\"progress\":90,\"message\":\"qcow2 ready ($((IMG_BYTES / 1024 / 1024)) MB) at $IMG_URL - DigitalOcean import can start.\",\"image_url\":\"$IMG_URL\",\"image_bytes\":$IMG_BYTES}")
    case "$R" in *'"ok"'*) sleep 600 ;; *) sleep 30 ;; esac
  done
fi

report finalizing 88 "Offline install done in ${DUR}s. Writing the ${VOL_GB} GB Windows disk over the boot disk, then rebooting into Windows (setup finishes there; RDP up in ~10-15 min)."
systemctl stop rsyslog cron unattended-upgrades snapd do-agent 2>/dev/null || true
sync
echo 1 > /proc/sys/kernel/sysrq
echo s > /proc/sysrq-trigger
sleep 2
# Freeze the root filesystem read-only: nothing can dirty the boot disk while/after we overwrite it.
echo u > /proc/sysrq-trigger
sleep 2
exec >/dev/null 2>&1
# O_DIRECT both ways: no page-cache churn, so bash/dd/libc stay resident once the disk is gone.
dd if="$TARGET_REAL" of="$BOOT_DISK" bs=16M iflag=direct oflag=direct conv=fsync status=none
# Blank the volume's MBR so Windows never sees two disks with the same signature.
dd if=/dev/zero of="$TARGET_REAL" bs=1M count=2 oflag=direct conv=fsync status=none
# Only bash builtins from here on - the running root filesystem no longer exists.
echo b > /proc/sysrq-trigger
echo b > /proc/sysrq-trigger
reboot -f
