#!/usr/bin/env bash
# Repeatedly try an NLA-only RDP login (xfreerdp +auth-only) until it succeeds or the deadline passes.
#   js/ops/rdp_login_probe.sh <ip> <password> [max_minutes=10] [interval_s=20]
IP="$1"; PW="$2"; MAXMIN="${3:-10}"; INT="${4:-20}"
[ -z "$IP" ] || [ -z "$PW" ] && { echo "usage: $0 <ip> <password> [max_minutes] [interval_s]"; exit 2; }
if [ -z "$DISPLAY" ]; then Xvfb :97 -screen 0 640x480x16 >/dev/null 2>&1 & XV=$!; export DISPLAY=:97; sleep 1; fi
deadline=$(( $(date +%s) + MAXMIN*60 )); n=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  n=$((n+1))
  out=$(timeout 60 xfreerdp "/v:$IP" /u:Administrator "/p:$PW" /cert:ignore +auth-only /sec:nla 2>&1)
  st=$(echo "$out" | grep -o 'Authentication only, exit status [0-9]*' | head -1 | grep -o '[0-9]*$')
  err=$(echo "$out" | grep -o 'STATUS_[A-Z_]*\|ERRCONNECT_[A-Z_]*' | sort -u | tr '\n' ' ')
  echo "[$(date -u +%H:%M:%S)] try $n → exit_status=${st:-none} ${err}"
  if [ "$st" = "0" ]; then echo "LOGIN OK after $n tries"; [ -n "$XV" ] && kill $XV 2>/dev/null; exit 0; fi
  sleep "$INT"
done
echo "LOGIN FAILED after $n tries (${MAXMIN} min)"; [ -n "$XV" ] && kill $XV 2>/dev/null; exit 1
