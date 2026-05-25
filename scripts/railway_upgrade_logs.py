#!/usr/bin/env python3
"""Pull railway logs filtered for plan upgrade errors."""
import os, json, urllib.request, urllib.error
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN=os.environ['RAILWAY_PROJECT_TOKEN']
PID=os.environ['RAILWAY_PROJECT_ID']; EID=os.environ['RAILWAY_ENVIRONMENT_ID']; SID=os.environ['RAILWAY_SERVICE_ID']
H = {"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN}

def gql(q):
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query":q}).encode(), headers=H)
    return json.loads(urllib.request.urlopen(req).read())

# Latest 5 deployments
q1 = f'query {{ deployments(input: {{projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}"}}, first: 5) {{ edges {{ node {{ id status createdAt }} }} }} }}'
dep = gql(q1)
deps = [e['node'] for e in dep['data']['deployments']['edges']]
print("Recent deployments:")
for d in deps: print(f"  {d['id']}  {d['status']}  {d['createdAt']}")

# Pick latest SUCCESS deployment
target = next((d for d in deps if d['status']=='SUCCESS'), deps[0])
print(f"\nUsing deployment: {target['id']}\n")

# Filters to try
filters = [
    'applyPhonePlanUpgrade',
    'phoneTransactions.insertOne failed',
    'Plan Upgrade',
    'Plan upgraded',
    'cpPendingPlan',
    'cpUpgradeData',
    'phone plan',
    'IVR upgrade',
    '[CloudPhone]',
    'upgrade',
]
for f in filters:
    print(f"━━ Filter: {f!r} ━━")
    q = f'query {{ deploymentLogs(deploymentId: "{target["id"]}", limit: 50, filter: "{f}") {{ message timestamp severity }} }}'
    try:
        r = gql(q)
        logs = r.get('data',{}).get('deploymentLogs') or []
        print(f"  ({len(logs)} entries)")
        for l in logs[:25]:
            sev = l.get('severity','?')
            msg = (l.get('message') or '').replace('\n',' ')[:300]
            print(f"    [{sev[:4]}] {l.get('timestamp','')[:19]}  {msg}")
    except Exception as e:
        print(f"  ERROR: {e}")
    print()
