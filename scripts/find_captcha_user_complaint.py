#!/usr/bin/env python3
"""Find specific AI Support chat messages where users mention captcha."""
import json, requests, re

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60)
    return r.json().get("data") or {}

Q_DEPLOY = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 50) {
    edges { node { id status createdAt } }
  }
}
"""
edges = gql(Q_DEPLOY, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID}).get("deployments", {}).get("edges", [])
deployments = [e["node"] for e in edges]

Q_LOGS = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
}
"""

# Patterns for captcha mentions in user text
captcha_text_re = re.compile(r"captcha", re.IGNORECASE)
# Patterns for "still on", "not working", "turned off but"
complaint_re = re.compile(r"still|not.{0,5}off|turned off but|doesn.?t.{0,5}(?:turn|go)|won.?t|isn.?t (?:off|disabled)|keep|appears", re.IGNORECASE)

hits = []
for d in deployments[:20]:
    data = gql(Q_LOGS, {"d": d["id"], "limit": 5000})
    logs = data.get("deploymentLogs") or []
    for l in logs:
        m = (l.get("message") or "")
        if captcha_text_re.search(m):
            # Filter out anti-red service infrastructure logs
            if "[AntiRed]" in m or "Worker route" in m or "Startup worker upgrade" in m:
                continue
            hits.append({"dep": d["id"][:8], "createdAt": d["createdAt"], **l})

print(f"Found {len(hits)} user/AI captcha mentions\n")
# Show all
hits.sort(key=lambda x: x.get("timestamp",""))
for h in hits[-200:]:
    msg = (h.get("message") or "").strip()[:500]
    print(f"  [{h['timestamp']}] {msg}")

with open("/app/scripts/railway_user_captcha_mentions.jsonl", "w") as f:
    for h in hits:
        f.write(json.dumps(h) + "\n")
print(f"\nSaved → /app/scripts/railway_user_captcha_mentions.jsonl")
