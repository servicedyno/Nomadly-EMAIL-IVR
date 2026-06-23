#!/usr/bin/env python3
"""Pull Railway logs for @kathyserious (chatId 8690991604) — recent activity."""
import json, requests
from pathlib import Path

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
ENVIRONMENT_ID = "889fd56a-720a-4020-884c-034784992666"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    return requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60).json()

q = """query($e:String!,$n:Int!,$f:String){
  environmentLogs(environmentId:$e, afterLimit:$n, filter:$f){
    message severity timestamp
  }
}"""

filters = [
    "8690991604",
    "kathyserious",
    "+18889838571",
    "PN2b431f7cb112addb980e949f694f8f16",
    "cpIsSubNumber",
    "cpSubParent",
    "addAdditionalNumber",
    "addNumberToPlan",
]

for flt in filters:
    r = gql(q, {"e": ENVIRONMENT_ID, "n": 1500, "f": flt})
    logs = ((r or {}).get("data") or {}).get("environmentLogs") or []
    print(f"filter={flt!r:40s} → {len(logs):5d} logs")
    if logs:
        path = f"/app/rail_kathy_{flt.replace('+','plus').replace(' ','_').lower()}.txt"
        sorted_logs = sorted(logs, key=lambda x: x.get('timestamp',''))
        Path(path).write_text("\n".join(
            f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}"
            for l in sorted_logs
        ))
        print(f"  → {path}")
