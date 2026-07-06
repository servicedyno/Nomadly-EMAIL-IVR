"""Deep dive: strivepartypaperless.com - CF zone state, protection state, NS, post-WHM coverage."""
import os, json
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from pymongo import MongoClient
import urllib.request

db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME', 'test')]
DOMAIN = 'strivepartypaperless.com'
CHAT_ID = '1960615421'

print('=' * 70)
print(f'DOMAIN STATE — {DOMAIN}')
print('=' * 70)

# Hosting plan record
for coll in db.list_collection_names():
    if 'hosting' in coll.lower() or 'cpanel' in coll.lower() or 'antired' in coll.lower() or 'cf' in coll.lower():
        for q in [{'_id': DOMAIN}, {'domain': DOMAIN}, {'_id': f'{DOMAIN}__{CHAT_ID}'}]:
            d = db[coll].find_one(q)
            if d:
                print(f'\n--- {coll} ({q}) ---')
                print(json.dumps(d, default=str, indent=2)[:2500])

# CF zone tracking
print('\n' + '=' * 70)
print('CLOUDFLARE ZONE / ANTIRED STATE for strivepartypaperless')
print('=' * 70)
for coll in db.list_collection_names():
    if 'protection' in coll.lower() or 'worker' in coll.lower() or 'antired' in coll.lower() or 'cf' in coll.lower():
        for q in [{'_id': DOMAIN}, {'domain': DOMAIN}, {'_id': f'{DOMAIN}__{CHAT_ID}'}]:
            d = db[coll].find_one(q)
            if d:
                print(f'\n--- {coll} ({q}) ---')
                print(json.dumps(d, default=str, indent=2)[:2500])

# zoneIdOf / cfZoneIdOf
print('\n' + '=' * 70)
print('ZONE ID LOOKUP')
print('=' * 70)
for coll in ['cfZoneIdOf', 'zoneIdOf', 'cloudflareZoneIdOf', 'cfZonesOf']:
    if coll in db.list_collection_names():
        for q in [{'_id': DOMAIN}]:
            d = db[coll].find_one(q)
            if d:
                print(f'  {coll}[{DOMAIN}]: {json.dumps(d, default=str)[:500]}')

# Nameservers in DB
print('\n' + '=' * 70)
print('NAMESERVERS IN DB')
print('=' * 70)
for coll in ['nameserversOf', 'nameserversOfDomain', 'domainNameserversOf', 'cpaneldnsRecordsOf']:
    if coll in db.list_collection_names():
        for q in [{'_id': DOMAIN}, {'domain': DOMAIN}]:
            d = db[coll].find_one(q)
            if d:
                print(f'  {coll}: {json.dumps(d, default=str)[:600]}')

# Live DNS resolve
print('\n' + '=' * 70)
print('LIVE DNS LOOKUP')
print('=' * 70)
import subprocess
for rtype in ['NS', 'A', 'CNAME', 'SOA']:
    r = subprocess.run(['dig', '+short', DOMAIN, rtype], capture_output=True, text=True, timeout=8)
    print(f'  {rtype:6s}: {r.stdout.strip() or "(none)"}')

# Live Cloudflare API check
print('\n' + '=' * 70)
print('CLOUDFLARE API — zone exists for strivepartypaperless.com?')
print('=' * 70)
cf_key = os.environ.get('CLOUDFLARE_API_KEY')
cf_email = os.environ.get('CLOUDFLARE_EMAIL')
try:
    req = urllib.request.Request(
        f'https://api.cloudflare.com/client/v4/zones?name={DOMAIN}',
        headers={'X-Auth-Email': cf_email, 'X-Auth-Key': cf_key})
    res = json.loads(urllib.request.urlopen(req, timeout=10).read())
    if res.get('result'):
        for z in res['result']:
            print(f"  ✅ Zone EXISTS in CF: id={z['id']}  status={z['status']}  NS={z.get('name_servers')}")
            print(f"     created={z.get('created_on')}  activated={z.get('activated_on')}")
    else:
        print(f'  ❌ Zone does NOT exist in Cloudflare account')
        print(f'  Raw: {json.dumps(res)[:400]}')
except Exception as e:
    print(f'  CF API error: {e}')

# Heartbeat coverage — list all active cpanel accounts vs heartbeat-checked
print('\n' + '=' * 70)
print('CPANEL ACCOUNT COVERAGE (after WHM migration)')
print('=' * 70)
for coll in db.list_collection_names():
    if 'cpanel' in coll.lower() or 'hosting' in coll.lower():
        ct = db[coll].count_documents({})
        if 0 < ct < 100:
            sample = db[coll].find_one()
            print(f'  {coll}: {ct} docs   sample keys: {list(sample.keys())[:10]}')
