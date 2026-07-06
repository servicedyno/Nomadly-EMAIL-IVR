#!/usr/bin/env python3
"""Find ALL phone transactions tied to chat 8690991604 — try every field/type combo."""
import os, json, urllib.request
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

CHAT = 8690991604

# Sample one phoneTransactions doc to see field shape
sample = db.phoneTransactions.find_one({})
print(f"[phoneTransactions sample] fields: {sorted((sample or {}).keys())}")
print(f"  sample.chatId={sample.get('chatId') if sample else None} (type={type(sample.get('chatId')).__name__ if sample else 'n/a'})")

# Try various ways to query
print("\n[query attempts for chat 8690991604]")
for q in [{'chatId': str(CHAT)}, {'chatId': CHAT}, {'chatId': float(CHAT)}, {'_id': CHAT}, {'userId': CHAT}, {'userId': str(CHAT)}]:
    try:
        n = db.phoneTransactions.count_documents(q)
        print(f"  query={q} → {n} matches")
    except Exception as e:
        print(f"  query={q} → ERR: {e}")

# Same for cpOrders / cloudPhoneOrders if they exist
print("\n[checking other candidate collections]")
for coll in ['cpOrders', 'cloudPhoneOrders', 'phoneOrdersOf', 'orderOf', 'phoneHistoryOf']:
    if coll in db.list_collection_names():
        try:
            n = db[coll].count_documents({'$or': [{'chatId': CHAT}, {'chatId': str(CHAT)}, {'_id': CHAT}, {'_id': str(CHAT)}]})
            print(f"  {coll}: {n} entries for this chat")
        except Exception as e:
            print(f"  {coll}: err {e}")

# Sample escalation doc to find the message body (the actual complaint text)
print("\n[escalations] full content for chat", CHAT)
for e in db.escalations.find({'chatId': CHAT}).sort([('createdAt', -1)]).limit(5):
    print(f"\n  ─── escalation _id={e.get('_id')} ───")
    print(f"    createdAt: {e.get('createdAt')}")
    print(f"    category : {e.get('category')}")
    print(f"    summary  : {e.get('summary')}")
    print(f"    aiSupportChatId: {e.get('aiSupportChatId')}")
    print(f"    keys: {sorted(e.keys())}")
    if e.get('summary'):
        print(f"    SUMMARY TEXT: {str(e.get('summary'))[:500]}")

# Find the aiSupportChats linked to those escalations
print("\n[aiSupportChats] all rows for chat", CHAT)
for c in db.aiSupportChats.find({'chatId': CHAT}).sort([('createdAt', -1)]).limit(10):
    msgs = c.get('messages') or []
    print(f"\n  ─── chat _id={c.get('_id')} ── createdAt={c.get('createdAt')} resolvedAt={c.get('resolvedAt')} category={c.get('category')}")
    for m in msgs[-6:]:
        role = m.get('role')
        content = (m.get('content') or '')[:300]
        print(f"    {role}: {content}")

# Also try chatId as string
print("\n[aiSupportChats] with string chatId")
for c in db.aiSupportChats.find({'chatId': str(CHAT)}).sort([('createdAt', -1)]).limit(10):
    msgs = c.get('messages') or []
    print(f"\n  ─── chat _id={c.get('_id')} ── createdAt={c.get('createdAt')} resolvedAt={c.get('resolvedAt')} category={c.get('category')}")
    for m in msgs[-6:]:
        role = m.get('role')
        content = (m.get('content') or '')[:300]
        print(f"    {role}: {content}")
