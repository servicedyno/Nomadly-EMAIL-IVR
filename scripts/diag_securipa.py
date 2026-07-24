import os, json
from pathlib import Path
from pymongo import MongoClient

# load env
env = {}
for line in Path('/app/backend/.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    env[k] = v.strip().strip('"').strip("'")

client = MongoClient(env['MONGO_URL'])
db = client[env.get('DB_NAME', 'test')]

def dump(label, doc):
    print(f"\n===== {label} =====")
    if doc is None:
        print("None")
        return
    print(json.dumps(doc, default=str, indent=2)[:4000])

DOMAIN = 'securipa.xyz'

# find user by username
user = db.nameOf.find_one({'val': 'aramboss'})
dump('nameOf aramboss', user)
chat_id = user['_id'] if user else None
print("chatId:", chat_id)

# cpanelAccounts referencing securipa.xyz (primary or addon)
print("\n===== cpanelAccounts matching securipa.xyz =====")
for d in db.cpanelAccounts.find({'$or': [{'domain': DOMAIN}, {'addonDomains': DOMAIN}]}):
    print(json.dumps(d, default=str, indent=2)[:3000])

# registeredDomains
dump('registeredDomains securipa.xyz', db.registeredDomains.find_one({'_id': DOMAIN}) or db.registeredDomains.find_one({'domain': DOMAIN}))

# domainsOf for this chat
if chat_id is not None:
    dump('domainsOf chatId', db.domainsOf.find_one({'_id': chat_id}))

# list all collections that might store hosting status
print("\n===== collections =====")
print([c for c in db.list_collection_names() if 'panel' in c.lower() or 'host' in c.lower() or 'plan' in c.lower()])
