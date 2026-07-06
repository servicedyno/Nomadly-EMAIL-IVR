#!/usr/bin/env python3
"""Fetch recent Railway prod logs and grep for marketplace-related events since fee rollout."""
import os, sys, json, requests, urllib.request
sys.path.insert(0, '/app/scripts')

# Read .env manually
env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

API_KEY = env['API_KEY_RAILWAY']
PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
SERVICE_ID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'
URL = 'https://backboard.railway.app/graphql/v2'

def gql(query, variables=None):
    r = requests.post(URL, json={'query': query, 'variables': variables or {}},
                       headers={'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'},
                       timeout=60)
    j = r.json()
    if 'errors' in j and j['errors']:
        print('GQL errors:', json.dumps(j['errors'], indent=2))
    return j.get('data') or {}

# Latest deployment
data = gql("""
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
    edges { node { id status createdAt } }
  }
}""", {'p': PROJECT_ID, 'e': ENV_ID, 's': SERVICE_ID})
edges = ((data.get('deployments') or {}).get('edges')) or []
success = [e['node'] for e in edges if e['node']['status'] == 'SUCCESS']
target = success[0] if success else edges[0]['node']
print(f'Target deployment: {target["id"][:8]}…  status={target["status"]}  created={target["createdAt"]}\n')

# Logs
data = gql("""
query($d:String!, $limit:Int!, $filter:String!) {
  deploymentLogs(deploymentId:$d, limit:$limit, filter:$filter) {
    timestamp message severity
  }
}""", {'d': target['id'], 'limit': 500, 'filter': 'Marketplace'})
logs = data.get('deploymentLogs') or []
print(f'Fetched {len(logs)} log lines matching "Marketplace"\n')
for l in logs[-200:]:
    print(f'[{l.get("timestamp","")[:19]}] {(l.get("message") or "").strip()[:280]}')
