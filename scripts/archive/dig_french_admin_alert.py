#!/usr/bin/env python3
"""Find the recent French admin alert in Railway logs.

Strategy: pull a wide environmentLogs window for the last ~90 min, then filter
client-side for messages that:
  1. Mention the admin chat ID (so we know it was sent TO admin), OR
  2. Look like an admin alert pattern (sendAdmin / adminDigest / Admin Alert), AND
  3. Contain French-looking text (votre, alerte, échec, etc.) OR were emitted
     under a fr locale.
"""
import json, os, sys, re, urllib.request
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
UA = "Mozilla/5.0"

# Read admin chat id without printing it
admin_id = None
try:
    for line in open("/app/backend/.env"):
        if line.startswith("TELEGRAM_ADMIN_CHAT_ID="):
            admin_id = line.split("=", 1)[1].strip()
            break
except Exception:
    pass
if not admin_id:
    print("Cannot read TELEGRAM_ADMIN_CHAT_ID"); sys.exit(1)
print(f"Admin chat ID known (last 4 digits: …{admin_id[-4:]})\n")


def gql(q, v):
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query": q, "variables": v}).encode(),
        headers={"Content-Type":"application/json","User-Agent":UA,"Project-Access-Token":TOKEN})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())


Q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
  environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
    timestamp message severity tags { serviceId deploymentId }
  }
}"""


def fetch_filter(filter_str, hours=2):
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    cursor = now
    seen = set(); out = []
    while cursor > start:
        a_iso = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(Q, {"e": ENV_ID, "a": a_iso, "f": filter_str, "lim": 1000})
        logs = r.get("data", {}).get("environmentLogs") or []
        new = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:140])
            if k not in seen:
                seen.add(k); out.append(l); new += 1
        if not logs: break
        cursor -= timedelta(minutes=30)
        if new == 0: break
    return [l for l in out if l["timestamp"][:19] >= start.strftime("%Y-%m-%dT%H:%M:%S")]


# 1. Pull logs that mention the admin chat ID directly
print("─ Logs mentioning admin chat id (last 2h) ─")
admin_id_logs = fetch_filter(admin_id, hours=2)
print(f"  found {len(admin_id_logs)} matches")
for l in admin_id_logs[:25]:
    print(f"  {l['timestamp'][:19]}  {l['message'][:180]}")

# 2. Look for typical admin-alert patterns
print("\n─ [Admin] / sendAdmin / Admin Alert patterns (last 2h) ─")
for needle in ["[Admin]", "Admin Alert", "admin digest", "sendAdmin", "adminMessage", "alert(", "Sent to admin"]:
    logs = fetch_filter(needle, hours=2)
    if not logs: continue
    print(f"\n  filter={needle!r} → {len(logs)} hits")
    for l in logs[:10]:
        print(f"    {l['timestamp'][:19]}  {l['message'][:180]}")

# 3. French signatures — common French words that appear in alert / error messages
print("\n─ French-looking strings (last 2h) ─")
fr_words = ["votre", "veuillez", "échec", "alerte", "compte", "détecté", "réessay", "Veuillez", "Échec", "Alerte", "Détecté"]
for w in fr_words:
    logs = fetch_filter(w, hours=2)
    if not logs: continue
    print(f"\n  fr-word={w!r} → {len(logs)} hits")
    for l in logs[:8]:
        print(f"    {l['timestamp'][:19]}  {l['message'][:220]}")

# 4. lang=fr / userLanguage 'fr' bot operations
print("\n─ lang=fr emit (last 2h) ─")
for needle in ["lang=fr", "'fr'", "userLanguage: 'fr'", "language: 'fr'", "lang: 'fr'", "lang fr"]:
    logs = fetch_filter(needle, hours=2)
    if not logs: continue
    print(f"\n  filter={needle!r} → {len(logs)} hits")
    for l in logs[:5]:
        print(f"    {l['timestamp'][:19]}  {l['message'][:220]}")
