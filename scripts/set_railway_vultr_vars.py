#!/usr/bin/env python3
"""
Set two Railway env vars on the Nomadly-EMAIL-IVR production service:
  - VULTR_API_KEY            (the key you provided)
  - VPS_DEFAULT_PROVIDER=vultr  (flips every new VPS/RDP to Vultr)

Idempotent via Railway's `variableUpsert` mutation (creates or overwrites).
DOES NOT redeploy automatically — Railway will pick up the new vars on the
next deploy or restart.
"""
import json, sys, urllib.request, urllib.error

TOKEN      = "8a6f6eb8-2ed6-4560-92c0-aab7947820ae"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
ENV_ID     = "889fd56a-720a-4020-884c-034784992666"  # production environment
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"  # Nomadly-EMAIL-IVR
ENDPOINT   = "https://backboard.railway.app/graphql/v2"

VARS_TO_SET = {
    "VULTR_API_KEY":        "J2TXFWSMWH7EW5UJMEUBHJZSG4D5QGBEXZMA",
    "VPS_DEFAULT_PROVIDER": "vultr",
}

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
        return {"http_error": e.code, "body": e.read().decode(errors='ignore')}

for name, value in VARS_TO_SET.items():
    print(f"\n── Setting {name} ──")
    r = gql(UPSERT_MUTATION, {"input": {
        "projectId":     PROJECT_ID,
        "environmentId": ENV_ID,
        "serviceId":     SERVICE_ID,
        "name":          name,
        "value":         value,
    }})
    if "errors" in r:
        print(f"  ❌ ERROR: {r['errors']}")
        sys.exit(1)
    elif "http_error" in r:
        print(f"  ❌ HTTP {r['http_error']}: {r['body'][:300]}")
        sys.exit(1)
    else:
        print(f"  ✅ OK — variable set in production env")

# Verify by reading back
print("\n── Verification: reading back via variables query ──")
READ_QUERY = """
query Vars($projectId:String!,$environmentId:String!,$serviceId:String) {
  variables(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId)
}
"""
r = gql(READ_QUERY, {"projectId": PROJECT_ID, "environmentId": ENV_ID, "serviceId": SERVICE_ID})
vars_now = r.get("data", {}).get("variables", {})
for name in VARS_TO_SET:
    v = vars_now.get(name)
    if v:
        masked = v if name == "VPS_DEFAULT_PROVIDER" else (v[:6] + "…" + v[-4:])
        print(f"  ✅ {name} = {masked}")
    else:
        print(f"  ❌ {name} NOT FOUND in current Railway vars")

print("\nNOTE: Railway will pick up these new vars on the next deploy or service restart.")
