import os, json
from pymongo import MongoClient

db = MongoClient(os.environ["PROD_MONGO_URL"], serverSelectionTimeoutMS=15000)[os.environ.get("PROD_DB_NAME","test")]
CHAT_ID = "1794625076"
PHONE = "+18886146831"

doc = db.phoneNumbersOf.find_one({"_id": CHAT_ID})
numbers = doc["val"]["numbers"]
idx = next(i for i,n in enumerate(numbers) if n.get("phoneNumber")==PHONE and n.get("status")=="active")
n = numbers[idx]

print("=== BEFORE ===")
for k in ["sipUsername","sipPassword","telnyxSipUsername","telnyxSipPassword","telnyxCredentialId"]:
    print(f"  {k}: {n.get(k)}")

# Canonical = the telnyx* fields (= credential telnyxCredentialId, verified 200 OK).
canon_user = n["telnyxSipUsername"]
canon_pass = n["telnyxSipPassword"]
assert canon_user and canon_pass, "telnyx fields missing — abort"

res = db.phoneNumbersOf.update_one(
    {"_id": CHAT_ID, "val.numbers.phoneNumber": PHONE},
    {"$set": {
        "val.numbers.$.sipUsername": canon_user,
        "val.numbers.$.sipPassword": canon_pass,
        "val.numbers.$._sipResyncFix": "2026-06-02 desync hotfix: aligned sip* to telnyx* (cred 161ab41a)",
    }}
)
print("\nupdate matched:", res.matched_count, "modified:", res.modified_count)

doc2 = db.phoneNumbersOf.find_one({"_id": CHAT_ID})
n2 = next(x for x in doc2["val"]["numbers"] if x.get("phoneNumber")==PHONE and x.get("status")=="active")
print("\n=== AFTER ===")
for k in ["sipUsername","sipPassword","telnyxSipUsername","telnyxSipPassword","telnyxCredentialId"]:
    print(f"  {k}: {n2.get(k)}")
consistent = (n2["sipUsername"]==n2["telnyxSipUsername"] and n2["sipPassword"]==n2["telnyxSipPassword"])
print("\nALL FIELDS CONSISTENT:", consistent)
print("USER SHOULD USE -> username:", n2["sipUsername"], "| password:", n2["sipPassword"], "| domain:", n2.get("sipDomain"))
