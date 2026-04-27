#!/usr/bin/env python3
"""Pull Scoreboard44 history across wider time window to check prior setting activity."""
import json, requests, re
from pathlib import Path

env = {}
for line in Path('/app/.env').read_text().splitlines():
    m = re.match(r'^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$', line)
    if m: env[m.group(1)] = m.group(2)

API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = env.get("API_KEY_RAILWAY")
ENVIRONMENT_ID = env.get("RAILWAY_ENVIRONMENT_ID")
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    return requests.post(API_URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60).json()

# Try introspection to find pagination/time filter
introspect = """{__type(name:"Query"){fields{name args{name type{name kind ofType{name kind}}}}}}"""
r = gql(introspect)
q_fields = (r.get("data") or {}).get("__type", {}).get("fields", [])
env_log_field = [f for f in q_fields if f["name"] == "environmentLogs"]
print("environmentLogs fields:")
for f in env_log_field:
    for a in f["args"]:
        t = a["type"]
        print(f"  arg: {a['name']}  type: {t}")

# Also look at deployment logs fields
dep_log_field = [f for f in q_fields if f["name"] == "deploymentLogs"]
print("\ndeploymentLogs fields:")
for f in dep_log_field:
    for a in f["args"]:
        print(f"  arg: {a['name']}  type: {a['type']}")
