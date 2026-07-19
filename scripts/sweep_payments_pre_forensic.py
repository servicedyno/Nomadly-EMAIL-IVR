#!/usr/bin/env python3
"""READ-ONLY deep sweep of the `payments` collection for over-credits that
predate forensic logging (2026-06-18). Detects underpayment over-credits by
comparing credited USD (CSV col 3) vs actual market value of crypto received
(col 7). USDT = stablecoin ground-truth; volatile coins use CoinGecko daily
historical prices (bulk range fetch, 1 call/coin)."""
import os, json, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME','test')]
FORENSIC_CUTOFF = datetime(2026, 6, 18, tzinfo=timezone.utc)

CG_ID = {'BTC':'bitcoin','ETH':'ethereum','LTC':'litecoin','DOGE':'dogecoin',
         'BCH':'bitcoin-cash','TRX':'tron'}

def parse_date(s):
    # "Sun Apr 19 2026 10:08:24 GMT+0000 (Coordinated Universal Time)"
    try:
        core = s.split(' GMT')[0].strip()
        return datetime.strptime(core, '%a %b %d %Y %H:%M:%S').replace(tzinfo=timezone.utc)
    except Exception:
        return None

def coin_base(coin):
    c = coin.upper()
    if c.startswith('USDT'):
        return 'USDT'
    return c

# ---- fetch historical daily prices per volatile coin (bulk) ----
def fetch_price_map(cg_id, frm, to):
    url = (f"https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart/range"
           f"?vs_currency=usd&from={int(frm)}&to={int(to)}")
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'nomadly-audit'})
            data = json.loads(urllib.request.urlopen(req, timeout=30).read())
            m = {}
            for ts_ms, price in data.get('prices', []):
                d = datetime.fromtimestamp(ts_ms/1000, tz=timezone.utc).strftime('%Y-%m-%d')
                m[d] = price  # last price for the day wins
            return m
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(12); continue
            print(f"  [price] {cg_id} HTTP {e.code}"); return {}
        except Exception as e:
            print(f"  [price] {cg_id} err {e}"); time.sleep(5)
    return {}

# ---- gather all crypto payments ----
rows = []
for p in db.payments.find({'val': {'$regex': '^Crypto,'}}):
    parts = (p.get('val') or '').split(',')
    if len(parts) < 8:
        continue
    ptype = parts[1]
    credited = parts[3].replace('$','').strip()
    chatId = parts[4]
    name = parts[5]
    dt = parse_date(parts[6])
    amt_coin = parts[7].strip().split()
    if len(amt_coin) != 2 or dt is None:
        continue
    try:
        amount = float(amt_coin[0]); credited = float(credited)
    except Exception:
        continue
    rows.append({'ref': p['_id'], 'ptype': ptype, 'credited': credited,
                 'chatId': chatId, 'name': name, 'dt': dt,
                 'amount': amount, 'coin': amt_coin[1], 'base': coin_base(amt_coin[1])})

print(f"Parsed {len(rows)} crypto payment rows")
dmin = min(r['dt'] for r in rows); dmax = max(r['dt'] for r in rows)
print(f"Date range: {dmin.date()} .. {dmax.date()}")

# fetch price maps for volatile coins present
volatile = {r['base'] for r in rows if r['base'] in CG_ID}
price_maps = {}
frm = (dmin.timestamp()) - 86400*2
to = (dmax.timestamp()) + 86400
for b in volatile:
    print(f"Fetching {b} ({CG_ID[b]}) daily prices...")
    price_maps[b] = fetch_price_map(CG_ID[b], frm, to)
    time.sleep(3)

def actual_usd(r):
    if r['base'] == 'USDT':
        return r['amount'], 'stablecoin'
    pm = price_maps.get(r['base'], {})
    dstr = r['dt'].strftime('%Y-%m-%d')
    price = pm.get(dstr)
    if price is None and pm:
        # nearest available date
        best = min(pm.keys(), key=lambda k: abs((datetime.strptime(k,'%Y-%m-%d').replace(tzinfo=timezone.utc)-r['dt']).total_seconds()))
        price = pm[best]
    if price is None:
        return None, 'no-price'
    return r['amount']*price, f'@{price:.4g}'

flagged = []
for r in rows:
    actual, src = actual_usd(r)
    if actual is None or actual <= 0:
        continue
    ratio = actual / r['credited'] if r['credited'] else 1
    # USDT: strict (>10% over). Volatile: loose (credited > 2x actual) to absorb price noise.
    over = False
    if r['base'] == 'USDT':
        over = actual < r['credited'] * 0.90
    else:
        over = actual < r['credited'] * 0.50
    if over:
        r2 = dict(r); r2['actualUsd'] = round(actual,2); r2['ratio'] = round(ratio,3)
        r2['overcreditUsd'] = round(r['credited']-actual,2); r2['priceSrc'] = src
        r2['pre_forensic'] = r['dt'] < FORENSIC_CUTOFF
        flagged.append(r2)

flagged.sort(key=lambda x: (not x['pre_forensic'], -x['overcreditUsd']))
print(f"\n=== FLAGGED OVER-CREDITS: {len(flagged)} ===")
for f in flagged:
    tag = 'PRE-FORENSIC' if f['pre_forensic'] else 'post'
    print(f"[{tag}] {f['dt'].date()} ref={f['ref']} {f['ptype']:10s} chatId={f['chatId']} @{f['name']}: "
          f"got {f['amount']} {f['coin']} (~${f['actualUsd']} {f['priceSrc']}) but CREDITED ${f['credited']} "
          f"→ over ${f['overcreditUsd']} (ratio {f['ratio']})")

pre = [f for f in flagged if f['pre_forensic']]
print(f"\n=== SUMMARY ===")
print(f"Total flagged: {len(flagged)}  |  Pre-forensic (<2026-06-18): {len(pre)}")
print(f"Pre-forensic total over-credit: ${round(sum(f['overcreditUsd'] for f in pre),2)}")
print(f"All flagged total over-credit:  ${round(sum(f['overcreditUsd'] for f in flagged),2)}")
by_type = {}
for f in flagged:
    by_type.setdefault(f['ptype'], 0)
    by_type[f['ptype']] += f['overcreditUsd']
print("By product type:", {k: round(v,2) for k,v in by_type.items()})
