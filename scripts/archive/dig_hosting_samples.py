#!/usr/bin/env python3
"""Pull sample log messages for each suspicious filter — exact text + per-day breakdown."""
import json, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone
from collections import Counter

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
ENDPOINT = "https://backboard.railway.app/graphql/v2"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0"

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
            if i == retries - 1: return {"errors": [{"err": str(e)}]}
            time.sleep(2)


def fetch(filter_str, anchor=None, lim=200):
    q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
      environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
        timestamp message severity } }"""
    if anchor is None:
        anchor = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    r = gql(q, {"e": ENV_ID, "a": anchor, "f": filter_str, "lim": lim})
    if "errors" in r:
        print(f"ERR for '{filter_str}': {r['errors']}")
        return []
    return r["data"]["environmentLogs"] or []


# Sample each filter — show unique top variants
FILTERS = {
    "hosting_failed":     "hosting failed",
    "provision_failed":   "provisioning failed",
    "whm_error":          "WHM API error",
    "refund_hosting":     "hosting refund",
    "stuck_job":          "stuck job",
    "cf_worker_error":    "Worker",
    "cf_iperror":         "CF IP",
    "cf_zone_error":      "zone error",
    "manual_intervention":"manual intervention",
}

# Drill into the latest occurrence of each filter
for name, flt in FILTERS.items():
    print(f"\n{'═'*86}")
    print(f"  FILTER: '{flt}'  ({name})")
    print(f"{'═'*86}")
    logs = fetch(flt, lim=500)
    if not logs:
        print("  (no logs)")
        continue

    # Top message variants (first 120 chars)
    variants = Counter()
    for l in logs:
        m = (l["message"] or "")
        # Normalise dynamic parts away
        norm = m[:160]
        variants[norm] += 1

    print(f"  Total fetched: {len(logs)}")
    print(f"  Top 8 message variants:")
    for var, cnt in variants.most_common(8):
        print(f"    [{cnt}x]  {var}")

    # Last 3 raw lines
    print(f"  Last 3 raw lines:")
    for l in logs[:3]:
        sev = l.get("severity") or "?"
        print(f"    {l['timestamp'][:19]} [{sev}] {l['message'][:200]}")


# Pull specifically what's currently happening on the most recent failures
print(f"\n\n{'═'*86}")
print(f"   RECENT (06-22 / 06-21) HOSTING FAILURE CONTEXT")
print(f"{'═'*86}")
for q in ["hosting failed", "provisioning failed", "[AntiRed]"]:
    print(f"\n--- query='{q}' (last 200 lines) ---")
    logs = fetch(q, lim=200)
    for l in logs[:8]:
        print(f"  {l['timestamp'][:19]} {l['message'][:240]}")
