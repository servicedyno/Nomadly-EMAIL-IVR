#!/usr/bin/env python3
"""Analyze fetched Railway production logs for anomalies and group fixes."""
import json, re, sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

PROD_DIR = Path("/app/logs_prod")
SERVICES = ["HostingBotNew", "LockbayNewFIX", "Nomadly-EMAIL-IVR"]

# stripping noisy variable bits to group similar lines
STRIP_PATTERNS = [
    (r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", "<uuid>"),
    (r"\b[0-9a-f]{24}\b", "<objectid>"),
    (r"\+\d{7,15}\b", "<phone>"),
    (r"\b\d{6,}\b", "<id>"),
    (r"\b[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\b", "<ip>"),
    (r"\b\d{4}-\d{2}-\d{2}T[\d:.]+Z\b", "<ts>"),
    (r"\b\d+ms\b", "<ms>"),
    (r"\b\d+(\.\d+)? ?(seconds?|secs?|s|min|hours?|hrs?)\b", "<dur>"),
    (r"@\w+", "@<user>"),
    (r"https?://[^\s\"']+", "<url>"),
    (r"'[^']{30,}'", "'<long>'"),
    (r"\"[^\"]{30,}\"", '"<long>"'),
    (r"chatId[:= ]\s*\d+", "chatId=<id>"),
    (r"user(_id|Id)?[:= ]\s*\d+", "user=<id>"),
    (r"call(_id|Id|sid)?[:= ]\s*\S+", "call=<id>"),
    (r"orderId[:= ]\s*\S+", "orderId=<id>"),
]

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def normalize(msg: str) -> str:
    m = ANSI.sub("", msg or "")
    for pat, rep in STRIP_PATTERNS:
        m = re.sub(pat, rep, m)
    m = re.sub(r"\s+", " ", m).strip()
    return m[:280]


def load(svc: str):
    fp = PROD_DIR / f"{svc}.json"
    if not fp.exists():
        return None
    with open(fp) as f:
        return json.load(f)


def detect_restarts(logs):
    """Lines indicating container/process restart."""
    pat = re.compile(r"(starting container|process exited|container exited|restart|spawn|crashed|sigterm|sigkill|listening on port|server (started|running)|bot started|reconnect)", re.I)
    return [l for l in logs if pat.search(l.get("message",""))]


def detect_warnings(logs):
    pat = re.compile(r"\b(WARN(ING)?|deprecat|fallback|retry|retried|timed? ?out|slow|exceeded)\b", re.I)
    out = []
    for l in logs:
        if l.get("severity") == "warning":
            out.append(l); continue
        if pat.search(l.get("message","")):
            out.append(l)
    return out


def detect_slow_ops(logs):
    """Find ms/seconds operations > thresholds."""
    slow = []
    pat_ms = re.compile(r"(\d{4,})\s*ms\b")
    pat_s  = re.compile(r"(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)\b", re.I)
    for l in logs:
        m = l.get("message","")
        for v in pat_ms.findall(m):
            if int(v) >= 3000:
                slow.append((int(v), l)); break
        else:
            for v in pat_s.findall(m):
                try:
                    if float(v) >= 5:
                        slow.append((int(float(v)*1000), l)); break
                except: pass
    slow.sort(key=lambda x: -x[0])
    return slow


def detect_repeated(logs, top=15, min_count=10):
    """Group identical normalized messages."""
    c = Counter()
    examples = {}
    sev_by = defaultdict(Counter)
    for l in logs:
        n = normalize(l.get("message",""))
        if not n: continue
        c[n] += 1
        examples.setdefault(n, l.get("message",""))
        sev_by[n][l.get("severity") or "?"] += 1
    return [(n, cnt, dict(sev_by[n]), examples[n]) for n,cnt in c.most_common() if cnt >= min_count][:top]


def detect_errors(logs):
    errs = [l for l in logs if l.get("severity") == "error"]
    # also catch error-like info lines
    pat = re.compile(r"\b(error|exception|failed|failure|stack ?trace|traceback|enotfound|econnrefused|econnreset|etimedout|cannot read|undefined is not|unhandled|panic)\b", re.I)
    for l in logs:
        if l.get("severity") != "error" and pat.search(l.get("message","")):
            errs.append(l)
    return errs


def group_errors(errs, top=30, min_count=1):
    c = Counter()
    examples = {}
    first_ts = {}
    last_ts = {}
    for l in errs:
        n = normalize(l.get("message",""))
        if not n: continue
        c[n] += 1
        examples.setdefault(n, l.get("message",""))
        ts = l.get("timestamp","")
        if n not in first_ts or ts < first_ts[n]: first_ts[n] = ts
        if n not in last_ts  or ts > last_ts[n]:  last_ts[n]  = ts
    return [{
        "pattern": n, "count": cnt,
        "first_seen": first_ts.get(n,""), "last_seen": last_ts.get(n,""),
        "example": examples.get(n,"")[:600],
    } for n,cnt in c.most_common() if cnt >= min_count][:top]


def per_minute_rate(logs):
    by_min = Counter()
    for l in logs:
        ts = l.get("timestamp","")
        if len(ts) >= 16:
            by_min[ts[:16]] += 1
    if not by_min: return None
    counts = sorted(by_min.values())
    n = len(counts)
    avg = sum(counts)/n
    median = counts[n//2]
    p95 = counts[int(n*0.95)] if n>20 else counts[-1]
    spikes = [(k, v) for k,v in by_min.items() if v > max(p95, avg*3)]
    spikes.sort(key=lambda x: -x[1])
    return {"per_min_avg": round(avg,1), "per_min_median": median, "per_min_p95": p95,
            "spike_minutes": spikes[:10]}


def analyze(svc):
    data = load(svc)
    if not data:
        return None
    logs = data["logs"]
    out = {
        "service": svc,
        "deployment_id": data["deployment_id"],
        "deployment_status": data["status"],
        "log_count": len(logs),
        "severity_breakdown": data["severity_breakdown"],
        "time_range": data.get("time_range"),
    }
    errs = detect_errors(logs)
    out["error_count"] = len(errs)
    out["error_groups"] = group_errors(errs, top=40)
    out["warnings"] = group_errors(detect_warnings(logs), top=15, min_count=2)
    out["restarts"] = [{"ts": r["timestamp"], "msg": r["message"][:240]} for r in detect_restarts(logs)][:30]
    slow = detect_slow_ops(logs)
    out["slow_ops"] = [{"ms": ms, "ts": l["timestamp"], "msg": l["message"][:240]} for ms,l in slow[:15]]
    out["top_repeated"] = [{"pattern": n, "count": c, "severity": s, "example": e[:240]}
                            for (n,c,s,e) in detect_repeated(logs, top=12, min_count=20)]
    out["rate"] = per_minute_rate(logs)
    return out


report = {"generated_at": datetime.utcnow().isoformat()+"Z", "services": {}}
for svc in SERVICES:
    r = analyze(svc)
    if r:
        report["services"][svc] = r

out_path = "/app/logs_prod/_analysis.json"
with open(out_path, "w") as f:
    json.dump(report, f, indent=2)

# Console summary
print(f"\n{'='*70}\nANOMALY REPORT — generated {report['generated_at']}\n{'='*70}")
for svc, r in report["services"].items():
    print(f"\n## {svc}  (deployment {r['deployment_id'][:8]}, {r['deployment_status']})")
    print(f"   logs: {r['log_count']}  severity: {r['severity_breakdown']}")
    print(f"   range: {r['time_range']}")
    print(f"   errors: {r['error_count']}")
    if r['error_groups']:
        print(f"   --- top error patterns ---")
        for g in r['error_groups'][:10]:
            print(f"     [{g['count']:>4}x] {g['pattern'][:120]}")
    if r['warnings']:
        print(f"   --- top warning patterns ---")
        for g in r['warnings'][:5]:
            print(f"     [{g['count']:>4}x] {g['pattern'][:120]}")
    if r['restarts']:
        print(f"   --- restarts: {len(r['restarts'])} ---")
        for x in r['restarts'][:5]:
            print(f"     [{x['ts'][:19]}] {x['msg'][:120]}")
    if r['slow_ops']:
        print(f"   --- slow ops ---")
        for x in r['slow_ops'][:5]:
            print(f"     [{x['ms']:>6}ms] {x['msg'][:120]}")
    if r['rate']:
        print(f"   rate: avg {r['rate']['per_min_avg']}/min, median {r['rate']['per_min_median']}, p95 {r['rate']['per_min_p95']}, spikes: {len(r['rate']['spike_minutes'])}")

print(f"\n\nFull JSON: {out_path}")
