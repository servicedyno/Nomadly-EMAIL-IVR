#!/usr/bin/env python3
"""Pull every Railway log line touching mccoyfcuportal.com to root-cause the
'no SSL' complaint."""
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

DEPS = gql(
    'query($p:String!,$e:String!,$s:String!){deployments(input:{projectId:$p,environmentId:$e,serviceId:$s},first:50){edges{node{id status createdAt}}}}',
    {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID},
)
deployments = [e["node"] for e in DEPS.get("deployments", {}).get("edges", []) if e["node"]["status"] in ("SUCCESS", "FAILED", "CRASHED", "REMOVED")]

DOMAIN = "mccoyfcuportal.com"
all_hits = []
for d in deployments[:20]:
    data = gql('query($d:String!,$l:Int!){deploymentLogs(deploymentId:$d,limit:$l){timestamp message severity}}', {"d": d["id"], "l": 5000})
    logs = data.get("deploymentLogs") or []
    for l in logs:
        m = (l.get("message") or "")
        if DOMAIN in m.lower() or DOMAIN.upper() in m or "mccoyfcuportal" in m.lower():
            all_hits.append({"dep": d["id"][:8], "createdAt": d["createdAt"], **l})

all_hits.sort(key=lambda x: x.get("timestamp",""))
print(f"{len(all_hits)} hits for {DOMAIN}\n")
for h in all_hits:
    msg = (h.get("message") or "").strip().replace("\n", " | ")[:600]
    sev = (h.get("severity") or "")[:5]
    print(f"[{h['timestamp'][:19]}] {sev:5} {msg}")
