#!/usr/bin/env python3
"""Deeper Railway log analysis for flmzv2 shortlink error."""

import requests
import json

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "5c463b97-111b-4116-a571-475613fd51e2"
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

# Step 1: Get ALL deployments to find the right one
print("=" * 70)
print("Fetching ALL recent deployments...")
print("=" * 70)

deploy_query = """
query($projectId: String!, $serviceId: String!, $environmentId: String!) {
  deployments(
    input: {
      projectId: $projectId
      serviceId: $serviceId
      environmentId: $environmentId
    }
    first: 5
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
    "projectId": "dee2dbf2-3781-40d6-97cd-99f01b26c17f",
    "serviceId": "6fe00b0a-e9c4-4a41-aff2-e56867e63159",
    "environmentId": ENVIRONMENT_ID,
})

edges = deploy_result.get("data", {}).get("deployments", {}).get("edges", [])
for e in edges:
    n = e["node"]
    print(f"  Deployment: {n['id']} | Status: {n['status']} | Created: {n['createdAt']}")

# Step 2: Fetch logs from latest deployment with max limit
DEPLOYMENT_ID = edges[0]["node"]["id"] if edges else "6b3975fe-c08c-4e35-bbb7-513c1cfa813c"
print(f"\n{'=' * 70}")
print(f"Fetching max logs from deployment: {DEPLOYMENT_ID}")
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
result = gql(log_query, {"deploymentId": DEPLOYMENT_ID, "limit": 5000})
if result.get("errors"):
    print(f"Errors: {json.dumps(result['errors'], indent=2)}")
logs = (result.get("data") or {}).get("deploymentLogs") or []
print(f"Got {len(logs)} deployment log entries")

# Sort by time
logs_sorted = sorted(logs, key=lambda x: x.get("timestamp", ""))

# Step 3: Find ALL logs between 16:39:50 and 16:41:00 (around the error)
print(f"\n{'=' * 70}")
print(f"ALL logs around shortlink error (16:39:50 - 16:41:00):")
print(f"{'=' * 70}")

for log in logs_sorted:
    ts = log.get("timestamp", "")
    if "2026-04-16T16:39:" in ts or "2026-04-16T16:40:" in ts:
        sev = log.get("severity", "")
        msg = log.get("message", "")
        marker = " <<<< ERROR" if "failed" in msg.lower() or "error" in msg.lower() or sev == "error" else ""
        print(f"  [{ts[:23]}] [{sev:5}] {msg[:400]}{marker}")

# Step 4: Look for ANY error-severity logs
print(f"\n{'=' * 70}")
print(f"ALL error-severity logs:")
print(f"{'=' * 70}")
error_logs = [l for l in logs_sorted if l.get("severity") == "error"]
for log in error_logs:
    ts = log.get("timestamp", "")[:23]
    msg = log.get("message", "")
    print(f"  [{ts}] {msg[:400]}")

if not error_logs:
    print("  (no error-severity logs found)")

# Step 5: Look for unhandled rejections, TypeError, ReferenceError, etc.
print(f"\n{'=' * 70}")
print(f"JavaScript errors (TypeError, ReferenceError, etc.):")
print(f"{'=' * 70}")

js_errors = [l for l in logs_sorted if any(x in l.get("message", "") for x in 
    ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "undefined", "Cannot read", "is not a function", "Unhandled", "ECONNREFUSED", "ETIMEDOUT"])]
for log in js_errors:
    ts = log.get("timestamp", "")[:23]
    msg = log.get("message", "")
    print(f"  [{ts}] {msg[:400]}")

if not js_errors:
    print("  (no JS errors found)")

# Step 6: Check for chatId 7304424395 in ALL logs
print(f"\n{'=' * 70}")
print(f"ALL logs mentioning chatId 7304424395 (flmzv2):")
print(f"{'=' * 70}")

user_logs = [l for l in logs_sorted if "7304424395" in l.get("message", "")]
for log in user_logs:
    ts = log.get("timestamp", "")[:23]
    msg = log.get("message", "")
    print(f"  [{ts}] {msg[:400]}")

# Step 7: Look for shortener/cuttly/bitly/rapidapi errors
print(f"\n{'=' * 70}")
print(f"Shortener service logs:")
print(f"{'=' * 70}")

shortener_logs = [l for l in logs_sorted if any(x in l.get("message", "").lower() for x in 
    ["shortener", "cuttly", "rapidapi", "url-shortener42", "createshort", "dedup", "slug"])]
for log in shortener_logs:
    ts = log.get("timestamp", "")[:23]
    msg = log.get("message", "")
    print(f"  [{ts}] {msg[:400]}")

if not shortener_logs:
    print("  (no shortener-specific logs found)")

# Save all to file
with open("/app/railway_deep_analysis.txt", "w") as f:
    for log in logs_sorted:
        f.write(f"[{log.get('timestamp','')}] [{log.get('severity','')}] {log.get('message','')}\n")
print(f"\nSaved {len(logs_sorted)} logs to /app/railway_deep_analysis.txt")
