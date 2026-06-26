#!/usr/bin/env python3
"""Show StandardDSv6Family quota + total regional cores across the RDP fallback regions."""
import json, urllib.request, urllib.parse

env={}
for line in open('/app/backend/.env'):
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")
TEN=env['AZURE_TENANT_ID']; CID=env['AZURE_CLIENT_ID']; CSEC=env['AZURE_CLIENT_SECRET']; SUB=env['AZURE_SUBSCRIPTION_ID']
tok=json.loads(urllib.request.urlopen(urllib.request.Request(
    f"https://login.microsoftonline.com/{TEN}/oauth2/v2.0/token",
    data=urllib.parse.urlencode({'client_id':CID,'client_secret':CSEC,'grant_type':'client_credentials','scope':'https://management.azure.com/.default'}).encode(),
    headers={'Content-Type':'application/x-www-form-urlencoded'}),timeout=25).read())['access_token']

regions={'eastus':'US-east','westus3':'US-west','eastus2':'US-central','westeurope':'EU','uksouth':'UK','australiaeast':'AU','southeastasia':'SG'}
print(f"{'region':14}{'Dsv6 cores':>14}{'total cores':>14}")
for loc,cust in regions.items():
    try:
        u=json.loads(urllib.request.urlopen(urllib.request.Request(
            f"https://management.azure.com/subscriptions/{SUB}/providers/Microsoft.Compute/locations/{loc}/usages?api-version=2023-07-01",
            headers={'Authorization':f'Bearer {tok}'}),timeout=25).read())['value']
        dsv6=next((i for i in u if i['name']['value'].lower()=='standarddsv6family'),None)
        cores=next((i for i in u if i['name']['value']=='cores'),None)
        d=f"{dsv6['currentValue']}/{dsv6['limit']}" if dsv6 else 'n/a'
        c=f"{cores['currentValue']}/{cores['limit']}" if cores else 'n/a'
        print(f"{cust:14}{d:>14}{c:>14}")
    except Exception as e:
        print(f"{cust:14}  err {str(e)[:40]}")
print("\n(D2s_v6 = 2 cores each → max RDPs per region ≈ limit/2)")
