#!/usr/bin/env python3
"""Find admin + group notifications around the CloudIVR activation timestamp."""
import json, requests, re

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=30)
    return r.json().get("data") or {}

DEPS = gql(
    'query($p:String!,$e:String!,$s:String!){deployments(input:{projectId:$p,environmentId:$e,serviceId:$s},first:1){edges{node{id status createdAt}}}}',
    {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID},
)
success = [e["node"] for e in DEPS.get("deployments", {}).get("edges", []) if e["node"]["status"] == "SUCCESS"]
print(f"Scanning latest: {success[0]['id'][:8]}")

# Pull a big chunk around the CloudIVR purchase
data = gql('query($d:String!,$l:Int!){deploymentLogs(deploymentId:$d,limit:$l){timestamp message severity}}', {"d": success[0]["id"], "l": 5000})
logs = data.get("deploymentLogs") or []

# Filter to anything in 16:28–16:35 window
relevant = []
USER_CHAT = "1506649532"
LETS_SPAM = "Lets_spam"
for l in logs:
    ts = l.get("timestamp","")
    m = (l.get("message") or "")
    if not ts.startswith("2026-06-01T16:"):
        continue
    if "16:28" in ts or "16:29" in ts or "16:30" in ts or "16:31" in ts or "16:32" in ts or "16:33" in ts:
        relevant.append(l)

print(f"\n{len(relevant)} lines in 16:28-16:33 window:\n")
for l in relevant:
    msg = (l.get("message") or "").strip().replace("\n", " | ")[:700]
    print(f"[{l['timestamp'][13:19]}] {msg}")
