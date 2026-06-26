#!/usr/bin/env python3
"""Test Azure AAD auth + ARM access (read-only) with .env creds."""
import json, urllib.request, urllib.parse

env={}
for line in open('/app/backend/.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")

TENANT=env['AZURE_TENANT_ID']; CID=env['AZURE_CLIENT_ID']; CSEC=env['AZURE_CLIENT_SECRET']
SUB=env['AZURE_SUBSCRIPTION_ID']; RG=env.get('AZURE_RESOURCE_GROUP','nomadly-vps'); LOC=env.get('AZURE_DEFAULT_LOCATION','eastus')
print("Azure sub:", SUB, "RG:", RG, "loc:", LOC)

# 1. client_credentials token
tok_url=f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
data=urllib.parse.urlencode({'client_id':CID,'client_secret':CSEC,'grant_type':'client_credentials',
    'scope':'https://management.azure.com/.default'}).encode()
token=None
try:
    r=json.loads(urllib.request.urlopen(urllib.request.Request(tok_url,data=data,
        headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=25).read())
    token=r.get('access_token'); print("AUTH OK, token len", len(token or ''))
except urllib.error.HTTPError as e:
    print("AUTH FAILED", e.code, e.read().decode()[:600])
except Exception as e:
    print("AUTH ERROR", e)

def arm(path, ver):
    url=f"https://management.azure.com{path}?api-version={ver}"
    req=urllib.request.Request(url, headers={'Authorization':f'Bearer {token}'})
    try: return json.loads(urllib.request.urlopen(req,timeout=30).read())
    except urllib.error.HTTPError as e: return {'_http':e.code,'_body':e.read().decode()[:500]}
    except Exception as e: return {'_err':str(e)}

if token:
    # 2. resource group exists?
    print("\n=== Resource group ===")
    print(json.dumps(arm(f"/subscriptions/{SUB}/resourceGroups/{RG}", "2021-04-01"))[:300])
    # 3. existing VMs in RG
    print("\n=== VMs in RG ===")
    vms=arm(f"/subscriptions/{SUB}/resourceGroups/{RG}/providers/Microsoft.Compute/virtualMachines","2023-07-01")
    if 'value' in vms:
        print(f"{len(vms['value'])} VM(s)")
        for v in vms['value']:
            print("  ", v.get('name'), v.get('properties',{}).get('hardwareProfile',{}).get('vmSize'))
    else:
        print(json.dumps(vms)[:400])
    # 4. Dsv6 quota in location
    print(f"\n=== Compute usage/quota in {LOC} (Dsv6 family) ===")
    u=arm(f"/subscriptions/{SUB}/providers/Microsoft.Compute/locations/{LOC}/usages","2023-07-01")
    if 'value' in u:
        for item in u['value']:
            nm=item.get('name',{}).get('value','')
            if 'Dsv6' in nm or 'DSv6' in nm or 'standardDSv6' in nm.lower() or 'dsv6' in nm.lower() or item.get('currentValue',0)>0 and 'D' in nm:
                print(f"   {nm}: {item.get('currentValue')}/{item.get('limit')}")
        # also total regional cores
        for item in u['value']:
            if item.get('name',{}).get('value')=='cores':
                print(f"   [Total Regional vCPUs] cores: {item.get('currentValue')}/{item.get('limit')}")
    else:
        print(json.dumps(u)[:400])
print("\nDONE")
