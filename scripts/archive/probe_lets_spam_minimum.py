#!/usr/bin/env python3
"""Search for any minimum-balance / minimum-$50 / insufficient-funds messages
to @Lets_spam (chatId 1506649532) AFTER their initial purchase."""
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
dep = DEPS["deployments"]["edges"][0]["node"]
print(f"Deployment: {dep['id']} ({dep['createdAt']})")

data = gql('query($d:String!,$l:Int!){deploymentLogs(deploymentId:$d,limit:$l){timestamp message severity}}', {"d": dep["id"], "l": 5000})
logs = data.get("deploymentLogs") or []

# All lines mentioning 1506649532 OR @Lets_spam, sorted chronologically
hits = []
for l in logs:
    m = (l.get("message") or "")
    if "1506649532" in m or "Lets_spam" in m:
        hits.append(l)
hits.sort(key=lambda x: x.get("timestamp",""))

print(f"\n{len(hits)} lines for chatId 1506649532 / @Lets_spam:\n")
for l in hits:
    ts = l.get("timestamp","")
    msg = (l.get("message") or "").strip().replace("\n", " | ")[:600]
    sev = (l.get("severity") or "")[:5]
    print(f"[{ts[11:19]}] {sev:5} {msg}")

# Highlight the lines mentioning balance/minimum/insufficient/$50
print("\n──── MINIMUM/INSUFFICIENT/BALANCE highlights ────")
balance_re = re.compile(r"\$50|minimum|insufficient|low.{0,5}balance|not enough|top.?up|add.{0,5}fund", re.IGNORECASE)
for l in hits:
    m = (l.get("message") or "")
    if balance_re.search(m):
        ts = l.get("timestamp","")
        print(f"[{ts[11:19]}] {m.strip()[:500]}")
