#!/usr/bin/env python3
"""Cloud IVR plan-upgrade focused deep dive."""
import os, json, urllib.request
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

PLAN_PRICES = {'starter': 50, 'pro': 75, 'business': 120}

# 1) Inspect all phoneNumbersOf for plan integrity issues
print("="*70)
print("phoneNumbersOf — full inspection")
print("="*70)
docs = list(db.phoneNumbersOf.find({}))
issues_found = []
for d in docs:
    cid = d.get('_id')
    nums = d.get('numbers') or (d.get('val',{}).get('numbers') if isinstance(d.get('val'),dict) else None) or []
    if not nums: continue
    name = (db.nameOf.find_one({'_id':cid},{'val':1}) or {}).get('val','?')
    print(f"\nchat={cid} ({name}) → {len(nums)} number(s)")
    for n in nums:
        if not isinstance(n, dict): continue
        plan = n.get('plan'); price = n.get('planPrice')
        pn = n.get('phoneNumber')
        purchase = n.get('purchaseDate'); expires = n.get('expiresAt'); status = n.get('status')
        upgrade_pending = n.get('upgradePending') or n.get('pendingPlan') or n.get('pendingPlanChange')
        ext = n.get('externalNumber') or n.get('isExternal')
        print(f"  {pn:18s}  plan={plan:10s}  price=${price}  status={status or 'active'}  type={n.get('type')}  ext={ext}  purchase={str(purchase)[:10]}  expires={str(expires)[:10]}")
        if upgrade_pending:
            print(f"      ⚠️ upgradePending: {upgrade_pending}")
            issues_found.append((cid, pn, 'pending', upgrade_pending))
        expected = PLAN_PRICES.get((plan or '').lower())
        if expected and price and float(price) not in (expected, expected/5, expected*1.0):
            # if price doesn't match standard, flag it (but might be valid if extra-number)
            print(f"      ⚠️ price mismatch: plan={plan} → expected ${expected} but got ${price}")
            issues_found.append((cid, pn, 'price_mismatch', f'{plan}=${price} vs ${expected}'))

print(f"\nTotal price/pending issues found: {len(issues_found)}")
for x in issues_found: print(f"  → {x}")

# 2) phoneTransactions — recent upgrades/changes
print()
print("="*70)
print("phoneTransactions — ALL (latest first)")
print("="*70)
txns = list(db.phoneTransactions.find({}).sort('_id',-1).limit(30))
print(f"Total in collection: {db.phoneTransactions.count_documents({})}")
for t in txns:
    s = json.dumps({k:str(v)[:100] for k,v in t.items() if k != '_id'}, default=str)[:600]
    print(f"  • _id={t.get('_id')}: {s}")

# 3) escalations collection
print()
print("="*70)
print("escalations collection")
print("="*70)
n_esc = db.escalations.count_documents({})
print(f"Total escalations: {n_esc}")
escs = list(db.escalations.find({}).sort('_id',-1).limit(30))
for e in escs:
    cid = e.get('chatId')
    name = (db.nameOf.find_one({'_id':cid},{'val':1}) or {}).get('val','?')
    s = json.dumps({k:str(v)[:300] for k,v in e.items() if k != '_id'}, default=str)
    print(f"\n• chat={cid} ({name})")
    print(f"  {s[:800]}")

# 4) supportSessions — see who was escalated to human
print()
print("="*70)
print("supportSessions — recent (active)")
print("="*70)
since = datetime.now(timezone.utc) - timedelta(days=30)
sess = list(db.supportSessions.find({}).limit(120))
# supportSessions stored as { _id: chatId, val: timestamp }
active_recent = []
for s in sess:
    val = s.get('val')
    if isinstance(val,(int,float)) and val > 0:
        ts = datetime.fromtimestamp(val/1000, tz=timezone.utc)
        if ts > since:
            active_recent.append((s.get('_id'), ts))
active_recent.sort(key=lambda x: x[1], reverse=True)
print(f"Active (last 30d): {len(active_recent)}")
for cid, ts in active_recent[:20]:
    name = (db.nameOf.find_one({'_id':cid},{'val':1}) or {}).get('val','?')
    # check phoneNumbersOf for this user
    phone_doc = db.phoneNumbersOf.find_one({'_id':cid})
    plan_summary = ''
    if phone_doc:
        nums = phone_doc.get('numbers') or []
        if nums and isinstance(nums[0], dict):
            plan_summary = ' | '.join(f"{n.get('phoneNumber')}={n.get('plan')}/${n.get('planPrice')}" for n in nums[:3] if isinstance(n,dict))
    print(f"  • {ts.strftime('%Y-%m-%d %H:%M')} chat={cid} ({name})  numbers: {plan_summary}")

# 5) transactions (general) — search for plan upgrade related
print()
print("="*70)
print("transactions — plan/upgrade related")
print("="*70)
matches = list(db.transactions.find({'$or':[
    {'type':{'$regex':'plan|upgrad|renew|change','$options':'i'}},
    {'description':{'$regex':'plan|upgrad|renew|change|ivr|pro|business|starter','$options':'i'}},
    {'reason':{'$regex':'plan|upgrad|renew|change','$options':'i'}},
]}).sort('_id',-1).limit(40))
print(f"Matched: {len(matches)}")
for t in matches:
    s = json.dumps({k:str(v)[:120] for k,v in t.items() if k != '_id'}, default=str)
    print(f"  • _id={t.get('_id')}: {s[:500]}")
