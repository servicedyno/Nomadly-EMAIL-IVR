#!/usr/bin/env python3
"""READ-ONLY investigation of @davion419 (chatId 404562920) VPS/RDP purchase failure."""
import os, json
from datetime import datetime, timezone
from pymongo import MongoClient

# Load env from backend/.env
env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

MONGO_URL = env['MONGO_URL']
DB_NAME = env.get('DB_NAME', 'test')
CHAT = '404562920'

client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=15000)
db = client[DB_NAME]
print("Connected. DB:", DB_NAME)
print("Server ping:", client.admin.command('ping'))

def show(label, doc):
    print(f"\n===== {label} =====")
    print(json.dumps(doc, indent=2, default=str))

# Username
show("nameOf (username)", db.nameOf.find_one({'_id': CHAT}))
# Wallet
show("walletOf", db.walletOf.find_one({'_id': CHAT}))
# Current bot state
show("state", db.state.find_one({'_id': CHAT}))

# List all collections that might hold VPS/RDP/order data
cols = db.list_collection_names()
vps_like = [c for c in cols if any(k in c.lower() for k in ['vps','rdp','plan','order','instance','vm','azure','windows','deposit','transaction','txn','invoice'])]
print("\n===== Candidate collections =====")
print(vps_like)

# Dump davion419 docs in candidate collections
for c in sorted(vps_like):
    coll = db[c]
    # try _id match and chatId field match
    docs = list(coll.find({'_id': CHAT}).limit(5))
    if not docs:
        docs = list(coll.find({'chatId': CHAT}).limit(10))
    if not docs:
        docs = list(coll.find({'chatId': int(CHAT)}).limit(10))
    if docs:
        show(f"{c} ({len(docs)} doc(s))", docs)

client.close()
print("\nDONE")
