#!/usr/bin/env python3
"""Fetch environment logs with pagination — gives broader time window for Scoreboard44 history."""
import json, requests, re
from pathlib import Path

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

# Try filtering by text — find any log containing 8273560746 or scoreboard
q = """query($e:String!,$n:Int!,$f:String){
  environmentLogs(environmentId:$e, afterLimit:$n, filter:$f){
    message severity timestamp
  }
}"""
for flt in ["8273560746", "Scoreboard44", "scoreboard", "phoneNumbersOf"]:
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 5000, "f": flt})
    data = (r or {}).get("data") or {}
    logs = data.get("environmentLogs") or []
    errs = r.get("errors") if r else None
    print(f"filter={flt!r:20s} → {len(logs)} logs" + (f"   errors={errs}" if errs else ""))
    if logs:
        path = f"/app/rail_env_{flt.replace('@','').replace(' ','_')}.txt"
        Path(path).write_text(
            "\n".join(f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}" for l in sorted(logs, key=lambda x: x.get('timestamp','')))
        )
        print(f"  → saved {path}")
        # Print first and last 2
        for l in logs[:2] + logs[-2:]:
            print(f"    {l.get('timestamp','')[:19]} | {l.get('message','')[:200]}")
