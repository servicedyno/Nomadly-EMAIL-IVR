#!/usr/bin/env python3
"""
Analyze Railway logs for all deployments in the last 12 hours.
Detect anomalies, bugs, and UX friction points.

Usage:
    python3 /app/scripts/analyze_railway_12h.py
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── Load env ────────────────────────────────────────────────────────────
ENV_FILE = Path("/app/backend/.env")
if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

TOKEN = os.environ["RAILWAY_PROJECT_TOKEN"]
PID = os.environ["RAILWAY_PROJECT_ID"]
EID = os.environ["RAILWAY_ENVIRONMENT_ID"]
SID = os.environ["RAILWAY_SERVICE_ID"]
ENDPOINT = "https://backboard.railway.app/graphql/v2"

print(f"📍 Project: {PID}")
print(f"📍 Environment: {EID}")
print(f"📍 Default Service: {SID}")


def gql(query: str, variables: dict | None = None) -> dict:
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Project-Access-Token": TOKEN,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}", file=sys.stderr)
        raise
    if "errors" in data:
        print(f"GraphQL errors: {json.dumps(data['errors'], indent=2)[:1000]}", file=sys.stderr)
    return data.get("data", {})


# ── Step 1: List services ───────────────────────────────────────────────
print("\n━━━ STEP 1: Discover services ━━━")
services_q = """
query($pid: String!) {
  project(id: $pid) {
    name
    services { edges { node { id name } } }
  }
}
"""
sd = gql(services_q, {"pid": PID})
project_name = sd.get("project", {}).get("name", "?")
services = [e["node"] for e in sd.get("project", {}).get("services", {}).get("edges", [])]
print(f"Project: {project_name}")
for s in services:
    print(f"  - {s['name']:<30}  {s['id']}")

# ── Step 2: For each service, list deployments in last 12h ──────────────
CUTOFF = datetime.now(timezone.utc) - timedelta(hours=12)
print(f"\n━━━ STEP 2: Deployments since {CUTOFF.isoformat()} ━━━")

deployments_q = """
query($pid: String!, $eid: String!, $sid: String!) {
  deployments(input: {projectId: $pid, environmentId: $eid, serviceId: $sid}, first: 50) {
    edges {
      node {
        id
        status
        createdAt
        updatedAt
        meta
        canRedeploy
      }
    }
  }
}
"""

all_deployments: list[dict] = []
for svc in services:
    try:
        dd = gql(deployments_q, {"pid": PID, "eid": EID, "sid": svc["id"]})
        edges = dd.get("deployments", {}).get("edges", []) or []
    except Exception as e:
        print(f"  ! Could not fetch deployments for {svc['name']}: {e}")
        continue
    fresh = []
    for e in edges:
        n = e["node"]
        try:
            created = datetime.fromisoformat(n["createdAt"].replace("Z", "+00:00"))
        except Exception:
            continue
        if created >= CUTOFF:
            n["_service"] = svc["name"]
            n["_serviceId"] = svc["id"]
            n["_created"] = created
            fresh.append(n)
    print(f"  {svc['name']:<30}  {len(fresh):>3} deployment(s) in last 12h")
    all_deployments.extend(fresh)

if not all_deployments:
    print("\nℹ️  No deployments in the last 12h. Falling back to most recent deployment per service for log scan.")
    # Fall back: take the most recent deployment per service so we still have logs to analyze
    for svc in services:
        try:
            dd = gql(deployments_q, {"pid": PID, "eid": EID, "sid": svc["id"]})
            edges = dd.get("deployments", {}).get("edges", []) or []
        except Exception:
            continue
        if edges:
            n = edges[0]["node"]
            try:
                n["_created"] = datetime.fromisoformat(n["createdAt"].replace("Z", "+00:00"))
            except Exception:
                n["_created"] = None
            n["_service"] = svc["name"]
            n["_serviceId"] = svc["id"]
            all_deployments.append(n)

all_deployments.sort(key=lambda d: d["_created"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
print(f"\nTotal deployments to analyze: {len(all_deployments)}")
for d in all_deployments:
    print(f"  [{d['status']:<10}] {d['_service']:<28} {d['_created'].isoformat() if d['_created'] else '?'}  {d['id']}")


# ── Step 3: Fetch logs for each deployment ──────────────────────────────
print("\n━━━ STEP 3: Fetch logs ━━━")
logs_q = """
query($id: String!, $limit: Int!, $filter: String) {
  deploymentLogs(deploymentId: $id, limit: $limit, filter: $filter) {
    message
    timestamp
    severity
  }
}
"""

# Save raw logs here
LOG_DIR = Path("/app/scripts/railway_logs_12h")
LOG_DIR.mkdir(parents=True, exist_ok=True)

per_deploy_logs: dict[str, list[dict]] = {}
for d in all_deployments:
    did = d["id"]
    svc_name = d["_service"]
    print(f"  ↪ {svc_name:<28} {did[:12]} ...", end=" ", flush=True)
    try:
        ld = gql(logs_q, {"id": did, "limit": 1500, "filter": ""})
        logs = ld.get("deploymentLogs", []) or []
    except Exception as e:
        print(f"  fetch failed: {e}")
        logs = []
    # Filter to last 12 hours by timestamp
    fresh_logs = []
    for entry in logs:
        ts = entry.get("timestamp")
        if not ts:
            continue
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            continue
        if t >= CUTOFF:
            entry["_t"] = t
            fresh_logs.append(entry)
    per_deploy_logs[did] = fresh_logs
    print(f"{len(fresh_logs):>4} log lines (in 12h window)")
    # Persist for inspection
    out_path = LOG_DIR / f"{svc_name}_{did[:12]}.jsonl"
    with out_path.open("w") as fh:
        for entry in fresh_logs:
            fh.write(json.dumps({
                "timestamp": entry.get("timestamp"),
                "severity": entry.get("severity"),
                "message": entry.get("message"),
            }) + "\n")

total_lines = sum(len(v) for v in per_deploy_logs.values())
print(f"\nTotal log lines collected: {total_lines}")


# ── Step 4: Analyze ─────────────────────────────────────────────────────
print("\n━━━ STEP 4: Analysis ━━━")

# Severity counts overall + per service
severity_counts: dict[str, Counter] = defaultdict(Counter)
all_messages: list[tuple[str, str, str, datetime]] = []  # (service, severity, message, ts)
for d in all_deployments:
    svc = d["_service"]
    for entry in per_deploy_logs.get(d["id"], []):
        sev = (entry.get("severity") or "info").lower()
        msg = entry.get("message") or ""
        severity_counts[svc][sev] += 1
        all_messages.append((svc, sev, msg, entry["_t"]))

print("\n[Severity breakdown per service]")
print(f"{'Service':<30} {'lines':>6} {'err':>6} {'warn':>6} {'info':>6} {'other':>6}")
for svc, c in severity_counts.items():
    err = c.get("error", 0) + c.get("err", 0) + c.get("critical", 0) + c.get("fatal", 0)
    warn = c.get("warn", 0) + c.get("warning", 0)
    info = c.get("info", 0)
    other = sum(c.values()) - err - warn - info
    total = sum(c.values())
    print(f"{svc:<30} {total:>6} {err:>6} {warn:>6} {info:>6} {other:>6}")

# ── Anomaly patterns ────────────────────────────────────────────────────
ERROR_PATTERNS = [
    (r"\bUnhandledPromiseRejection\b", "UnhandledPromiseRejection"),
    (r"\bECONNREFUSED\b", "ECONNREFUSED"),
    (r"\bECONNRESET\b", "ECONNRESET"),
    (r"\bETIMEDOUT\b", "ETIMEDOUT"),
    (r"\bENOTFOUND\b", "ENOTFOUND"),
    (r"\b5\d{2}\b.*(error|status)", "5xx response"),
    (r"\bMongoNetworkError\b", "MongoNetworkError"),
    (r"\bMongoServerError\b", "MongoServerError"),
    (r"\bduplicate key\b", "MongoDB duplicate key"),
    (r"timeout of \d+ms exceeded", "axios/fetch timeout"),
    (r"\brequest timeout\b", "request timeout"),
    (r"Cannot read propert", "TypeError null/undefined"),
    (r"\bnull is not\b", "null reference"),
    (r"\bundefined is not\b", "undefined reference"),
    (r"\bstack overflow\b", "stack overflow"),
    (r"\bMemory\b.*\b(leak|exhaust|exceed)\b", "memory issue"),
    (r"\b(crash|crashed|segfault)\b", "crash"),
    (r"\bRate limit\b", "rate limit hit"),
    (r"\b429\b", "429 Too Many Requests"),
    (r"\b401\b.*Unauthorized", "401 Unauthorized"),
    (r"\b403\b.*Forbidden", "403 Forbidden"),
    (r"\b404\b.*Not Found", "404 Not Found"),
    (r"\bTelnyx\b.*\b(error|fail|denied)\b", "Telnyx API error"),
    (r"\bTwilio\b.*\b(error|fail|denied)\b", "Twilio API error"),
    (r"\bcPanel\b.*\b(down|fail|error|timeout)\b", "cPanel issue"),
    (r"\bWHM\b.*\b(down|fail|error|timeout)\b", "WHM issue"),
    (r"\bCloudflare\b.*\b(error|fail|denied|429)\b", "Cloudflare API error"),
    (r"\bFincra\b.*\b(error|fail|denied)\b", "Fincra payment error"),
    (r"\bBlockBee\b.*\b(error|fail|denied)\b", "BlockBee payment error"),
    (r"\bDynoPay\b.*\b(error|fail|denied)\b", "DynoPay payment error"),
    (r"\bTelegram\b.*\b(error|fail|denied|conflict)\b", "Telegram API error"),
    (r"\bbot was blocked by the user\b", "Telegram bot blocked by user"),
    (r"\bchat not found\b", "Telegram chat not found"),
    (r"\bRetryAfter\b", "Telegram retry-after"),
    (r"\bDeadlineExceeded\b", "DeadlineExceeded"),
    (r"\bsegmentation fault\b", "segfault"),
    (r"\bSIGTERM\b", "SIGTERM received"),
    (r"\bSIGKILL\b", "SIGKILL"),
    (r"\bOut of memory\b", "OOM"),
    (r"\bDB connection lost\b", "DB connection lost"),
]

UX_PATTERNS = [
    (r"\b(refund|partial refund|chargeback)\b", "refund flow"),
    (r"abandon(?:ed|ment)", "cart abandonment"),
    (r"\bregistration\b.*\b(fail|error)\b", "registration failure"),
    (r"\bdomain\b.*\b(unavail|taken|conflict)\b", "domain unavailable / conflict"),
    (r"insufficient (?:balance|funds)", "insufficient funds"),
    (r"\bdeposit (?:fail|stuck|expired)\b", "deposit problem"),
    (r"\bunderpaid\b", "underpaid deposit"),
    (r"\bcheckout\b.*\b(fail|error|cancel)\b", "checkout failure"),
    (r"\bDNS\b.*\b(propagat|fail|error)\b", "DNS / propagation issue"),
    (r"\bpassword reset\b", "password reset"),
    (r"\bpermission denied\b", "permission denied"),
    (r"unsupported|not supported", "unsupported feature path"),
    (r"\b/start\b\s+stuck", "/start stuck"),
    (r"\bgive[- ]?up\b|\bgave up\b", "user gave up"),
    (r"\bmenu\b.*\b(broken|stuck|loop)\b", "menu navigation stuck"),
    (r"\binvoice\b.*\b(missing|fail)\b", "invoice issue"),
]

def categorize(messages):
    counts = Counter()
    examples: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for svc, sev, msg, ts in messages:
        for pat, label in ERROR_PATTERNS + UX_PATTERNS:
            if re.search(pat, msg, re.IGNORECASE):
                counts[label] += 1
                if len(examples[label]) < 3:
                    examples[label].append((svc, ts.isoformat(), msg.strip()[:300]))
    return counts, examples


cat_counts, cat_examples = categorize(all_messages)

print("\n[Pattern hits — last 12 hours]")
if not cat_counts:
    print("  ✅ No matches across configured anomaly/UX patterns.")
else:
    for label, n in cat_counts.most_common():
        print(f"  {n:>5}  {label}")

# Surface raw error/warn samples (top recurring)
print("\n[Top recurring error/warn message stems]")
err_msgs = [m for (s, sv, m, _t) in all_messages if sv in ("error", "err", "warn", "warning", "critical", "fatal")]
def stem(m: str) -> str:
    # Strip common dynamic bits to dedupe
    s = m
    s = re.sub(r"\b\d{6,}\b", "<NUM>", s)             # long numbers / chatIds / timestamps
    s = re.sub(r"\b[a-f0-9]{8,}\b", "<HEX>", s)        # hex ids
    s = re.sub(r"\b\d{1,3}(?:\.\d{1,3}){3}\b", "<IP>", s)
    s = re.sub(r"https?://\S+", "<URL>", s)
    s = re.sub(r"\b\w+@\w+\.\w+\b", "<EMAIL>", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:220]

stem_counts = Counter(stem(m) for m in err_msgs)
for s, n in stem_counts.most_common(15):
    if n >= 2:
        print(f"  ×{n:<3}  {s}")

# Per-deployment status
print("\n[Deployment status overview]")
for d in all_deployments:
    when = d["_created"].isoformat() if d["_created"] else "?"
    print(f"  {when}  {d['status']:<10}  {d['_service']:<28}  {d['id']}")

# Save full categorized examples to a JSON file for the user to read
report_path = Path("/app/scripts/railway_12h_analysis.json")
report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "window_hours": 12,
    "cutoff_utc": CUTOFF.isoformat(),
    "project": project_name,
    "services": [{"name": s["name"], "id": s["id"]} for s in services],
    "deployments": [
        {
            "id": d["id"],
            "service": d["_service"],
            "status": d["status"],
            "created_at": d["_created"].isoformat() if d["_created"] else None,
            "log_lines_in_window": len(per_deploy_logs.get(d["id"], [])),
        }
        for d in all_deployments
    ],
    "severity_per_service": {svc: dict(c) for svc, c in severity_counts.items()},
    "pattern_hits": dict(cat_counts),
    "pattern_examples": {k: v for k, v in cat_examples.items()},
    "top_error_warn_stems": stem_counts.most_common(40),
}
report_path.write_text(json.dumps(report, indent=2, default=str))
print(f"\n✅ Full report: {report_path}")
print(f"✅ Per-deployment raw logs: {LOG_DIR}")
