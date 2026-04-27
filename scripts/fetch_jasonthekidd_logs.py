#!/usr/bin/env python3
"""Fetch Railway logs for @jasonthekidd — zip upload under public_html didn't show up."""
import json, requests, re, sys
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

# Pull different facets
for flt in ["jasonthekidd", "Jasonthekidd", "JasonTheKidd", "public_html", ".zip", "zip upload", "file upload", "multer", "cpanel", "whm", "uploadFile"]:
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 1500, "f": flt})
    logs = ((r or {}).get("data") or {}).get("environmentLogs") or []
    print(f"filter={flt!r:20s} → {len(logs)} logs")
    if logs:
        path = f"/app/rail_{flt.replace('.','').replace(' ','_').lower()}.txt"
        Path(path).write_text("\n".join(f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}" for l in sorted(logs, key=lambda x: x.get('timestamp',''))))
