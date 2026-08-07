"""READ-ONLY production investigation for @Padrino_voodoo OTP complaint."""
import os, sys, json, datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'test')
db = MongoClient(MONGO_URL, serverSelectionTimeoutMS=15000)[DB_NAME]

def jd(x):
    return json.dumps(x, indent=2, default=str)[:4000]

print("=== DB:", DB_NAME, "===")
cols = db.list_collection_names()
print("collections count:", len(cols))

# 1. Find user by username (case-insensitive), with/without @
uname = "Padrino_voodoo"
import re
rx = re.compile("^@?" + re.escape(uname) + "$", re.IGNORECASE)
user = db.nameOf.find_one({'val': rx})
print("\n=== nameOf lookup (username -> chatId) ===")
print(jd(user))

if not user:
    # try usernameOf or other collections
    for c in ['usernameOf', 'userNameOf', 'tgUsernameOf']:
        if c in cols:
            u2 = db[c].find_one({'val': rx})
            print(f"[{c}]", jd(u2))
    sys.exit("USER NOT FOUND in nameOf")

chatId = user['_id']
print("\n>>> chatId =", chatId)

# 2. Phone numbers (plan is per-number)
print("\n=== phoneNumbersOf ===")
pn = db.phoneNumbersOf.find_one({'_id': chatId})
print(jd(pn))

# 3. Subscription plan
for c in ['planOf', 'planEndingTime', 'phonePlanOf', 'subscriptionOf']:
    if c in cols:
        print(f"\n=== {c} ===")
        print(jd(db[c].find_one({'_id': chatId})))

# 4. Wallet
print("\n=== walletOf ===")
print(jd(db.walletOf.find_one({'_id': chatId})))

# 5. Language
for c in ['langOf', 'userLanguageOf', 'infoOf']:
    if c in cols:
        d = db[c].find_one({'_id': chatId})
        if d:
            print(f"\n=== {c} (keys) ===", list(d.keys())[:40] if isinstance(d, dict) else d)
