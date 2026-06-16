#!/usr/bin/env python3
"""
Investigate Railway production logs for a recent .com.au domain registration
failure. Pulls the deploymentLogs of the active deployment, filters for the
last ~3h, and surfaces:
  - any mention of `.com.au`, `comau`, `com.au` tld
  - any OpenProvider API request/response noise
  - error / warn severity lines in the same window
"""
import os, sys, json, re, requests
from datetime import datetime, timezone, timedelta

API_KEY    = os.environ.get("RAILWAY_API_KEY", "6a2add90-c53c-40c4-91b7-f6f5af75861b")
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID     = "889fd56a-720a-4020-884c-034784992666"
URL        = "https://backboard.railway.app/graphql/v2"
HDR        = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60)
    try:
        j = r.json()
    except Exception:
        print("NON-JSON:", r.status_code, r.text[:500]); sys.exit(1)
    if "errors" in j and j["errors"]:
        print("GQL ERRORS:", json.dumps(j["errors"], indent=2))
    return j.get("data") or {}

# ── 1. Latest SUCCESS deployment ─────────────────────────────────────────
DEPLOY_Q = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
    edges { node { id status createdAt } }
  }
}
"""
d = gql(DEPLOY_Q, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = (((d or {}).get("deployments") or {}).get("edges")) or []
success = [e["node"] for e in edges if e["node"].get("status") == "SUCCESS"]
target = success[0] if success else edges[0]["node"]
print(f"Deployment: {target['id']}  status={target['status']}  created={target['createdAt']}\n")

# ── 2. Fetch a large window of logs ──────────────────────────────────────
LOG_Q = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) {
    timestamp message severity
  }
}
"""
d = gql(LOG_Q, {"d": target["id"], "limit": 5000})
logs = d.get("deploymentLogs") or []
print(f"Fetched {len(logs)} log lines\n")

# Determine cutoff = 3 hours before the newest log line we have (avoids clock-skew vs UTC now)
def parse_ts(s):
    try:
        return datetime.fromisoformat(s.replace("Z","+00:00"))
    except Exception:
        return None
ts_all = [parse_ts(l.get("timestamp","")) for l in logs]
ts_all = [t for t in ts_all if t]
if not ts_all:
    print("No parseable timestamps"); sys.exit(1)
newest = max(ts_all)
cutoff = newest - timedelta(hours=3)
print(f"Newest log: {newest.isoformat()}")
print(f"Cutoff (3h): {cutoff.isoformat()}\n")

recent = [l for l in logs if (parse_ts(l.get("timestamp","")) or datetime.min.replace(tzinfo=timezone.utc)) >= cutoff]
print(f"Lines in last 3h window: {len(recent)}\n")

# ── 3. Filters ───────────────────────────────────────────────────────────
def m(line, *needles):
    msg = (line.get("message") or "").lower()
    return any(n.lower() in msg for n in needles)

comau_lines       = [l for l in recent if m(l, "com.au", ".com.au", "comau", "com_au", "tld_au", " au ", "australia", "com-au")]
openprovider_lines= [l for l in recent if m(l, "openprovider", "open_provider", "[op]", "op-api", "op_api", "op.create", "op.register", "op.api")]
register_lines    = [l for l in recent if m(l, "register domain", "registerdomain", "domain registration", "register_domain", "registration failed", "createdomain", "create domain")]
err_lines         = [l for l in recent if (l.get("severity") or "").upper() in ("ERROR","CRITICAL","WARN","WARNING")]
exception_lines   = [l for l in recent if m(l, "error:", "exception", "traceback", "unhandled", "etimedout", "enotfound", "econnrefused", "rejected", "promise")]

print(f"═══ Counts (last 3h, deployment {target['id'][:8]}…) ═══")
print(f"  .com.au mentions:     {len(comau_lines)}")
print(f"  OpenProvider lines:   {len(openprovider_lines)}")
print(f"  Domain-register lines:{len(register_lines)}")
print(f"  ERROR/WARN severity:  {len(err_lines)}")
print(f"  Exception-ish text:   {len(exception_lines)}")

def dump(title, items, n=60):
    if not items: return
    print(f"\n═══ {title} (last {min(n,len(items))} of {len(items)}) ═══")
    for l in items[-n:]:
        msg = (l.get("message") or "").replace("\n"," ")[:400]
        print(f"  [{(l.get('timestamp') or '')[:19]}] [{l.get('severity','')}] {msg}")

dump(".com.au mentions",      comau_lines,        60)
dump("OpenProvider lines",    openprovider_lines, 80)
dump("Domain-register lines", register_lines,     40)
dump("Exception-ish in 3h",   exception_lines,    40)

# Save full window to disk for any deeper grep
out = "/app/scripts/comau_failure_window.jsonl"
with open(out, "w") as f:
    for l in recent:
        f.write(json.dumps(l) + "\n")
print(f"\nFull 3h window written to {out}")
