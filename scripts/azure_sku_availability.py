#!/usr/bin/env python3
"""Find Azure regions where Standard_D2s_v6 (and fallbacks) are available (no capacity restriction)."""
import json, urllib.request, urllib.parse

env={}
for line in open('/app/backend/.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")
TENANT=env['AZURE_TENANT_ID']; CID=env['AZURE_CLIENT_ID']; CSEC=env['AZURE_CLIENT_SECRET']; SUB=env['AZURE_SUBSCRIPTION_ID']; RG=env.get('AZURE_RESOURCE_GROUP','nomadly-vps')

tok=json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
    data=urllib.parse.urlencode({'client_id':CID,'client_secret':CSEC,'grant_type':'client_credentials','scope':'https://management.azure.com/.default'}).encode(),
    headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=25).read())['access_token']

def arm(path, ver, q=''):
    url=f"https://management.azure.com{path}?api-version={ver}"+q
    req=urllib.request.Request(url, headers={'Authorization':f'Bearer {tok}'})
    try: return json.loads(urllib.request.urlopen(req,timeout=40).read())
    except urllib.error.HTTPError as e: return {'_http':e.code,'_body':e.read().decode()[:400]}

# 0. Verify failed attempt cleaned up (no leftover VMs/IPs/NICs in RG)
print("=== Resources currently in RG (should be empty after cleanup) ===")
res=arm(f"/subscriptions/{SUB}/resourceGroups/{RG}/resources","2021-04-01")
if 'value' in res:
    print(f"{len(res['value'])} resource(s)")
    for r in res['value']:
        print("  ", r.get('type'), r.get('name'))
else:
    print(json.dumps(res)[:300])

# Candidate regions (from REGION_TO_AZURE) — RDP-relevant
regions = {'eastus':'US-east','westus3':'US-west','eastus2':'US-central','westeurope':'EU',
           'uksouth':'UK','southeastasia':'SG','australiaeast':'AU','centralindia':'IN','japaneast':'JP'}
skus_of_interest = ['Standard_D2s_v6','Standard_D2as_v6','Standard_D4s_v6','Standard_B2s','Standard_B2ms']

print("\n=== SKU availability per region (restrictions) ===")
for az_loc, cust in regions.items():
    data=arm(f"/subscriptions/{SUB}/providers/Microsoft.Compute/skus","2021-07-01",
             q="&%24filter="+urllib.parse.quote(f"location eq '{az_loc}'"))
    if 'value' not in data:
        print(f"{az_loc} ({cust}): query err {str(data)[:120]}"); continue
    found={}
    for s in data['value']:
        nm=s.get('name')
        if nm in skus_of_interest and s.get('resourceType')=='virtualMachines':
            restr=s.get('restrictions',[])
            # NotAvailableForSubscription / location/zone restriction means blocked
            blocked = any(r.get('reasonCode') for r in restr)
            reasons=[r.get('reasonCode') for r in restr]
            found[nm]= 'OK' if not blocked else f"BLOCKED({','.join(reasons)})"
    line=", ".join(f"{k}={v}" for k,v in sorted(found.items()))
    print(f"{az_loc:16s} ({cust:9s}): {line if line else 'none of interest listed'}")
print("\nDONE")
