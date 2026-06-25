import os, json
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME','test')]
def j(x): return json.dumps(x, default=str, indent=2)
cid = '5168006768'
st = db.state.find_one({'_id': cid}) or {}
print("=== state keys ===")
print([k for k in st.keys()])
for key in ['vpsDetails','vpsConfigTypes','lastStep','action']:
    print(f"\n=== {key} ===")
    print(j(st.get(key)))
