#!/usr/bin/env python3
"""Find duplicate notifications for CloudIVR plan purchase."""
import json, requests, re, sys
from collections import defaultdict

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=30)
    return r.json().get("data") or {}

# Most recent SUCCESS deployment only
DEPS = gql(
    'query($p:String!,$e:String!,$s:String!){deployments(input:{projectId:$p,environmentId:$e,serviceId:$s},first:3){edges{node{id status createdAt}}}}',
    {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID},
)
success = [e["node"] for e in DEPS.get("deployments", {}).get("edges", []) if e["node"]["status"] == "SUCCESS"]
print(f"Scanning {len(success)} SUCCESS deployments")

# Patterns for CloudIVR + notifications
CIVR_RE = re.compile(r"cloudivr|cloud[- ]?ivr|civr", re.IGNORECASE)
NOTIFY_RE = re.compile(r"notify|admin|adminMsg|notifyGroup|notifyAdmin|sendMessage.*admin|group.*chat|adminUserTag", re.IGNORECASE)
PURCHASE_RE = re.compile(r"paid|purchased|order|new (?:cloudivr|plan|sub|subscription)|wallet.*charge|invoice", re.IGNORECASE)

all_hits = []
for d in success[:3]:
    data = gql('query($d:String!,$l:Int!){deploymentLogs(deploymentId:$d,limit:$l){timestamp message severity}}', {"d": d["id"], "l": 5000})
    logs = data.get("deploymentLogs") or []
    print(f"  [{d['id'][:8]}] {len(logs)} lines")
    for l in logs:
        m = (l.get("message") or "")
        if CIVR_RE.search(m):
            all_hits.append({"dep": d["id"][:8], "createdAt": d["createdAt"], **l})

all_hits.sort(key=lambda x: x.get("timestamp",""))
print(f"\n{len(all_hits)} CloudIVR-related lines:\n")
for h in all_hits[:120]:
    msg = (h.get("message") or "").strip().replace("\n", " | ")[:500]
    print(f"[{h['timestamp'][:19]}] {msg}")
