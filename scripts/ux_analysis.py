#!/usr/bin/env python3
"""Fetch Railway production logs and analyze for UI/UX and user flow issues."""

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

# Step 1: Get all recent deployments
print("=" * 80)
print("FETCHING DEPLOYMENTS...")
print("=" * 80)

deploy_query = """
query($projectId: String!, $serviceId: String!, $environmentId: String!) {
  deployments(
    input: {
      projectId: $projectId
      serviceId: $serviceId
      environmentId: $environmentId
    }
    first: 10
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

edges = deploy_result.get("data", {}).get("deployments", {}).get("edges", [])
for e in edges:
    n = e["node"]
    print(f"  {n['id']} | {n['status']} | {n['createdAt']}")

# Step 2: Fetch logs from multiple deployments for broader coverage
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

for e in edges[:3]:  # Last 3 deployments
    dep_id = e["node"]["id"]
    dep_status = e["node"]["status"]
    print(f"\nFetching logs from deployment {dep_id} ({dep_status})...")
    result = gql(log_query, {"deploymentId": dep_id, "limit": 5000})
    logs = (result.get("data") or {}).get("deploymentLogs") or []
    print(f"  Got {len(logs)} entries")
    all_logs.extend(logs)

# Also fetch environment logs
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
env_logs = (env_result.get("data") or {}).get("environmentLogs") or []
print(f"\nEnvironment logs: {len(env_logs)} entries")
all_logs.extend(env_logs)

# Deduplicate by timestamp+message
seen = set()
unique_logs = []
for log in all_logs:
    key = f"{log.get('timestamp','')}{log.get('message','')}"
    if key not in seen:
        seen.add(key)
        unique_logs.append(log)

logs_sorted = sorted(unique_logs, key=lambda x: x.get("timestamp", ""))
print(f"\nTotal unique log entries: {len(logs_sorted)}")

# Save raw logs
with open("/app/railway_ux_analysis_raw.txt", "w") as f:
    for log in logs_sorted:
        f.write(f"[{log.get('timestamp','')}] [{log.get('severity','')}] {log.get('message','')}\n")

# ========================================================================
# ANALYSIS
# ========================================================================

print("\n" + "=" * 80)
print("UI/UX & USER FLOW ANALYSIS")
print("=" * 80)

# Parse user interactions
user_actions = defaultdict(list)  # chatId -> list of (timestamp, action)
error_messages = []
etelegram_errors = []
flow_entries = []
replies_to_users = []

for log in logs_sorted:
    msg = log.get("message", "")
    ts = log.get("timestamp", "")
    sev = log.get("severity", "")
    
    # Track user messages (incoming)
    m = re.match(r'message:\s+(.+?)\s+from:\s+(\d+)\s+(\S+)', msg)
    if m:
        action_text = m.group(1).strip()
        chat_id = m.group(2)
        username = m.group(3)
        user_actions[f"{chat_id} ({username})"].append((ts, "INPUT", action_text))
        flow_entries.append((ts, chat_id, username, "INPUT", action_text))
        continue
    
    # Track bot replies (outgoing)
    r = re.match(r'reply:\s+(.+?)\s+to:\s+(\d+)', msg)
    if r:
        reply_text = r.group(1).strip()[:200]
        chat_id = r.group(2)
        replies_to_users.append((ts, chat_id, reply_text))
        flow_entries.append((ts, chat_id, "", "REPLY", reply_text))
        continue
    
    # Track errors
    if "ETELEGRAM" in msg or "error" in msg.lower():
        error_messages.append((ts, msg))
    
    if "ETELEGRAM" in msg:
        etelegram_errors.append((ts, msg))

# ────────────────────────────────────────────────────
# Analysis 1: USER JOURNEYS — trace each user's flow
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("1. USER JOURNEYS (Action Sequences)")
print("-" * 80)

for user_id, actions in sorted(user_actions.items(), key=lambda x: -len(x[1])):
    if len(actions) < 2:
        continue
    print(f"\n>> User: {user_id} ({len(actions)} actions)")
    for ts, atype, text in actions[-30:]:  # Last 30 actions
        ts_short = ts[11:19] if len(ts) > 19 else ts
        print(f"  [{ts_short}] {text[:120]}")

# ────────────────────────────────────────────────────
# Analysis 2: ERROR MESSAGES SENT TO USERS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("2. ERROR MESSAGES & FAILURES SENT TO USERS")
print("-" * 80)

error_keywords = ["failed", "error", "invalid", "expired", "denied", "issue", "problem",
                   "unavailable", "not found", "cannot", "unable", "wrong", "couldn't", "sorry"]

user_errors = []
for ts, chat_id, reply in replies_to_users:
    reply_lower = reply.lower()
    if any(kw in reply_lower for kw in error_keywords):
        user_errors.append((ts, chat_id, reply))

for ts, chat_id, reply in user_errors:
    ts_short = ts[11:19] if len(ts) > 19 else ts
    print(f"  [{ts_short}] to:{chat_id} >> {reply[:200]}")

if not user_errors:
    print("  (no error messages to users found)")

# ────────────────────────────────────────────────────
# Analysis 3: TELEGRAM API ERRORS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("3. TELEGRAM API ERRORS (ETELEGRAM)")
print("-" * 80)

for ts, msg in etelegram_errors:
    ts_short = ts[11:19] if len(ts) > 19 else ts
    print(f"  [{ts_short}] {msg[:250]}")

if not etelegram_errors:
    print("  (no Telegram API errors found)")

# ────────────────────────────────────────────────────
# Analysis 4: REPEATED ACTIONS (user confusion/retry)
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("4. REPEATED ACTIONS (Possible User Confusion / Retries)")
print("-" * 80)

repeat_found = False
for user_id, actions in user_actions.items():
    if len(actions) < 3:
        continue
    for i in range(1, len(actions)):
        if actions[i][2] == actions[i-1][2] and actions[i][2] not in ['/start', 'Home']:
            ts_short = actions[i][0][11:19] if len(actions[i][0]) > 19 else actions[i][0]
            print(f"  [{ts_short}] {user_id} >> repeated: '{actions[i][2][:100]}'")
            repeat_found = True

if not repeat_found:
    print("  (no repeated actions found)")

# ────────────────────────────────────────────────────
# Analysis 5: ABANDONED FLOWS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("5. FLOW INTERRUPTIONS (User switched context or abandoned)")
print("-" * 80)

flow_starters = ["Shorten", "Buy", "Send", "Create", "New", "Shortit", "Bitly", "Campaign", "Wallet"]
flow_enders = ["Home", "/start", "Back", "Cancel"]

abandon_found = False
for user_id, actions in user_actions.items():
    if len(actions) < 3:
        continue
    for i in range(len(actions) - 1):
        curr = actions[i][2]
        next_a = actions[i+1][2]
        if any(s in curr for s in flow_starters) and any(e in next_a for e in flow_enders):
            ts_short = actions[i][0][11:19] if len(actions[i][0]) > 19 else actions[i][0]
            print(f"  [{ts_short}] {user_id} >> Started '{curr[:60]}' -> Abandoned with '{next_a[:60]}'")
            abandon_found = True

if not abandon_found:
    print("  (no abandoned flows found)")

# ────────────────────────────────────────────────────
# Analysis 6: MOST COMMON ACTIONS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("6. MOST COMMON USER ACTIONS (Feature Popularity)")
print("-" * 80)

all_action_texts = []
for user_id, actions in user_actions.items():
    for ts, atype, text in actions:
        all_action_texts.append(text)

action_counts = Counter(all_action_texts)
for action, count in action_counts.most_common(30):
    print(f"  {count:4d}x >> {action[:120]}")

# ────────────────────────────────────────────────────
# Analysis 7: BACKEND ERRORS & EXCEPTIONS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("7. BACKEND ERRORS & EXCEPTIONS")
print("-" * 80)

backend_errors = []
for log in logs_sorted:
    msg = log.get("message", "")
    ts = log.get("timestamp", "")
    if log.get("severity") == "error" or any(x in msg for x in 
        ["TypeError", "ReferenceError", "SyntaxError", "Unhandled", "ECONNREFUSED", 
         "ETIMEDOUT", "ERR_", "FATAL", "crash", "Cannot read", "is not a function",
         "undefined is not", "MongoError", "MongoServerError"]):
        backend_errors.append((ts, msg))

for ts, msg in backend_errors[-30:]:
    ts_short = ts[11:19] if len(ts) > 19 else ts
    print(f"  [{ts_short}] {msg[:250]}")

if not backend_errors:
    print("  (no backend errors found)")

# ────────────────────────────────────────────────────
# Analysis 8: LONG GAPS (user confusion)
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("8. POTENTIALLY CONFUSING FLOWS (Long delays between user actions)")
print("-" * 80)

gap_found = False
for user_id, actions in user_actions.items():
    if len(actions) < 2:
        continue
    for i in range(1, len(actions)):
        try:
            t1 = datetime.fromisoformat(actions[i-1][0].replace('Z', '+00:00'))
            t2 = datetime.fromisoformat(actions[i][0].replace('Z', '+00:00'))
            gap = (t2 - t1).total_seconds()
            if 120 < gap < 1800:
                ts_short = actions[i-1][0][11:19]
                print(f"  [{ts_short}] {user_id} >> {int(gap)}s gap: '{actions[i-1][2][:50]}' -> '{actions[i][2][:50]}'")
                gap_found = True
        except:
            pass

if not gap_found:
    print("  (no significant delays found)")

# ────────────────────────────────────────────────────
# Analysis 9: ACTIVE USERS SUMMARY
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("9. ACTIVE USERS SUMMARY")
print("-" * 80)

for user_id, actions in sorted(user_actions.items(), key=lambda x: -len(x[1])):
    first_ts = actions[0][0][:19] if actions else "?"
    last_ts = actions[-1][0][:19] if actions else "?"
    print(f"  {user_id:35s} >> {len(actions):3d} actions | {first_ts} -> {last_ts}")

# ────────────────────────────────────────────────────
# Analysis 10: PAYWALL / SUBSCRIPTION BLOCKS
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("10. PAYWALL / SUBSCRIPTION / LIMIT MESSAGES")
print("-" * 80)

paywall_found = False
for ts, chat_id, reply in replies_to_users:
    reply_lower = reply.lower()
    if any(kw in reply_lower for kw in ["subscri", "expired", "renew", "upgrade", "exhaust", "limit", "buy plan", "free trial"]):
        ts_short = ts[11:19] if len(ts) > 19 else ts
        print(f"  [{ts_short}] to:{chat_id} >> {reply[:200]}")
        paywall_found = True

if not paywall_found:
    print("  (no paywall messages found)")

# ────────────────────────────────────────────────────
# Analysis 11: DEAD-END DETECTION (bot sent message but no user follow-up)
# ────────────────────────────────────────────────────
print("\n" + "-" * 80)
print("11. POTENTIAL DEAD ENDS (Bot replied, user never followed up)")
print("-" * 80)

# Build per-user timeline of inputs and replies
user_timelines = defaultdict(list)
for ts, chat_id, username, direction, text in flow_entries:
    user_timelines[chat_id].append((ts, direction, text))

dead_end_found = False
for chat_id, timeline in user_timelines.items():
    if len(timeline) < 2:
        continue
    # Check if last interaction was a REPLY (bot waiting for user response that never came)
    if timeline[-1][1] == "REPLY":
        last_reply = timeline[-1][2]
        # Skip if it's a final message (success, confirmation)
        if not any(kw in last_reply.lower() for kw in ["success", "done", "completed", "created", "welcome"]):
            ts_short = timeline[-1][0][11:19] if len(timeline[-1][0]) > 19 else timeline[-1][0]
            print(f"  [{ts_short}] User {chat_id} >> Last bot msg (no follow-up): '{last_reply[:120]}'")
            dead_end_found = True

if not dead_end_found:
    print("  (no dead ends detected)")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
print(f"Total logs analyzed: {len(logs_sorted)}")
print(f"Unique users tracked: {len(user_actions)}")
print(f"Error messages to users: {len(user_errors)}")
print(f"Telegram API errors: {len(etelegram_errors)}")
print(f"Backend errors: {len(backend_errors)}")
