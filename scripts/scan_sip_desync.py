import os
from pymongo import MongoClient
db = MongoClient(os.environ["PROD_MONGO_URL"], serverSelectionTimeoutMS=20000)[os.environ.get("PROD_DB_NAME","test")]

affected = []
scanned = 0
for doc in db.phoneNumbersOf.find({}):
    chat_id = doc.get("_id")
    numbers = (doc.get("val") or {}).get("numbers") or []
    for n in numbers:
        if n.get("status") != "active":
            continue
        scanned += 1
        su, sp = n.get("sipUsername"), n.get("sipPassword")
        tu, tp = n.get("telnyxSipUsername"), n.get("telnyxSipPassword")
        # Desync signature: telnyx fields exist but differ from the primary sip fields
        if tu and (su != tu or (tp and sp != tp)):
            affected.append({
                "chatId": chat_id, "phone": n.get("phoneNumber"), "plan": n.get("plan"),
                "provider": n.get("provider"),
                "sipUsername": (su or "")[:18], "telnyxSipUsername": (tu or "")[:18],
                "pw_mismatch": sp != tp,
            })

print(f"Active numbers scanned: {scanned}")
print(f"Desynced (potentially 403-affected) active numbers: {len(affected)}\n")
for a in affected:
    print(a)
