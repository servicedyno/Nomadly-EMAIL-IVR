#!/usr/bin/env python3
"""Drill into specific anomalies found in the 48h scan."""
import json, urllib.request, time
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
ENDPOINT = "https://backboard.railway.app/graphql/v2"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

def gql(query, variables, retries=3):
    body = json.dumps({"query": query, "variables": variables}).encode()
    for i in range(retries):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, headers={
                "Content-Type": "application/json",
                "User-Agent": UA,
                "Project-Access-Token": TOKEN,
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if i == retries - 1:
                return {"errors": [{"err": str(e)}]}
            time.sleep(2)

def fetch_logs(filter_str, hours_back=48, limit=500):
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours_back)
    q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
      environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
        timestamp message severity } }"""
    anchor = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    r = gql(q, {"e": ENV_ID, "a": anchor, "f": filter_str, "lim": limit})
    if "errors" in r:
        return []
    logs = r["data"]["environmentLogs"] or []
    start_str = start.strftime("%Y-%m-%dT%H:%M:%S")
    return [lg for lg in logs if lg["timestamp"][:19] >= start_str]

print("=" * 80)
print("1. SETTLEMENT FAILED — Full context around payment 08fc2d53")
print("=" * 80)
logs = fetch_logs("08fc2d53", hours_back=72, limit=200)
for lg in logs:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("2. PHONE SCHEDULER — Insufficient funds detail")
print("=" * 80)
logs = fetch_logs("insufficient funds", hours_back=72, limit=200)
for lg in logs:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("3. PHONE SCHEDULER — Auto-renew outcomes last 72h")
print("=" * 80)
logs = fetch_logs("PhoneScheduler", hours_back=72, limit=300)
renew_lines = [lg for lg in logs if "auto-renew" in lg["message"].lower() or "released" in lg["message"].lower() or "expiry check complete" in lg["message"].lower()]
for lg in renew_lines[-20:]:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("4. FINCRA AUTH — Recent status (last 24h)")
print("=" * 80)
logs = fetch_logs("Fincra authentication failed", hours_back=24, limit=100)
print(f"  Count in last 24h: {len(logs)}")
if logs:
    print(f"  Latest: [{logs[0]['timestamp'][:19]}] {logs[0]['message'][:200]}")
    print(f"  Oldest: [{logs[-1]['timestamp'][:19]}] {logs[-1]['message'][:200]}")

print("\n" + "=" * 80)
print("5. SSL DEFERRED — Domains with origin timeout")
print("=" * 80)
logs = fetch_logs("SSL DEFERRED", hours_back=48, limit=200)
domains = set()
for lg in logs:
    msg = lg["message"]
    if "SSL DEFERRED:" in msg:
        parts = msg.split("SSL DEFERRED:")[1].strip().split(" ")
        if parts:
            domains.add(parts[0])
print(f"  Domains with SSL deferred ({len(domains)}):")
for d in sorted(domains):
    print(f"    - {d}")

print("\n" + "=" * 80)
print("6. WALLET CREDITS — Last 48h (revenue signal)")
print("=" * 80)
logs = fetch_logs("wallet credited", hours_back=48, limit=100)
for lg in logs:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("7. HOSTING SCHEDULER — Recent actions")
print("=" * 80)
logs = fetch_logs("HostingScheduler", hours_back=48, limit=200)
action_lines = [lg for lg in logs if "check complete" in lg["message"].lower() or "auto-renewed" in lg["message"].lower() or "terminated" in lg["message"].lower() or "suspended" in lg["message"].lower()]
for lg in action_lines[-15:]:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("8. DYNOPAY WEBHOOKS — Payment events")
print("=" * 80)
logs = fetch_logs("DYNOPAY WEBHOOK", hours_back=48, limit=100)
for lg in logs[:15]:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")

print("\n" + "=" * 80)
print("9. OPERATIONS BLOCKED — Service disruptions")
print("=" * 80)
logs = fetch_logs("OPERATIONS_BLOCKED", hours_back=48, limit=100)
print(f"  Count in last 48h: {len(logs)}")
for lg in logs[:10]:
    print(f"  [{lg['timestamp'][:19]}] {lg['message'][:250]}")
