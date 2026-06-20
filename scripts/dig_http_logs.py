#!/usr/bin/env python3
"""Dig into Nomadly-EMAIL-IVR httpLogs across all deployments in the last 6 days.
Aggregates by status, path, method, srcIp, clientUa, host to find what is causing
the 4xx flood and the 2xx drop-off."""
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
    out = []
    after = None
    for _ in range(8):
        r = gql(q, {'e': ENV, 's': SID, 'after': after})
        for ed in r['data']['deployments']['edges']:
            out.append((ed['node']['id'], ed['node']['status'], ed['node']['createdAt']))
        pi = r['data']['deployments']['pageInfo']
        if not pi['hasNextPage']:
            break
        after = pi['endCursor']
        if out[-1][2] < '2026-06-13':
            break
    return out


def fetch_logs(dep_id, after_iso, before_iso, page=500, max_pages=10):
    q = '''query H($d:String!, $a:String!, $b:String, $lim:Int){
      httpLogs(deploymentId:$d, afterDate:$a, beforeDate:$b, afterLimit:$lim){
        timestamp httpStatus method path srcIp clientUa host responseDetails
      }
    }'''
    out = []
    cursor = after_iso
    for _ in range(max_pages):
        r = gql(q, {'d': dep_id, 'a': cursor, 'b': before_iso, 'lim': page})
        if '_err' in r or 'errors' in r:
            return out
        logs = r['data']['httpLogs'] or []
        if not logs:
            break
        out.extend(logs)
        last = logs[-1]['timestamp']
        if last <= cursor:
            break
        cursor = last
        if len(logs) < page:
            break
    return out


def main():
    # 6 day window
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    end_iso = now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window: {start_iso} → {end_iso}')

    deps = list_deployments()
    print(f'Discovered {len(deps)} deployments')
    relevant = [d for d in deps if d[2] >= '2026-06-13']
    # also include the most recent one before the window so we cover the first hours of 06-14
    if not any(d[2] < '2026-06-14' for d in relevant):
        older = [d for d in deps if d[2] < '2026-06-14']
        if older:
            relevant.append(older[0])
    print(f'Querying httpLogs from {len(relevant)} deployments')

    all_logs = []
    for i, (dep_id, status, created) in enumerate(relevant):
        logs = fetch_logs(dep_id, start_iso, end_iso, page=500, max_pages=6)
        all_logs.extend(logs)
        sys.stdout.write(f'\r  [{i+1}/{len(relevant)}] {dep_id[:8]} {created[:19]} status={status[:7]} got={len(logs):>4}, total={len(all_logs):>5}')
        sys.stdout.flush()
    print()

    print(f'\nTotal http log lines fetched: {len(all_logs)}')

    # Per-day status breakdown
    print('\n── Status code by day ──')
    by_day_status = defaultdict(Counter)
    for l in all_logs:
        d = l['timestamp'][:10]
        by_day_status[d][l['httpStatus']] += 1
    for d in sorted(by_day_status):
        cnts = by_day_status[d]
        s2 = sum(v for k,v in cnts.items() if 200<=k<300)
        s3 = sum(v for k,v in cnts.items() if 300<=k<400)
        s4 = sum(v for k,v in cnts.items() if 400<=k<500)
        s5 = sum(v for k,v in cnts.items() if 500<=k<600)
        print(f'  {d}  total={s2+s3+s4+s5:>5}  2xx={s2:>5}  3xx={s3:>4}  4xx={s4:>5}  5xx={s5:>3}')

    # Top 4xx paths
    fourxx = [l for l in all_logs if 400 <= l['httpStatus'] < 500]
    print(f'\n── 4xx requests = {len(fourxx)} ──')
    print('\nTop 30 (method, path, status) for 4xx:')
    c = Counter((l['method'], l['path'][:100], l['httpStatus']) for l in fourxx)
    for (m, p, s), n in c.most_common(30):
        print(f'  [{s}] {n:>5}  {m:<6}  {p}')

    print('\nTop 15 srcIp for 4xx:')
    for ip, n in Counter(l['srcIp'] for l in fourxx).most_common(15):
        print(f'  {n:>5}  {ip}')

    print('\nTop 15 clientUa (truncated) for 4xx:')
    for ua, n in Counter(l['clientUa'][:80] for l in fourxx).most_common(15):
        print(f'  {n:>5}  {ua}')

    print('\nTop 10 host for 4xx:')
    for h, n in Counter(l['host'] for l in fourxx).most_common(10):
        print(f'  {n:>5}  {h}')

    print('\nTop 10 responseDetails for 4xx:')
    for rd, n in Counter(l['responseDetails'][:80] for l in fourxx).most_common(10):
        print(f'  {n:>5}  {rd}')

    # 2xx breakdown
    twoxx = [l for l in all_logs if 200 <= l['httpStatus'] < 300]
    print(f'\n── 2xx requests = {len(twoxx)} ──')
    print('\nTop 20 paths for 2xx:')
    for (m, p), n in Counter((l['method'], l['path'][:80]) for l in twoxx).most_common(20):
        print(f'  {n:>5}  {m:<6}  {p}')

    print('\nTop 10 host for 2xx:')
    for h, n in Counter(l['host'] for l in twoxx).most_common(10):
        print(f'  {n:>5}  {h}')

    print('\nTop 10 clientUa for 2xx (truncated):')
    for ua, n in Counter(l['clientUa'][:80] for l in twoxx).most_common(10):
        print(f'  {n:>5}  {ua}')

    # Save raw sample
    with open('/app/logs_prod/_http_sample.json', 'w') as f:
        json.dump(all_logs[:2000], f, indent=2)
    print(f'\nSaved 2000-log sample → /app/logs_prod/_http_sample.json')


if __name__ == '__main__':
    main()
