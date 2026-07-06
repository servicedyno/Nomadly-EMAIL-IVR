#!/usr/bin/env python3
"""Investigate @kathyserious AU number purchase failure."""
import os, json, urllib.request
from datetime import datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN=os.environ['RAILWAY_PROJECT_TOKEN']
PID=os.environ['RAILWAY_PROJECT_ID']; EID=os.environ['RAILWAY_ENVIRONMENT_ID']; SID=os.environ['RAILWAY_SERVICE_ID']
H={"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN}
def gql(q):
    r=urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query":q}).encode(), headers=H)
    return json.loads(urllib.request.urlopen(r).read())

body=json.dumps({"query":f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req=urllib.request.Request("https://backboard.railway.app/graphql/v2",data=body,headers=H)
v=json.loads(urllib.request.urlopen(req).read())['data']['variables']
from pymongo import MongoClient
db=MongoClient(v['MONGO_URL'])[v.get('DB_NAME') or 'test']

# 1) Find @kathyserious
print("="*72); print("Finding @kathyserious"); print("="*72)
matches = list(db.nameOf.find({'val': {'$regex': 'kathyserious', '$options':'i'}}))
print(f"Matches in nameOf: {len(matches)}")
for m in matches:
    cid = m.get('_id'); name = m.get('val')
    print(f"  chat={cid}  @{name}")

if not matches:
    print("No exact match — broader search")
    for m in db.nameOf.find({'val': {'$regex': 'kathy', '$options':'i'}}):
        print(f"  chat={m.get('_id')}  @{m.get('val')}")

# Pick first match
cid = matches[0]['_id'] if matches else None
if not cid:
    print("Cannot proceed without chatId")
    raise SystemExit(1)

print(f"\n[+] Using chatId={cid}")

# 2) Their state / phone numbers / wallet / pending orders
print("\n"+"="*72); print(f"DATA for chat={cid}"); print("="*72)
state = db.stateOf.find_one({'_id':cid}) or {}
print(f"stateOf keys: {list(state.keys())[:20]}")
if 'val' in state:
    sv = state['val']
    if isinstance(sv, dict):
        # Print interesting state fields
        for k in sorted(sv.keys()):
            v_str = json.dumps(sv[k], default=str)[:200] if not isinstance(sv[k], str) else sv[k][:200]
            if any(kw in k.lower() for kw in ['phone','cp','order','pending','address','country','plan','sip','ivr','cart','buy','purchase']):
                print(f"  {k} = {v_str}")

phones = db.phoneNumbersOf.find_one({'_id':cid})
print(f"\nphoneNumbersOf: {len(phones.get('val',{}).get('numbers',[])) if phones else 0} numbers")
if phones:
    for n in (phones.get('val',{}).get('numbers') or []):
        if isinstance(n,dict):
            print(f"  {n.get('phoneNumber')} status={n.get('status')} plan={n.get('plan')} country={n.get('country')}")

wallet = db.walletOf.find_one({'_id':cid}) or {}
usd = (wallet.get('usdIn',0) or 0) - (wallet.get('usdOut',0) or 0)
ngn = (wallet.get('ngnIn',0) or 0) - (wallet.get('ngnOut',0) or 0)
print(f"\nWallet: ${usd:.2f} USD | ₦{ngn:.0f}")

# Check pending purchase docs
print("\nLooking for pending Cloud IVR purchase docs...")
for coll_name in db.list_collection_names():
    if any(kw in coll_name.lower() for kw in ['pending','order','cart','purchase','address','regulat']):
        try:
            n = db[coll_name].count_documents({'$or':[{'chatId':str(cid)},{'_id':str(cid)},{'_id':cid}]})
            if n > 0:
                docs = list(db[coll_name].find({'$or':[{'chatId':str(cid)},{'_id':str(cid)},{'_id':cid}]}).limit(5))
                for d in docs:
                    print(f"\n  [{coll_name}] _id={d.get('_id')}")
                    print(f"    {json.dumps({k:str(v)[:300] for k,v in d.items() if k!='_id'}, default=str)[:800]}")
        except: pass

# Recent AI support chats from this user
print("\n"+"="*72); print(f"AI support conversation for {cid}"); print("="*72)
convo = list(db.aiSupportChats.find({'chatId':str(cid)},{'role':1,'content':1,'createdAt':1,'_id':0}).sort('createdAt',1))
print(f"Total messages: {len(convo)}")
for m in convo:
    ts = m['createdAt'].strftime('%Y-%m-%d %H:%M') if isinstance(m['createdAt'],datetime) else str(m['createdAt'])
    role = m.get('role','?')
    txt = (m.get('content') or '').replace('\n',' ').strip()[:400]
    print(f"  {ts} [{role:9s}] {txt}")

# 3) Railway logs for this chatId
print("\n"+"="*72); print(f"RAILWAY LOGS for chat {cid}"); print("="*72)
q1 = f'query {{ deployments(input: {{projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}"}}, first: 5) {{ edges {{ node {{ id status createdAt }} }} }} }}'
deps = gql(q1)['data']['deployments']['edges']
dep_id = next(e['node']['id'] for e in deps if e['node']['status']=='SUCCESS')
print(f"Using deployment: {dep_id}")

# Search by chatId
q = f'query {{ deploymentLogs(deploymentId: "{dep_id}", limit: 500, filter: "{cid}") {{ message timestamp severity }} }}'
r = gql(q)
logs = r.get('data',{}).get('deploymentLogs') or []
print(f"\nFound {len(logs)} log lines mentioning {cid}")
for l in logs[:200]:
    msg = (l.get('message') or '').replace('\n',' ').strip()[:380]
    print(f"  {l.get('timestamp','')[:19]} [{(l.get('severity') or '?')[:4]}] {msg}")
