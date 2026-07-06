#!/usr/bin/env python3
"""Pull the Contabo VPS failure context around 13:28:48 UTC for chatId 8625434794."""
import json, urllib.request, sys
from datetime import datetime, timedelta, timezone

TOKEN="8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID="889fd56a-720a-4020-884c-034784992666"
UA="Mozilla/5.0"

def gql(q,v):
    req=urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query":q,"variables":v}).encode(),
        headers={"Content-Type":"application/json","User-Agent":UA,"Project-Access-Token":TOKEN})
    return json.loads(urllib.request.urlopen(req,timeout=60).read())

Q="""query Q($e:String!,$a:String!,$f:String,$lim:Int){
  environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
    timestamp message severity
  }
}"""

# Anchor 5 min after the failure, pull ~30 min before/after
def fetch(filter_str, anchor="2026-06-21T13:35:00.000Z"):
    r=gql(Q,{"e":ENV_ID,"a":anchor,"f":filter_str,"lim":1000})
    return r.get("data",{}).get("environmentLogs") or []

# Pull every signal we can attribute to that user / time
print("\n═══ All logs mentioning 8625434794 (around 13:28 UTC) ═══")
logs=fetch("8625434794")
in_window=[l for l in logs if "2026-06-21T13:2" in l["timestamp"] or "2026-06-21T13:3" in l["timestamp"]]
print(f"In window: {len(in_window)}")
for l in in_window:
    print(f"  {l['timestamp'][:19]} {l['severity']:>6}  {l['message'][:250]}")

print("\n═══ Contabo-specific errors (last 1h) ═══")
for needle in ["Contabo","contabo","CONTABO","provisionInstance","provision-vps","createInstance","createVPS","VPS provision","provider error","provider 4","provider 5"]:
    logs=fetch(needle)
    win=[l for l in logs if "2026-06-21T13:" in l["timestamp"]]
    if not win: continue
    print(f"\n  filter={needle!r} ({len(win)} in 13:xx UTC):")
    for l in win[:15]:
        print(f"    {l['timestamp'][:19]} {l['severity']:>6}  {l['message'][:250]}")

print("\n═══ Error/Refund chains around 13:28 ═══")
for needle in ["Refund","refund","[VPS]","provisioning failed","sanitizeProviderError"]:
    logs=fetch(needle)
    win=[l for l in logs if "2026-06-21T13:" in l["timestamp"]]
    if not win: continue
    print(f"\n  filter={needle!r} ({len(win)} in 13:xx UTC):")
    for l in win[:10]:
        print(f"    {l['timestamp'][:19]} {l['severity']:>6}  {l['message'][:280]}")
