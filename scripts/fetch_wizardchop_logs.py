#!/usr/bin/env python3
"""Fetch Railway production logs for @wizardchop call-forwarding bug.
Search across multiple recent deployments since the issue is intermittent."""

import os
import sys
import requests
import json

ENV_PATH = "/app/.env"
def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' not in line: continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
API_KEY = env.get("API_KEY_RAILWAY")
PROJECT_ID = env.get("RAILWAY_PROJECT_ID")
SERVICE_ID = env.get("RAILWAY_SERVICE_ID")
ENVIRONMENT_ID = env.get("RAILWAY_ENVIRONMENT_ID")
API_URL = "https://backboard.railway.app/graphql/v2"

if not all([API_KEY, PROJECT_ID, SERVICE_ID, ENVIRONMENT_ID]):
    print("Missing env"); sys.exit(1)

HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    payload = {"query": q}
    if v: payload["variables"] = v
    r = requests.post(API_URL, json=payload, headers=HEADERS, timeout=60)
    return r.json()

# Fetch last 5 deployments
print("Fetching last 5 deployments...")
q = """
query($p: String!, $s: String!, $e: String!) {
  deployments(input: {projectId: $p, serviceId: $s, environmentId: $e}, first: 5) {
    edges { node { id status createdAt } }
  }
}
"""
r = gql(q, {"p": PROJECT_ID, "s": SERVICE_ID, "e": ENVIRONMENT_ID})
edges = r.get("data", {}).get("deployments", {}).get("edges", [])

# Keys to search for
keywords = [
    "+15162719167", "5162719167", "1167900472",
    "+19382616936", "9382616936",
    "ORPHANED NUMBER",
    "playHoldMusicAndTransfer",
    "Forwarding call to",
    "wizardchop",
    "Voice] PAYLOAD",
    "[Voice]",
]

all_matching = []

for ed in edges:
    dep = ed["node"]
    DEP_ID = dep["id"]
    print(f"\nDeployment: {DEP_ID}  status={dep['status']}  created={dep['createdAt']}")
    q2 = """
    query($d: String!, $l: Int!) {
      deploymentLogs(deploymentId: $d, limit: $l) { message severity timestamp }
    }
    """
    r2 = gql(q2, {"d": DEP_ID, "l": 5000})
    logs = r2.get("data", {}).get("deploymentLogs", []) or []
    print(f"  Got {len(logs)} entries")
    for log in logs:
        msg = log.get("message", "") or ""
        ml = msg.lower()
        for kw in keywords:
            if kw.lower() in ml:
                all_matching.append({**log, "_dep": DEP_ID})
                break

# Also fetch environment-wide logs
print("\nFetching environment logs...")
q3 = """
query($e: String!, $l: Int!) {
  environmentLogs(environmentId: $e, afterLimit: $l) { message severity timestamp }
}
"""
r3 = gql(q3, {"e": ENVIRONMENT_ID, "l": 10000})
elogs = (r3.get("data") or {}).get("environmentLogs", []) or []
print(f"  Got {len(elogs)} env-wide entries")
for log in elogs:
    msg = log.get("message", "") or ""
    ml = msg.lower()
    for kw in keywords:
        if kw.lower() in ml:
            all_matching.append({**log, "_dep": "env"})
            break

# Dedupe + sort
seen = set()
unique = []
for log in all_matching:
    key = (log.get("timestamp"), log.get("message", "")[:120])
    if key in seen: continue
    seen.add(key)
    unique.append(log)
unique.sort(key=lambda x: x.get("timestamp", ""))

print(f"\n{'='*80}\nMATCHING LOGS: {len(unique)}\n{'='*80}")
for log in unique[-300:]:
    ts = (log.get("timestamp") or "")[:23]
    sev = log.get("severity", "")
    msg = (log.get("message") or "")[:600]
    dep = log.get("_dep", "")[:8]
    print(f"[{ts}][{sev}][{dep}] {msg}")

out = "/app/railway_wizardchop_logs.txt"
with open(out, "w") as f:
    for log in unique:
        f.write(f"[{log.get('timestamp','')}][{log.get('severity','')}][{log.get('_dep','')}] {log.get('message','')}\n")
print(f"\nFull matching saved: {out}")
