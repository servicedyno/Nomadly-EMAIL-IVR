#!/usr/bin/env python3
"""Inspect the build error for the most-recent FAILED Railway deployment."""
import json, sys, requests

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def gql(query, variables=None):
    r = requests.post(URL, json={"query": query, "variables": variables or {}}, headers=HDR, timeout=60)
    j = r.json()
    if "errors" in j and j["errors"]:
        print("GQL ERRORS:", json.dumps(j["errors"], indent=2))
    return j.get("data") or {}


Q = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
    edges { node { id status createdAt meta } }
  }
}
"""
data = gql(Q, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = (((data or {}).get("deployments") or {}).get("edges")) or []
# pick the most recent FAILED
target = None
for e in edges:
    if e["node"]["status"] == "FAILED":
        target = e["node"]
        break
if not target:
    print("No FAILED deployment in last 5"); sys.exit(0)

print(f"Inspecting FAILED deploy {target['id']} ({target['createdAt']})")
meta = target.get("meta") or {}
if isinstance(meta, dict):
    print(f"  commit:  {meta.get('commitHash', '')}")
    print(f"  message: {meta.get('commitMessage', '')[:200]}")

Q_LOGS = """
query($d:String!, $limit:Int!) {
  buildLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
  deploymentLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
}
"""
d = gql(Q_LOGS, {"d": target["id"], "limit": 2000})
blogs = d.get("buildLogs") or []
dlogs = d.get("deploymentLogs") or []
print(f"\nbuildLogs={len(blogs)}  deploymentLogs={len(dlogs)}")

# Save full logs to disk
with open("/app/scripts/failed_build_logs.txt", "w") as f:
    for l in blogs:
        f.write(f"[{l.get('timestamp','')[:19]}] [{(l.get('severity') or 'info').upper()}] {l.get('message','')}\n")
with open("/app/scripts/failed_deploy_logs.txt", "w") as f:
    for l in dlogs:
        f.write(f"[{l.get('timestamp','')[:19]}] [{(l.get('severity') or 'info').upper()}] {l.get('message','')}\n")

# Print only error-level or anything containing common failure keywords
KEYWORDS = ["error", "fail", "exit", "exited", "killed", "panic", "fatal", "cannot find", "not found", "denied", "✘", "❌"]
def is_interesting(l):
    sev = (l.get("severity") or "").lower()
    if sev in ("error", "critical", "warn", "warning"): return True
    m = (l.get("message") or "").lower()
    return any(k in m for k in KEYWORDS)

print("\n────── INTERESTING build log lines (errors / failures) ──────")
for l in blogs:
    if is_interesting(l):
        print(f"  [{l.get('timestamp','')[:19]}] [{(l.get('severity') or 'info').upper()}] {(l.get('message','') or '').replace(chr(10),' ')[:300]}")

print("\n────── Last 40 build log lines (tail) ──────")
for l in blogs[-40:]:
    print(f"  [{l.get('timestamp','')[:19]}] [{(l.get('severity') or 'info').upper()}] {(l.get('message','') or '').replace(chr(10),' ')[:300]}")

if dlogs:
    print("\n────── Last 30 deployment log lines (tail) ──────")
    for l in dlogs[-30:]:
        print(f"  [{l.get('timestamp','')[:19]}] [{(l.get('severity') or 'info').upper()}] {(l.get('message','') or '').replace(chr(10),' ')[:300]}")
