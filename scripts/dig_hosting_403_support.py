#!/usr/bin/env python3
"""
Pull AI-Support chat + customer-complaint signals related to hosting 403s.
Filters:
  - 'Request failed (403)' user-facing message
  - 'AI-Support' or 'support_chat' or 'admin escalation' lines
  - '403' near 'hosting', 'file', 'cpanel', 'panel', 'public_html'
  - 'welcoparttylive' specifically (the domain in the screenshot)
"""
import json, urllib.request, sys, time
from collections import Counter
from datetime import datetime, timedelta, timezone

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
    """Slide anchorDate backward to fetch the whole window."""
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
            print(f"  err for '{filter_str}': {r['errors']}", file=sys.stderr)
            break
        logs = r["data"]["environmentLogs"] or []
        new_count = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:160])
            if k not in seen:
                seen.add(k)
                out.append(l); new_count += 1
        if not logs: break
        cursor = cursor - timedelta(hours=chunk_hours)
        if new_count == 0:
            stall += 1
            if stall >= 3: break
        else: stall = 0
    return [l for l in out if start.strftime("%Y-%m-%dT%H:%M:%S") <= l["timestamp"][:19] <= end.strftime("%Y-%m-%dT%H:%M:%S")]


def main():
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=21)).replace(hour=0, minute=0, second=0)

    print(f"\n=== HOSTING 403 / FILE-MANAGER / AI-SUPPORT analyzer ===")
    print(f"window: {start.isoformat()} → {now.isoformat()}\n")

    # 1) The actual user-visible 403 message
    print("=" * 90)
    print("  Filter: 'Request failed (403)'")
    print("=" * 90)
    logs = fetch_window('Request failed (403)', start, now, chunk_hours=12)
    print(f"Total: {len(logs)}")
    days = Counter(l['timestamp'][:10] for l in logs)
    for d, c in sorted(days.items()): print(f"  {d}: {c}")
    print("\nTop variants (top 8):")
    var = Counter(l['message'][:200] for l in logs)
    for v, c in var.most_common(8):
        print(f"  [{c}x] {v}")
    print("\nLast 5 raw lines:")
    for l in logs[:5]:
        print(f"  {l['timestamp'][:19]} {l['message'][:240]}")

    # 2) AI-Support escalations mentioning 403 / file manager / hosting
    print("\n" + "=" * 90)
    print("  Filter: 'AI-Support'")
    print("=" * 90)
    ai = fetch_window('AI-Support', start, now, chunk_hours=8)
    print(f"Total: {len(ai)}")
    days = Counter(l['timestamp'][:10] for l in ai)
    for d, c in sorted(days.items()): print(f"  {d}: {c}")

    # filter for 403 / file-manager related
    relevant = [l for l in ai if any(kw in l['message'].lower() for kw in
                ['403', 'file manager', 'fileman', 'panel', 'hosting', 'public_html', 'access denied', 'forbidden'])]
    print(f"\nRelevant (403/file-manager/hosting): {len(relevant)}")
    for l in relevant[:30]:
        print(f"  {l['timestamp'][:19]} {l['message'][:280]}")

    # 3) welcoparttylive specifically
    print("\n" + "=" * 90)
    print("  Filter: 'welcoparttylive'")
    print("=" * 90)
    welc = fetch_window('welcoparttylive', start, now, chunk_hours=24)
    print(f"Total: {len(welc)}")
    days = Counter(l['timestamp'][:10] for l in welc)
    for d, c in sorted(days.items()): print(f"  {d}: {c}")
    print("\nLast 15 raw lines:")
    for l in welc[:15]:
        print(f"  {l['timestamp'][:19]} {l['message'][:280]}")

    # 4) Forbidden + AcrobatN (folder shown in screenshot)
    print("\n" + "=" * 90)
    print("  Filter: 'AcrobatN'")
    print("=" * 90)
    acro = fetch_window('AcrobatN', start, now, chunk_hours=24)
    print(f"Total: {len(acro)}")
    for l in acro[:10]:
        print(f"  {l['timestamp'][:19]} {l['message'][:280]}")

    # 5) cPanel file listing 403 specifically
    print("\n" + "=" * 90)
    print("  Filter: 'Fileman::list_files'  (the actual API call behind the panel screenshot)")
    print("=" * 90)
    fm = fetch_window('list_files', start, now, chunk_hours=12)
    print(f"Total: {len(fm)}")
    var = Counter(l['message'][:200] for l in fm)
    for v, c in var.most_common(6):
        print(f"  [{c}x] {v}")

    # 6) "403" generic
    print("\n" + "=" * 90)
    print("  Filter: '403' (any hosting / cpanel related)")
    print("=" * 90)
    fortythree = fetch_window('403', start, now, chunk_hours=6, lim=500)
    print(f"Total: {len(fortythree)}")
    hostingish = [l for l in fortythree if any(kw in l['message'].lower() for kw in
                  ['cpanel', 'panel', 'fileman', 'public_html', 'hosting'])]
    print(f"Hosting/cpanel context: {len(hostingish)}")
    for l in hostingish[:20]:
        print(f"  {l['timestamp'][:19]} {l['message'][:280]}")


if __name__ == "__main__":
    main()
