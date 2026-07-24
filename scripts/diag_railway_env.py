import json, urllib.request, base64
from pathlib import Path

env = {}
for l in Path('/app/backend/.env').read_text().splitlines():
    l=l.strip()
    if not l or l.startswith('#') or '=' not in l: continue
    k,v=l.split('=',1); env[k]=v.strip().strip('"').strip("'")
TOKEN=env['API_KEY_RAILWAY']
PID='c23ac3d9-51c5-4242-8776-eed4e3801abe'; EID='889fd56a-720a-4020-884c-034784992666'; SID='b9c4ad64-7667-4dd3-8b9a-3867ede47885'
H={"Project-Access-Token":TOKEN}

def gql(q, variables=None):
    payload={"query":q}
    if variables: payload["variables"]=variables
    body=json.dumps(payload).encode()
    req=urllib.request.Request("https://backboard.railway.app/graphql/v2",data=body,
        headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0 Chrome/126.0"} | H)
    try: return json.loads(urllib.request.urlopen(req,timeout=30).read())
    except urllib.error.HTTPError as e: return {"HTTPError":e.code,"body":e.read().decode()[:400]}
    except Exception as e: return {"error":str(e)}

q='query V($p:String!,$e:String!,$s:String!){ variables(projectId:$p, environmentId:$e, serviceId:$s) }'
r=gql(q, {"p":PID,"e":EID,"s":SID})
prodvars = r.get('data',{}).get('variables') if isinstance(r,dict) else None
if not prodvars:
    print("Could not fetch variables:", json.dumps(r)[:400])
else:
    print("Fetched", len(prodvars), "prod variables")
    for key in ['TELNYX_API_KEY','TELNYX_SIP_CONNECTION_ID','TELNYX_CALL_CONTROL_APP_ID','TELNYX_MESSAGING_PROFILE_ID','TELNYX_DEFAULT_ANI','BOT_ENVIRONMENT','TELNYX_PUBLIC_KEY','TELNYX_API_KEY_V2']:
        pv = prodvars.get(key)
        lv = env.get(key)
        def mask(x):
            if x is None: return None
            return f"{x[:20]}...{x[-6:]} (len {len(x)})" if len(x)>30 else x
        same = (pv==lv)
        print(f"\n{key}:")
        print(f"   PROD : {mask(pv)}")
        print(f"   .env : {mask(lv)}")
        print(f"   MATCH: {same}")
    # print any other TELNYX_* keys present in prod that we don't have
    print("\nAll TELNYX_* keys in PROD:")
    for k in sorted(prodvars):
        if 'TELNYX' in k.upper():
            v=prodvars[k]
            print(f"   {k} = {v[:22]}...{v[-6:] if len(v)>28 else ''} (len {len(v)})")
    # Now test the PROD telnyx key directly
    pk = prodvars.get('TELNYX_API_KEY')
    if pk:
        print("\n=== Testing PROD TELNYX_API_KEY against Telnyx API ===")
        req=urllib.request.Request("https://api.telnyx.com/v2/phone_numbers?page[size]=1",
            headers={"Authorization": f"Bearer {pk}", "Accept":"application/json"})
        try:
            rr=urllib.request.urlopen(req, timeout=20)
            print("HTTP", rr.status, "-> PROD KEY VALID")
        except urllib.error.HTTPError as e:
            print("HTTP", e.code, "->", e.read().decode()[:300])
