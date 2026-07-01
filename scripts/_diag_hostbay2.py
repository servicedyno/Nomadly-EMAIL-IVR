import os, json
from pymongo import MongoClient
from bson import json_util

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'test')
db = MongoClient(MONGO_URL)[DB_NAME]

CID = 5168006768
CIDS = [CID, str(CID)]

def dump(coll, query, limit=10, sort=None):
    print(f"\n===== {coll} query={query} =====")
    try:
        cur = db[coll].find(query)
        if sort: cur = cur.sort(sort)
        cur = cur.limit(limit)
        docs = list(cur)
        if not docs:
            print("  (none)")
        for d in docs:
            print("  ", json_util.dumps(d)[:900])
    except Exception as e:
        print("  ERR", e)

# state doc
dump('state', {'_id': {'$in': CIDS}})
# marketplace access
dump('marketplaceAccess', {'_id': {'$in': CIDS}})
# vps
dump('vpsTransactions', {'$or': [{'chatId': {'$in': CIDS}}, {'chatId': CID}]}, sort=[('createdAt', -1)])
dump('vpsPlansOf', {'_id': {'$in': CIDS}})
# dynopay
dump('chatIdOfDynopayPayment', {'$or':[{'chatId': {'$in': CIDS}}, {'val.chatId': {'$in': CIDS}}]})
dump('dynopayWebhooks', {}, limit=6, sort=[('_id', -1)])
# payment intents / payments
dump('paymentIntents', {'$or':[{'chatId': {'$in': CIDS}}, {'val.chatId': {'$in': CIDS}}]}, sort=[('_id',-1)])
dump('chatIdOfPayment', {'$or':[{'chatId': {'$in': CIDS}}, {'val.chatId': {'$in': CIDS}}]})
