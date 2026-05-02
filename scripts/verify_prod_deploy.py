#!/usr/bin/env python3
"""
Verify Railway production has the AntiRed/WHM hardening fixes deployed.

Checks:
  1. Latest deployment status for each service (SUCCESS / FAILED / REMOVED).
  2. Pull last 30 min of logs and confirm presence of NEW behaviour signals
     (e.g. retry log line) and absence of OLD failure patterns
     (cPHulk 10000ms timeout, AntiRed 30000ms timeout).
"""

import json
import os
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ENV_FILE = Path("/app/backend/.env")
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

TOKEN = os.environ["RAILWAY_PROJECT_TOKEN"]
PID = os.environ["RAILWAY_PROJECT_ID"]
EID = os.environ["RAILWAY_ENVIRONMENT_ID"]
ENDPOINT = "https://backboard.railway.app/graphql/v2"


def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Project-Access-Token": TOKEN,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


# ── 1. Latest deployments per service ──
print("=" * 78)
print("Railway production deployment verification")
print("=" * 78)
print(f"Project: {PID}")
print(f"Env:     {EID}")

q_services = """
query($projectId: String!) {
  project(id: $projectId) {
    services { edges { node { id name } } }
  }
}
"""
services = gql(q_services, {"projectId": PID})["data"]["project"]["services"]["edges"]
print(f"\nServices: {[s['node']['name'] for s in services]}\n")

q_dep = """
query($pid:String!, $eid:String!, $sid:String!) {
  deployments(
    first: 5,
    input: {projectId: $pid, environmentId: $eid, serviceId: $sid}
  ) {
    edges { node { id status createdAt } }
  }
}
"""

cutoff = datetime.now(timezone.utc) - timedelta(minutes=90)
report = {}
for s in services:
    sid = s["node"]["id"]
    name = s["node"]["name"]
    deps = gql(q_dep, {"pid": PID, "eid": EID, "sid": sid})["data"]["deployments"]["edges"]
    if not deps:
        continue
    latest = deps[0]["node"]
    print(f"▶ {name}")
    print(f"   latest: {latest['status']:10s}  {latest['createdAt']}  id={latest['id'][:8]}")
    for d in deps[1:]:
        print(f"           {d['node']['status']:10s}  {d['node']['createdAt']}  id={d['node']['id'][:8]}")
    report[name] = {"latest_status": latest["status"], "latest_at": latest["createdAt"], "id": latest["id"]}


# ── 2. Pull recent logs for the active deployment of `Nomadly-EMAIL-IVR`
target_name = "Nomadly-EMAIL-IVR"
if target_name not in report:
    print(f"\n[!] {target_name} not in services — skipping log scan.")
    sys.exit(0)

dep_id = report[target_name]["id"]
print(f"\n--- Scanning recent logs of {target_name} ({dep_id[:8]}…) ---")

q_logs = """
query($id: String!, $limit: Int!, $filter: String) {
  deploymentLogs(deploymentId: $id, limit: $limit, filter: $filter) {
    message
    timestamp
    severity
  }
}
"""
start = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
try:
    logs = gql(q_logs, {"id": dep_id, "limit": 1000, "filter": ""})["data"]["deploymentLogs"] or []
    # Client-side time window filter
    win_start = datetime.now(timezone.utc) - timedelta(minutes=60)
    fresh = []
    for entry in logs:
        ts = entry.get("timestamp")
        if not ts:
            continue
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            continue
        if t >= win_start:
            fresh.append(entry)
    logs = fresh
except Exception as e:
    print(f"[!] log query failed: {e}")
    logs = []

print(f"   {len(logs)} log lines pulled (last 60 min)")

patterns = {
    "OLD_cPHulk_10000ms":  r"cPHulk error: timeout of 10000ms",
    "OLD_AntiRed_30000ms_directly_to_origin":  r"\[AntiRed\] CF IP Fix deploy error.+timeout of 30000ms",
    "OLD_WHM_DOWN_first_detection":  r"WHM control-plane DOWN — first detection",
    "NEW_whm_retry":  r"transient error.+retrying in",  # our new log line
    "WHM_UP_back":  r"WHM control-plane back UP",
    "AntiRed_success":  r"CF IP Fix deployed for",
    "Whitelist_success":  r"cPHulk:.+whitelisted successfully",
}
hits = Counter()
samples = {k: [] for k in patterns}
import re
for entry in logs:
    msg = entry.get("message", "")
    for k, rx in patterns.items():
        if re.search(rx, msg):
            hits[k] += 1
            if len(samples[k]) < 2:
                samples[k].append((entry.get("timestamp"), msg[:200]))

print("\nPattern hits (last 60 min):")
for k in patterns:
    print(f"  {hits[k]:4d}  {k}")

print("\nSamples:")
for k, ex in samples.items():
    if ex:
        print(f"  --- {k} ---")
        for ts, m in ex:
            print(f"    {ts}  {m}")

# ── 3. Verdict ──
print("\nVerdict")
print("-------")
old_signals = sum(hits[k] for k in ["OLD_cPHulk_10000ms", "OLD_AntiRed_30000ms_directly_to_origin"])
new_signals = sum(hits[k] for k in ["NEW_whm_retry", "AntiRed_success"])
if report[target_name]["latest_status"] == "SUCCESS":
    print(f"  ✓ Latest deployment SUCCESS at {report[target_name]['latest_at']}")
else:
    print(f"  ⚠ Latest deployment is {report[target_name]['latest_status']}")
if old_signals == 0:
    print(f"  ✓ No OLD timeout signatures in last 60 min")
else:
    print(f"  ✗ {old_signals} OLD timeout signature(s) still present — fix not yet deployed")
if new_signals > 0:
    print(f"  ✓ {new_signals} NEW success/retry signal(s) in last 60 min")
else:
    print(f"  ⚠ NEW signals not yet observed — deploy may not have rolled out, or no whitelist/AntiRed activity in this window")
