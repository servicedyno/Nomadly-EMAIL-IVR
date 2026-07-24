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
CHAT = '7898648919'

def show(coll, q, n=5, fields=None):
    print(f"\n===== {coll} where {q} =====")
    cur = db[coll].find(q).limit(n)
    any_=False
    for d in cur:
        any_=True
        if fields:
            d = {k: d.get(k) for k in fields}
        # trim big base64 buffers
        for bk in ['buffer','data','audioBuffer','base64']:
            if isinstance(d.get(bk), str) and len(d[bk])>60:
                d[bk] = f"<{len(d[bk])} chars base64>"
        print(json.dumps(d, default=str, indent=2)[:2500])
    if not any_: print("(none)")

for coll in ['ivrAudioFiles','ivrAudioStore','bulkCallCampaigns','scheduledCalls']:
    for q in [{'chatId':CHAT},{'chatId':int(CHAT)},{'_id':CHAT}]:
        try:
            if db[coll].count_documents(q):
                show(coll,q)
                break
        except Exception as e:
            print(coll,'err',e)
