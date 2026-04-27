#!/usr/bin/env python3
"""Paginate environmentLogs to build longer Scoreboard44 history (last ~7 days)."""
import json, requests, re
from pathlib import Path
from datetime import datetime, timedelta

env = {}
for line in Path('/app/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$', line)
    if m: env[m.group(1)] = m.group(2)

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = env.get("API_KEY_RAILWAY")
ENVIRONMENT_ID = env.get("RAILWAY_ENVIRONMENT_ID")
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    return requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60).json()

# Paginate backward in time from now
q = """query($e:String!,$n:Int!,$f:String,$anchor:String){
  environmentLogs(environmentId:$e, beforeLimit:$n, filter:$f, anchorDate:$anchor){
    message severity timestamp
  }
}"""

all_hits = []
cursor = datetime.utcnow().isoformat() + "Z"
filter_val = "8273560746"

for round_i in range(1, 15):
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 1000, "f": filter_val, "anchor": cursor})
    if r.get("errors"):
        print(f"errors: {r['errors']}"); break
    data = (r or {}).get("data") or {}
    logs = data.get("environmentLogs") or []
    if not logs: 
        print(f"round {round_i}: 0 logs — done"); break
    all_hits.extend(logs)
    # Move cursor back
    oldest = min(logs, key=lambda x: x.get("timestamp", "zzz")).get("timestamp", "")
    print(f"round {round_i}: +{len(logs)} logs, oldest={oldest}")
    if oldest == cursor:
        print("cursor unchanged — stopping"); break
    cursor = oldest

# Dedupe
seen = set()
dedup = []
for l in all_hits:
    key = (l.get("timestamp", ""), l.get("message", ""))
    if key in seen: continue
    seen.add(key); dedup.append(l)
dedup.sort(key=lambda x: x.get("timestamp", ""))

print(f"\n{len(dedup)} unique Scoreboard44 logs")
Path("/app/rail_env_scoreboard44_full.txt").write_text(
    "\n".join(f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}" for l in dedup)
)
print("Saved to /app/rail_env_scoreboard44_full.txt")

# Summarize daily activity
from collections import Counter
days = Counter(l.get("timestamp","")[:10] for l in dedup)
print("\nActivity by day:")
for d, c in sorted(days.items()):
    print(f"  {d}: {c} events")
