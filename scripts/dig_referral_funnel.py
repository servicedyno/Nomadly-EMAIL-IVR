#!/usr/bin/env python3
"""Get raw /start ref_xxx samples to understand referral code formats and timing."""
import json, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
UA = "Mozilla/5.0"

def gql(q, v):
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query": q, "variables": v}).encode(),
        headers={"Content-Type":"application/json","User-Agent":UA,"Project-Access-Token":TOKEN})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

Q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
  environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
    timestamp message severity
  }
}"""

def fetch(filter_str, hours=200):
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    seen = set(); out = []
    cursor = now
    while cursor > start:
        a_iso = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(Q, {"e": ENV_ID, "a": a_iso, "f": filter_str, "lim": 1000})
        logs = r.get("data", {}).get("environmentLogs") or []
        new = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:80])
            if k not in seen:
                seen.add(k); out.append(l); new += 1
        if not logs: break
        cursor -= timedelta(hours=4)
        if new == 0: break
    return [l for l in out if l["timestamp"][:19] >= start.strftime("%Y-%m-%dT%H:%M:%S")]


print("\n=== /start ref_xxx samples ===")
logs = fetch("ref_", hours=200)
print(f"Total log lines mentioning ref_: {len(logs)}")
# Filter to actual /start lines
ref_starts = [l for l in logs if "/start ref_" in l["message"]]
print(f"Actual /start ref_ events: {len(ref_starts)}")
print()
for l in ref_starts[:30]:
    print(f"  {l['timestamp'][:19]}  {l['message'][:120]}")

print("\n=== [Referral] log lines (action outcomes) ===")
ref_action = [l for l in logs if "[Referral]" in l["message"]]
print(f"Total: {len(ref_action)}")
# Categorize
cat = Counter()
for l in ref_action:
    m = l["message"]
    if "credited" in m: cat["credited"] += 1
    elif "Wallet referral saved" in m: cat["wallet_saved"] += 1
    elif "Created referral code" in m: cat["code_created"] += 1
    elif "Invalid referrer code" in m: cat["invalid_code"] += 1
    elif "Tracked click" in m: cat["click_tracked"] += 1
    elif "Web redirect fallback" in m: cat["web_fallback"] += 1
    elif "Error" in m: cat["error"] += 1
    else: cat["other"] += 1
print("\n  Category breakdown:")
for k, v in cat.most_common():
    print(f"    {k:<20} {v:>5}")

print("\n  Sample of each category:")
shown = set()
for l in ref_action:
    m = l["message"]
    bucket = None
    for k in ["credited", "Wallet referral saved", "Created referral code",
              "Invalid referrer code", "Tracked click", "Web redirect fallback", "Error"]:
        if k in m: bucket = k; break
    if not bucket or bucket in shown: continue
    shown.add(bucket)
    print(f"    [{bucket}] {l['timestamp'][:19]}  {m[:150]}")
