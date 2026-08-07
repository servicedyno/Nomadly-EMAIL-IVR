#!/usr/bin/env python3
"""Scan the last 48h of Railway prod logs across all services.
Classifies: severe errors, warnings, failed payments/purchases, and
user-reported complaints/support. Groups similar lines and reports the
LAST occurrence timestamp (to judge whether an issue is still active/unfixed).
"""
import requests, json, os, re, sys
from datetime import datetime, timedelta, timezone
from collections import defaultdict

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
HEADERS = {"Project-Access-Token": API_KEY, "Content-Type": "application/json"}

PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"

SERVICES = [
    {"id": "b9c4ad64-7667-4dd3-8b9a-3867ede47885", "name": "Nomadly-EMAIL-IVR"},
    {"id": "0a453645-4180-441b-8988-020807f4479a", "name": "HostingBotNew"},
    {"id": "96ee768e-3f4d-49c8-be75-dea30777e890", "name": "LockbayNewFIX"},
]

NOW = datetime.now(timezone.utc)
START = NOW - timedelta(hours=48)

os.makedirs("/app/logs_prod", exist_ok=True)


def gql(query, variables=None):
    try:
        r = requests.post(API_URL, json={"query": query, "variables": variables or {}}, headers=HEADERS, timeout=90)
        return r.json()
    except Exception as e:
        return {"errors": [{"message": str(e)}]}


DEP_Q = """query($p:String!,$s:String!,$e:String!){
  deployments(input:{projectId:$p,serviceId:$s,environmentId:$e}, first:25){
    edges{node{id status createdAt}}
  }
}"""

LOG_Q = """query($id:String!,$start:DateTime!,$end:DateTime!,$limit:Int!){
  deploymentLogs(deploymentId:$id, startDate:$start, endDate:$end, limit:$limit){
    message severity timestamp
  }
}"""

SEVERE = [
    "error:", "exception", "traceback", "unhandled", "unhandledrejection",
    "unhandled promise", "fatal", "segfault", "critical", "econnrefused",
    "etimedout", "enotfound", "eaddrinuse", "typeerror", "referenceerror",
    "syntaxerror", "rangeerror", "🚨", "crash", "cancel failed",
    "refund failed", "failed to", "could not", "500 internal", "502 bad",
    "503 ", "mongoerror", "mongoservererror", "timeout of", "rejected",
]

# User-reported / complaint / money-impacting signals
USER_ISSUE = [
    "complaint", "complain", "refund", "not working", "doesn't work",
    "didn't work", "stuck", "still waiting", "no response", "scam",
    "angry", "double charged", "charged twice", "overcharged",
    "wrong price", "did not receive", "not received", "missing",
    "[support]", "support request", "help me", "resolve", "dispute",
    "payment failed", "deposit not", "wallet not", "balance wrong",
]

# Money / transaction failure signals (bugs that hurt users)
MONEY_FAIL = [
    "payment failed", "deposit failed", "purchase failed", "registration failed",
    "provisioning failed", "cpanel create failed", "domain registration failed",
    "refund", "chargeback", "insufficient", "webhook error", "fincra",
    "blockbee", "dynopay", "overcharge", "price mismatch", "double",
]

NOISE = [
    "[memory]", "[protectionenforcer] ssl grace", "ssl grace period active",
    "[balancemonitor] running", "heartbeat", "keepalive",
]


def norm(msg):
    m = re.sub(r"\s+", " ", msg).strip()
    m = re.sub(r"\b[0-9a-f]{8,}\b", "<id>", m)
    m = re.sub(r"\+?\d{6,15}", "<num>", m)
    m = re.sub(r"\d+", "<n>", m)
    return m[:160]


def classify(msg, sev):
    ml = msg.lower()
    if any(n in ml for n in NOISE):
        return None
    sevU = (sev or "").upper()
    is_user = any(k in ml for k in USER_ISSUE)
    is_money = any(k in ml for k in MONEY_FAIL)
    is_severe = sevU in ("ERROR", "CRITICAL", "FATAL") or any(k in ml for k in SEVERE)
    is_warn = sevU in ("WARN", "WARNING")
    if is_user:
        return "user_issue"
    if is_money and (is_severe or "fail" in ml or "error" in ml):
        return "money_fail"
    if is_severe:
        return "severe"
    if is_warn:
        return "warn"
    return None


def fetch_service(svc):
    dr = gql(DEP_Q, {"p": PROJECT_ID, "s": svc["id"], "e": ENV_ID})
    if dr.get("errors"):
        print(f"  [{svc['name']}] deployments error: {dr['errors'][0].get('message')}")
        return []
    deploys = [e["node"] for e in (((dr.get("data") or {}).get("deployments") or {}).get("edges") or [])]
    deploys = [d for d in deploys if d["status"] in ("SUCCESS", "DEPLOYED", "RUNNING", "REMOVED", "CRASHED", "FAILED")]
    deploys.sort(key=lambda x: x["createdAt"])  # asc
    # build active windows over [START, NOW]
    windows = []
    for i, d in enumerate(deploys):
        ts = datetime.fromisoformat(d["createdAt"].replace("Z", "+00:00"))
        w_end = datetime.fromisoformat(deploys[i + 1]["createdAt"].replace("Z", "+00:00")) if i + 1 < len(deploys) else NOW
        w_start = max(ts, START)
        w_end = min(w_end, NOW)
        if w_end <= START or w_start >= NOW:
            continue
        windows.append((w_start, w_end, d["id"], d["status"]))
    if not windows and deploys:
        d = deploys[-1]
        windows = [(START, NOW, d["id"], d["status"])]
    logs = []
    seen = set()
    for ws, we, dep_id, st in windows:
        cur = ws
        while cur < we:
            ce = min(cur + timedelta(hours=1), we)
            r = gql(LOG_Q, {"id": dep_id, "start": cur.isoformat(), "end": ce.isoformat(), "limit": 5000})
            if r.get("errors"):
                ce = cur + timedelta(minutes=30)
                r = gql(LOG_Q, {"id": dep_id, "start": cur.isoformat(), "end": ce.isoformat(), "limit": 5000})
            got = ((r.get("data") or {}).get("deploymentLogs")) or []
            for l in got:
                k = (l.get("timestamp"), l.get("message"))
                if k in seen:
                    continue
                seen.add(k)
                logs.append(l)
            cur = ce
    return logs


def main():
    print(f"Window: {START.isoformat()} -> {NOW.isoformat()} (48h)\n")
    report = {"generatedAt": NOW.isoformat(), "window_start": START.isoformat(), "services": []}
    raw_out = open("/app/logs_prod/scan_48h_raw.jsonl", "w")
    for svc in SERVICES:
        print(f"=== {svc['name']} ===")
        logs = fetch_service(svc)
        print(f"  fetched {len(logs)} log lines in window")
        buckets = {"user_issue": defaultdict(lambda: {"count": 0, "first": None, "last": None, "ex": []}),
                   "money_fail": defaultdict(lambda: {"count": 0, "first": None, "last": None, "ex": []}),
                   "severe": defaultdict(lambda: {"count": 0, "first": None, "last": None, "ex": []}),
                   "warn": defaultdict(lambda: {"count": 0, "first": None, "last": None, "ex": []})}
        for l in logs:
            msg = l.get("message") or ""
            ts = l.get("timestamp") or ""
            raw_out.write(json.dumps({"svc": svc["name"], **l}) + "\n")
            kind = classify(msg, l.get("severity"))
            if not kind:
                continue
            key = norm(msg)
            b = buckets[kind][key]
            b["count"] += 1
            if b["first"] is None or ts < b["first"]:
                b["first"] = ts
            if b["last"] is None or ts > b["last"]:
                b["last"] = ts
            if len(b["ex"]) < 2:
                b["ex"].append(msg[:400])
        svc_rep = {"name": svc["name"], "total_lines": len(logs), "groups": {}}
        for kind in ("user_issue", "money_fail", "severe", "warn"):
            groups = sorted(buckets[kind].items(), key=lambda kv: kv[1]["count"], reverse=True)
            svc_rep["groups"][kind] = [
                {"pattern": k, "count": g["count"], "first": g["first"], "last": g["last"], "example": g["ex"][0] if g["ex"] else ""}
                for k, g in groups
            ]
            print(f"\n  --- {kind.upper()} ({len(groups)} distinct) ---")
            for k, g in groups[:30]:
                print(f"    (x{g['count']:>4}) last={ (g['last'] or '')[:19] }  {g['ex'][0][:200] if g['ex'] else k}")
        report["services"].append(svc_rep)
        print("")
    raw_out.close()
    with open("/app/logs_prod/scan_48h_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print("Saved -> /app/logs_prod/scan_48h_report.json and scan_48h_raw.jsonl")


if __name__ == "__main__":
    main()
