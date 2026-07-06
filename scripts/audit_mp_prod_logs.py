#!/usr/bin/env python3
"""Fetch Railway prod logs for marketplace-related events using project-scoped token."""
import os, sys, json, urllib.request
from datetime import datetime, timedelta, timezone

# .env
env = {}
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

TOKEN      = env['API_KEY_RAILWAY']  # project-scoped
ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
ENDPOINT   = 'https://backboard.railway.app/graphql/v2'

def gql(query, variables=None):
    body = json.dumps({'query': query, 'variables': variables or {}}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Project-Access-Token': TOKEN,
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

# Fetch env logs — use environmentLogs (works with project-scoped token)
q = """query Q($e:String!,$a:String!,$f:String,$lim:Int){
  environmentLogs(environmentId:$e,anchorDate:$a,filter:$f,beforeLimit:$lim){
    timestamp message severity tags { serviceId } } }"""

# Fetch marketplace-related logs for the last 14 days across all chunks (500 lines each)
now  = datetime.now(timezone.utc)
end  = now
start = now - timedelta(days=14)

seen = set()
out = []
cursor = end
for filter_str in ['Marketplace', 'mp:pay_access', 'MP paywall', 'mpSellerPaywall']:
    cursor = end
    per_filter = 0
    while cursor > start:
        anchor = cursor.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        r = gql(q, {'e': ENV_ID, 'a': anchor, 'f': filter_str, 'lim': 500})
        if 'errors' in r and r['errors']:
            print(f'  [{filter_str}] err: {r["errors"]}', file=sys.stderr); break
        logs = r['data']['environmentLogs'] or []
        new = 0
        for l in logs:
            k = (l['timestamp'], l['message'][:100])
            if k in seen: continue
            seen.add(k); out.append(l); new += 1; per_filter += 1
        if not logs or new == 0: break
        cursor = cursor - timedelta(hours=6)
    print(f'  filter="{filter_str}": {per_filter} new', file=sys.stderr)

out.sort(key=lambda l: l['timestamp'])
print(f'\nTotal unique marketplace-tagged log lines (last 14 days): {len(out)}\n')

# Bucket by day
by_day = {}
for l in out:
    d = l['timestamp'][:10]
    by_day.setdefault(d, []).append(l)

for d in sorted(by_day):
    print(f'━━━ {d}: {len(by_day[d])} lines ━━━')

print(f'\n─── Latest 60 lines ───')
for l in out[-60:]:
    print(f'[{l["timestamp"][:19]}] {(l["message"] or "").strip()[:260]}')
