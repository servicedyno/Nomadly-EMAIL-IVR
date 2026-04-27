#!/usr/bin/env python3
"""Pull all errors from the latest deployment (post-12:17 on 2026-04-27)."""
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

q = """query($e:String!,$n:Int!,$f:String){
  environmentLogs(environmentId:$e, afterLimit:$n, filter:$f){
    message severity timestamp
  }
}"""

# Pull all errors
for flt in ["hasVoice is not defined", "is not defined", "Cannot set properties", "Cannot read properties", "TypeError", "ReferenceError"]:
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 500, "f": flt})
    logs = ((r or {}).get("data") or {}).get("environmentLogs") or []
    print(f"filter={flt!r:40s} → {len(logs)} logs")
    # Show distinct messages
    seen = set()
    distinct = []
    for l in logs:
        msg = l.get("message", "")
        key = re.sub(r'(\d{8,}|chatId[=:]\s*\d+)', '#', msg)[:200]
        if key not in seen:
            seen.add(key); distinct.append(l)
    for l in distinct[:12]:
        print(f"  [{l.get('timestamp','')[:19]}] {l.get('message','')[:240]}")
    print()
