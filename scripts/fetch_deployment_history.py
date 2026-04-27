#!/usr/bin/env python3
"""Fetch logs from previous deployments to find Scoreboard44 settings from last night."""
import os, json, requests, re, sys
from pathlib import Path

env = {}
for line in Path('/app/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$', line)
    if m: env[m.group(1)] = m.group(2)

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = env.get("API_KEY_RAILWAY")
PROJECT_ID = env.get("RAILWAY_PROJECT_ID")
SERVICE_ID = env.get("RAILWAY_SERVICE_ID")
ENVIRONMENT_ID = env.get("RAILWAY_ENVIRONMENT_ID")
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60)
    return r.json()

# Fetch last 20 deployments
q = """query($p:String!,$s:String!,$e:String!){
  deployments(input:{projectId:$p,serviceId:$s,environmentId:$e},first:20){
    edges{node{id status createdAt}}
  }
}"""
deps = [e["node"] for e in gql(q, {"p":PROJECT_ID,"s":SERVICE_ID,"e":ENVIRONMENT_ID}).get("data",{}).get("deployments",{}).get("edges",[])]
print(f"Found {len(deps)} deployments:")
for d in deps:
    print(f"  {d['id']}  {d['status']}  {d['createdAt']}")

all_logs = []
log_q = """query($d:String!,$n:Int!){deploymentLogs(deploymentId:$d,limit:$n){message severity timestamp}}"""
for d in deps:
    lr = gql(log_q, {"d": d["id"], "n": 8000})
    data = (lr or {}).get("data") or {}
    logs = data.get("deploymentLogs") or []
    # Filter for scoreboard mentions before adding everything
    hits = [l for l in logs if 'scoreboard' in l.get("message","").lower() or '8273560746' in l.get("message","")]
    print(f"  {d['id'][:8]} → {len(logs)} logs, {len(hits)} scoreboard hits")
    all_logs.extend(logs)

all_logs.sort(key=lambda x: x.get("timestamp",""))
print(f"\nTotal: {len(all_logs)} logs across all deployments")

# Find every Scoreboard44 / chatId 8273560746 hit
hits = [l for l in all_logs if 'scoreboard' in l.get("message","").lower() or '8273560746' in l.get("message","")]
print(f"{len(hits)} hits across all deployments")

Path('/app/scoreboard44_all_deployments.txt').write_text(
    "\n".join(f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}" for l in hits)
)
print(f"Saved to /app/scoreboard44_all_deployments.txt")

# Also save the LAST 2 deployments' full logs for setting-reset investigation
recent_ids = [deps[0]["id"], deps[1]["id"] if len(deps) > 1 else None]
recent_logs = [l for l in all_logs]  # already fetched above
# Search for anything touching phoneNumbersOf / ivr / voicemail / forwarding config
keywords_rx = re.compile(r"(phoneNumbersOf|ivr|voicemail|forwarding|recording|features|val\.numbers)", re.I)
cfg_hits = [l for l in all_logs if keywords_rx.search(l.get("message",""))]
Path('/app/phone_config_activity.txt').write_text(
    "\n".join(f"[{l.get('timestamp','')[:19]}] [{l.get('severity','')}] {l.get('message','')}" for l in cfg_hits)
)
print(f"Saved {len(cfg_hits)} config-related logs to /app/phone_config_activity.txt")
