#!/usr/bin/env bash
# Run a PowerShell snippet on a golden-image Windows droplet through an RDP session (Xvfb + xfreerdp + xdotool)
# and print its output. The snippet's stdout/errors land in <out_dir>/out.txt via the \\tsclient\share drive.
#   js/ops/rdp_run_ps.sh <ip> <password> '<powershell code>' [out_dir]
IP="$1"; PW="$2"; CODE="$3"; OUT="${4:-/app/memory/rdp_run_$IP}"
[ -z "$IP" ] || [ -z "$PW" ] || [ -z "$CODE" ] && { echo "usage: $0 <ip> <password> '<ps code>' [out_dir]"; exit 2; }
mkdir -p "$OUT"; rm -f "$OUT"/out.txt "$OUT"/done.txt
printf '%s\n' "$CODE" > "$OUT/cmd.ps1"
export DISPLAY=:98
Xvfb :98 -screen 0 1280x800x24 >/dev/null 2>&1 & XV=$!
sleep 1
xfreerdp "/v:$IP" /u:Administrator "/p:$PW" /cert:ignore /sec:nla /size:1280x800 /drive:share,"$OUT" -clipboard /log-level:ERROR >"$OUT/xfreerdp.log" 2>&1 & RDP=$!
sleep 35
WID=$(xdotool search --class xfreerdp | head -1); [ -n "$WID" ] && xdotool windowactivate --sync "$WID" 2>/dev/null
xdotool key --delay 200 super+r; sleep 3
# The snippet itself is read from the shared drive, so no quoting issues in the Run box.
xdotool type --delay 40 'powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& { . \\tsclient\share\cmd.ps1 } *>&1 | Out-File \\tsclient\share\out.txt; Get-Date | Out-File \\tsclient\share\done.txt"'
sleep 1; xdotool key Return
for i in $(seq 1 "${WAIT_ITER:-45}"); do [ -f "$OUT/done.txt" ] && break; sleep 2; done
import -window root "$OUT/desktop.png" 2>/dev/null
kill $RDP 2>/dev/null; kill $XV 2>/dev/null
[ -f "$OUT/out.txt" ] && { iconv -f UTF-16 -t UTF-8 "$OUT/out.txt" 2>/dev/null || cat "$OUT/out.txt"; exit 0; }
echo "no output (see $OUT/desktop.png)"; exit 1
