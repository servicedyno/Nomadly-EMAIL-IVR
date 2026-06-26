#!/usr/bin/env python3
import os, json
from pymongo import MongoClient

env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

client = MongoClient(env['MONGO_URL'], serverSelectionTimeoutMS=15000)
db = client[env.get('DB_NAME','test')]
CHAT = '404562920'

def show(label, doc):
    print(f"\n===== {label} =====")
    print(json.dumps(doc, indent=2, default=str))

cols = db.list_collection_names()
print("ALL COLLECTIONS:")
print(sorted(cols))

# Focused candidate collections
targets = [c for c in cols if any(k in c.lower() for k in ['vps','rdp','order','instance','deposit','txn','transaction','invoice','azure','windows','log','history','payment'])]
print("\nTARGET COLLECTIONS:", sorted(targets))

for c in sorted(targets):
    coll = db[c]
    docs = list(coll.find({'_id': CHAT}).limit(5))
    if not docs: docs = list(coll.find({'chatId': CHAT}).limit(10))
    if not docs:
        try: docs = list(coll.find({'chatId': int(CHAT)}).limit(10))
        except: docs = []
    # also try fields like userId, ownerChatId
    if not docs:
        for fld in ['userId','ownerChatId','telegramId','owner']:
            docs = list(coll.find({fld: CHAT}).limit(10))
            if docs: break
    if docs:
        show(f"{c} ({len(docs)})", docs)

client.close()
print("\nDONE")
