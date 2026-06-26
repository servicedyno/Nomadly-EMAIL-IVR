#!/usr/bin/env python3
"""Fetch Railway production logs for chatId 404562920 + check userErrors collection."""
import os, json, urllib.request
from pymongo import MongoClient

env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

CHAT = '404562920'

# ---------- 1. userErrors + recent vps/digital orders from Mongo ----------
client = MongoClient(env['MONGO_URL'], serverSelectionTimeoutMS=15000)
db = client[env.get('DB_NAME','test')]

def show(label, docs):
    print(f"\n===== {label} =====")
    print(json.dumps(docs, indent=2, default=str))

for cname, q in [
    ('userErrors', {'chatId': CHAT}),
    ('userErrors', {'_id': CHAT}),
    ('vpsTransactions', {'chatId': CHAT}),
    ('digitalOrders', {'chatId': CHAT}),
    ('paymentIntents', {'chatId': CHAT}),
    ('escalations', {'chatId': CHAT}),
    ('walletLedger', {'chatId': CHAT}),
]:
    try:
        docs = list(db[cname].find(q).sort([('_id',-1)]).limit(8))
        if docs: show(f"{cname} {q}", docs)
    except Exception as e:
        print(f"{cname} err: {e}")

client.close()

# ---------- 2. Railway GraphQL logs ----------
RAIL = "https://backboard.railway.app/graphql/v2"
TOKEN = env.get('RAILWAY_PROJECT_TOKEN')
APIKEY = env.get('API_KEY_RAILWAY')
PID = env['RAILWAY_PROJECT_ID']; EID = env['RAILWAY_ENVIRONMENT_ID']; SID = env['RAILWAY_SERVICE_ID']

def gql(query, use_project_token=True):
    headers = {"Content-Type": "application/json"}
    if use_project_token and TOKEN:
        headers["Project-Access-Token"] = TOKEN
    else:
        headers["Authorization"] = f"Bearer {APIKEY}"
    req = urllib.request.Request(RAIL, data=json.dumps({"query": query}).encode(), headers=headers)
    try:
        return json.loads(urllib.request.urlopen(req, timeout=40).read())
    except urllib.error.HTTPError as e:
        return {"_httperror": e.code, "_body": e.read().decode()[:500]}
    except Exception as e:
        return {"_error": str(e)}

# get latest deployments
q_dep = 'query { deployments(input: {projectId: "%s", environmentId: "%s", serviceId: "%s"}, first: 3) { edges { node { id status createdAt } } } }' % (PID, EID, SID)
print("\n########## RAILWAY: latest deployments ##########")
res = gql(q_dep, use_project_token=bool(TOKEN))
print(json.dumps(res, indent=2)[:1500])

# pick first deployment id
dep_id = None
try:
    dep_id = res['data']['deployments']['edges'][0]['node']['id']
except Exception:
    pass

if not dep_id and 'data' not in res:
    # retry with Bearer
    print("\nRetry deployments with Bearer API key...")
    res = gql(q_dep, use_project_token=False)
    print(json.dumps(res, indent=2)[:1500])
    try: dep_id = res['data']['deployments']['edges'][0]['node']['id']
    except Exception: pass

print("\nDEPLOY_ID:", dep_id)

if dep_id:
    for filt in ['404562920']:
        q_logs = 'query { deploymentLogs(deploymentId: "%s", limit: 400, filter: "%s") { message timestamp severity } }' % (dep_id, filt)
        print(f"\n########## RAILWAY LOGS filter='{filt}' ##########")
        r = gql(q_logs, use_project_token=bool(TOKEN))
        if 'data' in r and r['data'].get('deploymentLogs') is not None:
            logs = r['data']['deploymentLogs']
            print(f"({len(logs)} lines)")
            for l in logs:
                print(l['timestamp'], l['severity'], l['message'][:300])
        else:
            print(json.dumps(r, indent=2)[:1500])
print("\nDONE")
