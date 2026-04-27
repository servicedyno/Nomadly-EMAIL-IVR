#!/usr/bin/env python3
"""Search Railway logs for specific strings around jasonthekidd's hosting."""
import requests, re
from pathlib import Path

env = {}
for line in Path('/app/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$', line)
    if m: env[m.group(1)] = m.group(2)

HDR = {"Authorization": f"Bearer {env['API_KEY_RAILWAY']}", "Content-Type": "application/json"}
ENV_ID = env["RAILWAY_ENVIRONMENT_ID"]

def gql(flt):
    q = """query($e:String!,$n:Int!,$f:String){environmentLogs(environmentId:$e, afterLimit:$n, filter:$f){message severity timestamp}}"""
    r = requests.post("https://backboard.railway.app/graphql/v2", json={"query": q, "variables": {"e": ENV_ID, "n": 1500, "f": flt}}, headers=HDR, timeout=60).json()
    return ((r or {}).get("data") or {}).get("environmentLogs") or []

for flt in ["cap1online360", "cap1online", "7893016294", "[Hosting]", "[Panel] Upload", "[Panel]", "Upload error"]:
    logs = gql(flt)
    hits = [l for l in logs if '7893016294' in l.get("message","") or 'cap1online' in l.get("message","") or 'jasonthekidd' in l.get("message","").lower()]
    if hits or flt == "[Panel] Upload" or flt == "Upload error":
        print(f"\n=== filter={flt!r} → {len(logs)} total, {len(hits)} jason-related ===")
        for l in (hits if hits else logs)[:30]:
            print(f"  [{l.get('timestamp','')[:19]}] {l.get('message','')[:300]}")
