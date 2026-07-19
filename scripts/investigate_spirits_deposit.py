#!/usr/bin/env python3
"""READ-ONLY forensic trace for @spirits_of_the_ancesters 17 TRX -> $100 credit."""
import os, sys, json
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'test')
db = MongoClient(MONGO_URL)[DB_NAME]

def jd(x):
    return json.dumps(x, default=str, indent=2, ensure_ascii=False)

print("=== 1) Find user by username ===")
uname = 'spirits_of_the_ancesters'
# nameOf stores username in 'val'
u = db.nameOf.find_one({'val': uname})
if not u:
    # try case-insensitive / partial
    import re
    u = db.nameOf.find_one({'val': re.compile('^'+re.escape(uname)+'$', re.I)})
if not u:
    print("Not found in nameOf by exact match. Trying regex contains 'spirits'...")
    for d in db.nameOf.find({'val': re.compile('spirits', re.I)}).limit(10):
        print("  candidate:", d.get('_id'), d.get('val'))
    sys.exit(0)

chatId = str(u['_id'])
print("chatId:", chatId, "username:", u.get('val'))

print("\n=== 2) Wallet ===")
print(jd(db.walletOf.find_one({'_id': chatId})))

print("\n=== 3) transactions (wallet top-ups etc) ===")
txns = list(db.transactions.find({'chatId': chatId}).sort('createdAt', -1).limit(25))
if not txns:
    txns = list(db.transactions.find({'chatId': int(chatId)}).sort('createdAt', -1).limit(25)) if chatId.isdigit() else []
for t in txns:
    print(jd({k: t.get(k) for k in ('_id','type','amount','currency','status','description','createdAt','metadata')}))

print("\n=== 4) cryptoDepositAddresses (forensic) ===")
for d in db.cryptoDepositAddresses.find({'chatId': chatId}).sort('archivedAt', -1).limit(10):
    print(jd(d))

print("\n=== 5) dynopayWebhooks for this user's refs ===")
refs = set()
for d in db.cryptoDepositAddresses.find({'chatId': chatId}):
    refs.add(d.get('_id'))
for t in txns:
    md = t.get('metadata') or {}
    if md.get('ref'): refs.add(md.get('ref'))
print("refs discovered:", refs)
for r in refs:
    for w in db.dynopayWebhooks.find({'refId': r}).sort('receivedAt', 1):
        print(jd(w))

print("\n=== 6) payments collection (CSV val) for this chatId ===")
for p in db.payments.find({'val': {'$regex': chatId}}).limit(15):
    print(p.get('_id'), '->', p.get('val'))
