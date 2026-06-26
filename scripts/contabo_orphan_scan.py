#!/usr/bin/env python3
"""How many vpsPlansOf records are Contabo, and how many exist on the CURRENT account?"""
import json, urllib.request, urllib.parse, uuid, re
from pymongo import MongoClient

env={}
with open('/app/backend/.env') as f:
    for line in f:
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")

# Contabo token
AUTH='https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
data=urllib.parse.urlencode({'client_id':env['CONTABO_CLIENT_ID'],'client_secret':env['CONTABO_CLIENT_SECRET'],
    'username':env['CONTABO_API_USER'],'password':env['CONTABO_API_PASSWORD'],'grant_type':'password'}).encode()
token=json.loads(urllib.request.urlopen(urllib.request.Request(AUTH,data=data,
    headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=20).read())['access_token']

def api(path,params=None):
    url='https://api.contabo.com/v1'+path
    if params: url+='?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={'Authorization':f'Bearer {token}','x-request-id':str(uuid.uuid4())})
    try: return json.loads(urllib.request.urlopen(req,timeout=30).read())
    except urllib.error.HTTPError as e: return {'_http':e.code}

# Current account instance IDs
cur=set()
res=api('/compute/instances',{'size':200,'page':1})
for i in res.get('data',[]):
    cur.add(str(i.get('instanceId')))
print("CURRENT account (hosting@dyno.pt) instance IDs:", sorted(cur))

client=MongoClient(env['MONGO_URL'],serverSelectionTimeoutMS=15000)
db=client[env.get('DB_NAME','test')]
recs=list(db.vpsPlansOf.find({}))
print(f"\nTotal vpsPlansOf records: {len(recs)}")

def detect(rec):
    p=(rec.get('provider') or '').lower()
    if p in ('ovh','contabo','vultr','digitalocean','azure'): return p
    cid=rec.get('contaboInstanceId')
    if rec.get('_ovhServiceName'): return 'ovh'
    if cid is None: return 'unknown'
    s=str(cid)
    if s.startswith('vps-'): return 'ovh'
    if re.match(r'^az-',s,re.I): return 'azure'
    if re.match(r'^do-',s,re.I): return 'digitalocean'
    if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',s,re.I): return 'vultr'
    if re.match(r'^\d+$',s): return 'contabo'
    return 'unknown'

from collections import Counter
by_prov=Counter()
contabo_recs=[]
for r in recs:
    pr=detect(r); by_prov[pr]+=1
    if pr=='contabo': contabo_recs.append(r)
print("By provider:", dict(by_prov))

# For contabo records, which exist on current account?
orphan=[]; present=[]
for r in contabo_recs:
    iid=str(r.get('contaboInstanceId'))
    status=r.get('status')
    if iid in cur: present.append((iid,r.get('chatId'),status))
    else: orphan.append((iid,r.get('chatId'),status,str(r.get('start_time'))[:10]))

print(f"\nContabo records: {len(contabo_recs)}")
print(f"  -> PRESENT on current account: {len(present)}")
for x in present: print("     present", x)
print(f"  -> ORPHANED (404 on current account / on OLD account): {len(orphan)}")
for x in sorted(orphan, key=lambda t:t[3], reverse=True)[:40]:
    print("     orphan ", x)

client.close()
print("\nDONE")
