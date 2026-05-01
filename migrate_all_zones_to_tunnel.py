#!/usr/bin/env python3
"""
Migrate ALL Cloudflare zones for this account to use the configured Tunnel CNAME
for root + www, and purge origin-leaking subdomain A records (mail/cpanel/etc.).
Idempotent: zones already on tunnel are skipped.
"""
import os, sys, json, time
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load env
import subprocess
env_lines = subprocess.run(
    ["bash", "-c", "set -a; source /app/backend/.env; env"],
    capture_output=True, text=True
).stdout.splitlines()
ENV = {l.split('=',1)[0]: l.split('=',1)[1] for l in env_lines if '=' in l}

CF_EMAIL = ENV["CLOUDFLARE_EMAIL"]
CF_KEY   = ENV["CLOUDFLARE_API_KEY"]
WHM_HOST = ENV["WHM_HOST"]               # 209.38.241.9
TUNNEL   = ENV["CF_TUNNEL_CNAME"]        # f63ce7b5-...cfargotunnel.com
MAIL_RELAY = ENV.get("MAIL_RELAY_HOST", "").strip()

LEAK_PREFIXES = {"mail", "cpanel", "webmail", "webdisk", "whm",
                 "autodiscover", "autoconfig"}

def cf(method, path, body=None):
    url = f"https://api.cloudflare.com/client/v4{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("X-Auth-Email", CF_EMAIL)
    req.add_header("X-Auth-Key", CF_KEY)
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode() if body else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read())
        except: return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}

def list_records(zone_id):
    out, page = [], 1
    while True:
        r = cf("GET", f"/zones/{zone_id}/dns_records?per_page=100&page={page}")
        if not r.get("success"): return out, r.get("errors", [r])
        out.extend(r.get("result", []))
        info = r.get("result_info", {})
        if page >= info.get("total_pages", 1): break
        page += 1
    return out, None

def migrate_zone(zone_id, zone_name):
    """Returns dict with action summary."""
    result = {
        "zone": zone_name,
        "status": "ok",
        "leaks_purged": [],
        "tunnel_created": [],
        "leaky_mx_purged": [],
        "errors": [],
        "skipped": False,
    }
    records, err = list_records(zone_id)
    if err:
        result["status"] = "list_error"
        result["errors"].append(str(err))
        return result

    # Check current state
    web_names = [zone_name, f"www.{zone_name}"]
    a_to_origin = [r for r in records if r["type"] == "A" and r["content"] == WHM_HOST]
    cname_to_tunnel = [r for r in records if r["type"] == "CNAME" and r["content"] == TUNNEL]
    cname_to_tunnel_names = {r["name"] for r in cname_to_tunnel}

    # If both root and www already on tunnel AND no A→origin records, skip
    if zone_name in cname_to_tunnel_names and \
       f"www.{zone_name}" in cname_to_tunnel_names and \
       len(a_to_origin) == 0:
        result["skipped"] = True
        return result

    # ── 1. Replace root + www A → tunnel CNAME ──
    for name in web_names:
        # Delete any A record pointing to origin for this name
        for r in records:
            if r["name"] == name and r["type"] == "A" and r["content"] == WHM_HOST:
                d = cf("DELETE", f"/zones/{zone_id}/dns_records/{r['id']}")
                if not d.get("success"):
                    result["errors"].append(f"delete A {name}: {d.get('errors', d)}")
        # Delete any non-tunnel CNAME for this name (CF doesn't allow A+CNAME for same name)
        for r in records:
            if r["name"] == name and r["type"] == "CNAME" and r["content"] != TUNNEL:
                cf("DELETE", f"/zones/{zone_id}/dns_records/{r['id']}")
        # Create CNAME → tunnel if not already there
        if name not in cname_to_tunnel_names:
            c = cf("POST", f"/zones/{zone_id}/dns_records",
                   {"type": "CNAME", "name": name, "content": TUNNEL,
                    "ttl": 1, "proxied": True})
            if c.get("success"):
                result["tunnel_created"].append(name)
            else:
                result["errors"].append(f"create CNAME {name}: {c.get('errors', c)}")

    # ── 2. Purge leak-prone subdomain A records pointing to origin ──
    for r in records:
        if r["type"] != "A" or r["content"] != WHM_HOST:
            continue
        if r["name"] in web_names:
            continue  # already handled above
        prefix = r["name"].split(".")[0].lower()
        if prefix in LEAK_PREFIXES:
            d = cf("DELETE", f"/zones/{zone_id}/dns_records/{r['id']}")
            if d.get("success"):
                result["leaks_purged"].append(r["name"])
            else:
                result["errors"].append(f"purge {r['name']}: {d.get('errors', d)}")

    # ── 3. Purge leaky MX records (pointing to mail.<domain> or origin IP) ──
    for r in records:
        if r["type"] != "MX":
            continue
        leaky = r["content"] == f"mail.{zone_name}" or r["content"] == WHM_HOST
        if leaky:
            d = cf("DELETE", f"/zones/{zone_id}/dns_records/{r['id']}")
            if d.get("success"):
                result["leaky_mx_purged"].append(f"{r['name']} → {r['content']}")
            else:
                result["errors"].append(f"purge MX {r['name']}: {d.get('errors', d)}")

    # ── 4. If MAIL_RELAY set, add clean MX ──
    if MAIL_RELAY:
        existing_relay = any(r["type"] == "MX" and r["content"] == MAIL_RELAY for r in records)
        if not existing_relay:
            mx = cf("POST", f"/zones/{zone_id}/dns_records",
                    {"type": "MX", "name": zone_name, "content": MAIL_RELAY,
                     "ttl": 300, "priority": 10})
            if mx.get("success"):
                result["mx_added"] = MAIL_RELAY

    if result["errors"]:
        result["status"] = "errors"
    return result

def main():
    # Read zones from /tmp/zones.txt
    zones = []
    with open("/tmp/zones.txt") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) >= 3 and parts[2] == "active":
                zones.append((parts[0], parts[1]))
    print(f"Loaded {len(zones)} active zones")
    print(f"Tunnel: {TUNNEL}")
    print(f"Origin (WHM_HOST): {WHM_HOST}")
    print(f"Mail relay: {MAIL_RELAY or '(unset — mail records will be purged, none added)'}")
    print()

    total_migrated = 0
    total_leaks_purged = 0
    total_mx_purged = 0
    total_skipped = 0
    total_errors = 0
    error_zones = []

    # Parallelism: 6 concurrent workers — safe under CF rate limits
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(migrate_zone, zid, zname): zname for zid, zname in zones}
        done = 0
        for fut in as_completed(futures):
            done += 1
            r = fut.result()
            if r["skipped"]:
                total_skipped += 1
                continue
            tc = len(r["tunnel_created"])
            lp = len(r["leaks_purged"])
            mp = len(r["leaky_mx_purged"])
            if tc or lp or mp:
                total_migrated += 1
                total_leaks_purged += lp
                total_mx_purged += mp
                print(f"[{done:3d}/{len(zones)}] {r['zone']:45s} CNAME+{tc} leaks-{lp} mx-{mp}")
            if r["errors"]:
                total_errors += 1
                error_zones.append((r["zone"], r["errors"][:3]))
                print(f"[{done:3d}/{len(zones)}] {r['zone']:45s} ERRORS: {r['errors'][:2]}")

    print()
    print("=" * 70)
    print(f"SUMMARY:")
    print(f"  Total active zones:       {len(zones)}")
    print(f"  Migrated (added CNAME):   {total_migrated}")
    print(f"  Already-clean (skipped):  {total_skipped}")
    print(f"  Origin-leak A records purged: {total_leaks_purged}")
    print(f"  Leaky MX records purged:  {total_mx_purged}")
    print(f"  Zones with errors:        {total_errors}")
    if error_zones:
        print()
        print("ERROR DETAILS (first 10):")
        for z, errs in error_zones[:10]:
            print(f"  {z}: {errs}")

    # Save full report
    with open("/tmp/migration_report.json", "w") as f:
        json.dump({
            "timestamp": time.time(),
            "total_zones": len(zones),
            "migrated": total_migrated,
            "skipped": total_skipped,
            "leaks_purged": total_leaks_purged,
            "mx_purged": total_mx_purged,
            "errors": total_errors,
            "error_zones": error_zones,
        }, f, indent=2)
    print()
    print("Report saved: /tmp/migration_report.json")

if __name__ == "__main__":
    main()
