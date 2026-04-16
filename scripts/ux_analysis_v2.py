#!/usr/bin/env python3
"""Fetch LATEST Railway production logs — check for new issues since UX fixes."""

import requests
import json
import re
from collections import defaultdict, Counter
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

# Get latest deployment
deploy_query = """
query($projectId: String!, $serviceId: String!, $environmentId: String!) {
  deployments(
    input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }
    first: 3
  ) { edges { node { id status createdAt } } }
}
"""
deploy_result = gql(deploy_query, {
    "projectId": PROJECT_ID,
    "serviceId": SERVICE_ID,
    "environmentId": ENVIRONMENT_ID,
})
edges = deploy_result.get("data", {}).get("deployments", {}).get("edges", [])

print("=" * 80)
print("DEPLOYMENTS")
print("=" * 80)
for e in edges:
    n = e["node"]
    print(f"  {n['id'][:12]}... | {n['status']} | {n['createdAt']}")

# Fetch logs from all recent deployments
all_logs = []
log_query = """
query($deploymentId: String!, $limit: Int!) {
  deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
    message
    severity
    timestamp
  }
}
"""
for e in edges[:3]:
    dep_id = e["node"]["id"]
    result = gql(log_query, {"deploymentId": dep_id, "limit": 5000})
    logs = (result.get("data") or {}).get("deploymentLogs") or []
    print(f"  Deployment {dep_id[:12]}: {len(logs)} logs")
    all_logs.extend(logs)

# Also environment logs
env_query = """
query($environmentId: String!, $afterLimit: Int!) {
  environmentLogs(environmentId: $environmentId, afterLimit: $afterLimit) {
    message severity timestamp
  }
}
"""
env_result = gql(env_query, {"environmentId": ENVIRONMENT_ID, "afterLimit": 5000})
env_logs = (env_result.get("data") or {}).get("environmentLogs") or []
print(f"  Environment: {len(env_logs)} logs")
all_logs.extend(env_logs)

# Deduplicate
seen = set()
unique = []
for log in all_logs:
    key = f"{log.get('timestamp','')}{log.get('message','')[:100]}"
    if key not in seen:
        seen.add(key)
        unique.append(log)
logs_sorted = sorted(unique, key=lambda x: x.get("timestamp", ""))
print(f"\nTotal unique entries: {len(logs_sorted)}")
print(f"Time range: {logs_sorted[0]['timestamp'][:19] if logs_sorted else '?'} → {logs_sorted[-1]['timestamp'][:19] if logs_sorted else '?'}")

# Parse interactions
user_actions = defaultdict(list)
replies = []
etelegram_errors = []
backend_errors = []

for log in logs_sorted:
    msg = log.get("message", "")
    ts = log.get("timestamp", "")
    sev = log.get("severity", "")

    m = re.match(r'message:\s+(.+?)\s+from:\s+(\d+)\s+(\S+)', msg)
    if m:
        user_actions[f"{m.group(2)} ({m.group(3)})"].append((ts, "IN", m.group(1).strip()))
        continue

    r = re.match(r'reply:\s+(.+?)\s+to:\s+(\d+)', msg)
    if r:
        replies.append((ts, r.group(2), r.group(1).strip()[:300]))
        continue

    if "ETELEGRAM" in msg:
        etelegram_errors.append((ts, msg))

    if sev == "error" or any(x in msg for x in [
        "TypeError", "ReferenceError", "Unhandled", "ECONNREFUSED", "ETIMEDOUT",
        "Cannot read", "is not a function", "MongoError", "FATAL", "crash",
        "ERR_", "EPIPE", "ENOTFOUND"]):
        backend_errors.append((ts, msg))

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("1. USER JOURNEYS")
print("=" * 80)

for uid, actions in sorted(user_actions.items(), key=lambda x: -len(x[1])):
    if len(actions) < 2:
        continue
    print(f"\n>> {uid} ({len(actions)} actions)")
    for ts, d, txt in actions[-40:]:
        print(f"  [{ts[11:19]}] {txt[:150]}")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("2. ERROR MESSAGES TO USERS")
print("=" * 80)

err_kw = ["failed", "error", "invalid", "expired", "denied", "issue", "unavailable",
          "not found", "cannot", "unable", "wrong", "couldn't", "sorry", "too low",
          "underpayment", "not enough", "try again"]
user_errors = [(ts, cid, r) for ts, cid, r in replies if any(k in r.lower() for k in err_kw)]
for ts, cid, r in user_errors:
    print(f"  [{ts[11:19]}] to:{cid} >> {r[:250]}")
if not user_errors:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("3. TELEGRAM API ERRORS")
print("=" * 80)
for ts, msg in etelegram_errors:
    print(f"  [{ts[11:19]}] {msg[:250]}")
if not etelegram_errors:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("4. BACKEND ERRORS / EXCEPTIONS")
print("=" * 80)
for ts, msg in backend_errors[-30:]:
    print(f"  [{ts[11:19]}] {msg[:300]}")
if not backend_errors:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("5. REPEATED ACTIONS (retries / confusion)")
print("=" * 80)
repeat_count = 0
for uid, actions in user_actions.items():
    for i in range(1, len(actions)):
        if actions[i][2] == actions[i-1][2] and actions[i][2] not in ['/start', 'Back', 'Cancel']:
            print(f"  [{actions[i][0][11:19]}] {uid} >> repeated: '{actions[i][2][:100]}'")
            repeat_count += 1
if repeat_count == 0:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("6. FLOW ABANDONMENTS")
print("=" * 80)
starters = ["Buy", "Send", "Create", "Shorten", "Shortit", "Campaign", "Deposit", "Pay", "Wallet", "VPS", "Domain"]
enders = ["Back", "/start", "Cancel", "Annuler", "Retour", "Home"]
abn_count = 0
for uid, actions in user_actions.items():
    for i in range(len(actions) - 1):
        c, n = actions[i][2], actions[i+1][2]
        if any(s in c for s in starters) and any(e in n for e in enders):
            print(f"  [{actions[i][0][11:19]}] {uid} >> '{c[:60]}' -> '{n[:60]}'")
            abn_count += 1
if abn_count == 0:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("7. LONG GAPS (>2min, confusion indicator)")
print("=" * 80)
gap_count = 0
for uid, actions in user_actions.items():
    if len(actions) < 2: continue
    for i in range(1, len(actions)):
        try:
            t1 = datetime.fromisoformat(actions[i-1][0].replace('Z', '+00:00'))
            t2 = datetime.fromisoformat(actions[i][0].replace('Z', '+00:00'))
            gap = (t2 - t1).total_seconds()
            if 120 < gap < 3600:
                print(f"  [{actions[i-1][0][11:19]}] {uid} >> {int(gap)}s gap: '{actions[i-1][2][:50]}' -> '{actions[i][2][:50]}'")
                gap_count += 1
        except: pass
if gap_count == 0:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("8. PAYWALL / SUBSCRIPTION BLOCKS")
print("=" * 80)
pw_kw = ["subscri", "expired", "renew", "upgrade", "exhaust", "limit", "buy plan", "free trial", "balance too low", "need.*more"]
pw_count = 0
for ts, cid, r in replies:
    if any(k in r.lower() for k in pw_kw):
        print(f"  [{ts[11:19]}] to:{cid} >> {r[:250]}")
        pw_count += 1
if pw_count == 0:
    print("  (none)")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("9. FEATURE POPULARITY")
print("=" * 80)
all_acts = [a[2] for uid, acts in user_actions.items() for a in acts]
for act, cnt in Counter(all_acts).most_common(30):
    print(f"  {cnt:4d}x >> {act[:120]}")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("10. ACTIVE USERS SUMMARY")
print("=" * 80)
for uid, acts in sorted(user_actions.items(), key=lambda x: -len(x[1])):
    print(f"  {uid:40s} >> {len(acts):3d} actions | {acts[0][0][11:19]} -> {acts[-1][0][11:19]}")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("11. PAYMENT / DEPOSIT FLOWS")
print("=" * 80)
pay_kw = ["deposit", "pay", "bitcoin", "crypto", "btc", "usdt", "litecoin", "payment", "credited", "wallet"]
for ts, cid, r in replies:
    if any(k in r.lower() for k in pay_kw):
        print(f"  [{ts[11:19]}] to:{cid} >> {r[:250]}")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("12. NEW USER ONBOARDING PATTERNS")
print("=" * 80)
for uid, acts in user_actions.items():
    if acts[0][2] == '/start' and len(acts) >= 3:
        first_5 = [a[2][:40] for a in acts[:5]]
        print(f"  {uid:35s} >> {' -> '.join(first_5)}")

# ═══════════════════════════════════════════════════
print("\n" + "=" * 80)
print("13. POTENTIAL DEAD ENDS")
print("=" * 80)
user_timelines = defaultdict(list)
for log in logs_sorted:
    msg = log.get("message", "")
    ts = log.get("timestamp", "")
    m = re.match(r'message:\s+(.+?)\s+from:\s+(\d+)', msg)
    if m:
        user_timelines[m.group(2)].append((ts, "IN", m.group(1).strip()))
    r = re.match(r'reply:\s+(.+?)\s+to:\s+(\d+)', msg)
    if r:
        user_timelines[r.group(2)].append((ts, "OUT", r.group(1).strip()[:200]))

de_count = 0
for cid, tl in user_timelines.items():
    if len(tl) >= 2 and tl[-1][1] == "OUT":
        last = tl[-1][2].lower()
        if not any(k in last for k in ["success", "done", "completed", "created", "welcome", "activated", "thank"]):
            print(f"  User {cid} >> Last bot msg: '{tl[-1][2][:150]}'")
            de_count += 1
if de_count == 0:
    print("  (none)")

print("\n" + "=" * 80)
print(f"ANALYSIS COMPLETE — {len(logs_sorted)} logs, {len(user_actions)} users, {len(user_errors)} errors to users, {len(etelegram_errors)} ETELEGRAM, {len(backend_errors)} backend errors")
print("=" * 80)
