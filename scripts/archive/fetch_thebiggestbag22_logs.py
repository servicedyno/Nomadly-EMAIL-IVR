#!/usr/bin/env python3
"""Fetch Railway production logs for @Thebiggestbag22 file-delete issue."""

import os
import sys
import requests
import json

# Read Railway creds from /app/.env
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
    print(f"Missing env: key={bool(API_KEY)} proj={bool(PROJECT_ID)} svc={bool(SERVICE_ID)} env={bool(ENVIRONMENT_ID)}")
    sys.exit(1)

HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    payload = {"query": q}
    if v: payload["variables"] = v
    r = requests.post(API_URL, json=payload, headers=HEADERS, timeout=60)
    return r.json()

# Get latest deployment
print(f"PROJECT: {PROJECT_ID}")
print(f"SERVICE: {SERVICE_ID}")
print(f"ENV:     {ENVIRONMENT_ID}")
print("Fetching latest deployment...")
q = """
query($p: String!, $s: String!, $e: String!) {
  deployments(input: {projectId: $p, serviceId: $s, environmentId: $e}, first: 1) {
    edges { node { id status createdAt } }
  }
}
"""
r = gql(q, {"p": PROJECT_ID, "s": SERVICE_ID, "e": ENVIRONMENT_ID})
if r.get("errors"):
    print(json.dumps(r["errors"], indent=2))
    sys.exit(1)
edges = r.get("data", {}).get("deployments", {}).get("edges", [])
if not edges:
    print("No deployments returned")
    sys.exit(1)
dep = edges[0]["node"]
DEP_ID = dep["id"]
print(f"Deployment: {DEP_ID}  status={dep['status']}  created={dep['createdAt']}")

# Fetch logs
print(f"\nFetching deployment logs (5000)...")
q = """
query($d: String!, $l: Int!) {
  deploymentLogs(deploymentId: $d, limit: $l) { message severity timestamp }
}
"""
r = gql(q, {"d": DEP_ID, "l": 5000})
logs = r.get("data", {}).get("deploymentLogs", [])
print(f"Got {len(logs)} log entries\n")

# Also fetch environment logs
r2 = gql("""
query($e: String!, $l: Int!) {
  environmentLogs(environmentId: $e, afterLimit: $l) { message severity timestamp }
}
""", {"e": ENVIRONMENT_ID, "l": 5000})
elogs = r2.get("data", {}).get("environmentLogs", [])
print(f"Got {len(elogs)} environment logs")

all_logs = logs + elogs
all_logs.sort(key=lambda x: x.get("timestamp", ""))

# Filter for file delete / Thebiggestbag / cPanel errors
keywords = ["thebiggestbag", "biggestbag", "bag22", "/files/delete", "fileop", "unlink",
            "killdir", "Fileman", "deleteFile", "cPanel Proxy API2"]
matching = []
for log in all_logs:
    msg = log.get("message", "") or ""
    ml = msg.lower()
    if any(kw.lower() in ml for kw in keywords):
        matching.append(log)

print(f"\n{'='*80}\nMatching logs (keywords: {keywords}): {len(matching)}\n{'='*80}")
for log in matching[-150:]:
    ts = (log.get("timestamp") or "")[:19]
    sev = log.get("severity", "")
    msg = (log.get("message") or "")[:500]
    print(f"[{ts}][{sev}] {msg}")

# Save all matching + recent errors
out = "/app/railway_thebiggestbag22_logs.txt"
with open(out, "w") as f:
    for log in all_logs:
        f.write(f"[{log.get('timestamp','')}][{log.get('severity','')}] {log.get('message','')}\n")
print(f"\nFull logs saved: {out} ({len(all_logs)} entries)")
