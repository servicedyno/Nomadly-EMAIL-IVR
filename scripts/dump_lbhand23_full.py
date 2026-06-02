import os, json
from pymongo import MongoClient

db = MongoClient(os.environ["PROD_MONGO_URL"], serverSelectionTimeoutMS=15000)[os.environ.get("PROD_DB_NAME","test")]
pn = db.phoneNumbersOf.find_one({"_id": "1794625076"})
val = pn.get("val", {})
numbers = val.get("numbers", [])
def red(v):
    return v
for i, n in enumerate(numbers):
    print(f"\n===================== number[{i}] FULL DUMP =====================")
    print(json.dumps(n, indent=2, default=str))
