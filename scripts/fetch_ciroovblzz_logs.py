#!/usr/bin/env python3
"""Fetch Railway logs for @ciroovblzz RDP purchase failure (chatId 8625434794)."""
import json, requests, re, sys
from pathlib import Path

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
ENVIRONMENT_ID = "889fd56a-720a-4020-884c-034784992666"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

print(f"ENV_ID: {ENVIRONMENT_ID}")

def gql(q, v=None):
    return requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60).json()

q = """query($e:String!,$n:Int!,$f:String){
  environmentLogs(environmentId:$e, afterLimit:$n, filter:$f){
    message severity timestamp
  }
}"""

# Filters: chatId + various VPS/RDP/Contabo/Vultr identifiers
filters = [
    "8625434794",
    "ciroovblzz",
    "203370900",
    "nomadly-8625434794",
    "VPS",
    "RDP",
    "vps-plan-pay",
    "buyVPSPlanFullProcess",
    "Contabo",
    "Vultr",
    "vultr",
    "askCountryForVPS",
]

results = {}
for flt in filters:
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 1500, "f": flt})
    logs = ((r or {}).get("data") or {}).get("environmentLogs") or []
    err = r.get("errors")
    results[flt] = len(logs)
    print(f"filter={flt!r:30s} → {len(logs):5d} logs" + (f"  ERRORS:{err}" if err else ""))
    if logs:
        # Save the user-specific filters in full; others we keep last 200 (most recent)
        path = f"/app/rail_ciroovblzz_{flt.replace('-','_').replace(' ','_').lower()}.txt"
        sorted_logs = sorted(logs, key=lambda x: x.get('timestamp',''))
        Path(path).write_text("\n".join(
            f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}"
            for l in sorted_logs
        ))
        print(f"  → {path}")
print("\nDone.")
