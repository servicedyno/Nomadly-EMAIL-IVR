"""READ-ONLY prod investigation v3 — state + 48h IVR/OTP activity."""
import os, json, datetime
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'], serverSelectionTimeoutMS=15000)[os.environ.get('DB_NAME','test')]
chatId = "7706898844"
now = datetime.datetime.utcnow()
cutoff = now - datetime.timedelta(hours=48)
def j(x, n=2500): return json.dumps(x, default=str, indent=2)[:n]

# 1. Current bot state (what he was doing)
print("=== state doc ===")
st = db.state.find_one({'_id': chatId})
print(j(st, 3000))

# 2. Recent phoneLogs
print("\n=== phoneLogs last 48h (most recent 40) ===")
logs = list(db.phoneLogs.find({'chatId': chatId}).sort('_id',-1).limit(60))
if not logs:
    logs = list(db.phoneLogs.find({'$or':[{'chatId':chatId},{'chatId':int(chatId)}]}).sort([('$natural',-1)]).limit(60))
print("total pulled:", len(logs))
for l in logs[:40]:
    ts = l.get('timestamp') or l.get('createdAt') or l.get('date') or l.get('time')
    print(f"  ts={ts} type={l.get('type')} dir={l.get('direction')} mode={l.get('ivrMode') or l.get('mode')} "
          f"num={l.get('phoneNumber') or l.get('from') or l.get('caller')} target={l.get('to') or l.get('target')} "
          f"result={l.get('result') or l.get('status')} note={str(l.get('note') or l.get('error') or '')[:60]}")

# 3. ivrAnalytics
print("\n=== ivrAnalytics ===")
for d in db.ivrAnalytics.find({'chatId': chatId}).limit(20):
    print(" ", j(d, 400))

# 4. scheduledCalls
print("\n=== scheduledCalls ===")
for d in db.scheduledCalls.find({'chatId': chatId}).limit(10):
    print(" ", j(d, 500))
