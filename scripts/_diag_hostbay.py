import os, json
from pymongo import MongoClient
from datetime import datetime

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'test')
db = MongoClient(MONGO_URL)[DB_NAME]

print("DB_NAME:", DB_NAME)
print("collections sample:", [c for c in db.list_collection_names() if 'name' in c.lower() or 'market' in c.lower() or 'vps' in c.lower() or 'pay' in c.lower()][:40])

# find hostbay_support
for coll in ['nameOf']:
    try:
        docs = list(db[coll].find({'val': {'$regex': 'hostbay_support', '$options': 'i'}}).limit(10))
        print(f"\n[{coll}] regex hostbay_support ->", [(d.get('_id'), d.get('val')) for d in docs])
    except Exception as e:
        print(coll, 'err', e)

# Try userName field variations across state
try:
    docs = list(db['state'].find({'userName': {'$regex': 'hostbay_support', '$options': 'i'}}).limit(10))
    print("\n[state] userName hostbay_support ->", [(d.get('_id'), d.get('userName'), d.get('action')) for d in docs])
except Exception as e:
    print('state err', e)
