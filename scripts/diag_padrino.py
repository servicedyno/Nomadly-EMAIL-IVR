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

u = db.nameOf.find_one({'val': {'$regex': '^padrino_voodoo$', '$options':'i'}})
if not u:
    for d in db.nameOf.find({'val': {'$regex':'padrino','$options':'i'}}):
        print("candidate:", d)
print("nameOf:", u)
chat = u['_id'] if u else None
print("chatId:", chat)

if chat:
    pn = db.phoneNumbersOf.find_one({'_id': str(chat)})
    if pn:
        for n in pn.get('val',{}).get('numbers',[]):
            print("\n--- number", n.get('phoneNumber'), "---")
            for k in ['phoneNumber','provider','type','plan','status','isSubNumber','parentNumber',
                      'twilioNumberSid','twilioSubAccountSid','twilioSubAccountToken',
                      'connectionId','telnyxCredentialId','callControlAppId']:
                v = n.get(k)
                if k == 'twilioSubAccountToken':
                    v = (f"<len {len(v)}>" if isinstance(v,str) and v else ("EMPTY" if v in (None,'') else v))
                print(f"  {k}: {v}")
            print("  features.ivr:", json.dumps(n.get('features',{}).get('ivr'), default=str)[:300])
