#!/usr/bin/env python3
"""Fetch Railway production logs since the latest deployment for the Node.js bot service."""
import os, sys, json, requests
from datetime import datetime, timezone

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(query, variables=None):
    r = requests.post(URL, json={"query": query, "variables": variables or {}}, headers=HDR, timeout=60)
    try:
        j = r.json()
    except Exception:
        print("NON-JSON:", r.status_code, r.text[:500]); sys.exit(1)
    if "errors" in j and j["errors"]:
        print("GQL ERRORS:", json.dumps(j["errors"], indent=2))
    return j.get("data") or {}

Q_DEPLOY = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 10) {
    edges { node { id status createdAt } }
  }
}
"""
data = gql(Q_DEPLOY, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = (((data or {}).get("deployments") or {}).get("edges")) or []
print(f"─── Found {len(edges)} recent deployments ───")
for i, e in enumerate(edges[:5]):
    n = e["node"]
    print(f"  [{i}] id={n['id'][:8]}… status={n['status']:12s} created={n['createdAt']}")

success = [e["node"] for e in edges if e["node"].get("status") == "SUCCESS"]
target = success[0] if success else (edges[0]["node"] if edges else None)
if not target:
    print("❌ No deployments"); sys.exit(1)
print(f"\n─── Target: {target['id']} status={target['status']} created={target['createdAt']} ───\n")

Q_LOGS = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) {
    timestamp message severity
  }
}
"""
data = gql(Q_LOGS, {"d": target["id"], "limit": 1500})
logs = data.get("deploymentLogs") or []
print(f"Fetched {len(logs)} log lines\n")

with open("/app/scripts/railway_logs_latest.jsonl", "w") as f:
    for l in logs:
        f.write(json.dumps(l) + "\n")

err_lines = [l for l in logs if (l.get("severity") or "").upper() in ("ERROR", "CRITICAL", "WARN", "WARNING")]
exception_lines = [l for l in logs if any(tok in (l.get("message") or "").lower() for tok in ["error:", "exception", "traceback", "unhandled", "econnrefused", "etimedout", "enotfound", "typeerror", "referenceerror", "unhandledrejection", "unhandled promise"])]
voice_lines = [l for l in logs if "[voice]" in (l.get("message") or "").lower()]
ivr_lines = [l for l in logs if "ivr" in (l.get("message") or "").lower()]
fwd_lines = [l for l in logs if any(t in (l.get("message") or "").lower() for t in ["forward", "transfer"])]
captcha_lines = [l for l in logs if "captcha" in (l.get("message") or "").lower()]
webhook_lines = [l for l in logs if "webhook" in (l.get("message") or "").lower()]

print(f"═══ Counts ═══")
print(f"  ERROR/WARN severity: {len(err_lines)}")
print(f"  Exception-ish:       {len(exception_lines)}")
print(f"  [Voice] events:      {len(voice_lines)}")
print(f"  IVR-related:         {len(ivr_lines)}")
print(f"  Forward/transfer:    {len(fwd_lines)}")
print(f"  Captcha-related:     {len(captcha_lines)}")
print(f"  Webhook events:      {len(webhook_lines)}")

def dump(title, items, n=30):
    if not items: return
    print(f"\n═══ {title} (up to {n}) ═══")
    for l in items[-n:]:
        msg = (l.get("message") or "").replace("\n", " ")[:280]
        print(f"  [{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {msg}")

dump("ERROR / WARN severity", err_lines)
dump("Exception-ish text", exception_lines, 25)
dump("IVR-related", ivr_lines, 25)
dump("Forward/transfer-related", fwd_lines, 25)
