#!/usr/bin/env python3
"""Pull environmentLogs filtered to important business events over last 6 days.
Counts per day per filter and shows sample messages."""
import json, urllib.request, urllib.error, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'

def gql(q,v=None):
    req=urllib.request.Request(URL,
        data=json.dumps({'query':q,'variables':v or {}}).encode(),
        headers={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN})
    try: return json.load(urllib.request.urlopen(req,timeout=90))
    except urllib.error.HTTPError as e: return {'_err':e.code,'body':e.read().decode()[:300]}


def fetch(after_iso, before_iso, flt, page=500, max_pages=20):
    q='''query Q($e:String!, $a:String!, $b:String, $f:String, $lim:Int){
      environmentLogs(environmentId:$e, afterDate:$a, beforeDate:$b, filter:$f, afterLimit:$lim){
        timestamp message severity tags { serviceId }
      }
    }'''
    out=[]; cursor=after_iso
    for _ in range(max_pages):
        r=gql(q, {'e':ENV,'a':cursor,'b':before_iso,'f':flt,'lim':page})
        if 'errors' in r or '_err' in r: return out
        logs=r['data']['environmentLogs'] or []
        if not logs: break
        out.extend(logs)
        last=logs[-1]['timestamp']
        if last <= cursor: break
        cursor=last
        if len(logs)<page: break
    return out


def main():
    now=datetime.now(timezone.utc)
    start=(now - timedelta(days=6)).replace(hour=0,minute=0,second=0,microsecond=0)
    a=start.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    b=now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window {a} → {b}')

    # Business event filters - tuned to Nomadly's log style
    FILTERS = {
        'user_start':      '/start',
        'btn_callback':    'callback_query',
        'wallet_credit':   'wallet credited',
        'deposit_created': 'deposit created',
        'deposit_done':    'deposit completed',
        'BlockBee':        'BlockBee',
        'Fincra':          'Fincra',
        'DynoPay':         'DynoPay',
        'crypto_wallet':   'crypto wallet',
        'order_created':   'order created',
        'order_paid':      'order paid',
        'domain_register': 'domain registered',
        'domain_failed':   'domain failed',
        'vps_create':      'VPS created',
        'phone_buy':       'phone number purchased',
        'sms_buy':         'SMS purchased',
        'tg_blocked':      'bot was blocked',
        'tg_chat_left':    'left the chat',
        'forbidden':       'Forbidden',
        '500_err':         '"status":500',
        'ETIMEDOUT':       'ETIMEDOUT',
        'uncaught':        'uncaughtException',
        'unhandled':       'unhandledRejection',
        'MongoError':      'MongoError',
        'price_oracle':    'price-oracle',
        'webhook_err':     'webhook error',
        'BTC_balance':     'balance',
        'underpaid':       'underpaid',
        'half_credit':     'credited',
        'restart':         'PhoneScheduler',     # often appears on every restart
    }

    summary = {}
    for name, flt in FILTERS.items():
        logs = fetch(a, b, flt, page=500, max_pages=8)
        total = len(logs)
        by_day = Counter(l['timestamp'][:10] for l in logs)
        days = ' '.join(f'{d[5:]}={by_day[d]}' for d in sorted(by_day.keys()))
        sample = logs[0]['message'][:140].replace('\n',' ') if logs else ''
        summary[name] = {'total': total, 'by_day': dict(by_day), 'sample': sample, 'all_messages': [l['message'][:200] for l in logs[:30]]}
        # crude flag
        flag=''
        if total>0 and by_day:
            sd=sorted(by_day)
            last=by_day[sd[-1]]
            others=[by_day[d] for d in sd[:-1]]
            avg=sum(others)/len(others) if others else 0
            if avg and last<avg*0.4: flag='  ⬇⬇ DROP'
            elif avg and last>avg*2.5: flag='  ⬆⬆ SPIKE'
        print(f'  {name:<18} total={total:>5}  {days}{flag}')
        if logs and name in ('half_credit','underpaid','uncaught','unhandled','MongoError','tg_blocked','BlockBee','Fincra','DynoPay','order_paid','wallet_credit','domain_register','phone_buy','sms_buy','vps_create'):
            print(f'    ↳ sample: {sample}')

    with open('/app/logs_prod/_business_events.json','w') as f:
        json.dump(summary, f, indent=2)
    print('\nSaved → /app/logs_prod/_business_events.json')


if __name__=='__main__': main()
