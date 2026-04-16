#!/usr/bin/env python3
"""Fetch latest Railway production logs - find shortlink error for @flmzv2."""

import requests
import json
import sys
from datetime import datetime

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "5c463b97-111b-4116-a571-475613fd51e2"
PROJECT_ID = "dee2dbf2-3781-40d6-97cd-99f01b26c17f"
SERVICE_ID = "6fe00b0a-e9c4-4a41-aff2-e56867e63159"
ENVIRONMENT_ID = "b3e707a7-f41e-4e9d-8ea3-6b51e26ecb8d"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(API_URL, json=payload, headers=HEADERS, timeout=60)
    return resp.json()

# Step 1: Get latest deployment
print("=" * 70)
print("Step 1: Getting latest deployment...")
print("=" * 70)

deploy_query = """
query($projectId: String!, $serviceId: String!, $environmentId: String!) {
  deployments(
    input: {
      projectId: $projectId
      serviceId: $serviceId
      environmentId: $environmentId
    }
    first: 1
  ) {
    edges {
      node {
        id
        status
        createdAt
      }
    }
  }
}
"""
deploy_result = gql(deploy_query, {
    "projectId": PROJECT_ID,
    "serviceId": SERVICE_ID,
    "environmentId": ENVIRONMENT_ID,
})

if deploy_result.get("errors"):
    print(f"Deploy query errors: {json.dumps(deploy_result['errors'], indent=2)}")
    
edges = deploy_result.get("data", {}).get("deployments", {}).get("edges", [])
if not edges:
    print("No deployments found. Trying with hardcoded deployment ID...")
    DEPLOYMENT_ID = "bec5c251-25a7-44cc-8d7d-b73cf3bde2c0"
else:
    DEPLOYMENT_ID = edges[0]["node"]["id"]
    print(f"Latest deployment: {DEPLOYMENT_ID}")
    print(f"Status: {edges[0]['node'].get('status')}")
    print(f"Created: {edges[0]['node'].get('createdAt')}")

# Step 2: Fetch deployment logs
print(f"\n{'=' * 70}")
print(f"Step 2: Fetching deployment logs (deployment={DEPLOYMENT_ID})...")
print(f"{'=' * 70}")

log_query = """
query($deploymentId: String!, $limit: Int!) {
  deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
    message
    severity
    timestamp
  }
}
"""
log_result = gql(log_query, {"deploymentId": DEPLOYMENT_ID, "limit": 5000})
logs = log_result.get("data", {}).get("deploymentLogs", [])

if log_result.get("errors"):
    print(f"Log query errors: {json.dumps(log_result['errors'], indent=2)}")

print(f"Got {len(logs)} log entries")

# Step 3: Also try environment logs
print(f"\n{'=' * 70}")
print(f"Step 3: Fetching environment logs...")
print(f"{'=' * 70}")

env_log_query = """
query($environmentId: String!, $afterLimit: Int!) {
  environmentLogs(environmentId: $environmentId, afterLimit: $afterLimit) {
    message
    severity
    timestamp
  }
}
"""
env_result = gql(env_log_query, {"environmentId": ENVIRONMENT_ID, "afterLimit": 5000})
env_logs = env_result.get("data", {}).get("environmentLogs", [])
print(f"Got {len(env_logs)} environment log entries")

# Combine all logs
all_logs = logs + env_logs

# Save all logs
with open("/app/railway_logs_latest.txt", "w") as f:
    for log in sorted(all_logs, key=lambda x: x.get("timestamp", "")):
        f.write(f"[{log.get('timestamp','')}] [{log.get('severity','')}] {log.get('message','')}\n")
print(f"\nSaved {len(all_logs)} total log entries to /app/railway_logs_latest.txt")

# Step 4: Filter for shortlink/shorten/flmzv2 related logs
print(f"\n{'=' * 70}")
print(f"Step 4: Searching for flmzv2 / shortlink / shorten errors...")
print(f"{'=' * 70}")

keywords = ["flmzv2", "shorten", "shortlink", "short", "🔗", "cuttly", "bitly", "url"]
matching = []
for log in all_logs:
    msg = log.get("message", "").lower()
    if any(kw in msg for kw in keywords):
        matching.append(log)

print(f"Found {len(matching)} matching log entries")
for log in sorted(matching, key=lambda x: x.get("timestamp", "")):
    ts = log.get("timestamp", "")[:19]
    sev = log.get("severity", "")
    msg = log.get("message", "")
    print(f"  [{ts}] [{sev}] {msg[:300]}")

# Step 5: Also search for errors in general
print(f"\n{'=' * 70}")
print(f"Step 5: Recent errors (last 100 error-level logs)...")
print(f"{'=' * 70}")

errors = [l for l in all_logs if l.get("severity") == "error" or "error" in l.get("message", "").lower()]
errors_sorted = sorted(errors, key=lambda x: x.get("timestamp", ""), reverse=True)[:100]
for log in errors_sorted[:50]:
    ts = log.get("timestamp", "")[:19]
    msg = log.get("message", "")
    print(f"  [{ts}] {msg[:300]}")

# Save matching logs separately
with open("/app/railway_flmzv2_logs.txt", "w") as f:
    for log in sorted(matching, key=lambda x: x.get("timestamp", "")):
        f.write(f"[{log.get('timestamp','')}] [{log.get('severity','')}] {log.get('message','')}\n")
print(f"\nSaved {len(matching)} flmzv2/shortlink logs to /app/railway_flmzv2_logs.txt")
