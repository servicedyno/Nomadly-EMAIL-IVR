#!/usr/bin/env python3
"""Test Contabo API auth + instance access with .env creds (hosting@dyno.pt)."""
import json, urllib.request, urllib.parse, uuid

env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")

AUTH_URL='https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token'
API_BASE='https://api.contabo.com/v1'

CID=env['CONTABO_CLIENT_ID']; CSEC=env['CONTABO_CLIENT_SECRET']
USER=env['CONTABO_API_USER']; PWD=env['CONTABO_API_PASSWORD']
print("Contabo account:", USER, "client_id:", CID)

# 1. OAuth password grant
data=urllib.parse.urlencode({
    'client_id':CID,'client_secret':CSEC,'username':USER,'password':PWD,'grant_type':'password'
}).encode()
req=urllib.request.Request(AUTH_URL, data=data, headers={'Content-Type':'application/x-www-form-urlencoded'})
token=None
try:
    r=json.loads(urllib.request.urlopen(req,timeout=20).read())
    token=r.get('access_token')
    print("AUTH OK. expires_in:", r.get('expires_in'))
except urllib.error.HTTPError as e:
    print("AUTH FAILED HTTP", e.code, e.read().decode()[:500])
except Exception as e:
    print("AUTH ERROR:", e)

def api(method, path, params=None):
    url=API_BASE+path
    if params: url+='?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url, method=method, headers={
        'Authorization':f'Bearer {token}','x-request-id':str(uuid.uuid4())})
    try:
        return json.loads(urllib.request.urlopen(req,timeout=30).read())
    except urllib.error.HTTPError as e:
        return {'_http':e.code,'_body':e.read().decode()[:600]}
    except Exception as e:
        return {'_err':str(e)}

if token:
    # 2. List instances (page 1, big size)
    print("\n=== LIST INSTANCES (account hosting@dyno.pt) ===")
    res=api('GET','/compute/instances',{'size':100,'page':1})
    if '_http' in res:
        print("LIST FAILED:", res)
    else:
        data=res.get('data',[])
        print(f"Total instances on account: {len(data)}")
        for i in data:
            print(f"  id={i.get('instanceId')} name={i.get('displayName')} status={i.get('status')} ip={(i.get('ipConfig',{}) or {}).get('v4',{}).get('ip')} product={i.get('productId')} cancelDate={i.get('cancelDate')}")
    # 3. Specific davion419 instances
    for iid in ['203378282','203378302','203368045','203368052']:
        print(f"\n=== GET instance {iid} ===")
        r=api('GET', f'/compute/instances/{iid}')
        if '_http' in r:
            print("  ", r)
        else:
            d=(r.get('data') or [{}])[0]
            print(f"   status={d.get('status')} ip={(d.get('ipConfig',{}) or {}).get('v4',{}).get('ip')} displayName={d.get('displayName')} cancelDate={d.get('cancelDate')} createdDate={d.get('createdDate')}")
print("\nDONE")
