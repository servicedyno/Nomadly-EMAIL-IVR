#!/usr/bin/env python3
"""
Set Azure + OS-aware provider routing env vars on the Nomadly-EMAIL-IVR
production service.

Pushes:
  - AZURE_TENANT_ID
  - AZURE_CLIENT_ID
  - AZURE_CLIENT_SECRET
  - AZURE_SUBSCRIPTION_ID
  - AZURE_RESOURCE_GROUP=nomadly-vps
  - AZURE_DEFAULT_LOCATION=eastus
  - VPS_DEFAULT_PROVIDER=digitalocean    (Linux/VPS purchases route to DO)
  - VPS_RDP_PROVIDER=azure               (Windows/RDP purchases route to Azure)

Reads all values from /app/backend/.env (dev pod env). Idempotent via
Railway's `variableUpsert` mutation. DOES NOT redeploy — Railway picks up
the new vars on the next deploy / service restart.
"""
import json, os, sys, urllib.request, urllib.error

TOKEN      = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV_ID     = "889fd56a-720a-4020-884c-034784992666"  # production environment
# The Telegram bot runs on Nomadly-EMAIL-IVR (user-confirmed 2026-06-24).
# Do NOT push to HostingBotNew / LockbayNewFIX — those are unrelated services.
SERVICE_TARGETS = [
    ("Nomadly-EMAIL-IVR", "b9c4ad64-7667-4dd3-8b9a-3867ede47885"),
]
ENDPOINT   = "https://backboard.railway.app/graphql/v2"

# Pull current Azure creds from /app/backend/.env so we don't risk a typo
def load_dotenv(path):
    vars_ = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            vars_[k] = v
    return vars_

env = load_dotenv("/app/backend/.env")

VARS_TO_SET = {
    "AZURE_TENANT_ID":         env.get("AZURE_TENANT_ID"),
    "AZURE_CLIENT_ID":         env.get("AZURE_CLIENT_ID"),
    "AZURE_CLIENT_SECRET":     env.get("AZURE_CLIENT_SECRET"),
    "AZURE_SUBSCRIPTION_ID":   env.get("AZURE_SUBSCRIPTION_ID"),
    "AZURE_RESOURCE_GROUP":    env.get("AZURE_RESOURCE_GROUP", "nomadly-vps"),
    "AZURE_DEFAULT_LOCATION":  env.get("AZURE_DEFAULT_LOCATION", "eastus"),
    "VPS_DEFAULT_PROVIDER":    "digitalocean",
    "VPS_RDP_PROVIDER":        "azure",
}

# Sanity check
for k, v in VARS_TO_SET.items():
    if not v:
        print(f"❌ Missing value for {k} in /app/backend/.env — aborting")
        sys.exit(1)

UPSERT_MUTATION = """
mutation Upsert($input: VariableUpsertInput!) {
  variableUpsert(input: $input)
}
"""

def gql(query, variables):
    body = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Project-Access-Token": TOKEN,
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "body": e.read().decode(errors="ignore")}

print("─── Pushing Azure + OS-aware routing to Railway prod ───")
for service_name, service_id in SERVICE_TARGETS:
    print(f"\n──── Service: {service_name} ────")
    for name, value in VARS_TO_SET.items():
        r = gql(UPSERT_MUTATION, {"input": {
            "projectId":     PROJECT_ID,
            "environmentId": ENV_ID,
            "serviceId":     service_id,
            "name":          name,
            "value":         value,
        }})
        if "errors" in r:
            print(f"  ❌ {name}: {r['errors']}")
            sys.exit(1)
        elif "http_error" in r:
            print(f"  ❌ {name}: HTTP {r['http_error']}: {r['body'][:200]}")
            sys.exit(1)
        else:
            # Mask secret-looking values
            masked = value if name in ("VPS_DEFAULT_PROVIDER", "VPS_RDP_PROVIDER",
                                       "AZURE_RESOURCE_GROUP", "AZURE_DEFAULT_LOCATION") \
                           else (value[:6] + "…" + value[-4:])
            print(f"  ✅ {name} = {masked}")

# Verify by reading back from each service
print("\n─── Verification: reading back via variables query ───")
READ_QUERY = """
query Vars($projectId:String!,$environmentId:String!,$serviceId:String) {
  variables(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId)
}
"""
all_ok = True
for service_name, service_id in SERVICE_TARGETS:
    print(f"\n──── {service_name} ────")
    r = gql(READ_QUERY, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": service_id})
    vars_now = r.get("data", {}).get("variables", {})
    for name, expected in VARS_TO_SET.items():
        v = vars_now.get(name)
        if v == expected:
            masked = v if name in ("VPS_DEFAULT_PROVIDER", "VPS_RDP_PROVIDER",
                                   "AZURE_RESOURCE_GROUP", "AZURE_DEFAULT_LOCATION") \
                       else (v[:6] + "…" + v[-4:])
            print(f"  ✅ {name} = {masked}")
        else:
            print(f"  ❌ {name} mismatch (got {v!r}, expected {expected!r})")
            all_ok = False

if not all_ok:
    sys.exit(1)
print("\n✅ All Railway prod vars set on both services. Service will pick them up on next deploy/restart.")
