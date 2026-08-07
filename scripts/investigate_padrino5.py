"""READ-ONLY prod investigation v5 — support/escalations = his actual words."""
import os, json, datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'], serverSelectionTimeoutMS=15000)[os.environ.get('DB_NAME','test')]
chatId = "7706898844"
def j(x, n=1200): return json.dumps(x, default=str, indent=2)[:n]

print("=== escalations (his complaints) ===")
for d in db.escalations.find({'chatId': chatId}).sort([('$natural',-1)]).limit(12):
    print("\n--", d.get('createdAt') or d.get('timestamp'), "| status:", d.get('status'), "| topic:", d.get('topic') or d.get('category'))
    for f in ['userMessage','message','question','summary','reason','issue','text','lastUserMessage','transcript']:
        if d.get(f):
            print(f"   {f}: {str(d[f])[:600]}")

print("\n\n=== supportSessions ===")
for d in db.supportSessions.find({'chatId': chatId}).sort([('$natural',-1)]).limit(5):
    print("keys:", list(d.keys()))
    msgs = d.get('messages') or d.get('history') or d.get('turns')
    if isinstance(msgs, list):
        for m in msgs[-20:]:
            role = m.get('role') or m.get('from') or m.get('sender')
            content = m.get('content') or m.get('text') or m.get('message')
            print(f"   [{role}] {str(content)[:400]}")
    else:
        print(j(d, 1500))

print("\n\n=== supportRatings ===")
for d in db.supportRatings.find({'chatId': chatId}).limit(5):
    print(j(d, 500))
