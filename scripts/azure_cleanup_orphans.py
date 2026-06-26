#!/usr/bin/env python3
"""Delete orphaned Azure network resources (no VMs exist → all NIC/IP/NSG/VNet are orphans)."""
import json, urllib.request, urllib.parse, time

env={}
for line in open('/app/backend/.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")
TENANT=env['AZURE_TENANT_ID']; CID=env['AZURE_CLIENT_ID']; CSEC=env['AZURE_CLIENT_SECRET']; SUB=env['AZURE_SUBSCRIPTION_ID']; RG=env.get('AZURE_RESOURCE_GROUP','nomadly-vps')

def token():
    return json.loads(urllib.request.urlopen(urllib.request.Request(
        f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token",
        data=urllib.parse.urlencode({'client_id':CID,'client_secret':CSEC,'grant_type':'client_credentials','scope':'https://management.azure.com/.default'}).encode(),
        headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=25).read())['access_token']
tok=token()

def req(method, path, ver):
    url=f"https://management.azure.com{path}?api-version={ver}"
    r=urllib.request.Request(url, method=method, headers={'Authorization':f'Bearer {tok}'})
    try:
        resp=urllib.request.urlopen(r,timeout=60)
        return resp.status, (resp.read().decode()[:200] if method=='GET' else '')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

# Safety: confirm 0 VMs
vms=json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://management.azure.com/subscriptions/{SUB}/resourceGroups/{RG}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01",
    headers={'Authorization':f'Bearer {tok}'}),timeout=30).read())
nvms=len(vms.get('value',[]))
print(f"VMs in RG: {nvms}")
if nvms>0:
    print("ABORT: VMs exist — not safe to bulk-delete network resources."); raise SystemExit

# List all resources
res=json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://management.azure.com/subscriptions/{SUB}/resourceGroups/{RG}/resources?api-version=2021-04-01",
    headers={'Authorization':f'Bearer {tok}'}),timeout=30).read())['value']

VER={'Microsoft.Network/networkInterfaces':'2023-09-01',
     'Microsoft.Network/publicIPAddresses':'2023-09-01',
     'Microsoft.Network/networkSecurityGroups':'2023-09-01',
     'Microsoft.Network/virtualNetworks':'2023-09-01'}
# Delete in dependency order: NIC -> (IP, NSG, VNet)
order=['Microsoft.Network/networkInterfaces','Microsoft.Network/publicIPAddresses','Microsoft.Network/networkSecurityGroups','Microsoft.Network/virtualNetworks']

for rtype in order:
    for r in res:
        if r.get('type')!=rtype: continue
        name=r['name']
        path=f"/subscriptions/{SUB}/resourceGroups/{RG}/providers/{rtype}/{name}"
        st,body=req('DELETE',path,VER[rtype])
        print(f"DELETE {rtype.split('/')[-1]}/{name} -> {st} {body}")
    # small wait so NIC deletes settle before deleting their IP/subnet deps
    time.sleep(8)

print("\n=== Re-list after delete (allow async to finish) ===")
time.sleep(20)
res2=json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://management.azure.com/subscriptions/{SUB}/resourceGroups/{RG}/resources?api-version=2021-04-01",
    headers={'Authorization':f'Bearer {tok}'}),timeout=30).read())['value']
print(f"Remaining resources: {len(res2)}")
for r in res2: print("  ", r.get('type'), r.get('name'))
print("DONE")
