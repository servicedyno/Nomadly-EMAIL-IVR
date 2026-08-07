"""READ-ONLY prod investigation v2 — compact summary + 48h activity."""
import os, json, datetime, re
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'], serverSelectionTimeoutMS=15000)[os.environ.get('DB_NAME','test')]
chatId = "7706898844"
now = datetime.datetime.utcnow()
print("SERVER now(utc):", now.isoformat())
cutoff = now - datetime.timedelta(hours=48)
print("48h cutoff:", cutoff.isoformat())

# ---- All phone numbers compact ----
pn = db.phoneNumbersOf.find_one({'_id': chatId})
nums = (pn or {}).get('val', {}).get('numbers', [])
print(f"\n=== phone numbers ({len(nums)}) ===")
for n in nums:
    print(f"  {n.get('phoneNumber')} | plan={n.get('plan')} | status={n.get('status')} | provider={n.get('provider')} "
          f"| purchase={n.get('purchaseDate')} | expires={n.get('expiresAt')} | released={n.get('_released')} | autoRenew={n.get('autoRenew')}")

# ---- Plan subscription collections ----
for c in ['planOf','planEndingTime','phonePlanOf','subscriptionOf','phoneSubscriptionOf']:
    if c in db.list_collection_names():
        d = db[c].find_one({'_id': chatId})
        print(f"\n=== {c} ===\n", json.dumps(d, default=str)[:800])

# ---- Wallet ----
print("\n=== walletOf ===\n", json.dumps(db.walletOf.find_one({'_id': chatId}), default=str)[:600])

# ---- Search all collections for recent docs referencing this chatId ----
print("\n=== scanning collections for chatId activity ===")
cols = db.list_collection_names()
for c in sorted(cols):
    try:
        # try common chatId field names
        q = {'$or': [{'_id': chatId}, {'chatId': chatId}, {'chatId': int(chatId)}, {'userId': chatId}, {'ownerChatId': chatId}]}
        cnt = db[c].count_documents(q)
        if cnt:
            print(f"  [{c}] docs={cnt}")
    except Exception:
        pass
