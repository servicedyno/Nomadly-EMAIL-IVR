#!/usr/bin/env python3
"""Fetch and analyze Railway deployment logs comprehensively."""

import requests
import json
import sys
import re
from collections import Counter, defaultdict
from datetime import datetime

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "5c463b97-111b-4116-a571-475613fd51e2"
PROJECT_ID = "dee2dbf2-3781-40d6-97cd-99f01b26c17f"
SERVICE_ID = "6fe00b0a-e9c4-4a41-aff2-e56867e63159"
ENVIRONMENT_ID = "b3e707a7-f41e-4e9d-8ea3-6b51e26ecb8d"
DEPLOYMENT_ID = "bec5c251-25a7-44cc-8d7d-b73cf3bde2c0"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "User-Agent": "NomadlyBot/1.0",
}


def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(API_URL, json=payload, headers=HEADERS, timeout=60)
    return resp.json()


def fetch_deployment_logs(deployment_id, limit=2000):
    """Fetch deployment logs with correct schema."""
    query = """
    query($deploymentId: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
        message
        severity
        timestamp
      }
    }
    """
    result = gql(query, {"deploymentId": deployment_id, "limit": limit})
    if result.get("data", {}).get("deploymentLogs"):
        return result["data"]["deploymentLogs"]
    print(f"Error: {json.dumps(result.get('errors', []), indent=2)}")
    return []


def fetch_environment_logs(env_id, after_limit=2000):
    """Fetch environment-level logs."""
    query = """
    query($environmentId: String!, $afterLimit: Int!) {
      environmentLogs(environmentId: $environmentId, afterLimit: $afterLimit) {
        message
        severity
        timestamp
      }
    }
    """
    result = gql(query, {"environmentId": env_id, "afterLimit": after_limit})
    if result.get("data", {}).get("environmentLogs"):
        return result["data"]["environmentLogs"]
    return []


def fetch_http_logs(deployment_id, limit=500):
    """Fetch HTTP access logs."""
    query = """
    query($deploymentId: String!, $limit: Int!) {
      httpLogs(deploymentId: $deploymentId, limit: $limit) {
        message
        severity
        timestamp
      }
    }
    """
    result = gql(query, {"deploymentId": deployment_id, "limit": limit})
    if result.get("data", {}).get("httpLogs"):
        return result["data"]["httpLogs"]
    return []


if __name__ == "__main__":
    print("=" * 70)
    print("Railway Log Fetcher — Comprehensive Analysis")
    print("=" * 70)

    # Fetch deployment runtime logs (max 2000)
    print("\n📜 Fetching deployment runtime logs (limit=2000)...")
    runtime_logs = fetch_deployment_logs(DEPLOYMENT_ID, limit=2000)
    print(f"  ✅ Got {len(runtime_logs)} runtime log entries")

    # Fetch HTTP logs
    print("\n🌐 Fetching HTTP access logs (limit=500)...")
    http_logs = fetch_http_logs(DEPLOYMENT_ID, limit=500)
    print(f"  ✅ Got {len(http_logs)} HTTP log entries")

    # Combine and save
    all_logs = runtime_logs + http_logs
    
    # Save raw JSON
    with open("/app/railway_logs_raw.json", "w") as f:
        json.dump({"runtime": runtime_logs, "http": http_logs}, f, indent=2)
    print(f"\n📁 Saved {len(all_logs)} total entries to /app/railway_logs_raw.json")

    # Save text logs 
    with open("/app/railway_logs.txt", "w") as f:
        for log in sorted(runtime_logs, key=lambda x: x.get("timestamp", "")):
            f.write(f"[{log.get('timestamp','')}] [{log.get('severity','')}] {log.get('message','')}\n")
    print(f"📁 Saved text logs to /app/railway_logs.txt")

    # Save HTTP logs separately
    with open("/app/railway_http_logs.txt", "w") as f:
        for log in sorted(http_logs, key=lambda x: x.get("timestamp", "")):
            f.write(f"[{log.get('timestamp','')}] {log.get('message','')}\n")
    print(f"📁 Saved HTTP logs to /app/railway_http_logs.txt")

    # Print summary stats
    print(f"\n{'='*70}")
    print("LOG SUMMARY")
    print(f"{'='*70}")
    
    # Severity distribution
    sev_counts = Counter(l.get("severity", "unknown") for l in runtime_logs)
    print(f"\nSeverity distribution (runtime):")
    for sev, count in sev_counts.most_common():
        print(f"  {sev}: {count}")

    # Timestamp range
    timestamps = [l.get("timestamp", "") for l in runtime_logs if l.get("timestamp")]
    if timestamps:
        print(f"\nTime range: {min(timestamps)[:19]} → {max(timestamps)[:19]}")

    print(f"\n✅ Log fetch complete. Analyze with:")
    print(f"  cat /app/railway_logs.txt | grep -i error")
    print(f"  cat /app/railway_http_logs.txt | head -50")
