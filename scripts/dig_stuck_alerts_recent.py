#!/usr/bin/env python3
"""Pull the most recent Anti-Red protection STUCK alerts from Railway prod logs.

For each STUCK incident, reconstruct the surrounding 10-minute timeline:
  - What the heartbeat saw on WHM (DIAG line)
  - Which file(s) were missing/corrupted
  - Whether deployCFIPFix succeeded/failed
  - Whether the panel's auto-restore fired around the same time
  - What the customer was doing (uploads/extracts/deletes)
"""
import json, urllib.request, sys, time
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
ENDPOINT = "https://backboard.railway.app/graphql/v2"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0"


def gql(query, variables, retries=3):
    body = json.dumps({"query": query, "variables": variables}).encode()
    for i in range(retries):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, headers={
                "Content-Type": "application/json", "User-Agent": UA,
                "Project-Access-Token": TOKEN,
            })
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if i == retries - 1: return {"errors": [{"err": str(e)}]}
            time.sleep(2)


def fetch_window(filter_str, start, end, chunk_hours=12, lim=500):
    q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
      environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
        timestamp message severity } }"""
    seen = set()
    out = []
    cursor = end
    stall = 0
    while cursor > start:
        anchor = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(q, {"e": ENV_ID, "a": anchor, "f": filter_str, "lim": lim})
        if "errors" in r:
            break
        logs = r["data"]["environmentLogs"] or []
        new_count = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:160])
            if k not in seen:
                seen.add(k); out.append(l); new_count += 1
        if not logs: break
        cursor -= timedelta(hours=chunk_hours)
        if new_count == 0:
            stall += 1
            if stall >= 3: break
        else: stall = 0
    return out


def main():
    now = datetime.now(timezone.utc)
    DAYS = 2
    start = now - timedelta(days=DAYS)

    print(f"\n=== Anti-Red STUCK alerts — last {DAYS}d ===")
    print(f"Window: {start.isoformat()}  →  {now.isoformat()}\n")

    # 1. The exact admin-bot alert text
    print("─" * 90)
    print("  Filter: 'Anti-Red protection STUCK'")
    print("─" * 90)
    stuck = fetch_window("Anti-Red protection STUCK", start, now, chunk_hours=8)
    print(f"  Total fires: {len(stuck)}")
    if not stuck:
        # Fallback: the message body without the admin-DM prefix
        stuck = fetch_window("ProtectionHeartbeat", start, now, chunk_hours=6)
        stuck = [l for l in stuck if "consecutively" in l["message"]
                 or "STUCK" in l["message"]
                 or "max repairs" in l["message"]]
        print(f"  (matched via secondary heartbeat filter): {len(stuck)}")

    by_day = Counter(l["timestamp"][:10] for l in stuck)
    for d, c in sorted(by_day.items()):
        print(f"    {d}: {c}")

    # Extract unique cpUsers from the messages
    import re
    cp_users = []
    for l in stuck:
        m = re.search(r"\b([a-z0-9]{7,9})\b.*(?:consecutively|STUCK|repair|protection|public_html)", l["message"])
        if m:
            cp_users.append(m.group(1))
    user_counts = Counter(cp_users)
    print(f"\n  Unique accounts flagged: {len(user_counts)}")
    print(f"  Top 10 most-stuck accounts in window:")
    for u, c in user_counts.most_common(10):
        print(f"    {u}: {c} stuck alerts")

    # 2. For the top 3 stuck accounts, reconstruct timeline ±5min
    target_users = [u for u, _ in user_counts.most_common(3)]
    print(f"\n{'─' * 90}\n  Timeline reconstruction for top {len(target_users)} stuck accounts\n{'─' * 90}")
    for user in target_users:
        print(f"\n══ {user} ══")
        # Show all events ±10 min from each STUCK alert for this user
        user_stucks = [l for l in stuck if user in l["message"]]
        for stuck_event in user_stucks[:2]:  # First 2 incidents
            t = stuck_event["timestamp"]
            print(f"\n  → STUCK at {t[:19]}")
            # Pull ±10 min around this
            anchor = datetime.fromisoformat(t.replace("Z", "+00:00")) + timedelta(minutes=10)
            band = fetch_window(user, anchor - timedelta(minutes=30), anchor, chunk_hours=1, lim=200)
            band.sort(key=lambda x: x["timestamp"])
            for evt in band:
                evt_t = evt["timestamp"][:19]
                if abs((datetime.fromisoformat(evt["timestamp"].replace("Z","+00:00")) -
                        datetime.fromisoformat(t.replace("Z","+00:00"))).total_seconds()) < 600:
                    print(f"    {evt_t}  {evt['message'][:230]}")


if __name__ == "__main__":
    main()
