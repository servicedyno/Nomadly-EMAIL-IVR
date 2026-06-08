#!/usr/bin/env python3
"""Fetch ALL prod logs from `Nomadly-EMAIL-IVR` since last Friday (2026-06-05T00:00Z)
   using deploymentLogs(startDate, endDate) with 1-hour windows.
   Then extract user-facing activity (commands, IVR calls, purchases, payments, etc.)."""

import requests, json, os, sys
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
import re

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
HEADERS = {"Project-Access-Token": API_KEY, "Content-Type": "application/json"}

# We care about the Nomadly bot (the only service that handles users).
SERVICE_NAME = "Nomadly-EMAIL-IVR"
SERVICE_ID   = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
PROJECT_ID   = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV_ID       = "889fd56a-720a-4020-884c-034784992666"

# Window: last Friday 00:00 UTC → now
START = datetime(2026, 6, 5, 0, 0, 0, tzinfo=timezone.utc)
END   = datetime.now(timezone.utc)

OUT = "/app/logs_prod/nomadly_since_friday.jsonl"


def gql(query, variables=None):
    r = requests.post(API_URL, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=90)
    return r.json()


# Step 1: list all deployments covering [START, END]
print(f"Window: {START.isoformat()} → {END.isoformat()}")
print(f"That is {(END - START).total_seconds() / 3600:.1f} hours\n")

dep_q = """query($p:String!,$s:String!,$e:String!){
  deployments(input:{projectId:$p,serviceId:$s,environmentId:$e}, first:20){
    edges{node{id status createdAt}}
  }
}"""
dr = gql(dep_q, {"p": PROJECT_ID, "s": SERVICE_ID, "e": ENV_ID})
deploys = [e["node"] for e in dr["data"]["deployments"]["edges"]]
relevant = []
for d in sorted(deploys, key=lambda x: x["createdAt"]):
    ts = datetime.fromisoformat(d["createdAt"].replace("Z", "+00:00"))
    if d["status"] not in ("SUCCESS", "DEPLOYED", "RUNNING", "REMOVED"):
        continue
    # Include if it might cover any part of [START, END]
    if ts <= END:
        relevant.append((ts, d))
print(f"Deployments to query ({len(relevant)}):")
for ts, d in relevant:
    print(f"  - {d['id']} {d['status']:<8} {d['createdAt']}")

# Determine the deployment that was active for each chunk of the window.
# Sort by createdAt asc; deploy i is active from createdAt_i to createdAt_{i+1}
windows = []  # (start, end, deployment_id)
for i, (ts, d) in enumerate(relevant):
    start = max(ts, START)
    end_ = relevant[i+1][0] if i+1 < len(relevant) else END
    if start >= END: continue
    end_ = min(end_, END)
    if end_ <= START: continue
    windows.append((max(start, START), end_, d["id"], d["status"]))

print(f"\nActive deployment windows:")
for ws, we, did, st in windows:
    print(f"  [{ws.isoformat()} → {we.isoformat()}] {did[:8]} ({st})")

# Step 2: pull logs in 1-hour chunks within each window (deploymentLogs cap = 5000)
log_q = """query($id:String!,$start:DateTime!,$end:DateTime!,$limit:Int!){
  deploymentLogs(deploymentId:$id, startDate:$start, endDate:$end, limit:$limit){
    message severity timestamp
  }
}"""

total = 0
seen = set()
os.makedirs("/app/logs_prod", exist_ok=True)
with open(OUT, "w") as f:
    for ws, we, dep_id, _ in windows:
        cur = ws
        while cur < we:
            chunk_end = min(cur + timedelta(hours=1), we)
            r = gql(log_q, {"id": dep_id, "start": cur.isoformat(), "end": chunk_end.isoformat(), "limit": 5000})
            if r.get("errors"):
                print(f"  ERROR {cur.isoformat()}-{chunk_end.isoformat()} on {dep_id[:8]}: {r['errors'][0].get('message','?')[:200]}")
                # try smaller window
                if "exceeds" in str(r["errors"]).lower() or "too" in str(r["errors"]).lower():
                    chunk_end = cur + timedelta(minutes=30)
                    r = gql(log_q, {"id": dep_id, "start": cur.isoformat(), "end": chunk_end.isoformat(), "limit": 5000})
            logs = (r.get("data") or {}).get("deploymentLogs") or []
            for l in logs:
                k = (l.get("timestamp"), l.get("message"))
                if k in seen: continue
                seen.add(k)
                f.write(json.dumps(l) + "\n")
                total += 1
            print(f"  {dep_id[:8]} [{cur.strftime('%m-%d %H:%M')} → {chunk_end.strftime('%m-%d %H:%M')}] = {len(logs):>4} (new={total})")
            cur = chunk_end

print(f"\nTotal unique log lines: {total}")
print(f"Saved to {OUT}")
