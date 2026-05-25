#!/usr/bin/env python3
"""Deep dive: get ALL aiSupportChats + all related plan-upgrade activity."""
import os, json, urllib.request, re
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN=os.environ['RAILWAY_PROJECT_TOKEN']
PID=os.environ['RAILWAY_PROJECT_ID']; EID=os.environ['RAILWAY_ENVIRONMENT_ID']; SID=os.environ['RAILWAY_SERVICE_ID']
body=json.dumps({"query":f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req=urllib.request.Request("https://backboard.railway.app/graphql/v2",data=body,
   headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN})
v=json.loads(urllib.request.urlopen(req).read())['data']['variables']
from pymongo import MongoClient
db=MongoClient(v['MONGO_URL'])[v.get('DB_NAME') or 'test']
print(f"DB: {v.get('DB_NAME')}")
print(f"All collections: {sorted(db.list_collection_names())[:50]}")
print()

# 1) Full aiSupportChats span
oldest = list(db.aiSupportChats.find({}).sort('createdAt',1).limit(1))
newest = list(db.aiSupportChats.find({}).sort('createdAt',-1).limit(1))
if oldest: print(f"Oldest AI chat: {oldest[0].get('createdAt')}")
if newest: print(f"Newest AI chat: {newest[0].get('createdAt')}")
print()

# 2) Search ALL aiSupportChats for any plan-upgrade / IVR-upgrade related text
upgrade_rx = re.compile(r'\b(upgrad|prorat|change\s+plan|switch\s+plan|renew|expire|expir|business plan|pro plan|starter|differen[ct]|why.*?charge|wrong.*?(price|charge|amount)|cost.*?(more|differ)|credit|discount)\b', re.I)
ivr_rx = re.compile(r'\b(ivr|cloud ?ivr|sip|caller ?id|phone.*?(plan|number)|number.*?(plan|expir|renew))\b', re.I)

all_user = list(db.aiSupportChats.find({'role':'user'},{'chatId':1,'content':1,'createdAt':1,'_id':0}).sort('createdAt',-1))
print(f"Total user messages all-time: {len(all_user)}")

upgrade_msgs = []
for m in all_user:
    txt = m.get('content') or ''
    if upgrade_rx.search(txt) or ivr_rx.search(txt):
        upgrade_msgs.append(m)

print(f"Messages matching upgrade/IVR/plan keywords: {len(upgrade_msgs)}")
print()

# Group by user
by_user = defaultdict(list)
for m in upgrade_msgs: by_user[m['chatId']].append(m)

for cid, msgs in sorted(by_user.items(), key=lambda kv: kv[1][0]['createdAt'], reverse=True):
    name_doc = db.nameOf.find_one({'_id':cid},{'val':1}) or {}
    plan_doc = db.planOf.find_one({'_id':cid}) or {}
    phone_doc = db.phoneNumbersOf.find_one({'_id':cid}) if 'phoneNumbersOf' in db.list_collection_names() else None
    print(f"\n──── chat={cid}  name={name_doc.get('val','?')}  plan={plan_doc.get('plan')}  msgs={len(msgs)}")
    if phone_doc:
        pv = phone_doc.get('val') if isinstance(phone_doc, dict) else None
        if isinstance(pv, dict):
            for pn, info in list(pv.items())[:6]:
                if isinstance(info, dict):
                    et = info.get('endingTime')
                    et_s = et.strftime('%Y-%m-%d') if isinstance(et, datetime) else str(et)[:10]
                    print(f"   📞 {pn}  plan={info.get('plan')}  status={info.get('status')}  end={et_s}")
    # show full conversation
    convo = list(db.aiSupportChats.find({'chatId':cid},{'role':1,'content':1,'createdAt':1,'_id':0}).sort('createdAt',1))
    print(f"   Full convo ({len(convo)} msgs):")
    for m in convo:
        ts = m['createdAt'].strftime('%Y-%m-%d %H:%M') if isinstance(m['createdAt'],datetime) else str(m['createdAt'])
        role = m.get('role','?')
        ctext = (m.get('content') or '').replace('\n',' ').strip()
        print(f"     {ts} [{role:9s}] {ctext[:380]}")

# 3) Look at planChangeOf / planEndingTime / planHistoryOf  / billingOf collections if exist
print()
print("="*70)
print("PLAN-RELATED COLLECTIONS")
print("="*70)
for c in sorted(db.list_collection_names()):
    if any(k in c.lower() for k in ['plan','ivr','phone','sip','upgrad','renew','bill','credit','transact']):
        try: n = db[c].count_documents({})
        except: n = '?'
        print(f"  {c:40s}  count={n}")

# 4) Recent phone plan changes — look at phoneLogs / planHistoryOf
print()
print("="*70)
print("RECENT PHONE PLAN ACTIVITY (phoneLogs or planHistoryOf)")
print("="*70)
for cname in ['planHistoryOf','phonePlanHistory','planChangesOf','phoneLogs','transactionsOf','txnsOf']:
    if cname not in db.list_collection_names(): continue
    print(f"\n[{cname}] sample (latest 8):")
    docs = list(db[cname].find({}).sort('_id',-1).limit(8))
    for d in docs:
        d2 = {k:v for k,v in d.items() if k != '_id'}
        s = json.dumps(d2, default=str)[:400]
        print(f"  • _id={d.get('_id')}: {s}")

# 5) Check phoneNumbersOf for status='upgrade_pending' or planChange
print()
print("="*70)
print("phoneNumbersOf — any pending/issue states")
print("="*70)
sample = list(db.phoneNumbersOf.find({}).limit(50))
print(f"sample {len(sample)} docs (showing first 5):")
for d in sample[:5]:
    print(f"  _id={d.get('_id')}: keys={list(d.keys())}")
    val = d.get('val')
    if isinstance(val, dict):
        for k, info in list(val.items())[:3]:
            print(f"      {k}: {json.dumps(info, default=str)[:300]}")
