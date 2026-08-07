"""READ-ONLY prod investigation v4 — bulk campaigns + OTP mode analysis."""
import os, json, datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'], serverSelectionTimeoutMS=15000)[os.environ.get('DB_NAME','test')]
chatId = "7706898844"
def j(x, n=1500): return json.dumps(x, default=str, indent=2)[:n]

print("=== bulkCallCampaigns for user (most recent 8) ===")
camps = list(db.bulkCallCampaigns.find({'chatId': chatId}).sort([('$natural',-1)]).limit(8))
if not camps:
    camps = list(db.bulkCallCampaigns.find({'$or':[{'chatId':chatId},{'chatId':int(chatId)}]}).limit(8))
for c in camps:
    print("\n--- campaign", c.get('_id'), "---")
    print("  createdAt:", c.get('createdAt'), " status:", c.get('status'))
    print("  ivrMode:", c.get('ivrMode'), " callerId:", c.get('callerId'), " callerPlan:", c.get('callerPlan'), " plan:", c.get('plan'))
    print("  templateName:", c.get('templateName'), " otpLength:", c.get('otpLength'))
    print("  keys:", [k for k in c.keys()])
    # summarize leads/results
    for lk in ['leads','results','targets','calls']:
        if lk in c and isinstance(c[lk], list):
            print(f"  {lk}: {len(c[lk])} items; sample:", j(c[lk][:3], 800))

print("\n=== most-recent campaign FULL dump ===")
if camps:
    print(j(camps[0], 3500))
