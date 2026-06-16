#!/usr/bin/env python3
"""Pull last 30min of logs for the latest deployment, filter for user
6550622589 (Leprechaun00) and any .au-family activity, including failures."""
import sys, json, requests
from datetime import datetime, timedelta

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJ = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV  = "889fd56a-720a-4020-884c-034784992666"
SVC  = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
URL  = "https://backboard.railway.app/graphql/v2"
HDR  = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query":q, "variables":v or {}}, headers=HDR, timeout=60).json()
    if "errors" in r and r["errors"]:
        print("GQL ERR:", r["errors"]); sys.exit(1)
    return r.get("data") or {}

# Latest deployment (any status — we want the running one)
DQ = "query($p:String!,$e:String!,$s:String!){deployments(input:{projectId:$p,environmentId:$e,serviceId:$s},first:3){edges{node{id status createdAt}}}}"
edges = gql(DQ, {"p":PROJ,"e":ENV,"s":SVC}).get("deployments",{}).get("edges",[])
for e in edges: n=e["node"]; print(f"  {n['id'][:8]}…  {n['status']:10s}  {n['createdAt']}")
running = next((e["node"] for e in edges if e["node"]["status"]=="SUCCESS"), edges[0]["node"])
print(f"\nUsing deployment: {running['id']}\n")

LQ = "query($d:String!,$limit:Int!){deploymentLogs(deploymentId:$d,limit:$limit){timestamp message severity}}"
logs = gql(LQ, {"d":running["id"], "limit": 4000}).get("deploymentLogs") or []
print(f"Fetched {len(logs)} lines\n")

def parse(s):
    try: return datetime.fromisoformat(s.replace("Z","+00:00"))
    except: return None
ts = [parse(l.get("timestamp","")) for l in logs]
ts = [t for t in ts if t]
if not ts: sys.exit(1)
newest = max(ts)
cutoff = newest - timedelta(minutes=30)
recent = [l for l in logs if (parse(l.get("timestamp","")) or datetime.min) >= cutoff]
print(f"Last 30min window has {len(recent)} lines (newest {newest.isoformat()})\n")

USER = "6550622589"
au_or_user = [l for l in recent if (USER in (l.get("message") or "")
                                    or "com.au" in (l.get("message") or "").lower()
                                    or " .au " in (l.get("message") or "").lower()
                                    or "leprechaun" in (l.get("message") or "").lower()
                                    or "register" in (l.get("message") or "").lower()
                                    or "[op]" in (l.get("message") or "").lower()
                                    or "openprovider" in (l.get("message") or "").lower()
                                    or "additional" in (l.get("message") or "").lower()
                                    or "374" in (l.get("message") or ""))]
print(f"User/.au/register-related lines: {len(au_or_user)}\n")
print("--- LAST 80 ENTRIES (most recent at bottom) ---\n")
for l in au_or_user[-80:]:
    msg = (l.get("message") or "").replace("\n"," ")[:380]
    print(f"  [{(l.get('timestamp') or '')[:19]}] [{l.get('severity','')}] {msg}")
