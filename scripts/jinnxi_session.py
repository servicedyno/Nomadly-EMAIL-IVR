#!/usr/bin/env python3
"""Reconstruct jinnXI's session: every message + reply to/from chatId 8280668528."""
import os, requests, re

env = {}
with open('/app/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
H = {'Authorization': f'Bearer {env["API_KEY_RAILWAY"]}', 'Content-Type': 'application/json'}
URL = 'https://backboard.railway.app/graphql/v2'
def gql(q, v=None): return requests.post(URL, json={'query': q, 'variables': v or {}}, headers=H, timeout=60).json()

# Pull last 3 deployments and time-window the latest one
deps = [(e['node']['id'], e['node']['createdAt']) for e in gql('query($p:String!,$s:String!,$e:String!) { deployments(input:{projectId:$p,serviceId:$s,environmentId:$e},first:3) { edges { node { id createdAt } } } }', {'p': env['RAILWAY_PROJECT_ID'], 's': env['RAILWAY_SERVICE_ID'], 'e': env['RAILWAY_ENVIRONMENT_ID']})['data']['deployments']['edges']]

CHAT_ID = '8280668528'
NAME = 'jinnXI'
target_logs = []

# Time window: jinnXI activity centered around 09:14 - 09:30
WINDOWS = [
    ('2026-04-29T09:00:00.000Z', '2026-04-29T10:30:00.000Z', 'jinnXI session window'),
]
q = 'query($d:String!,$l:Int!,$s:DateTime,$e:DateTime) { deploymentLogs(deploymentId:$d,limit:$l,startDate:$s,endDate:$e) { message timestamp severity } }'

for dep_id, created in deps:
    for s, e, _ in WINDOWS:
        if created > e: continue
        r = gql(q, {'d': dep_id, 'l': 5000, 's': s, 'e': e})
        logs = (r.get('data') or {}).get('deploymentLogs', []) or []
        for log in logs:
            msg = log.get('message') or ''
            if CHAT_ID in msg or NAME in msg:
                target_logs.append({**log, '_dep': dep_id[:8]})

# Dedupe
seen = set()
unique = []
for log in target_logs:
    k = (log.get('timestamp'), log.get('message', '')[:200])
    if k in seen: continue
    seen.add(k)
    unique.append(log)
unique.sort(key=lambda x: x.get('timestamp', ''))

print(f"Found {len(unique)} log entries for {NAME} ({CHAT_ID})\n")
print("="*100)
for log in unique:
    ts = (log.get('timestamp') or '')[:23]
    msg = log.get('message') or ''
    # Truncate but show enough context
    print(f"[{ts}] {msg[:500]}")
    print("-" * 100)
