#!/usr/bin/env python3
"""Check Cloudflare actual state for homepage-navyfed.com and verify-navy.com."""
import os, json, requests
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

EMAIL = os.environ['CLOUDFLARE_EMAIL']
KEY = os.environ['CLOUDFLARE_API_KEY']
HDR = {'X-Auth-Email': EMAIL, 'X-Auth-Key': KEY, 'Content-Type': 'application/json'}

for domain in ['homepage-navyfed.com', 'verify-navy.com']:
    print(f"\n{'='*60}\n{domain}\n{'='*60}")
    # Find zone
    r = requests.get(f'https://api.cloudflare.com/client/v4/zones', params={'name': domain}, headers=HDR, timeout=15)
    j = r.json()
    if not j.get('success'):
        print('Zone lookup error:', j); continue
    zones = j.get('result', [])
    if not zones:
        print('NO ZONE on Cloudflare')
        continue
    z = zones[0]
    zid = z['id']
    print(f'Zone: id={zid}  status={z.get("status")}  name_servers={z.get("name_servers")}  original_ns={z.get("original_name_servers")}')

    # Worker routes
    r = requests.get(f'https://api.cloudflare.com/client/v4/zones/{zid}/workers/routes', headers=HDR, timeout=15)
    routes = r.json().get('result', [])
    print(f'\nWorker routes ({len(routes)}):')
    for rt in routes:
        print(f'  • pattern={rt.get("pattern"):60s} script={rt.get("script")}')

    # KV check — read bypass:{domain} from BANNED_IPS
    # First need KV namespace
    r = requests.get('https://api.cloudflare.com/client/v4/accounts/ed6035ebf6bd3d85f5b26c60189a21e2/storage/kv/namespaces', headers=HDR, timeout=15, params={'per_page': 100})
    nss = r.json().get('result', [])
    banned_ns = next((n for n in nss if n.get('title') == 'BANNED_IPS'), None)
    if banned_ns:
        nsid = banned_ns['id']
        print(f'\nKV namespace BANNED_IPS = {nsid}')
        # Check the bypass value
        r = requests.get(f'https://api.cloudflare.com/client/v4/accounts/ed6035ebf6bd3d85f5b26c60189a21e2/storage/kv/namespaces/{nsid}/values/bypass:{domain}', headers=HDR, timeout=15)
        if r.status_code == 200:
            print(f'  bypass:{domain} = {r.text!r}')
        else:
            print(f'  bypass:{domain} NOT SET (status {r.status_code})')
        # Also check www variant
        r = requests.get(f'https://api.cloudflare.com/client/v4/accounts/ed6035ebf6bd3d85f5b26c60189a21e2/storage/kv/namespaces/{nsid}/values/bypass:www.{domain}', headers=HDR, timeout=15)
        if r.status_code == 200:
            print(f'  bypass:www.{domain} = {r.text!r}')
        else:
            print(f'  bypass:www.{domain} NOT SET (status {r.status_code})')
