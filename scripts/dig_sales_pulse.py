#!/usr/bin/env python3
"""Pull real-sales pulse via environmentLogs (using anchorDate)."""
import json, urllib.request, sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
UA = "Mozilla/5.0"


def gql(q, v):
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query": q, "variables": v}).encode(),
        headers={"Content-Type":"application/json","User-Agent":UA,"Project-Access-Token":TOKEN})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


Q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
  environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
    timestamp message severity tags { serviceId }
  }
}"""


def fetch_window(filter_str, start, end, chunk_hours=4):
    seen = set()
    out = []
    cursor = end
    while cursor > start:
        a_iso = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(Q, {"e": ENV_ID, "a": a_iso, "f": filter_str, "lim": 1000})
        logs = r.get("data", {}).get("environmentLogs") or []
        new = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:120])
            if k not in seen:
                seen.add(k); out.append(l); new += 1
        if not logs: break
        cursor -= timedelta(hours=chunk_hours)
        if new == 0: break
    return [l for l in out
            if start.strftime("%Y-%m-%dT%H:%M:%S") <= l["timestamp"][:19]
            <= end.strftime("%Y-%m-%dT%H:%M:%S")]


now = datetime.now(timezone.utc)
start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)

FILTERS = {
    # Real customer sales (more specific Node bot output strings)
    "credited":              "credited",
    "PaymentConfirmed":      "PaymentConfirmed",
    "Deposit confirmed":     "Deposit confirmed",
    "Wallet topup":          "Wallet topup",
    "Domain registered":     "Domain registered",
    "Phone number":          "Phone number purchased",
    "SMS Campaign":          "SMS Campaign",
    "VPS purchased":         "VPS purchased",
    # Customer requests
    "/start":                "/start",
    "Insufficient balance":  "Insufficient balance",
    # Fincra specifically
    "fincra unauth":         "Fincra authentication failed",
    "BALANCE_FETCH_FAILED":  "BALANCE_FETCH_FAILED",
}

print(f"Window: {start.strftime('%Y-%m-%dT%H:%M:%S')} → {now.strftime('%Y-%m-%dT%H:%M:%S')}\n")
print(f"{'Filter':<22} {'Total':>6}  Per-day breakdown")
print("-" * 90)
for name, flt in FILTERS.items():
    logs = fetch_window(flt, start, now, chunk_hours=4)
    by_day = Counter(l["timestamp"][:10] for l in logs)
    days = " ".join(f"{d[5:]}={by_day[d]:>3}" for d in sorted(by_day.keys()))
    sample = logs[0]["message"][:90] if logs else ""
    print(f"{name:<22} {len(logs):>6}  {days}")
    if sample and len(logs) > 0 and len(logs) < 5:
        print(f"  └─ sample: {sample}")

print("\n→ Done")
