#!/usr/bin/env python3
"""Detailed: where does @kathyserious stand after the AU number address-failure incident?"""
import os, json, urllib.request, sys
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN = os.environ['RAILWAY_PROJECT_TOKEN']
PID = os.environ['RAILWAY_PROJECT_ID']
EID = os.environ['RAILWAY_ENVIRONMENT_ID']
SID = os.environ['RAILWAY_SERVICE_ID']
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Project-Access-Token": TOKEN}

body = json.dumps({"query": f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=body, headers=H)
v = json.loads(urllib.request.urlopen(req).read())['data']['variables']

from pymongo import MongoClient
db = MongoClient(v['MONGO_URL'])[v.get('DB_NAME') or 'test']

print("=" * 72)
print("  Forensic: searching for any chat with username 'kathyserious'")
print("=" * 72)

# Try nameOf collection
for doc in db.nameOf.find({'val': {'$regex': 'kathy', '$options': 'i'}}):
    print(f"  nameOf: chat={doc.get('_id')}  username=@{doc.get('val')}")

# Also try usernameOf
if 'usernameOf' in db.list_collection_names():
    for doc in db.usernameOf.find({'val': {'$regex': 'kathy', '$options': 'i'}}):
        print(f"  usernameOf: chat={doc.get('_id')}  username=@{doc.get('val')}")

# All collections that may store username
for c in ['userInfoOf', 'profile', 'profileOf']:
    if c in db.list_collection_names():
        for doc in db[c].find({}, limit=0):
            v_ = doc.get('val', {})
            if isinstance(v_, dict):
                u = (v_.get('username') or v_.get('userName') or '').lower()
                if 'kathy' in u:
                    print(f"  {c}: chat={doc.get('_id')}  username=@{u}")

print("\n" + "=" * 72)
CHAT = 8690991604
print(f"  Forensic deep-dive on chat={CHAT}")
print("=" * 72)

# 1) ALL state fields (full dump)
state = db.stateOf.find_one({'_id': CHAT}) or {}
print(f"\n[stateOf] all keys: {sorted((state.get('val') or {}).keys())}")
sv = state.get('val', {}) or {}
for k, v_ in sv.items():
    val_s = str(v_)[:200] if not isinstance(v_, (dict, list)) else json.dumps(v_, default=str)[:200]
    print(f"    {k} = {val_s}")

# 2) Wallet history
print("\n[walletOf]")
w = db.walletOf.find_one({'_id': CHAT}) or db.walletOf.find_one({'_id': str(CHAT)}) or {}
print(f"  usdIn={w.get('usdIn')} usdOut={w.get('usdOut')}  balance=${(w.get('usdIn',0) or 0) - (w.get('usdOut',0) or 0):.2f}")
print(f"  ngnIn={w.get('ngnIn')} ngnOut={w.get('ngnOut')}")

# 3) ALL phoneTransactions — both string and int chatId
print("\n[phoneTransactions] entries for this chat (last 30, newest first)")
all_txs = []
for q in [{'chatId': str(CHAT)}, {'chatId': CHAT}]:
    for t in db.phoneTransactions.find(q):
        all_txs.append(t)
all_txs.sort(key=lambda t: t.get('createdAt') or t.get('_id'), reverse=True)
for t in all_txs[:30]:
    ts = t.get('createdAt') or t.get('_id')
    print(f"  {ts} | action={t.get('action')} | $${t.get('amount')} | num={t.get('phoneNumber','-')} | reason={t.get('_backfillReason') or t.get('note') or t.get('reason') or ''}")

# 4) Look for AU-related logs in any collection that might capture purchase/order trail
print("\n[searching all collections for AU-related activity for this chat]")
for coll_name in db.list_collection_names():
    if any(kw in coll_name.lower() for kw in ['order', 'cart', 'purchase', 'pending', 'address', 'regulat', 'history', 'event', 'audit', 'log']):
        try:
            for d in db[coll_name].find({'$or': [{'chatId': str(CHAT)}, {'chatId': CHAT}, {'_id': CHAT}, {'_id': str(CHAT)}]}).limit(3):
                blob = json.dumps({k: str(d.get(k))[:150] for k in d.keys() if k != '_id'}, default=str)[:400]
                if 'AU' in blob or 'australia' in blob.lower() or '+61' in blob:
                    print(f"  [{coll_name}] AU-related: {blob}")
        except: pass

# 5) Suspension events
print("\n[suspensionEvents] for this chat")
for s in db.suspensionEvents.find({'chatId': CHAT}).sort('detectedAt', -1).limit(10):
    print(f"  {s.get('detectedAt')} | {s.get('phoneNumber')} | provider={s.get('provider')} | status={s.get('status')} | resolved={s.get('resolved')}")

# 6) AI Support chats — any recent complaints
print("\n[aiSupportChats] last 5 sessions")
chats = list(db.aiSupportChats.find({'chatId': CHAT}).sort([('createdAt', -1)]).limit(5)) or \
        list(db.aiSupportChats.find({'chatId': str(CHAT)}).sort([('createdAt', -1)]).limit(5))
for c in chats:
    print(f"  {c.get('createdAt')} | category={c.get('category')} | resolvedAt={c.get('resolvedAt')} | resolvedBy={c.get('resolvedBy')}")

# 7) Escalations
print("\n[escalations] last 5")
escs = list(db.escalations.find({'chatId': CHAT}).sort([('createdAt', -1)]).limit(5)) or \
       list(db.escalations.find({'chatId': str(CHAT)}).sort([('createdAt', -1)]).limit(5))
for e in escs:
    print(f"  {e.get('createdAt')} | category={e.get('category')} | resolvedAt={e.get('resolvedAt')}")
