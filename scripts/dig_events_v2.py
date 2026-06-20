#!/usr/bin/env python3
"""Better Railway environmentLogs analyzer using anchorDate+beforeLimit pagination.
This is the working query mode for substring filtering against historical logs."""
import json, urllib.request, urllib.error, sys, time
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'

def gql(q,v=None):
    req=urllib.request.Request(URL, data=json.dumps({'query':q,'variables':v or {}}).encode(),
        headers={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN})
    try: return json.load(urllib.request.urlopen(req,timeout=90))
    except urllib.error.HTTPError as e: return {'_err':e.code,'body':e.read().decode()[:300]}


def fetch_back(anchor_iso, floor_iso, flt, page=500, max_pages=30):
    """Paginate backwards from anchor_iso, stopping at floor_iso."""
    q='''query Q($e:String!, $anchor:String!, $f:String, $lim:Int!){
      environmentLogs(environmentId:$e, anchorDate:$anchor, filter:$f, beforeLimit:$lim){
        timestamp message severity tags { serviceId }
      }
    }'''
    out=[]; cursor=anchor_iso
    for _ in range(max_pages):
        r=gql(q, {'e':ENV,'anchor':cursor,'f':flt,'lim':page})
        if 'errors' in r or '_err' in r: return out
        logs=r['data']['environmentLogs'] or []
        if not logs: break
        out.extend(logs)
        # logs come in NEWEST-first order? Let's check by looking at returned range
        # earlier test showed range: 2026-06-20T20:17 → 2026-06-19T13:49, so newest is first
        oldest=min(l['timestamp'] for l in logs)
        newest=max(l['timestamp'] for l in logs)
        if oldest <= floor_iso:
            # we crossed the floor, keep only those within window
            return [l for l in out if l['timestamp'] >= floor_iso]
        cursor=oldest  # paginate further back
        if len(logs)<page: break
    return out


def main():
    now=datetime.now(timezone.utc)
    floor=(now - timedelta(days=6)).replace(hour=0,minute=0,second=0,microsecond=0)
    floor_iso=floor.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    anchor_iso=now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window {floor_iso} → {anchor_iso}\n')

    FILTERS = {
        # 🛒 sales events
        'deposit/topup':        'deposit',
        'wallet':               'wallet',
        'BlockBee':             'BlockBee',
        'Fincra':               'Fincra',
        'DynoPay':              'DynoPay',
        'crypto invoice':       'crypto invoice',
        'NowPayments':          'NowPayments',
        'Stripe':               'Stripe',
        # 🧾 orders
        'order':                'order',
        'invoice':              'invoice',
        'paid successfully':    'paid successfully',
        'underpaid':            'underpaid',
        'overpaid':             'overpaid',
        # 🌐 products purchased
        'domain registered':    'domain registered',
        'VPS created':          'VPS created',
        'phone purchased':      'phone purchased',
        'phone number bought':  'phone number bought',
        'SMS sent':             'SMS sent',
        # 🤖 user activity
        '/start command':       '/start',
        'callback_query':       'callback_query',
        'register user':        'register user',
        # ❌ errors / drop-off signals
        'ERROR':                'ERROR',
        'CRITICAL':             'CRITICAL',
        'uncaughtException':    'uncaughtException',
        'unhandledRejection':   'unhandledRejection',
        'MongoError':           'MongoError',
        'ETIMEDOUT':            'ETIMEDOUT',
        '500 Internal':         '500 Internal',
        'Forbidden':            'Forbidden',
        'bot was blocked':      'bot was blocked',
        'left the chat':        'left the chat',
        'fee calculation':      'Fee calculation',
        'INSUFFICIENT':         'INSUFFICIENT',
        'payment failed':       'payment failed',
        'webhook failed':       'webhook failed',
        'price oracle':         'price-oracle',
    }

    results={}
    print(f'{"Filter":<22}  {"Total":>5}  Daily breakdown                                 Flag')
    print('-'*100)
    for name, flt in FILTERS.items():
        logs = fetch_back(anchor_iso, floor_iso, flt, page=500, max_pages=30)
        # restrict to actual window
        logs = [l for l in logs if l['timestamp'] >= floor_iso]
        total = len(logs)
        by_day = Counter(l['timestamp'][:10] for l in logs)
        days_str = ' '.join(f'{d[5:]}={by_day[d]:>3}' for d in sorted(by_day.keys()))
        flag=''
        if total>0 and by_day:
            sd=sorted(by_day)
            last=by_day[sd[-1]]; others=[by_day[d] for d in sd[:-1]]
            avg=sum(others)/len(others) if others else 0
            if avg and last<avg*0.4: flag='  ⬇⬇DROP'
            elif avg and last>avg*2.5: flag='  ⬆⬆SPIKE'
        results[name] = {
            'total': total,
            'by_day': dict(by_day),
            'sample_messages': [l['message'][:200] for l in logs[:10]],
        }
        print(f'  {name:<22} {total:>5}  {days_str}{flag}')

    with open('/app/logs_prod/_6day_business_events.json','w') as f:
        json.dump(results, f, indent=2)
    print('\nSaved → /app/logs_prod/_6day_business_events.json')


if __name__=='__main__': main()
