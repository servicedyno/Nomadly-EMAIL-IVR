#!/usr/bin/env python3
"""READ-ONLY retrospective sweep for underpayment over-credits (DynoPay wallet)."""
import os, json
from pymongo import MongoClient

db = MongoClient(os.environ['MONGO_URL'])[os.environ.get('DB_NAME', 'test')]

print("=== A) Scan dynopayWebhooks confirmed events: base_amount vs actual (amount*exchange_rate) ===")
flagged = []
seen_payids = set()
q = {'$or': [{'status': 'confirmed'}, {'event': 'payment.confirmed'}]}
cur = db.dynopayWebhooks.find(q)
count = 0
for w in cur:
    b = w.get('body') or {}
    pid = b.get('payment_id') or w.get('paymentId')
    if pid in seen_payids:
        continue
    seen_payids.add(pid)
    count += 1
    base = b.get('base_amount')
    amt = b.get('amount')
    rate = b.get('exchange_rate')
    coin = b.get('currency')
    fee_payer = b.get('fee_payer')
    endpoint = w.get('endpoint')
    ref = w.get('refId')
    # actual USD value
    actual = None
    if amt is not None and rate is not None:
        try:
            actual = float(amt) * float(rate)
        except Exception:
            actual = None
    if base is not None and actual is not None:
        try:
            base_f = float(base)
        except Exception:
            continue
        # Flag over-credit: invoice significantly higher than actual received value
        if base_f > 0 and actual < base_f * 0.90:
            over = base_f - actual
            flagged.append({
                'ref': ref, 'endpoint': endpoint, 'coin': coin, 'sent': amt,
                'rate': rate, 'actualUsd': round(actual, 2), 'invoiceUsd': base_f,
                'feePayer': fee_payer, 'potentialOvercreditUsd': round(over, 2),
                'paymentId': pid, 'receivedAt': str(w.get('receivedAt')),
            })

print(f"Confirmed webhook events scanned (unique payIds): {count}")
print(f"Flagged (actual < 90% of invoice): {len(flagged)}")
flagged.sort(key=lambda x: -x['potentialOvercreditUsd'])
for f in flagged:
    print(json.dumps(f, default=str))

print("\n=== B) Cross-check flagged refs against transactions (what was actually credited) ===")
for f in flagged[:40]:
    ref = f['ref']
    t = db.transactions.find_one({'metadata.ref': ref})
    if t:
        print(f"ref={ref} invoice=${f['invoiceUsd']} actual=${f['actualUsd']} CREDITED=${t.get('amount')} chatId={t.get('chatId')} txn={t.get('_id')} coin={f['coin']}")
    else:
        print(f"ref={ref} invoice=${f['invoiceUsd']} actual=${f['actualUsd']} -- no transactions row found (may pre-date forensic)")

print("\n=== C) Summary of total potential over-credit ===")
total = sum(f['potentialOvercreditUsd'] for f in flagged)
print(f"Total flagged incidents: {len(flagged)}  |  Total potential over-credit: ${round(total,2)}")
