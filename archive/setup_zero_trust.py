#!/usr/bin/env python3
"""
Apply Cloudflare Zero Trust Access protection to cpanel-api.hostbay.io and
whm-api.hostbay.io. After this runs successfully, only requests carrying the
service-token headers (CF-Access-Client-Id, CF-Access-Client-Secret) are
allowed through — public access to the tunnel hostnames is blocked.

PREREQUISITE: Cloudflare Zero Trust must be activated on the account first.
Visit https://one.dash.cloudflare.com and click "Enable Access" (free tier).

This script is idempotent — safe to re-run.

After it succeeds, push CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET to
Railway (the script does this automatically when env vars are present).
"""
import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

# Load env from /app/backend/.env
env_lines = subprocess.run(
    ["bash", "-c", "set -a; source /app/backend/.env; env"],
    capture_output=True, text=True
).stdout.splitlines()
ENV = {l.split('=',1)[0]: l.split('=',1)[1] for l in env_lines if '=' in l}

CF_EMAIL   = ENV["CLOUDFLARE_EMAIL"]
CF_KEY     = ENV["CLOUDFLARE_API_KEY"]
ACCOUNT_ID = "ed6035ebf6bd3d85f5b26c60189a21e2"
RAILWAY_TOKEN = ENV["RAILWAY_PROJECT_TOKEN"]
RAILWAY_PROJECT_ID     = ENV["RAILWAY_PROJECT_ID"]
RAILWAY_ENVIRONMENT_ID = ENV["RAILWAY_ENVIRONMENT_ID"]
RAILWAY_SERVICE_ID     = ENV["RAILWAY_SERVICE_ID"]

TUNNEL_HOSTS = [
    ("cPanel API Tunnel", "cpanel-api.hostbay.io"),
    ("WHM API Tunnel",    "whm-api.hostbay.io"),
]
SERVICE_TOKEN_NAME = "Railway Bot - HostBay cPanel/WHM API"

def cf(method, path, body=None):
    url = f"https://api.cloudflare.com/client/v4{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("X-Auth-Email", CF_EMAIL)
    req.add_header("X-Auth-Key", CF_KEY)
    req.add_header("Content-Type", "application/json")
    data = json.dumps(body).encode() if body else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read())
        except Exception: return {"success": False, "error": str(e)}

def step(label):
    print(f"\n══ {label} ══")

# ── Pre-flight: confirm Access is enabled ──
step("Pre-flight — verify Zero Trust is enabled on the account")
r = cf("GET", f"/accounts/{ACCOUNT_ID}/access/service_tokens")
if not r.get("success"):
    errs = r.get("errors", [])
    msg = json.dumps(errs)[:300]
    if "Access" in msg and ("Enable" in msg or "enabled" in msg or "subscribe" in msg.lower()):
        print(f"  ❌ Zero Trust is NOT enabled on this account.")
        print(f"  → Open https://one.dash.cloudflare.com/{ACCOUNT_ID}/access")
        print(f"  → Click 'Enable Access' (free tier — up to 50 users)")
        print(f"  → Re-run this script.")
        sys.exit(2)
    print(f"  Unexpected API error: {msg}")
    sys.exit(1)
print(f"  ✅ Access is enabled. Found {len(r.get('result',[]))} existing service token(s).")

# ── 1. Service token (idempotent — reuse if already present) ──
step("Service Token")
existing = next((t for t in r["result"] if t.get("name") == SERVICE_TOKEN_NAME), None)
if existing:
    print(f"  ℹ️  Service token already exists: {existing['id']}")
    print(f"     client_id (public): {existing['client_id']}")
    print(f"     client_secret was issued in a prior run.")
    print(f"     If you don't have it saved, DELETE the token in the dashboard")
    print(f"     and re-run — it can only be displayed at creation time.")
    token_id     = existing["id"]
    client_id    = existing["client_id"]
    client_secret = ENV.get("CF_ACCESS_CLIENT_SECRET")  # may be in env from previous run
    if not client_secret:
        print(f"  ⚠️  client_secret not in /app/backend/.env — Railway env will be skipped.")
        print(f"     Save the secret manually OR delete and re-create the token.")
else:
    create = cf("POST", f"/accounts/{ACCOUNT_ID}/access/service_tokens",
                {"name": SERVICE_TOKEN_NAME, "duration": "8760h"})
    if not create.get("success"):
        print(f"  ❌ create failed: {create.get('errors')}")
        sys.exit(1)
    t = create["result"]
    token_id      = t["id"]
    client_id     = t["client_id"]
    client_secret = t["client_secret"]
    print(f"  ✅ Token created. ID: {token_id}")
    print(f"     client_id:     {client_id}")
    print(f"     client_secret: {client_secret}")
    # Save to a local file so the user has it after the run
    with open("/tmp/cf_access_token_secret.txt", "w") as f:
        f.write(f"CF_ACCESS_CLIENT_ID={client_id}\n")
        f.write(f"CF_ACCESS_CLIENT_SECRET={client_secret}\n")
    print(f"  Saved to /tmp/cf_access_token_secret.txt")

# ── 2. Access Application + policy for each tunnel host ──
existing_apps = cf("GET", f"/accounts/{ACCOUNT_ID}/access/apps")
if not existing_apps.get("success"):
    print(f"  ❌ list apps failed: {existing_apps.get('errors')}")
    sys.exit(1)
apps_by_domain = {a.get("domain"): a for a in existing_apps.get("result", [])}

for app_label, host in TUNNEL_HOSTS:
    step(f"Access Application — {host}")
    app = apps_by_domain.get(host)
    if app:
        print(f"  ℹ️  App already exists: {app['id']}")
        app_id = app["id"]
    else:
        body = {
            "name":                          app_label,
            "domain":                        host,
            "type":                          "self_hosted",
            "session_duration":              "24h",
            "auto_redirect_to_identity":     False,
            "allowed_idps":                  [],
            "skip_interstitial":             True,
        }
        cr = cf("POST", f"/accounts/{ACCOUNT_ID}/access/apps", body)
        if not cr.get("success"):
            print(f"  ❌ app create failed: {cr.get('errors')}")
            sys.exit(1)
        app_id = cr["result"]["id"]
        print(f"  ✅ App created: {app_id}")

    # Policy: allow ONLY the service token (no humans)
    pols = cf("GET", f"/accounts/{ACCOUNT_ID}/access/apps/{app_id}/policies")
    pol_exists = next((p for p in pols.get("result",[]) if p.get("name") == "Allow Railway Bot"), None)
    if pol_exists:
        print(f"  ℹ️  Policy already exists: {pol_exists['id']}")
    else:
        pol_body = {
            "name":     "Allow Railway Bot",
            "decision": "non_identity",   # non_identity = service-token only, no IdP
            "include":  [{"service_token": {"token_id": token_id}}],
            "precedence": 1,
        }
        pr = cf("POST", f"/accounts/{ACCOUNT_ID}/access/apps/{app_id}/policies", pol_body)
        if not pr.get("success"):
            print(f"  ❌ policy create failed: {pr.get('errors')}")
            sys.exit(1)
        print(f"  ✅ Policy created: {pr['result']['id']}")

# ── 3. Push CF_ACCESS_CLIENT_ID/SECRET to Railway env ──
if client_secret:
    step("Push credentials to Railway")
    for var_name, var_val in [("CF_ACCESS_CLIENT_ID", client_id),
                              ("CF_ACCESS_CLIENT_SECRET", client_secret)]:
        body = {
            "query": "mutation ($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
            "variables": {"input": {
                "projectId":     RAILWAY_PROJECT_ID,
                "environmentId": RAILWAY_ENVIRONMENT_ID,
                "serviceId":     RAILWAY_SERVICE_ID,
                "name":          var_name,
                "value":         var_val,
            }},
        }
        req = urllib.request.Request("https://backboard.railway.app/graphql/v2", method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Project-Access-Token", RAILWAY_TOKEN)
        try:
            with urllib.request.urlopen(req, data=json.dumps(body).encode(), timeout=15) as r:
                d = json.loads(r.read())
            ok = d.get("data", {}).get("variableUpsert")
            print(f"  {var_name}: {'OK' if ok else 'FAIL '+json.dumps(d.get('errors'))}")
        except Exception as e:
            print(f"  {var_name}: HTTP error {e}")
else:
    step("Push credentials to Railway")
    print("  ⏭ skipped — client_secret not available (existing token, secret not saved)")

print("\n✅ Done. Railway will auto-redeploy. Once code that sends CF-Access-* headers")
print("   reaches production, Zero Trust will block any other public access to the")
print("   tunnel hostnames.")
