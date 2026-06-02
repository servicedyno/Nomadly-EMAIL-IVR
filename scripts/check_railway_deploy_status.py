#!/usr/bin/env python3
"""Inspect Railway deployment status + recent failure logs for the Node.js bot."""
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


# Pull richer fields per deployment so we can tell why a deploy failed.
Q = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 15) {
    edges { node {
      id status createdAt updatedAt
      staticUrl url
      meta
      canRedeploy canRollback
    } }
  }
}
"""
data = gql(Q, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = (((data or {}).get("deployments") or {}).get("edges")) or []
print(f"─── {len(edges)} most-recent deployments ───")
for i, e in enumerate(edges[:15]):
    n = e["node"]
    meta = n.get("meta") or {}
    commit_sha = (meta.get("commitHash") or "")[:8] if isinstance(meta, dict) else ""
    commit_msg = (meta.get("commitMessage") or "").replace("\n", " ")[:90] if isinstance(meta, dict) else ""
    branch = meta.get("branch", "") if isinstance(meta, dict) else ""
    print(f"  [{i:2d}] {n['createdAt'][:19]}  {n['status']:18s}  {commit_sha}  ({branch}) {commit_msg}")

# Look at the FAILED ones in detail
fails = [e["node"] for e in edges if e["node"]["status"] in ("FAILED", "CRASHED", "REMOVED")]
if not fails:
    print("\n✅ No FAILED/CRASHED/REMOVED deployments in the last 15.")
    sys.exit(0)

Q_LOGS = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
  buildLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
}
"""

for f in fails[:5]:
    print(f"\n═══════ FAILED deployment {f['id'][:8]}… created={f['createdAt'][:19]} status={f['status']} ═══════")
    meta = f.get("meta") or {}
    if isinstance(meta, dict):
        print(f"  commit: {(meta.get('commitHash') or '')[:8]}  msg: {(meta.get('commitMessage') or '')[:120]}")
    d = gql(Q_LOGS, {"d": f["id"], "limit": 500})
    blogs = d.get("buildLogs") or []
    dlogs = d.get("deploymentLogs") or []
    print(f"  buildLogs={len(blogs)}  deploymentLogs={len(dlogs)}")
    print("  --- last 30 build log lines ---")
    for l in (blogs or [])[-30:]:
        msg = (l.get("message") or "").replace("\n", " ")[:240]
        print(f"    [{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {msg}")
    print("  --- last 20 deployment log lines ---")
    for l in (dlogs or [])[-20:]:
        msg = (l.get("message") or "").replace("\n", " ")[:240]
        print(f"    [{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {msg}")
