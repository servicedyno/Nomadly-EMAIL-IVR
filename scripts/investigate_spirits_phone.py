#!/usr/bin/env python3
"""READ-ONLY: gather everything about Spirits (chatId 7898648919) phone/IVR/plan/wallet."""
import os, json
from pymongo import MongoClient
db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME','test')]
CID = '7898648919'

def jd(x): return json.dumps(x, default=str, indent=2, ensure_ascii=False)

def show(coll, q):
    docs = list(db[coll].find(q).limit(10))
    print(f"\n=== {coll}  query={q}  -> {len(docs)} doc(s) ===")
    for d in docs:
        print(jd(d))

# Wallet
show('walletOf', {'_id': CID})

# Phone numbers assigned to this user
show('phoneNumbersOf', {'_id': CID})

# Plans / subscriptions — try common collections
for c in ['planOf','planEndingTime','phonePlanOf','phoneServiceOf','subscriptionOf',
          'phoneSubscriptionOf','ivrOf','ivrPlanOf','phoneNumberPlanOf','voicePlanOf']:
    if c in db.list_collection_names():
        show(c, {'_id': CID})

# Any collection whose name hints phone/ivr/voice/plan — scan for this chatId
print("\n=== SCAN: collections containing docs referencing this chatId (phone/ivr/plan/voice) ===")
for name in db.list_collection_names():
    low = name.lower()
    if any(k in low for k in ['phone','ivr','voice','plan','sip','number','call','sub']):
        try:
            d = db[name].find_one({'_id': CID})
            if d:
                print(f"\n--- {name} (by _id) ---")
                print(jd(d))
            else:
                # search value refs
                n = db[name].count_documents({'$or':[{'chatId': CID},{'chatId': int(CID)}]})
                if n:
                    print(f"\n--- {name} : {n} doc(s) with chatId field ---")
                    for dd in db[name].find({'$or':[{'chatId': CID},{'chatId': int(CID)}]}).limit(5):
                        print(jd(dd))
        except Exception as e:
            print(f"  ({name} scan error: {e})")

# transactions for this user
print("\n=== transactions (all) ===")
for t in db.transactions.find({'chatId': CID}).sort('createdAt',-1).limit(30):
    print(jd({k:t.get(k) for k in ('_id','type','amount','currency','status','description','createdAt','metadata')}))
