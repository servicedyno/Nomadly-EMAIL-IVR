#!/usr/bin/env python3
"""
Analyze Railway logs from the last 6 days to spot sales drop-offs / anomalies.
Uses project-access-token to pull environmentLogs + httpMetricsGroupedByStatus.
"""
import json
import os
import sys
import time
import urllib.request
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"   # production
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"

SERVICES = {
    "Nomadly-EMAIL-IVR": "b9c4ad64-7667-4dd3-8b9a-3867ede47885",
    "HostingBotNew":     "0a453645-4180-441b-8988-020807f4479a",
    "LockbayNewFIX":     "96ee768e-3f4d-49c8-be75-dea30777e890",
}

ENDPOINT = "https://backboard.railway.app/graphql/v2"


def gql(query, variables):
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"query": query, "variables": variables}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Project-Access-Token": TOKEN,
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


# ---------- 1. HTTP status metrics per service per day ----------
def fetch_http_metrics(service_id, start_iso, end_iso):
    q = """
    query M($e:String!, $s:String!, $start:DateTime!, $end:DateTime!) {
      httpMetricsGroupedByStatus(environmentId:$e, serviceId:$s,
        startDate:$start, endDate:$end, stepSeconds:86400) {
        statusCode samples { ts value }
      }
    }"""
    r = gql(q, {"e": ENV_ID, "s": service_id, "start": start_iso, "end": end_iso})
    if "errors" in r:
        return {"error": r["errors"]}
    by_day = defaultdict(lambda: defaultdict(int))
    for row in r["data"]["httpMetricsGroupedByStatus"]:
        sc = row["statusCode"]
        for s in row["samples"]:
            day = datetime.fromtimestamp(s["ts"], tz=timezone.utc).strftime("%Y-%m-%d")
            by_day[day][sc] += int(s["value"])
    return by_day


# ---------- 2. environmentLogs with filter + pagination ----------
def fetch_logs(after_iso, before_iso, filter_str, page_limit=500, max_pages=20):
    q = """
    query Q($e:String!, $a:String!, $b:String, $f:String, $lim:Int) {
      environmentLogs(environmentId:$e, afterDate:$a, beforeDate:$b,
                      filter:$f, afterLimit:$lim) {
        timestamp message severity tags { serviceName deploymentInstanceId }
      }
    }"""
    out = []
    cursor = after_iso
    for _ in range(max_pages):
        r = gql(q, {"e": ENV_ID, "a": cursor, "b": before_iso,
                    "f": filter_str, "lim": page_limit})
        if "errors" in r:
            return {"error": r["errors"]}
        logs = r["data"]["environmentLogs"] or []
        if not logs:
            break
        out.extend(logs)
        last_ts = logs[-1]["timestamp"]
        if last_ts <= cursor:
            break
        cursor = last_ts
        if len(logs) < page_limit:
            break
    return out


def count_per_day(logs):
    c = Counter()
    for l in logs:
        c[l["timestamp"][:10]] += 1
    return c


def count_per_day_per_service(logs):
    c = defaultdict(Counter)
    for l in logs:
        svc = (l.get("tags") or {}).get("serviceName") or "?"
        c[svc][l["timestamp"][:10]] += 1
    return c


# ---------- main ----------
def main():
    # 6-day window: last 6 full days + today
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = now
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso = end.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"\n=== RAILWAY 6-DAY ANALYSIS  ({start_iso}  →  {end_iso}) ===\n")

    # --- HTTP metrics ---
    print("─" * 78)
    print("HTTP STATUS BY DAY (per service)")
    print("─" * 78)
    for svc, sid in SERVICES.items():
        m = fetch_http_metrics(sid, start_iso, end_iso)
        if isinstance(m, dict) and "error" in m:
            print(f"  {svc}: ERROR {m['error']}")
            continue
        print(f"\n[{svc}]")
        print(f"  {'Day':<12} {'Total':>8} {'2xx':>8} {'3xx':>6} {'4xx':>8} {'5xx':>6}")
        for day in sorted(m.keys()):
            d = m[day]
            s2 = sum(v for k, v in d.items() if 200 <= k < 300)
            s3 = sum(v for k, v in d.items() if 300 <= k < 400)
            s4 = sum(v for k, v in d.items() if 400 <= k < 500)
            s5 = sum(v for k, v in d.items() if 500 <= k < 600)
            tot = s2 + s3 + s4 + s5
            print(f"  {day:<12} {tot:>8} {s2:>8} {s3:>6} {s4:>8} {s5:>6}")

    # --- Sales-relevant log filters ---
    FILTERS = {
        # Successful payment/deposit events
        "deposit_credited":   "credited",
        "payment_received":   "PaymentReceived",
        "blockbee_confirmed": "BlockBee",
        "fincra_paid":        "Fincra",
        "dynopay_paid":       "DynoPay",
        "stripe_paid":        "Stripe",
        "wallet_credit":      "wallet credited",
        # Sales / orders
        "domain_registered":  "registered successfully",
        "vps_created":        "VPS created",
        "phone_purchased":    "phone number purchased",
        "sms_sent":           "SMS sent",
        # User activity
        "new_start":          "/start",
        # Errors & anomalies
        "error":              "Error",
        "exception":          "Exception",
        "crash":              "uncaughtException",
        "rejected":           "rejected",
        "telegram_blocked":   "bot was blocked",
        "rate_limit":         "429",
        "webhook_fail":       "webhook failed",
        "mongo_err":          "MongoError",
        "timeout":            "ETIMEDOUT",
        "btc_price":          "price-oracle",
    }
    print("\n" + "─" * 78)
    print("LOG EVENT COUNTS BY DAY  (filter → daily counts)")
    print("─" * 78)
    results = {}
    for name, flt in FILTERS.items():
        logs = fetch_logs(start_iso, end_iso, flt, page_limit=500, max_pages=10)
        if isinstance(logs, dict) and "error" in logs:
            print(f"  {name:<22} ERROR {logs['error']}")
            continue
        total = len(logs)
        c = count_per_day(logs)
        results[name] = {"total": total, "by_day": dict(c),
                         "sample": logs[0]["message"][:160] if logs else ""}
        days_str = " ".join(f"{d[5:]}={c[d]}" for d in sorted(c.keys()))
        flag = ""
        # crude anomaly flag
        if total > 0:
            last_day = sorted(c.keys())[-1] if c else None
            if last_day:
                last = c[last_day]
                others = [c[d] for d in c if d != last_day]
                avg = sum(others) / len(others) if others else 0
                if avg and last < avg * 0.4:
                    flag = "  ⬇⬇ DROP"
                elif avg and last > avg * 2.5:
                    flag = "  ⬆⬆ SPIKE"
        print(f"  {name:<22} total={total:>5}  {days_str}{flag}")

    # Save raw json for later drill-down
    out_path = "/app/logs_prod/_6day_summary.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"window": [start_iso, end_iso], "filters": results}, f, indent=2)
    print(f"\nSaved raw counts → {out_path}")


if __name__ == "__main__":
    main()
