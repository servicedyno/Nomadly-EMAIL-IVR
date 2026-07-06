#!/usr/bin/env python3
"""Bot UX anomaly scan — last 6 days, Nomadly-EMAIL-IVR.
Looks for things real users can see / feel:
  - User-visible error replies ("⚠️ ...", "❌ ...", "Sorry, try again")
  - Slow handlers (response time > 3s)
  - Stuck flows (user starts a flow, never finishes)
  - Repeat-message loops (user spamming retries)
  - Callback timeouts / "query is too old"
  - Payment confirmation delays
  - Insufficient balance walls
  - Block / left chat events
  - Mid-conversation crashes
"""
import json, urllib.request, urllib.error, re, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'


def gql(q, v):
    req = urllib.request.Request(URL,
        data=json.dumps({'query': q, 'variables': v}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': UA, 'Project-Access-Token': TOKEN})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except urllib.error.HTTPError as e:
        return {'_err': e.code, 'body': e.read().decode()[:300]}


def paginate(flt, anchor, floor, max_pages=40):
    q = '''query Q($e:String!, $a:String!, $f:String!, $lim:Int!){
      environmentLogs(environmentId:$e, anchorDate:$a, filter:$f, beforeLimit:$lim){
        timestamp message severity tags { serviceId }
      }
    }'''
    out = []
    cursor = anchor
    for _ in range(max_pages):
        r = gql(q, {'e': ENV, 'a': cursor, 'f': flt, 'lim': 500})
        if 'errors' in r or '_err' in r: return out
        logs = r['data']['environmentLogs'] or []
        if not logs: break
        out.extend(logs)
        oldest = min(l['timestamp'] for l in logs)
        if oldest <= floor: break
        cursor = oldest
        if len(logs) < 500: break
    return [l for l in out if l['timestamp'] >= floor]


def main():
    now = datetime.now(timezone.utc)
    floor = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
    floor_iso = floor.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    anchor_iso = (now + timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window: {floor_iso} → {anchor_iso}\n')

    # ── UX-facing signals ──
    UX_FILTERS = {
        # what the user SEES
        '⚠️ warning emoji':       '⚠️',
        '❌ error emoji':          '❌',
        '😔 sad emoji':            '😔',
        '🚫 prohibition':          '🚫',
        '⏰ time/wait emoji':      '⏰',
        '🔄 retry emoji':          '🔄',
        '🆘 help emoji':           '🆘',
        'try again later':         'try again later',
        'try again':               'try again',
        'something went wrong':    'something went wrong',
        'unable to':               'unable to',
        'failed to':               'failed to',
        'please contact':          'please contact',
        'temporarily unavailable': 'temporarily unavailable',
        'Insufficient balance':    'Insufficient balance',
        'Insufficient funds':      'Insufficient funds',
        'not available':           'not available',
        'maintenance':             'maintenance',
        # bot internals affecting UX
        'query is too old':        'query is too old',  # callback expired
        'Bad Request: query':      'Bad Request',
        'message is not modified': 'message is not modified',
        'message to edit not found':'message to edit not found',
        'TIMEOUT':                 'TIMEOUT',
        'ETIMEDOUT':               'ETIMEDOUT',
        'ECONNRESET':              'ECONNRESET',
        'rate limit':              'rate limit',
        'rate_limit':              'rate_limit',
        'Too Many Requests':       'Too Many Requests',
        # user-trust events
        'bot was blocked':         'bot was blocked',
        'Forbidden: bot was':      'Forbidden: bot was',
        'user is deactivated':     'user is deactivated',
        'left the chat':           'left the chat',
        # flow completion checkpoints
        '/start':                  '/start',
        'main_menu':               'main_menu',
        'register user':           'register user',
        'deposit confirmed':       'deposit confirmed',
        'payment confirmed':       'payment confirmed',
        'domain registered':       'domain registered',
        'phone purchased':         'phone purchased',
        'VPS created':             'VPS created',
        # slow ops indicators
        'took':                    'took',  # we'll filter for "took ...s" >3s
        'took longer':             'took longer',
        'slow':                    'slow query',
        'duration_ms':             'duration_ms',
    }

    print(f'{"signal":<28} {"total":>5}   daily breakdown')
    print('-'*100)
    summary = {}
    for name, flt in UX_FILTERS.items():
        logs = paginate(flt, anchor_iso, floor_iso, max_pages=20)
        total = len(logs)
        by_day = Counter(l['timestamp'][:10] for l in logs)
        days = ' '.join(f'{d[5:]}={by_day[d]:>3}' for d in sorted(by_day.keys()))
        # capture a few samples
        summary[name] = {
            'filter': flt,
            'total': total,
            'by_day': dict(by_day),
            'samples': [l['message'][:240].replace('\n', ' ') for l in logs[:8]],
        }
        flag = ''
        if total > 0 and by_day:
            sd = sorted(by_day)
            last = by_day[sd[-1]]
            others = [by_day[d] for d in sd[:-1]]
            avg = sum(others)/len(others) if others else 0
            if avg and last > avg * 2.2: flag = '  ⬆⬆SPIKE'
            elif avg and last < avg * 0.35: flag = '  ⬇⬇DROP'
        print(f'  {name:<28} {total:>5}   {days}{flag}')

    with open('/app/logs_prod/_ux_signals.json', 'w') as f:
        json.dump(summary, f, indent=2)
    print('\nSaved → /app/logs_prod/_ux_signals.json')

    # ── Now dig into top UX issues ──
    print('\n══════════════════════════════════════════════════════════════')
    print('  TOP UX-IMPACT SIGNALS — sample messages')
    print('══════════════════════════════════════════════════════════════')
    spotlight = [
        '⚠️ warning emoji', '❌ error emoji', 'Insufficient balance',
        'try again later', 'failed to', 'query is too old',
        'message to edit not found', 'bot was blocked', 'TIMEOUT',
    ]
    for k in spotlight:
        if summary.get(k, {}).get('total', 0):
            print(f'\n── {k} (total={summary[k]["total"]}) ──')
            seen=set()
            for s in summary[k]['samples']:
                key = re.sub(r'\d{6,}', '<id>', s)[:120]
                if key in seen: continue
                seen.add(key)
                print(f'  • {s[:200]}')
                if len(seen) >= 5: break


if __name__ == '__main__':
    main()
