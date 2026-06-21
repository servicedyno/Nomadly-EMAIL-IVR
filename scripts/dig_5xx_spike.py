#!/usr/bin/env python3
"""Drill into 5xx spike on 06-20/06-21 — fetch httpLogs per deployment and aggregate."""
import json, urllib.request, urllib.error, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'
SID='b9c4ad64-7667-4dd3-8b9a-3867ede47885'   # Nomadly-EMAIL-IVR


def gql(q, v=None):
    req = urllib.request.Request(URL,
        data=json.dumps({'query': q, 'variables': v or {}}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': UA, 'Project-Access-Token': TOKEN})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        return {'_err': e.code, 'body': e.read().decode()[:300]}


def list_deployments():
    q = '''query D($e:String!, $s:String!, $after:String){
      deployments(first:50, after:$after, input:{environmentId:$e, serviceId:$s}){
        edges{ node{ id status createdAt } } pageInfo{ hasNextPage endCursor }
      }
    }'''
    out, after = [], None
    for _ in range(8):
        r = gql(q, {'e': ENV, 's': SID, 'after': after})
        for ed in r['data']['deployments']['edges']:
            out.append((ed['node']['id'], ed['node']['status'], ed['node']['createdAt']))
        pi = r['data']['deployments']['pageInfo']
        if not pi['hasNextPage']: break
        after = pi['endCursor']
        if out[-1][2] < '2026-06-19': break
    return out


def fetch_logs(dep_id, after_iso, before_iso, page=500, max_pages=8):
    q = '''query H($d:String!, $a:String!, $lim:Int){
      httpLogs(deploymentId:$d, anchorDate:$a, beforeLimit:$lim){
        timestamp httpStatus method path srcIp clientUa host responseDetails totalDuration
      }
    }'''
    seen = set()
    out = []
    # walk anchor backwards in 2h chunks from before_iso to after_iso
    cursor_dt = datetime.strptime(before_iso[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    start_dt = datetime.strptime(after_iso[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    while cursor_dt > start_dt:
        a_iso = cursor_dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        r = gql(q, {'d': dep_id, 'a': a_iso, 'lim': page})
        if '_err' in r or 'errors' in r:
            return out
        logs = r['data']['httpLogs'] or []
        if not logs: break
        new = 0
        for l in logs:
            k = (l['timestamp'], l['path'], l['httpStatus'])
            if k not in seen:
                seen.add(k); out.append(l); new += 1
        cursor_dt -= timedelta(hours=2)
        if new == 0: break
    return out


def main():
    # Last 32h window — covers 06-20 and 06-21 spike
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=32)
    start_iso = start.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    end_iso = now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window: {start_iso} → {end_iso}\n')

    deps = list_deployments()
    print(f'Discovered {len(deps)} deployments')
    # All deployments active during the window
    relevant = [d for d in deps if d[2] >= '2026-06-19T00:00:00']
    if not any(d[2] < '2026-06-19T00:00:00' for d in relevant):
        older = [d for d in deps if d[2] < '2026-06-19T00:00:00']
        if older: relevant.append(older[0])
    print(f'Querying httpLogs from {len(relevant)} deployments\n')

    all_logs = []
    for i, (dep_id, status, created) in enumerate(relevant):
        logs = fetch_logs(dep_id, start_iso, end_iso, page=500, max_pages=6)
        all_logs.extend(logs)
        sys.stdout.write(f'\r  [{i+1}/{len(relevant)}] {dep_id[:8]} {created[:19]} {status[:7]} got={len(logs):>4} total={len(all_logs):>5}')
        sys.stdout.flush()
    print(f'\n\nTotal fetched: {len(all_logs)}')

    # Filter to 5xx only
    fivexx = [l for l in all_logs if 500 <= l['httpStatus'] < 600]
    print(f'\n5xx count: {len(fivexx)}\n')

    # By hour
    print('── 5xx by hour (UTC) ──')
    by_hr = Counter(l['timestamp'][:13] for l in fivexx)
    for h in sorted(by_hr.keys()):
        print(f'  {h}h  {by_hr[h]:>5}')

    print('\n── 5xx by status code ──')
    for s, n in Counter(l['httpStatus'] for l in fivexx).most_common():
        print(f'  [{s}] {n:>5}')

    print('\n── Top 20 paths returning 5xx ──')
    for (m, p, s), n in Counter((l['method'], l['path'][:80], l['httpStatus']) for l in fivexx).most_common(20):
        print(f'  [{s}] {n:>5}  {m:<6} {p}')

    print('\n── Top 10 hosts returning 5xx ──')
    for h, n in Counter(l['host'] for l in fivexx).most_common(10):
        print(f'  {n:>5}  {h}')

    print('\n── Top 10 srcIp for 5xx ──')
    for ip, n in Counter(l['srcIp'] for l in fivexx).most_common(10):
        print(f'  {n:>5}  {ip}')

    print('\n── Top 10 responseDetails for 5xx ──')
    for rd, n in Counter(l['responseDetails'][:120] for l in fivexx).most_common(10):
        print(f'  {n:>5}  {rd}')

    print('\n── Top 10 clientUa for 5xx ──')
    for ua, n in Counter(l['clientUa'][:80] for l in fivexx).most_common(10):
        print(f'  {n:>5}  {ua}')

    print('\n── First 5 raw 5xx samples ──')
    for l in fivexx[:5]:
        print(f'  {l["timestamp"][:19]} {l["httpStatus"]} {l["method"]} {l["path"][:80]} | dur={l.get("totalDuration")}ms | rd={(l.get("responseDetails") or "")[:60]}')

    # Persist
    with open('/app/logs_prod/_5xx_drilldown.json', 'w') as f:
        json.dump({'window': [start_iso, end_iso], 'count': len(fivexx),
                   'samples': fivexx[:200]}, f, indent=2)
    print('\nSaved → /app/logs_prod/_5xx_drilldown.json')


if __name__ == '__main__':
    main()
