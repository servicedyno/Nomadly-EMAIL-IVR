import json
from pathlib import Path
from pymongo import MongoClient

env = {}
for line in Path('/app/backend/.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    env[k] = v.strip().strip('"').strip("'")

db = MongoClient(env['MONGO_URL'])[env.get('DB_NAME','test')]

def dump(label, doc, n=3000):
    print(f"\n===== {label} =====")
    print("None" if doc is None else json.dumps(doc, default=str, indent=2)[:n])

# find user (case-insensitive)
import re
u = db.nameOf.find_one({'val': {'$regex': f'^spirits_of_the_ancesters$', '$options':'i'}})
if not u:
    # try partial
    for d in db.nameOf.find({'val': {'$regex':'spirits','$options':'i'}}):
        print("candidate:", d)
dump('nameOf', u)
chat = u['_id'] if u else None
print("chatId:", chat)

if chat:
    # audio library entries
    print("\n===== audioLibrary / ivrAudioStore for user =====")
    for coll in ['audioLibrary','ivrAudioStore','audioLibraryOf','userAudio','ivrAudio']:
        try:
            cnt = db[coll].count_documents({'$or':[{'chatId':str(chat)},{'chatId':chat},{'_id':str(chat)}]})
            print(f"{coll}: {cnt} matching")
        except Exception as e:
            print(f"{coll}: err {e}")
    # phone numbers
    dump('phoneNumbersOf', db.phoneNumbersOf.find_one({'_id': str(chat)}))
    # plan
    dump('planOf', db.planOf.find_one({'_id': str(chat)}))

# list collections with 'audio' or 'ivr' or 'call' in name
print("\n===== relevant collections =====")
print([c for c in db.list_collection_names() if any(x in c.lower() for x in ['audio','ivr','call','bulk','campaign'])])
