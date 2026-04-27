#!/usr/bin/env python3
"""Fetch Railway production logs for @Scoreboard44 / phone-settings-reset investigation."""
import os, json, requests, re, sys
from pathlib import Path

# Load credentials from /app/.env
env = {}
for line in Path('/app/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$', line)
    if m:
        env[m.group(1)] = m.group(2)

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = env.get("API_KEY_RAILWAY") or env.get("RAILWAY_PROJECT_TOKEN")
PROJECT_ID = env.get("RAILWAY_PROJECT_ID")
SERVICE_ID = env.get("RAILWAY_SERVICE_ID")
ENVIRONMENT_ID = env.get("RAILWAY_ENVIRONMENT_ID")

print(f"API_KEY:        {API_KEY[:8]}...{API_KEY[-4:]}")
print(f"PROJECT_ID:     {PROJECT_ID}")
print(f"SERVICE_ID:     {SERVICE_ID}")
print(f"ENVIRONMENT_ID: {ENVIRONMENT_ID}\n")

HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60)
    return r.json()

# Latest deployment
deploy_q = """query($p:String!,$s:String!,$e:String!){
  deployments(input:{projectId:$p,serviceId:$s,environmentId:$e},first:3){
    edges{node{id status createdAt}}
  }
}"""
dr = gql(deploy_q, {"p": PROJECT_ID, "s": SERVICE_ID, "e": ENVIRONMENT_ID})
if dr.get("errors"):
    print("GQL errors:", json.dumps(dr["errors"], indent=2))
    sys.exit(1)

deps = [e["node"] for e in dr.get("data", {}).get("deployments", {}).get("edges", [])]
print("Recent deployments:")
for d in deps:
    print(f"  {d['id']}  {d['status']}  {d['createdAt']}")

# Pick the SUCCESS deployment
target = next((d for d in deps if d["status"] in ("SUCCESS", "RUNNING")), deps[0] if deps else None)
if not target:
    print("No deployments found."); sys.exit(1)
dep_id = target["id"]
print(f"\nUsing deployment: {dep_id}\n")

# Logs
log_q = """query($d:String!,$n:Int!){deploymentLogs(deploymentId:$d,limit:$n){message severity timestamp}}"""
lr = gql(log_q, {"d": dep_id, "n": 5000})
if lr.get("errors"):
    print("Log errors:", json.dumps(lr["errors"], indent=2))
logs = lr.get("data", {}).get("deploymentLogs", [])
print(f"Got {len(logs)} deployment logs")

# Env logs
env_q = """query($e:String!,$n:Int!){environmentLogs(environmentId:$e,afterLimit:$n){message severity timestamp}}"""
er = gql(env_q, {"e": ENVIRONMENT_ID, "n": 5000})
env_logs = er.get("data", {}).get("environmentLogs", [])
print(f"Got {len(env_logs)} environment logs\n")

all_logs = logs + env_logs
all_logs.sort(key=lambda x: x.get("timestamp", ""))

# Save raw
Path("/app/railway_all_logs.txt").write_text(
    "\n".join(f"[{l.get('timestamp','')}] [{l.get('severity','')}] {l.get('message','')}" for l in all_logs)
)
print(f"Saved {len(all_logs)} total to /app/railway_all_logs.txt\n")

# Search for Scoreboard44 / phone settings / IVR / SIP / voicemail resets
patterns = {
    "scoreboard44": re.compile(r"scoreboard44", re.I),
    "settings_reset": re.compile(r"(settings?\s*reset|reset.*settings?|wipe|restore.*default|clear.*phone|reset.*num)", re.I),
    "chatid_hints": re.compile(r"(chatId|chat_id)\s*[:=]\s*\d+.*?(scoreboard|@Scoreboard44|settings)", re.I),
    "ai_support": re.compile(r"(ai[_ ]?support|openai|gpt[- ]?5|claude|gemini|ai reply|ai:)", re.I),
    "phoneNum_update": re.compile(r"(phoneNum|phoneNumbers|numbersOf).*update", re.I),
    "forwardingConfig": re.compile(r"forwarding.*(reset|cleared|removed|\$unset)", re.I),
    "ivr_changes": re.compile(r"ivr.*(reset|clear|wipe|reconfigured|overwritten)", re.I),
    "voicemail_reset": re.compile(r"voicemail.*(reset|clear|wipe|removed|greeting.*changed)", re.I),
}
hits = {k: [] for k in patterns}
for l in all_logs:
    m = l.get("message", "")
    for k, rx in patterns.items():
        if rx.search(m):
            hits[k].append(l)

print("=" * 70)
print("HITS:")
print("=" * 70)
for k, arr in hits.items():
    print(f"\n--- {k} ({len(arr)}) ---")
    for l in arr[:50]:
        ts = l.get("timestamp", "")[:19]
        sev = l.get("severity", "")
        msg = l.get("message", "")[:400]
        print(f"  [{ts}] [{sev}] {msg}")

# Save scoreboard-specific logs
sb = hits["scoreboard44"]
Path("/app/railway_scoreboard44_logs.txt").write_text(
    "\n".join(f"[{l.get('timestamp','')}] [{l.get('severity','')}] {l.get('message','')}" for l in sb)
)
print(f"\nSaved {len(sb)} Scoreboard44-related logs to /app/railway_scoreboard44_logs.txt")
