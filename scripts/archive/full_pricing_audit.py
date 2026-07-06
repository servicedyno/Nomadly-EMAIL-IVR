#!/usr/bin/env python3
"""Find EVERY pricing anomaly across phoneNumbersOf + phoneTransactions."""
import os, json, urllib.request
from datetime import datetime
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

# Plan-price truth table (per js/phone-config.js — must verify)
PLAN_PRICES = {'starter':50,'pro':75,'business':120}
SUB_NUMBER_BASE = 25

# 1) Every phoneNumbersOf number — flag anomalies
print("="*72); print("ALL phoneNumbersOf — anomaly scan"); print("="*72)
anomalies = []
all_docs = list(db.phoneNumbersOf.find({}))
n_nums = 0
for d in all_docs:
    cid = d.get('_id')
    nums = (d.get('val',{}).get('numbers') if isinstance(d.get('val'),dict) else None) or []
    for n in nums:
        if not isinstance(n, dict): continue
        n_nums += 1
        # Skip released / cancelled / grandfathered — mirrors phone-scheduler reconciler
        if n.get('status') and n.get('status') not in ('active','suspended'): continue
        if n.get('grandfathered') is True: continue
        plan = (n.get('plan') or '').lower()
        price = n.get('planPrice')
        is_sub = bool(n.get('isSubNumber'))
        parent = n.get('parentNumber')
        status = n.get('status') or 'active'
        pn = n.get('phoneNumber')
        expected = SUB_NUMBER_BASE if is_sub else PLAN_PRICES.get(plan)
        if expected and price is not None and float(price) != expected:
            anomalies.append({
                'chatId': cid, 'phone': pn, 'plan': plan, 'isSub': is_sub, 'parent': parent,
                'status': status, 'price': price, 'expected': expected,
                'expires': n.get('expiresAt')
            })

print(f"Scanned {n_nums} numbers across {len(all_docs)} chats")
print(f"Pricing anomalies: {len(anomalies)}\n")
for a in anomalies:
    name = (db.nameOf.find_one({'_id':a['chatId']},{'val':1}) or {}).get('val','?')
    exp_d = a.get('expires')
    exp_s = exp_d.strftime('%Y-%m-%d') if isinstance(exp_d, datetime) else str(exp_d)[:10]
    print(f"  ⚠ chat={a['chatId']} @{name:20s} {a['phone']:16s} plan={a['plan']:8s} sub={a['isSub']} status={a['status']:8s} price=${a['price']} expected=${a['expected']} expires={exp_s}")

# 2) Every auto_renew/upgrade transaction across history — flag mismatches
print("\n"+"="*72); print("ALL renewal/upgrade phoneTransactions"); print("="*72)
renewals = list(db.phoneTransactions.find({'action':{'$in':['auto_renew','renew','manual_renew','upgrade']}}).sort('timestamp',1))
print(f"Total renewal-class transactions: {len(renewals)}\n")
for t in renewals:
    plan = (t.get('plan') or t.get('newPlan') or '').lower()
    amount = float(t.get('amount', 0))
    cid = t.get('chatId')
    pn = t.get('phoneNumber')
    # determine if this number is/was a sub
    p_doc = db.phoneNumbersOf.find_one({'_id':cid})
    is_sub = False
    if p_doc:
        nums = p_doc.get('numbers') or []
        for n in nums:
            if isinstance(n,dict) and n.get('phoneNumber') == pn:
                is_sub = bool(n.get('isSubNumber'))
                break
    name = (db.nameOf.find_one({'_id':cid},{'val':1}) or {}).get('val','?')
    expected = SUB_NUMBER_BASE if is_sub else PLAN_PRICES.get(plan)
    flag = ''
    if t.get('action') == 'upgrade':
        # upgrades may have credit, so use chargeAmount semantics
        flag = '(upgrade — credit applies)'
    elif expected and amount != expected and not is_sub:
        flag = f'⚠ MISMATCH (expected ${expected})'
    elif is_sub and amount != SUB_NUMBER_BASE:
        flag = f'⚠ SUB MISMATCH (expected ${SUB_NUMBER_BASE})'
    print(f"  {str(t.get('timestamp'))[:19]}  chat={cid} @{name:18s} {pn:16s} {t.get('action'):14s} plan={plan:8s} sub={is_sub} amount=${amount}  {flag}")

# 3) Numbers that have NO transactions at all (legacy / pre-collection)
print("\n"+"="*72); print("Active numbers with NO phoneTransactions row (legacy)"); print("="*72)
chat_with_txn = set(t.get('chatId') for t in db.phoneTransactions.find({}, {'chatId':1}))
for d in all_docs:
    cid = d.get('_id')
    nums = (d.get('val',{}).get('numbers') if isinstance(d.get('val'),dict) else None) or []
    for n in nums:
        if not isinstance(n,dict) or (n.get('status') and n.get('status') != 'active'):
            continue
        # active number
        if cid not in chat_with_txn:
            name = (db.nameOf.find_one({'_id':cid},{'val':1}) or {}).get('val','?')
            exp = n.get('expiresAt')
            exp_s = exp.strftime('%Y-%m-%d') if isinstance(exp, datetime) else str(exp)[:10]
            print(f"  chat={cid} @{name:20s} {n.get('phoneNumber'):16s} plan={n.get('plan')} price=${n.get('planPrice')} expires={exp_s} purchase={str(n.get('purchaseDate'))[:10]}")
