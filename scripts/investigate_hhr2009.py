"""Investigate HHR2009 (1960615421) — find domain, anti-red state, post-WHM coverage gap."""
import os, json
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME', 'test')]
CHAT_ID = '1960615421'

print('=' * 70)
print(f'USER LOOKUP — chatId {CHAT_ID} (HHR2009)')
print('=' * 70)

# Quick user profile
for coll in ['nameOf', 'usernameOf', 'walletOf', 'langOf', 'planOf', 'planEndingTime']:
    if coll in db.list_collection_names():
        doc = db[coll].find_one({'_id': CHAT_ID}) or db[coll].find_one({'_id': int(CHAT_ID)})
        if doc:
            print(f'  {coll}: {json.dumps(doc, default=str)}')

# Find domains owned
print('\n' + '=' * 70)
print('HOSTING PLANS / DOMAINS OWNED')
print('=' * 70)
for coll in ['hostingPlansOf', 'hostingOf', 'cpanelOf', 'cpanelAccountsOf', 'cPanelAccountsOf', 'cpanelDomainOf']:
    if coll in db.list_collection_names():
        docs = list(db[coll].find({'$or': [{'_id': CHAT_ID}, {'_id': int(CHAT_ID)}, {'chatId': CHAT_ID}, {'chatId': int(CHAT_ID)}]}))
        if docs:
            print(f'\n--- {coll} ---')
            for d in docs:
                print(json.dumps(d, default=str, indent=2)[:2500])

# Cpanel accounts owned by chatId
print('\n' + '=' * 70)
print('CPANEL ACCOUNTS — cpanelAccountsOf scan for HHR2009')
print('=' * 70)
for coll in ['cpanelAccountsOf', 'cPanelAccountsOf', 'cpanelOf']:
    if coll in db.list_collection_names():
        docs = list(db[coll].find({'chatId': CHAT_ID}).limit(20))
        docs += list(db[coll].find({'chatId': int(CHAT_ID)}).limit(20))
        for d in docs:
            print(f'  {coll}: {json.dumps(d, default=str)[:600]}')

# domainsOf
print('\n' + '=' * 70)
print('DOMAINS OWNED — domainsOf / nameserversOf')
print('=' * 70)
for coll in ['domainsOf', 'nameserversOf', 'cpaneldomainsOf', 'cpanelDomainsOf']:
    if coll in db.list_collection_names():
        for k in [CHAT_ID, int(CHAT_ID)]:
            d = db[coll].find_one({'_id': k})
            if d:
                print(f'  {coll}[{k}]: {json.dumps(d, default=str)[:1500]}')

# Recent purchases for this user
print('\n' + '=' * 70)
print('RECENT ORDERS / TRANSACTIONS (last 48h)')
print('=' * 70)
from datetime import timedelta
cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
for coll in ['orders', 'transactions', 'walletTransactions', 'paymentsOf', 'transactionHistoryOf']:
    if coll in db.list_collection_names():
        # try both string and int chatId, and ts/createdAt
        docs = list(db[coll].find({'chatId': CHAT_ID}).sort([('ts', -1), ('createdAt', -1), ('_id', -1)]).limit(10))
        if not docs:
            docs = list(db[coll].find({'chatId': int(CHAT_ID)}).sort([('ts', -1), ('createdAt', -1), ('_id', -1)]).limit(10))
        for d in docs:
            print(f'  {coll}: {json.dumps(d, default=str)[:600]}')

# AI support log for this user
print('\n' + '=' * 70)
print('AI SUPPORT LOG (for this user, last 5)')
print('=' * 70)
if 'aiSupportLog' in db.list_collection_names():
    docs = list(db.aiSupportLog.find({'chatId': CHAT_ID}).sort('ts', -1).limit(10))
    docs += list(db.aiSupportLog.find({'chatId': int(CHAT_ID)}).sort('ts', -1).limit(10))
    for d in docs:
        print(f'  {json.dumps(d, default=str)[:700]}')

# Escalation lookup
print('\n' + '=' * 70)
print('SUPPORT ESCALATIONS — ref ZUltP')
print('=' * 70)
for coll in ['supportEscalations', 'escalations', 'supportSessionsOf', 'supportSessions']:
    if coll in db.list_collection_names():
        for q in [{'id': 'ZUltP'}, {'ref': 'ZUltP'}, {'chatId': CHAT_ID}, {'chatId': int(CHAT_ID)}]:
            docs = list(db[coll].find(q).limit(5))
            for d in docs:
                print(f'  {coll}: {json.dumps(d, default=str)[:600]}')
