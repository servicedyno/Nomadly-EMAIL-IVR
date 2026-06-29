#!/usr/bin/env python3
"""
Railway log anomaly analyzer — fetches last 48h of production logs,
focuses on errors, payment failures, UX frictions, and PhoneScheduler issues.
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"  # Nomadly-EMAIL-IVR
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
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            if i == retries - 1:
                return {"errors": [{"err": str(e)}]}
            time.sleep(2)

def fetch_logs(filter_str, start, end, chunk_hours=6, before_limit=500):
    q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
      environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
        timestamp message severity tags { serviceId } } }"""
    seen = set()
    out = []
    cursor = end
    while cursor > start:
        anchor_iso = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(q, {"e": ENV_ID, "a": anchor_iso, "f": filter_str, "lim": before_limit})
        if "errors" in r:
            print(f"  [{filter_str[:30]}] err: {r['errors']}", file=sys.stderr)
            return out
        logs = r["data"]["environmentLogs"] or []
        new_count = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:80])
            if k not in seen:
                seen.add(k)
                out.append(l)
                new_count += 1
        if not logs:
            break
        cursor = cursor - timedelta(hours=chunk_hours)
        if new_count == 0:
            break
    out = [l for l in out
           if start.strftime("%Y-%m-%dT%H:%M:%S") <= l["timestamp"][:19]
           <= end.strftime("%Y-%m-%dT%H:%M:%S")]
    return out

def main():
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=48)
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"\n=== RAILWAY ANOMALY ANALYSIS ({start_iso} → {end_iso}) ===\n")

    CATEGORIES = {
        # Errors
        "ERROR_level": "ERROR",
        "uncaughtException": "uncaughtException",
        "unhandledRejection": "unhandledRejection",
        # Payment / Wallet
        "payment_confirmed": "payment confirmed",
        "deposit_confirmed": "deposit confirmed",
        "wallet_credited": "wallet credited",
        "settlement_failed": "settlement_failed",
        "settlement": "settlement",
        "insufficient_funds": "insufficient",
        "payment_failed": "payment failed",
        # Phone / SIP
        "PhoneScheduler": "PhoneScheduler",
        "phone_renew": "renew",
        "auto_renew": "auto-renew",
        "SIP_test": "test call",
        # Hosting
        "hosting_error": "HostingScheduler",
        "cpanel_error": "cPanel",
        "WHM_error": "WHM",
        # Network
        "read_timeout": "Read timed out",
        "ECONNREFUSED": "ECONNREFUSED",
        "ETIMEDOUT": "ETIMEDOUT",
        "timeout": "timeout",
        # Telegram
        "bot_blocked": "bot was blocked",
        "telegram_error": "TelegramError",
        # Crypto
        "crypto_payment": "crypto",
        "blockbee": "BlockBee",
        "dynopay": "DynoPay",
        # Admin alerts
        "admin_alert": "ADMIN ALERT",
        "stuck": "STUCK",
        # Fincra
        "fincra_auth": "Fincra authentication",
        "fincra_error": "fincra",
    }

    results = {}
    for name, flt in CATEGORIES.items():
        logs = fetch_logs(flt, start, now, chunk_hours=6, before_limit=500)
        results[name] = {
            "total": len(logs),
            "samples": [l["message"][:300] for l in logs[:10]],
            "timestamps": [l["timestamp"] for l in logs[:10]],
        }
        print(f"  {name:<25} count={len(logs):>5}  {'⚠️' if len(logs) > 20 else '✅' if len(logs) == 0 else '🔶'}")

    # Save full results
    out_path = "/app/logs_prod/_anomaly_48h.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({
            "window": [start_iso, end_iso],
            "results": results,
        }, f, indent=2)
    print(f"\n→ Saved: {out_path}")

    # Print details for high-count categories
    print("\n" + "=" * 78)
    print("DETAILED SAMPLES FOR KEY CATEGORIES")
    print("=" * 78)
    for name, data in sorted(results.items(), key=lambda x: -x[1]["total"]):
        if data["total"] > 0:
            print(f"\n--- {name} (total={data['total']}) ---")
            for i, (ts, msg) in enumerate(zip(data["timestamps"][:5], data["samples"][:5])):
                print(f"  [{ts[:19]}] {msg[:200]}")

if __name__ == "__main__":
    main()
