#!/usr/bin/env python3
"""
Railway 6-day RCA v2 — uses anchorDate-based pagination (the v1 script broke
because Railway requires `anchorDate` + `beforeLimit`, not `afterDate`/`afterLimit`).

We walk anchor points across the window and aggregate counts by day per filter.
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICES = {
    "Nomadly-EMAIL-IVR": "b9c4ad64-7667-4dd3-8b9a-3867ede47885",
    "HostingBotNew":     "0a453645-4180-441b-8988-020807f4479a",
    "LockbayNewFIX":     "96ee768e-3f4d-49c8-be75-dea30777e890",
}
ENDPOINT = "https://backboard.railway.app/graphql/v2"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


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


# ---------- HTTP status metrics ----------
def fetch_http_metrics(service_id, start_iso, end_iso):
    q = """query M($e:String!,$s:String!,$start:DateTime!,$end:DateTime!){
      httpMetricsGroupedByStatus(environmentId:$e,serviceId:$s,
        startDate:$start,endDate:$end,stepSeconds:86400){
        statusCode samples { ts value } } }"""
    r = gql(q, {"e": ENV_ID, "s": service_id, "start": start_iso, "end": end_iso})
    if "errors" in r: return {"error": r["errors"]}
    by_day = defaultdict(lambda: defaultdict(int))
    for row in r["data"]["httpMetricsGroupedByStatus"]:
        sc = row["statusCode"]
        for s in row["samples"]:
            day = datetime.fromtimestamp(s["ts"], tz=timezone.utc).strftime("%Y-%m-%d")
            by_day[day][sc] += int(s["value"])
    return by_day


# ---------- environmentLogs via sliding anchor ----------
def fetch_logs_window(filter_str, start, end, chunk_hours=4, before_limit=1000):
    """
    Walks anchorDate from `end` backwards to `start` in `chunk_hours` steps.
    Returns deduped logs in the window.
    """
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
            print(f"  [{filter_str}] err: {r['errors']}", file=sys.stderr)
            return out
        logs = r["data"]["environmentLogs"] or []
        # dedup by (timestamp, message)
        new_count = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:80])
            if k not in seen:
                seen.add(k)
                out.append(l)
                new_count += 1
        if not logs:
            break
        # Step the anchor backwards
        cursor = cursor - timedelta(hours=chunk_hours)
        if new_count == 0:
            # We're not gaining new logs — bail
            break
    # filter to the window
    out = [l for l in out
           if start.strftime("%Y-%m-%dT%H:%M:%S") <= l["timestamp"][:19]
           <= end.strftime("%Y-%m-%dT%H:%M:%S")]
    return out


def count_per_day(logs):
    c = Counter()
    for l in logs:
        c[l["timestamp"][:10]] += 1
    return c


def main():
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"\n=== RAILWAY 6-DAY ANALYSIS v2  ({start_iso}  →  {end_iso}) ===\n")

    # --- HTTP metrics ---
    print("─" * 78)
    print("HTTP STATUS BY DAY")
    print("─" * 78)
    http_summary = {}
    for svc, sid in SERVICES.items():
        m = fetch_http_metrics(sid, start_iso, end_iso)
        if isinstance(m, dict) and "error" in m:
            print(f"  {svc}: ERROR {m['error']}")
            continue
        print(f"\n[{svc}]")
        print(f"  {'Day':<12} {'Total':>8} {'2xx':>8} {'3xx':>6} {'4xx':>8} {'5xx':>6}")
        svc_rows = []
        for day in sorted(m.keys()):
            d = m[day]
            s2 = sum(v for k, v in d.items() if 200 <= k < 300)
            s3 = sum(v for k, v in d.items() if 300 <= k < 400)
            s4 = sum(v for k, v in d.items() if 400 <= k < 500)
            s5 = sum(v for k, v in d.items() if 500 <= k < 600)
            tot = s2 + s3 + s4 + s5
            flag = ""
            if s5 > 50: flag = "  ⚠️  5xx spike"
            print(f"  {day:<12} {tot:>8} {s2:>8} {s3:>6} {s4:>8} {s5:>6}{flag}")
            svc_rows.append({"day": day, "total": tot, "2xx": s2, "3xx": s3, "4xx": s4, "5xx": s5})
        http_summary[svc] = svc_rows

    # --- environment logs (sliding window via anchorDate) ---
    FILTERS = {
        # Fincra & Unauthorized
        "fincra_auth_fail":   "Fincra authentication failed",
        "fincra_balance_fail":"BALANCE_FETCH_FAILED",
        "unauthorized":       "Unauthorized",
        # Sales
        "deposit_credited":   "credited",
        "wallet_credited":    "wallet credited",
        "payment_confirmed":  "payment confirmed",
        "domain_registered":  "registered successfully",
        "vps_created":        "VPS created",
        "phone_purchased":    "phone number purchased",
        # Funnel
        "start_cmd":          "/start",
        "ref_link":           "ref_",
        # Errors
        "error_500":          "500 Internal",
        "error_502":          "502 Bad",
        "error_503":          "503 Service",
        "uncaught_ex":        "uncaughtException",
        "unhandled_rej":      "unhandledRejection",
        "mongo_err":          "MongoError",
        "telegram_blocked":   "bot was blocked",
        "rate_limit_429":     "429",
        "twilio_err":         "Twilio",
        "webhook_fail":       "webhook failed",
        "ECONNREFUSED":       "ECONNREFUSED",
        "ETIMEDOUT":          "ETIMEDOUT",
    }
    print("\n" + "─" * 78)
    print("LOG EVENT COUNTS BY DAY  (via anchorDate-based fetch)")
    print("─" * 78)
    results = {}
    for name, flt in FILTERS.items():
        logs = fetch_logs_window(flt, start, now, chunk_hours=4, before_limit=1000)
        c = count_per_day(logs)
        results[name] = {
            "filter": flt,
            "total": len(logs),
            "by_day": dict(c),
            "sample": logs[0]["message"][:200] if logs else "",
        }
        days_str = " ".join(f"{d[5:]}={c[d]}" for d in sorted(c.keys()))
        flag = ""
        if len(logs) and c:
            last_day = sorted(c.keys())[-1]
            last = c[last_day]
            others = [c[d] for d in c if d != last_day]
            avg = sum(others) / len(others) if others else 0
            if avg and last < avg * 0.4: flag = "  ⬇⬇ DROP"
            elif avg and last > avg * 2.5: flag = "  ⬆⬆ SPIKE"
        print(f"  {name:<22} total={len(logs):>5}  {days_str}{flag}")

    out_path = "/app/logs_prod/_6day_v2_summary.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"window": [start_iso, end_iso],
                   "http": http_summary,
                   "filters": results}, f, indent=2)
    print(f"\n→ Saved: {out_path}")


if __name__ == "__main__":
    main()
