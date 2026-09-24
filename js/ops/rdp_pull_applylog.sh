#!/usr/bin/env bash
# Pull C:\cloudinit\apply.log (+ markers) off a golden-image Windows droplet through an RDP session:
# opens xfreerdp in Xvfb with a shared drive, types a PowerShell copy command via xdotool, and waits for the files.
#   js/ops/rdp_pull_applylog.sh <ip> <password> [out_dir=/app/memory/rdp_applylog_<ip>]
IP="$1"; PW="$2"; OUT="${3:-/app/memory/rdp_applylog_$IP}"
[ -z "$IP" ] || [ -z "$PW" ] && { echo "usage: $0 <ip> <password> [out_dir]"; exit 2; }
mkdir -p "$OUT"; rm -f "$OUT"/*
export DISPLAY=:98
Xvfb :98 -screen 0 1280x800x24 >/dev/null 2>&1 & XV=$!
sleep 1
xfreerdp "/v:$IP" /u:Administrator "/p:$PW" /cert:ignore /sec:nla /size:1280x800 /drive:share,"$OUT" -clipboard /log-level:ERROR >"$OUT/xfreerdp.log" 2>&1 & RDP=$!
echo "waiting for the desktop..."; sleep 35
import -window root "$OUT/desktop1.png" 2>/dev/null
WID=$(xdotool search --class xfreerdp | head -1); [ -n "$WID" ] && xdotool windowactivate --sync "$WID" 2>/dev/null
xdotool key --delay 200 super+r; sleep 3
xdotool type --delay 40 'powershell -NoProfile -WindowStyle Hidden -Command "Copy-Item C:\cloudinit\*.log \\tsclient\share\ -Force; Copy-Item C:\cloudinit\*.txt \\tsclient\share\ -Force; Get-Date | Out-File \\tsclient\share\done.txt"'
sleep 1; xdotool key Return
for i in $(seq 1 30); do [ -f "$OUT/done.txt" ] && break; sleep 2; done
import -window root "$OUT/desktop2.png" 2>/dev/null
kill $RDP 2>/dev/null; kill $XV 2>/dev/null
ls -la "$OUT"
[ -f "$OUT/apply.log" ] && { echo "---- apply.log ----"; cat "$OUT/apply.log"; exit 0; }
echo "apply.log not retrieved (see $OUT/desktop*.png)"; exit 1
