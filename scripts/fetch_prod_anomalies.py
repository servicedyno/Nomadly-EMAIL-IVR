#!/usr/bin/env python3
"""Fetch ALL logs from latest production deployments (all services) using Project Access Token."""

import requests, json, sys, os
from datetime import datetime
from collections import Counter

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"   # user-provided project token
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"   # production

SERVICES = [
    ("HostingBotNew",     "0a453645-4180-441b-8988-020807f4479a"),
    ("LockbayNewFIX",     "96ee768e-3f4d-49c8-be75-dea30777e890"),
    ("Nomadly-EMAIL-IVR", "b9c4ad64-7667-4dd3-8b9a-3867ede47885"),
]

HEADERS = {"Project-Access-Token": API_KEY, "Content-Type": "application/json"}

def gql(query, variables=None):
    r = requests.post(API_URL, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=60)
    return r.json()

DEPLOY_Q = """
query($p: String!, $s: String!, $e: String!) {
  deployments(input: {projectId: $p, serviceId: $s, environmentId: $e}, first: 5) {
    edges { node { id status createdAt url } }
  }
}
"""

LOG_Q = """
query($id: String!, $limit: Int!) {
  deploymentLogs(deploymentId: $id, limit: $limit) {
    message severity timestamp
  }
}
"""

os.makedirs("/app/logs_prod", exist_ok=True)
summary = {"fetched_at": datetime.utcnow().isoformat()+"Z", "services": {}}

for svc_name, svc_id in SERVICES:
    print(f"\n{'='*70}\n {svc_name} ({svc_id})\n{'='*70}")
    dr = gql(DEPLOY_Q, {"p": PROJECT_ID, "s": svc_id, "e": ENV_ID})
    if dr.get("errors"):
        print(json.dumps(dr["errors"], indent=2)); continue
    deploys = [e["node"] for e in dr["data"]["deployments"]["edges"]]
    for d in deploys:
        print(f"  - {d['id']} {d['status']:<10} {d['createdAt']}  {d.get('url','')}")
    if not deploys:
        print("  no deployments");  continue
    latest = next((d for d in deploys if d["status"] in ("SUCCESS","DEPLOYED","RUNNING")), deploys[0])
    dep_id = latest["id"]
    print(f"\n  >>> pulling logs for {dep_id} ({latest['status']})")
    lr = gql(LOG_Q, {"id": dep_id, "limit": 5000})
    if lr.get("errors"):
        print(json.dumps(lr["errors"], indent=2)); continue
    logs = lr["data"]["deploymentLogs"] or []
    logs.sort(key=lambda x: x.get("timestamp") or "")
    sev = Counter(l.get("severity") or "?" for l in logs)
    print(f"  pulled {len(logs)} log lines; severity={dict(sev)}")
    if logs:
        print(f"  time range: {logs[0]['timestamp']} → {logs[-1]['timestamp']}")
    out = f"/app/logs_prod/{svc_name}.json"
    with open(out, "w") as f:
        json.dump({
            "service": svc_name, "service_id": svc_id,
            "deployment_id": dep_id, "status": latest["status"],
            "created_at": latest["createdAt"], "log_count": len(logs),
            "severity_breakdown": dict(sev),
            "time_range": [logs[0]["timestamp"], logs[-1]["timestamp"]] if logs else None,
            "logs": logs,
        }, f, indent=2)
    print(f"  saved → {out}")
    summary["services"][svc_name] = {
        "deployment_id": dep_id, "status": latest["status"],
        "log_count": len(logs), "severity": dict(sev),
        "time_range": [logs[0]["timestamp"], logs[-1]["timestamp"]] if logs else None,
    }

with open("/app/logs_prod/_summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print(f"\n\nSUMMARY:\n{json.dumps(summary, indent=2)}")
