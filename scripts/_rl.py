import os, json, urllib.request, sys
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
TOKEN = os.environ['API_KEY_RAILWAY']
PID='c23ac3d9-51c5-4242-8776-eed4e3801abe'; EID='889fd56a-720a-4020-884c-034784992666'; SID='b9c4ad64-7667-4dd3-8b9a-3867ede47885'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
def gql(query):
    h={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN}
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=json.dumps({"query":query}).encode(), headers=h)
    return json.loads(urllib.request.urlopen(req, timeout=40).read())
q = 'query { deployments(input: {projectId: "%s", environmentId: "%s", serviceId: "%s"}, first: 1) { edges { node { id status createdAt } } } }' % (PID,EID,SID)
dep=gql(q)['data']['deployments']['edges'][0]['node']
DID=dep['id']
print("DEPLOY:", DID, dep['status'], dep['createdAt'])
filt = sys.argv[1] if len(sys.argv)>1 else '5168006768'
q2 = 'query { deploymentLogs(deploymentId: "%s", limit: 400, filter: "%s") { message timestamp } }' % (DID, filt)
logs = gql(q2).get('data',{}).get('deploymentLogs',[])
print("count:", len(logs))
for l in logs:
    print(l['timestamp'], '|', l['message'][:500])
