#!/usr/bin/env python3
"""Targeted cleanup of the 12 remaining origin-leaking records."""
import json, subprocess, urllib.request

env_lines = subprocess.run(
    ["bash", "-c", "set -a; source /app/backend/.env; env"],
    capture_output=True, text=True
).stdout.splitlines()
ENV = {l.split('=',1)[0]: l.split('=',1)[1] for l in env_lines if '=' in l}
CF_EMAIL = ENV["CLOUDFLARE_EMAIL"]
CF_KEY   = ENV["CLOUDFLARE_API_KEY"]
WHM_HOST = ENV["WHM_HOST"]
TUNNEL   = ENV["CF_TUNNEL_CNAME"]

def cf(method, path, body=None):
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4{path}", method=method)
    req.add_header("X-Auth-Email", CF_EMAIL)
    req.add_header("X-Auth-Key", CF_KEY)
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode() if body else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read())
        except: return {"success": False, "error": str(e)}

# Map zone_name -> zone_id
ZONES = {}
with open("/tmp/zones.txt") as f:
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) >= 2:
            ZONES[parts[1]] = parts[0]

def list_records(zone_id):
    out, page = [], 1
    while True:
        r = cf("GET", f"/zones/{zone_id}/dns_records?per_page=100&page={page}")
        if not r.get("success"): return out
        out.extend(r.get("result", []))
        info = r.get("result_info", {})
        if page >= info.get("total_pages", 1): break
        page += 1
    return out

def delete_rec(zone_id, rec_id, label):
    d = cf("DELETE", f"/zones/{zone_id}/dns_records/{rec_id}")
    print(f"  delete {label}: {'OK' if d.get('success') else 'FAIL '+str(d.get('errors'))}")

def create_cname(zone_id, name):
    c = cf("POST", f"/zones/{zone_id}/dns_records",
           {"type":"CNAME","name":name,"content":TUNNEL,"ttl":1,"proxied":True})
    print(f"  create CNAME {name}: {'OK' if c.get('success') else 'FAIL '+str(c.get('errors'))}")

def full_migrate(domain, also_subs=None):
    """For a single zone: delete A→origin for root/www/mail*, replace with CNAME→tunnel."""
    print(f"\n══ {domain} ══")
    if domain not in ZONES:
        print(f"  zone not found"); return
    zid = ZONES[domain]
    recs = list_records(zid)
    web_names = [domain, f"www.{domain}"]
    # Delete origin-leak A records (root, www, anything matching leak prefixes or also_subs)
    leak_prefixes = {"mail","cpanel","webmail","webdisk","whm","autodiscover","autoconfig"} | set(also_subs or [])
    for r in recs:
        if r["type"] == "A" and r["content"] == WHM_HOST:
            prefix = r["name"].split(".")[0].lower()
            if r["name"] in web_names or prefix in leak_prefixes:
                delete_rec(zid, r["id"], f"A {r['name']}")
    # Delete leaky MX
    for r in recs:
        if r["type"] == "MX" and (r["content"] == f"mail.{domain}" or r["content"] == WHM_HOST):
            delete_rec(zid, r["id"], f"MX {r['name']}→{r['content']}")
    # Refresh records list to confirm deletes took effect
    recs = list_records(zid)
    cname_names = {r["name"] for r in recs if r["type"]=="CNAME" and r["content"]==TUNNEL}
    # Add tunnel CNAMEs for root + www if missing
    for name in web_names:
        if name not in cname_names:
            # Final safety: any other A/CNAME on this name?
            blocking = [r for r in recs if r["name"]==name and r["type"] in ("A","CNAME","AAAA")]
            for b in blocking:
                delete_rec(zid, b["id"], f"{b['type']} {b['name']}→{b['content']} (blocking)")
            create_cname(zid, name)
    # Add tunnel CNAMEs for any leak-subdomain we deleted (none for these — they should just stay deleted)

# 1. bottomlinesavings.xyz (pending)
full_migrate("bottomlinesavings.xyz")

# 2. downloaddtranscripts.net (pending)
full_migrate("downloaddtranscripts.net")

# 3. tdsecurity-portal.com (moved)
full_migrate("tdsecurity-portal.com")

# 4. getustogether.us — only the `blog.` leak
print(f"\n══ getustogether.us (blog.* leak) ══")
zid = ZONES["getustogether.us"]
recs = list_records(zid)
for r in recs:
    if r["type"]=="A" and r["content"]==WHM_HOST and r["name"].startswith("blog."):
        delete_rec(zid, r["id"], f"A {r['name']}")
        # Add CNAME→tunnel for blog
        c = cf("POST", f"/zones/{zid}/dns_records",
               {"type":"CNAME","name":r["name"],"content":TUNNEL,"ttl":1,"proxied":True})
        print(f"  create CNAME {r['name']}: {'OK' if c.get('success') else 'FAIL '+str(c.get('errors'))}")

# 5. sbsecurity-portal.com — wrong-zone garbage record
print(f"\n══ sbsecurity-portal.com (wrong-zone garbage) ══")
zid = ZONES["sbsecurity-portal.com"]
recs = list_records(zid)
for r in recs:
    if r["type"]=="A" and r["content"]==WHM_HOST and "tdsecure-portal" in r["name"]:
        delete_rec(zid, r["id"], f"A {r['name']} (wrong-zone garbage)")

print("\n══ Done ══")
