#!/usr/bin/env python3
"""Check if @kathyserious (chat 8690991604) has the Australian number active in production."""
import os, json, urllib.request, sys
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN = os.environ['RAILWAY_PROJECT_TOKEN']
PID = os.environ['RAILWAY_PROJECT_ID']
EID = os.environ['RAILWAY_ENVIRONMENT_ID']
SID = os.environ['RAILWAY_SERVICE_ID']
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0", "Project-Access-Token": TOKEN}

body = json.dumps({"query": f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req = urllib.request.Request("https://backboard.railway.app/graphql/v2", data=body, headers=H)
v = json.loads(urllib.request.urlopen(req).read())['data']['variables']

from pymongo import MongoClient
db = MongoClient(v['MONGO_URL'])[v.get('DB_NAME') or 'test']

CHAT = 8690991604
print("=" * 72)
print(f"  @kathyserious — Australian number status check (chat={CHAT})")
print("=" * 72)

# 1) Numbers on account
phones = db.phoneNumbersOf.find_one({'_id': CHAT}) or db.phoneNumbersOf.find_one({'_id': str(CHAT)})
nums = (phones or {}).get('val', {}).get('numbers', []) or []
print(f"\n📞 phoneNumbersOf — {len(nums)} number(s) on file")
au_nums = []
for n in nums:
    cc = n.get('countryCode') or n.get('country') or ''
    is_au = (str(cc).upper() == 'AU') or str(n.get('phoneNumber', '')).startswith('+61')
    mark = ' ← AU' if is_au else ''
    print(f"  • {n.get('phoneNumber')} | provider={n.get('provider')} | country={cc} | plan={n.get('plan')} | status={n.get('status')} | expires={n.get('expiresAt')}{mark}")
    if is_au:
        au_nums.append(n)

# 2) Pending bundles (regulatory approval queue)
print("\n📋 pendingBundles (AU regulatory queue)")
for b in db.pendingBundles.find({'chatId': str(CHAT)}).sort('createdAt', -1):
    print(f"  • {b.get('selectedNumber')} | country={b.get('countryCode')} | status={b.get('status')} | bundle={b.get('bundleSid')} | created={b.get('createdAt')} | updated={b.get('updatedAt')}")
    if b.get('rejectionReasons'):
        print(f"    rejection: {b.get('rejectionReasons')}")

# 3) Wallet
wallet = db.walletOf.find_one({'_id': CHAT}) or db.walletOf.find_one({'_id': str(CHAT)}) or {}
usd = (wallet.get('usdIn', 0) or 0) - (wallet.get('usdOut', 0) or 0)
print(f"\n💰 Wallet: ${usd:.2f} USD")

# 4) Most recent phone transactions
print("\n📜 Recent phoneTransactions (last 15)")
txs = list(db.phoneTransactions.find({'chatId': str(CHAT)}).sort([('_id', -1)]).limit(15)) or \
      list(db.phoneTransactions.find({'chatId': CHAT}).sort([('_id', -1)]).limit(15))
for t in txs:
    ts = t.get('createdAt') or t.get('timestamp') or t.get('_id')
    print(f"  • {ts} | action={t.get('action')} | amount=${t.get('amount')} | reason={t.get('_backfillReason') or t.get('note') or ''} | number={t.get('phoneNumber','')}")

# 5) Their state (pending CP order info)
state = db.stateOf.find_one({'_id': CHAT}) or db.stateOf.find_one({'_id': str(CHAT)}) or {}
sv = state.get('val') or {}
print("\n🔧 State — pending CloudPhone info")
for k in sorted(sv.keys()):
    if any(kw in k.lower() for kw in ['cp', 'pending', 'address', 'country', 'plan']):
        val = sv[k]
        val_s = str(val)[:160] if not isinstance(val, (dict, list)) else json.dumps(val, default=str)[:160]
        print(f"  {k} = {val_s}")

# 6) Summary verdict
print("\n" + "=" * 72)
if au_nums:
    print(f"✅ FINAL: @kathyserious HAS {len(au_nums)} Australian number(s) in their account.")
    for n in au_nums:
        print(f"   → {n.get('phoneNumber')} status={n.get('status')} expires={n.get('expiresAt')}")
else:
    pending_open = list(db.pendingBundles.find({'chatId': str(CHAT), 'status': {'$nin': ['twilio-approved', 'twilio-rejected', 'cancelled']}}))
    if pending_open:
        print(f"⏳ FINAL: NO active AU number yet — {len(pending_open)} bundle(s) still pending regulatory review.")
    else:
        rejected = list(db.pendingBundles.find({'chatId': str(CHAT), 'status': 'twilio-rejected'}))
        if rejected:
            print(f"❌ FINAL: NO AU number — bundle was REJECTED ({len(rejected)} rejection(s)). User likely needs to retry.")
        else:
            print("❌ FINAL: NO AU number — no pending bundles found either. User may have abandoned or been refunded.")
print("=" * 72)
