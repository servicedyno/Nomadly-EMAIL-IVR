#!/usr/bin/env python3
"""
Hosting-specific 21-day Railway RCA — Nomadly-EMAIL-IVR.

Filters all keyed to hosting plan failures:
  - cPanel provisioning success vs failure  
  - WHM API errors
  - AntiRed worker deploy / verification failures
  - Cloudflare integration errors (CF IP / Worker)
  - Webhook 502/503 affecting hosting checkout
  - 'AdminAlert' admin notifications (any hosting hand-offs)
  - Refunds / rollbacks from failed hosting provisioning

Output: /app/logs_prod/_hosting_3week_railway.json
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone

TOKEN = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICES = {
    "Nomadly-EMAIL-IVR": "b9c4ad64-7667-4dd3-8b9a-3867ede47885",
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


def fetch_logs_window(filter_str, start, end, chunk_hours=12, before_limit=1000):
    """Slides anchorDate backwards from `end` to `start`."""
    q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
      environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
        timestamp message severity tags { serviceId } } }"""
    seen = set()
    out = []
    cursor = end
    stall = 0
    while cursor > start:
        anchor_iso = cursor.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        r = gql(q, {"e": ENV_ID, "a": anchor_iso, "f": filter_str, "lim": before_limit})
        if "errors" in r:
            print(f"  [{filter_str}] err: {r['errors']}", file=sys.stderr)
            return out
        logs = r["data"]["environmentLogs"] or []
        new_count = 0
        for l in logs:
            k = (l["timestamp"], l["message"][:120])
            if k not in seen:
                seen.add(k)
                out.append(l)
                new_count += 1
        if not logs:
            break
        cursor = cursor - timedelta(hours=chunk_hours)
        if new_count == 0:
            stall += 1
            if stall >= 3:
                break
        else:
            stall = 0
    # bound to window
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
    DAYS = int(os.environ.get("DAYS", "21"))
    start = (now - timedelta(days=DAYS)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_iso = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    print(f"\n=== HOSTING 21-DAY RCA  ({start_iso}  →  {end_iso}) ===\n")

    FILTERS = {
        # SUCCESS signals
        "hosting_purchased":         "hosting purchased",
        "hosting_plan_purchased":    "Hosting plan purchased",
        "cpanel_account_created":    "cPanel account created",
        "cpanel_provisioned":        "cPanel provisioned",
        # FAILURE signals — explicit
        "hosting_failed":            "hosting failed",
        "cpanel_create_failed":      "cPanel account creation failed",
        "cpanel_create_error":       "cPanel creation error",
        "whm_error":                 "WHM API error",
        "whm_create_failed":         "createacct failed",
        "whm_unreachable":           "WHM unreachable",
        "provision_failed":          "provisioning failed",
        "admin_alert":               "AdminAlert",
        "admin_help_needed":         "admin_help",
        "manual_intervention":       "manual intervention",
        "rollback_hosting":          "hosting rollback",
        "refund_hosting":            "hosting refund",
        "stuck_job":                 "stuck job",
        # ANTIRED activity & worker
        "antired_cf_ip_fix":         "[AntiRed] CF IP Fix",
        "antired_deploy":            "[AntiRed] deploy",
        "antired_failed":            "[AntiRed] failed",
        "antired_skipped":           "[AntiRed]",
        "cf_worker_error":           "Worker",
        "cf_zone_error":             "zone error",
        # Cloudflare specific
        "cloudflare_unauthorized":   "Cloudflare Unauthorized",
        "cloudflare_429":            "Cloudflare 429",
        "cf_iperror":                "CF IP",
        # Generic errors
        "uncaught_ex":               "uncaughtException",
        "unhandled_rej":             "unhandledRejection",
        "mongo_err":                 "MongoError",
        "econn_refused":             "ECONNREFUSED",
        "etimedout":                 "ETIMEDOUT",
        # Job queue
        "cpanel_job_queue":          "cpanelPendingJobs",
        "job_attempt_failed":        "Job attempt failed",
    }

    print("─" * 86)
    print("LOG EVENT COUNTS BY DAY  (21-day window via anchorDate)")
    print("─" * 86)
    results = {}
    for name, flt in FILTERS.items():
        logs = fetch_logs_window(flt, start, now, chunk_hours=12, before_limit=1000)
        c = count_per_day(logs)
        results[name] = {
            "filter": flt,
            "total": len(logs),
            "by_day": dict(c),
            "sample_first": (logs[0]["message"][:240] if logs else ""),
            "sample_last":  (logs[-1]["message"][:240] if logs else ""),
        }
        days_str = " ".join(f"{d[5:]}={c[d]}" for d in sorted(c.keys()))
        flag = ""
        if len(logs) > 5 and c:
            sorted_days = sorted(c.keys())
            # First half average vs last 7 days
            mid = len(sorted_days) // 2
            first = sorted_days[:mid]
            last = sorted_days[-7:]
            first_avg = sum(c[d] for d in first) / max(len(first), 1)
            last_avg  = sum(c[d] for d in last) / max(len(last), 1)
            if first_avg and last_avg > first_avg * 2.0: flag = "  ⬆⬆ TREND UP"
            elif first_avg and last_avg < first_avg * 0.4: flag = "  ⬇⬇ TREND DOWN"
        print(f"  {name:<26} total={len(logs):>5}  {days_str}{flag}")

    out_path = "/app/logs_prod/_hosting_3week_railway.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump({"window": [start_iso, end_iso],
                   "service": "Nomadly-EMAIL-IVR",
                   "filters": results}, f, indent=2)
    print(f"\n→ Saved: {out_path}")


if __name__ == "__main__":
    main()
