import os, json
from pymongo import MongoClient

MONGO_URL = os.environ["PROD_MONGO_URL"]
DB_NAME = os.environ.get("PROD_DB_NAME", "test")

db = MongoClient(MONGO_URL, serverSelectionTimeoutMS=15000)[DB_NAME]
print("Connected. Collections sample count nameOf:", db.nameOf.estimated_document_count())

# Find chatId by username (nameOf maps chatId -> username in `val`)
candidates = ["LBHAND23", "lbhand23", "Lbhand23", "LBhand23"]
found = []
for u in candidates:
    doc = db.nameOf.find_one({"val": u})
    if doc:
        found.append((u, doc))

# Also case-insensitive regex search
regex_doc = list(db.nameOf.find({"val": {"$regex": "^lbhand23$", "$options": "i"}}))
print("Exact candidates found:", [(u, d.get("_id")) for u, d in found])
print("Regex matches:", [(d.get("_id"), d.get("val")) for d in regex_doc])

chat_ids = set([d.get("_id") for _, d in found] + [d.get("_id") for d in regex_doc])
print("chatIds:", chat_ids)

for cid in chat_ids:
    print("\n==================== chatId", cid, "====================")
    name = db.nameOf.find_one({"_id": cid})
    print("username:", name.get("val") if name else None)
    pn = db.phoneNumbersOf.find_one({"_id": cid})
    if not pn:
        print("NO phoneNumbersOf doc")
        continue
    val = pn.get("val", {})
    numbers = val.get("numbers", []) if isinstance(val, dict) else []
    print("twilioSubAccountSid:", val.get("twilioSubAccountSid") if isinstance(val, dict) else None)
    print("number count:", len(numbers))
    for i, n in enumerate(numbers):
        print(f"\n  --- number[{i}] ---")
        for k in ["phoneNumber","provider","plan","status","purchaseDate","expiresAt",
                  "sipUsername","sipPassword","sipDomain","connectionId","telnyxCredId",
                  "telnyxCredentialId","autoRenew","country"]:
            if k in n:
                print(f"    {k}: {n[k]}")
