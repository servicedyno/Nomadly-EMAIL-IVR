#!/usr/bin/env python3
"""Pull /telegram/webhook traffic + app-level errors for last 6 days.
Aggregate across all Nomadly deployments and visualize daily activity."""
import json, urllib.request, urllib.error, sys, time
from collections import Counter, defaultdict

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'
SID='b9c4ad64-7667-4dd3-8b9a-3867ede47885'

def gql(q, v=None, retries=2):
    for i in range(retries+1):
        req=urllib.request.Request(URL,
            data=json.dumps({'query':q,'variables':v or {}}).encode(),
            headers={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN})
        try:
            return json.load(urllib.request.urlopen(req,timeout=90))
        except urllib.error.HTTPError as e:
            if i==retries: return {'_err':e.code,'body':e.read().decode()[:300]}
            time.sleep(2)

def deployments():
    q='''query D($e:String!, $s:String!, $after:String){
      deployments(first:50, after:$after, input:{environmentId:$e, serviceId:$s}){
        edges{ node{ id status createdAt } } pageInfo{ hasNextPage endCursor }
      }
    }'''
    out=[]; after=None
    for _ in range(5):
        r=gql(q,{'e':ENV,'s':SID,'after':after})
        for ed in r['data']['deployments']['edges']:
            out.append((ed['node']['id'], ed['node']['createdAt']))
        pi=r['data']['deployments']['pageInfo']
        if not pi['hasNextPage']: break
        after=pi['endCursor']
        if out[-1][1] < '2026-06-13': break
    return out


def fetch_http(dep_id, before_iso, lim=5000):
    q='''query H($d:String!, $b:String!, $lim:Int!){
      httpLogs(deploymentId:$d, beforeDate:$b, beforeLimit:$lim){
        timestamp httpStatus method path srcIp host
      }
    }'''
    r=gql(q,{'d':dep_id,'b':before_iso,'lim':lim})
    if 'errors' in r or '_err' in r: return []
    return r['data']['httpLogs'] or []


def main():
    deps=deployments()
    print(f'Deployments: {len(deps)}')
    relevant=[d for d in deps if d[0] in {d[0] for d in deps}]  # all
    print(f'Querying httpLogs for last-6-day window across {len(relevant)} deployments')

    all_logs=[]
    for i,(dep_id,created) in enumerate(relevant):
        # query for logs up to "now" for active dep, up to next-dep-creation for removed
        next_t='2026-06-21T00:00:00Z'
        if i>0:
            # the deployment ABOVE this one in the list (later created) → query before that point
            next_t = relevant[i-1][1]  # since deps are sorted desc by createdAt
        logs = fetch_http(dep_id, next_t, lim=5000)
        all_logs.extend(logs)
        sys.stdout.write(f'\r  [{i+1}/{len(relevant)}] {dep_id[:8]} {created[:19]} got={len(logs):>5}, total={len(all_logs):>6}')
        sys.stdout.flush()
    print()
    print(f'\nTotal httpLogs: {len(all_logs)}')

    # Filter to last 6 days
    cutoff='2026-06-14T00:00:00Z'
    all_logs=[l for l in all_logs if l['timestamp'] >= cutoff]
    print(f'Filtered to last 6 days: {len(all_logs)}')

    # Per-day breakdown
    print('\n── Daily status code distribution ──')
    by_day=defaultdict(Counter)
    for l in all_logs:
        by_day[l['timestamp'][:10]][l['httpStatus']] += 1
    for d in sorted(by_day):
        c=by_day[d]
        s2=sum(v for k,v in c.items() if 200<=k<300)
        s3=sum(v for k,v in c.items() if 300<=k<400)
        s4=sum(v for k,v in c.items() if 400<=k<500)
        s5=sum(v for k,v in c.items() if 500<=k<600)
        print(f'  {d}  tot={s2+s3+s4+s5:>5}  2xx={s2:>4}  3xx={s3:>3}  4xx={s4:>5}  5xx={s5}')

    # Filter out the scanner noise and focus on real app traffic
    NOISE_PATHS = ('/con5dldbuy.php', '/con5dld', '/con5dldrobots.txt', '/downlod', '/robots.txt', '/favicon.ico', '/.env', '/.git')
    real_logs = [l for l in all_logs if not any(l['path'].startswith(p) for p in NOISE_PATHS)]
    print(f'\n── Real (non-scanner) requests: {len(real_logs)} ──')

    print('\n── Real traffic by day ──')
    rby=defaultdict(Counter)
    for l in real_logs:
        rby[l['timestamp'][:10]][l['httpStatus']] += 1
    for d in sorted(rby):
        c=rby[d]
        s2=sum(v for k,v in c.items() if 200<=k<300)
        s3=sum(v for k,v in c.items() if 300<=k<400)
        s4=sum(v for k,v in c.items() if 400<=k<500)
        s5=sum(v for k,v in c.items() if 500<=k<600)
        print(f'  {d}  tot={s2+s3+s4+s5:>5}  2xx={s2:>4}  3xx={s3:>3}  4xx={s4:>4}  5xx={s5}')

    # Telegram webhook specifically
    tg = [l for l in real_logs if '/telegram/webhook' in l['path']]
    print(f'\n── /telegram/webhook requests: {len(tg)} ──')
    tg_by_day=Counter(l['timestamp'][:10] for l in tg)
    for d in sorted(tg_by_day):
        print(f'  {d}  count={tg_by_day[d]}')

    # Top paths in real traffic
    print('\n── Top 30 paths in REAL traffic (across 6 days) ──')
    for (m,p,s),c in Counter((l['method'],l['path'][:80],l['httpStatus']) for l in real_logs).most_common(30):
        print(f'  [{s}] {c:>5}  {m:<6}  {p}')

    # Hourly view of last 36 hours
    print('\n── Hourly /telegram/webhook activity (last 48h) ──')
    h_tg=Counter(l['timestamp'][:13] for l in tg)
    for h in sorted(h_tg.keys())[-48:]:
        bar='#' * min(60,h_tg[h])
        print(f'  {h}  {h_tg[h]:>4}  {bar}')

    with open('/app/logs_prod/_real_traffic.json','w') as f:
        json.dump(real_logs[:5000], f, indent=2)
    print('\nSaved real traffic sample → /app/logs_prod/_real_traffic.json')


if __name__=='__main__': main()
