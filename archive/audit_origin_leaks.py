#!/usr/bin/env python3
"""Audit: list any A record still pointing to 209.38.241.9 anywhere in the account."""
import json, subprocess, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

env_lines = subprocess.run(
    ["bash", "-c", "set -a; source /app/backend/.env; env"],
    capture_output=True, text=True
).stdout.splitlines()
ENV = {l.split('=',1)[0]: l.split('=',1)[1] for l in env_lines if '=' in l}
CF_EMAIL = ENV["CLOUDFLARE_EMAIL"]
CF_KEY   = ENV["CLOUDFLARE_API_KEY"]
WHM_HOST = ENV["WHM_HOST"]

def cf_get(path):
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4{path}")
    req.add_header("X-Auth-Email", CF_EMAIL)
    req.add_header("X-Auth-Key", CF_KEY)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"success": False, "error": str(e)}

def scan(zone_id, zone_name):
    leaks = []
    page = 1
    while True:
        r = cf_get(f"/zones/{zone_id}/dns_records?per_page=100&page={page}")
        if not r.get("success"): break
        for rec in r.get("result", []):
            if rec["type"] == "A" and rec["content"] == WHM_HOST:
                leaks.append((zone_name, rec["type"], rec["name"], rec["content"], rec.get("proxied")))
            # Also flag MX that resolves into mail.<zone>  (which used to be an A→origin)
            if rec["type"] == "MX" and rec["content"] == f"mail.{zone_name}":
                leaks.append((zone_name, rec["type"], rec["name"], rec["content"], "(MX→mail.* leaky)"))
        info = r.get("result_info", {})
        if page >= info.get("total_pages", 1): break
        page += 1
    return leaks

zones = []
with open("/tmp/zones.txt") as f:
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) >= 3:
            zones.append((parts[0], parts[1]))

print(f"Auditing {len(zones)} zones for any A→{WHM_HOST}...")
all_leaks = []
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = {ex.submit(scan, zid, zname): zname for zid, zname in zones}
    done = 0
    for fut in as_completed(futs):
        done += 1
        leaks = fut.result()
        if leaks:
            all_leaks.extend(leaks)

print(f"\n=== AUDIT RESULT ===")
print(f"Total zones scanned: {len(zones)}")
print(f"Total origin leaks remaining: {len(all_leaks)}")
if all_leaks:
    print("\nZones still leaking origin IP:")
    for z, t, n, c, p in all_leaks[:50]:
        print(f"  {z:45s}  {t:5s} {n:50s} → {c} {p}")
    if len(all_leaks) > 50:
        print(f"... and {len(all_leaks)-50} more")
else:
    print("\n✅ ALL CLEAN — no zone leaks the origin IP")

with open("/tmp/leak_audit.json","w") as f:
    json.dump([{"zone":z,"type":t,"name":n,"content":c,"proxied":p} for z,t,n,c,p in all_leaks], f, indent=2)
