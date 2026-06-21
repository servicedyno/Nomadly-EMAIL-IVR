#!/usr/bin/env python3
"""Targeted user-journey UX scan — focuses on the painful moments users feel.
Cross-references "Insufficient balance" walls with subsequent deposit attempts
and identifies bot dead-ends, broken sub-accounts, and frustration loops."""
import json, urllib.request, urllib.error, re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

TOKEN='8a6f6eb8-2ed6-4560-92c0-aab7947820ae'
URL='https://backboard.railway.app/graphql/v2'
UA='Mozilla/5.0'
ENV='889fd56a-720a-4020-884c-034784992666'


def gql(q,v):
    req=urllib.request.Request(URL, data=json.dumps({'query':q,'variables':v}).encode(),
        headers={'Content-Type':'application/json','User-Agent':UA,'Project-Access-Token':TOKEN})
    try: return json.load(urllib.request.urlopen(req,timeout=90))
    except urllib.error.HTTPError as e: return {'_err':e.code}


def paginate(flt, anchor, floor, max_pages=30):
    q='''query Q($e:String!, $a:String!, $f:String!, $lim:Int!){
      environmentLogs(environmentId:$e, anchorDate:$a, filter:$f, beforeLimit:$lim){
        timestamp message severity
      }
    }'''
    out=[]; cursor=anchor
    for _ in range(max_pages):
        r=gql(q, {'e':ENV,'a':cursor,'f':flt,'lim':500})
        if 'errors' in r or '_err' in r: return out
        logs=r['data']['environmentLogs'] or []
        if not logs: break
        out.extend(logs)
        oldest=min(l['timestamp'] for l in logs)
        if oldest<=floor: break
        cursor=oldest
        if len(logs)<500: break
    return [l for l in out if l['timestamp']>=floor]


def main():
    now=datetime.now(timezone.utc)
    floor=(now - timedelta(days=6)).replace(hour=0,minute=0,second=0,microsecond=0)
    floor_iso=floor.strftime('%Y-%m-%dT%H:%M:%S.000Z')
    anchor_iso=(now + timedelta(minutes=2)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    print(f'Window {floor_iso} → {anchor_iso}\n')

    # ── 1. INSUFFICIENT BALANCE — the UX wall ──
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('① Insufficient balance wall — who hit it and did they recover?')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    insuf = paginate('Insufficient balance', anchor_iso, floor_iso, max_pages=15)
    insuf += paginate('Insufficient Wallet', anchor_iso, floor_iso, max_pages=10)
    re_chat = re.compile(r'\tto:\s*(\d+)')
    re_amount = re.compile(r'deposit at least.*?\$([\d,]+\.?\d*)')
    walls = defaultdict(list)  # chat -> [(ts, amount_short), ...]
    for l in insuf:
        m = re_chat.search(l['message'])
        if not m: continue
        chat = m.group(1)
        amt = re_amount.search(l['message'])
        walls[chat].append((l['timestamp'], amt.group(1) if amt else '?'))
    print(f'  {len(walls)} distinct users hit "Insufficient balance" wall over 6 days')
    print(f'  Total wall events: {sum(len(v) for v in walls.values())}')
    # Did these users subsequently deposit successfully?
    deposit_done = paginate('deposit confirmed', anchor_iso, floor_iso, max_pages=20)
    deposit_done += paginate('payment confirmed', anchor_iso, floor_iso, max_pages=20)
    deposit_done += paginate('Wallet credited', anchor_iso, floor_iso, max_pages=15)
    re_userid = re.compile(r'user[_ ]?id["\']?\s*[:=]\s*["\']?(\d{6,12})')
    re_chat2 = re.compile(r'(?:chat|user)[_ ]?(?:id)?[: ]+(\d{6,12})')
    deposit_users = set()
    for l in deposit_done:
        for r in (re_userid, re_chat2, re_chat):
            m = r.search(l['message'])
            if m:
                deposit_users.add(m.group(1))
                break
    print(f'\n  Users who eventually had a confirmed deposit/payment in same window: {len(deposit_users)}')
    recovered = [c for c in walls if c in deposit_users]
    bounced = [c for c in walls if c not in deposit_users]
    print(f'  → Recovered (hit wall AND deposited): {len(recovered)}')
    print(f'  → Bounced (hit wall, NO subsequent deposit): {len(bounced)}  ⚠ UX dead-end')
    bounce_rate = len(bounced) / max(1, len(walls)) * 100
    print(f'  → Bounce rate from insufficient-balance wall: {bounce_rate:.1f}%')
    if bounced:
        print('\n  Top bounced users (by # of wall hits):')
        for chat, _ in sorted([(c, len(walls[c])) for c in bounced], key=lambda x:-x[1])[:10]:
            hits = walls[chat]
            amts = [h[1] for h in hits]
            print(f'    chat={chat}  hits={len(hits)}  amounts_short=[{", ".join("$"+a for a in amts[:5])}]')

    # ── 2. TWILIO SUB-ACCOUNT 401 — affects user-owned phone numbers ──
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('② Twilio sub-accounts returning 401 (affects user-owned numbers)')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    phone_mon = paginate('PhoneMonitor', anchor_iso, floor_iso, max_pages=20)
    re_subacct = re.compile(r'subaccount (AC[a-f0-9]{32})')
    re_401 = re.compile(r'status code 401')
    sub_401 = Counter()
    sub_total = Counter()
    for l in phone_mon:
        m = re_subacct.search(l['message'])
        if not m: continue
        sub_total[m.group(1)] += 1
        if re_401.search(l['message']):
            sub_401[m.group(1)] += 1
    print(f'  Total PhoneMonitor checks: {sum(sub_total.values())}')
    print(f'  Total 401 failures: {sum(sub_401.values())}')
    print(f'  Affected sub-accounts: {len(sub_401)}')
    if sub_401:
        print('  Sub-accounts with most 401s:')
        for sa, c in sub_401.most_common(10):
            total = sub_total[sa]
            print(f'    {sa[:18]}…  401s={c}  total_checks={total}  fail_rate={c/total*100:.0f}%')

    # ── 3. CONTABO VPS provisioning issues ──
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('③ VPS provisioning errors — users can\'t start/stop their VPS')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    contabo = paginate('Contabo', anchor_iso, floor_iso, max_pages=10)
    re_409 = re.compile(r'failed \((\d+)\)')
    re_vps = re.compile(r'compute/instances/(\d+)')
    err_codes = Counter()
    affected_vps = Counter()
    for l in contabo:
        ec = re_409.search(l['message'])
        if ec:
            err_codes[ec.group(1)] += 1
        v = re_vps.search(l['message'])
        if v:
            affected_vps[v.group(1)] += 1
    print(f'  Total Contabo API failures: {sum(err_codes.values())}')
    print(f'  Error code breakdown:')
    for code, c in err_codes.most_common():
        meaning = {'409':'conflict — VPS not fully provisioned','423':'locked — actions unavailable','500':'internal error','502':'bad gateway','504':'gateway timeout','401':'unauthorized','403':'forbidden','404':'not found','429':'rate limit'}.get(code, '')
        print(f'    HTTP {code}: {c}  ({meaning})')
    print(f'\n  Affected VPS instances: {len(affected_vps)}')

    # ── 4. AutoPromo sending to blocked users ──
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('④ AutoPromo sending to users who already blocked the bot')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    autopromo = paginate('[AutoPromo] Unreachable', anchor_iso, floor_iso, max_pages=10)
    by_day = Counter(l['timestamp'][:10] for l in autopromo)
    re_unreach = re.compile(r'\[AutoPromo\] Unreachable (\d+):')
    targets = Counter()
    for l in autopromo:
        m = re_unreach.search(l['message'])
        if m: targets[m.group(1)] += 1
    print(f'  AutoPromo "unreachable" events (per day):')
    for d in sorted(by_day): print(f'    {d}: {by_day[d]}')
    print(f'  Distinct blocked users still being targeted by AutoPromo: {len(targets)}')
    if targets:
        print('  Top 10 users being repeatedly hit by AutoPromo despite blocking:')
        for chat, c in targets.most_common(10):
            print(f'    chat={chat}: {c} send attempts')

    # ── 5. TTS / IVR call issues ──
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('⑤ TTS timeouts (breaks IVR audio mid-call)')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    tts = paginate('[TTS]', anchor_iso, floor_iso, max_pages=15)
    tts_err = [l for l in tts if 'timeout' in l['message'].lower() or 'fail' in l['message'].lower() or 'error' in l['message'].lower()]
    by_day = Counter(l['timestamp'][:10] for l in tts_err)
    print(f'  TTS error/timeout events:')
    for d in sorted(by_day): print(f'    {d}: {by_day[d]}')
    print(f'  Total TTS errors in window: {len(tts_err)}')
    if tts_err:
        # severity samples
        for l in tts_err[:3]:
            print(f'  Sample: {l["message"][:200]}')

    # ── 6. Support chat ratings (👍 / 👎) ──
    print('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('⑥ Support session ratings (bad ratings = explicit UX feedback)')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    bad_rating = paginate('Support rated', anchor_iso, floor_iso, max_pages=10)
    print(f'  Support rating events: {len(bad_rating)}')
    good = [l for l in bad_rating if 'GOOD' in l['message']]
    bad = [l for l in bad_rating if 'BAD' in l['message']]
    print(f'  👍 GOOD: {len(good)}')
    print(f'  👎 BAD : {len(bad)}')
    if bad:
        print('  Bad-rated sessions:')
        for l in bad[:10]:
            m = re.search(r'BAD.*?by <b>@?(\w+)\b', l['message'])
            print(f'    {l["timestamp"][:19]}  {m.group(1) if m else "?"}')

    # Save full data
    summary = {
        'insufficient_balance': {
            'distinct_users': len(walls),
            'total_events': sum(len(v) for v in walls.values()),
            'recovered': len(recovered),
            'bounced': len(bounced),
            'bounce_rate_pct': round(bounce_rate, 1),
            'top_bounced_user_chats': [(c, len(walls[c])) for c in sorted(bounced, key=lambda x: -len(walls[x]))[:20]],
        },
        'twilio_subaccount_401s': {
            'total_401s': sum(sub_401.values()),
            'affected_subaccounts': len(sub_401),
            'top_sub_accounts': sub_401.most_common(15),
        },
        'contabo_vps_errors': {
            'total': sum(err_codes.values()),
            'by_code': dict(err_codes),
            'affected_vps_instances': len(affected_vps),
        },
        'autopromo_to_blocked': {
            'distinct_blocked_users_still_targeted': len(targets),
            'top_targets': targets.most_common(15),
            'by_day': dict(by_day),
        },
        'support_ratings': {'good': len(good), 'bad': len(bad)},
    }
    with open('/app/logs_prod/_ux_user_journey.json', 'w') as f:
        json.dump(summary, f, indent=2)
    print('\nSaved → /app/logs_prod/_ux_user_journey.json')


if __name__ == '__main__':
    main()
