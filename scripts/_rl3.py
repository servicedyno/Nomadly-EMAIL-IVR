import os, json, urllib.request
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
TOKEN = os.environ['API_KEY_RAILWAY']
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
def gql(query):
    h={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN}
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=json.dumps({"query":query}).encode(), headers=h)
    return json.loads(urllib.request.urlopen(req, timeout=40).read())
DID='d368b21c-d770-4e48-9eef-d11b2be1eb5d'
q2='query { deploymentLogs(deploymentId: "%s", limit: 500, filter: "5168006768") { message timestamp } }' % DID
logs=gql(q2).get('data',{}).get('deploymentLogs',[])
for l in logs:
    if '09:03:2' in l['timestamp'] or '09:03:3' in l['timestamp'] or '09:02:3' in l['timestamp']:
        print('=====', l['timestamp'])
        print(l['message'])
