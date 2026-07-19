#!/usr/bin/env python3
"""READ-ONLY: state of the exploited product payments for reversal (3R9ly hosting, sAoKK marketplace)."""
import os, json
from pymongo import MongoClient
db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME','test')]
def jd(x): return json.dumps(x, default=str, indent=2, ensure_ascii=False)

print("=== payments rows for the two refs ===")
for ref in ['3R9ly','sAoKK','N4b0q']:
    p = db.payments.find_one({'_id': ref})
    print(f"{ref}:", p.get('val') if p else 'NOT FOUND')

# 3R9ly hosting → chatId 8011229362
CID_H = '8011229362'
print(f"\n=== HOSTING user {CID_H} ===")
print("nameOf:", jd(db.nameOf.find_one({'_id': CID_H})))
print("cpanelAccounts:")
for c in db.cpanelAccounts.find({'chatId': CID_H}):
    print(jd({k:c.get(k) for k in ('_id','chatId','cpUser','domain','plan','status','createdAt','expiresAt','deleted','autoRenewable','whmHost')}))
# try int
if db.cpanelAccounts.count_documents({'chatId': CID_H}) == 0:
    for c in db.cpanelAccounts.find({'chatId': int(CID_H)}):
        print("(int chatId)", jd({k:c.get(k) for k in ('_id','chatId','cpUser','domain','plan','status','createdAt','expiresAt','deleted')}))
print("registeredDomains for user:")
for d in db.registeredDomains.find({'chatId': CID_H}).limit(10):
    print(jd({k:d.get(k) for k in ('_id','domain','chatId','createdAt','expiresAt','status')}))

# sAoKK marketplace → find chatId from dynopayWebhooks
print("\n=== MARKETPLACE ref sAoKK — resolve chatId ===")
w = db.dynopayWebhooks.find_one({'refId':'sAoKK'})
cid_m = None
if w:
    print("webhook meta_data:", jd((w.get('body') or {}).get('meta_data')))
# payments CSV col 5 = chatId
p = db.payments.find_one({'_id':'sAoKK'})
if p:
    parts = p['val'].split(',')
    cid_m = parts[4] if len(parts) > 4 else None
    print("chatId from payments CSV:", cid_m, "| name:", parts[5] if len(parts)>5 else None)
if cid_m:
    print("nameOf:", jd(db.nameOf.find_one({'_id': cid_m})))
    # marketplace access collections
    for coll in db.list_collection_names():
        if 'market' in coll.lower() or 'mp' == coll.lower() or 'access' in coll.lower():
            d = db[coll].find_one({'_id': cid_m}) or db[coll].find_one({'chatId': cid_m})
            if d:
                print(f"[{coll}]", jd(d))
