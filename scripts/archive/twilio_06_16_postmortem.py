#!/usr/bin/env python3
"""Twilio 06-16 post-mortem: pull every Twilio-related ERROR/WARNING log from
2026-06-16 from Railway, extract affected user IDs / phone numbers / error
categories, and write the result to JSON + CSV. Read-only."""
import json, urllib.request, urllib.error, re, csv
from collections import Counter, defaultdict

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


def paginate(flt, anchor='2026-06-17T00:00:00Z', floor='2026-06-16T00:00:00Z', max_pages=60):
    q = '''query Q($e:String!, $anchor:String!, $f:String!, $lim:Int!){
      environmentLogs(environmentId:$e, anchorDate:$anchor, filter:$f, beforeLimit:$lim){
        timestamp message severity tags { serviceId }
      }
    }'''
    out = []
    cursor = anchor
    for _ in range(max_pages):
        r = gql(q, {'e': ENV, 'anchor': cursor, 'f': flt, 'lim': 500})
        if 'errors' in r or '_err' in r:
            return out
        logs = r['data']['environmentLogs'] or []
        if not logs:
            break
        out.extend(logs)
        oldest = min(l['timestamp'] for l in logs)
        if oldest <= floor:
            break
        cursor = oldest
        if len(logs) < 500:
            break
    return [l for l in out if l['timestamp'] >= floor and l['timestamp'] < anchor]


# Regex patterns to mine out user identifiers
RE_USER_ID   = re.compile(r'user[_ ]?id["\']?\s*[:=]\s*["\']?(\d{6,12})', re.I)
RE_TG_FROM   = re.compile(r'from[: ]+(\d{6,12})')
RE_E164      = re.compile(r'\+\d{8,15}')
RE_TWILIO_SID= re.compile(r'\b(PN|MG|CA|SM|AC)[a-f0-9]{32}\b')
RE_ERROR_CODE= re.compile(r'\b(2\d{4}|3\d{4}|6\d{4}|status[:=]?\s*([45]\d\d))\b')
RE_USERNAME  = re.compile(r'\b([A-Za-z][A-Za-z0-9_]{2,32})\b')


def main():
    print('Fetching all Twilio-related logs from 2026-06-16 …')
    twilio = paginate('Twilio')
    print(f'  Twilio logs: {len(twilio)}')

    # filter to errors / warnings only
    errors = [l for l in twilio if l.get('severity') in ('error', 'warning')
              or any(k in l['message'].lower() for k in ['failed', 'error', 'unauthor', 'denied', 'invalid', 'forbidden'])]
    print(f'  Twilio-error/warning logs on 06-16: {len(errors)}')

    # Extract data
    rows = []
    user_ids = Counter()
    phones = Counter()
    twilio_sids = Counter()
    err_codes = Counter()
    err_sample_by_user = defaultdict(list)

    for l in errors:
        msg = l['message']
        ts = l['timestamp']
        uid = (RE_USER_ID.search(msg) or RE_TG_FROM.search(msg))
        uid = uid.group(1) if uid else None
        phone_matches = RE_E164.findall(msg)
        sids = RE_TWILIO_SID.findall(msg)
        code = RE_ERROR_CODE.search(msg)
        code_v = code.group(0) if code else ''
        if uid: user_ids[uid] += 1
        for p in phone_matches: phones[p] += 1
        for s in sids: twilio_sids[s] += 1
        if code_v: err_codes[code_v] += 1
        rows.append({
            'ts': ts,
            'severity': l.get('severity', ''),
            'user_id': uid or '',
            'phone': phone_matches[0] if phone_matches else '',
            'twilio_sid': sids[0] if sids else '',
            'err_code': code_v,
            'msg': msg[:400].replace('\n', ' '),
        })
        if uid:
            err_sample_by_user[uid].append(msg[:200])

    # Write CSV
    csv_path = '/app/logs_prod/_twilio_06_16_users.csv'
    with open(csv_path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['ts', 'severity', 'user_id', 'phone', 'twilio_sid', 'err_code', 'msg'])
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f'\nCSV → {csv_path}  ({len(rows)} rows)')

    # Affected users summary JSON
    affected = {
        'window': '2026-06-16',
        'total_twilio_logs': len(twilio),
        'total_error_warning': len(errors),
        'unique_user_ids': len(user_ids),
        'unique_phone_numbers': len(phones),
        'unique_twilio_sids': len(twilio_sids),
        'top_user_ids': user_ids.most_common(50),
        'top_phones': phones.most_common(50),
        'top_twilio_sids': twilio_sids.most_common(30),
        'top_err_codes': err_codes.most_common(20),
        'samples_by_user': {uid: msgs[:3] for uid, msgs in list(err_sample_by_user.items())[:50]},
    }
    with open('/app/logs_prod/_twilio_06_16_summary.json', 'w') as f:
        json.dump(affected, f, indent=2)
    print(f'\nSummary → /app/logs_prod/_twilio_06_16_summary.json')

    # Console digest
    print('\n── Top 15 affected user_ids ──')
    for uid, c in user_ids.most_common(15):
        print(f'  {uid}: {c} errors')
    print('\n── Top 15 phone numbers in errors ──')
    for p, c in phones.most_common(15):
        print(f'  {p}: {c}')
    print('\n── Top 10 Twilio error codes ──')
    for code, c in err_codes.most_common(10):
        print(f'  {code}: {c}')

    # Hourly distribution to spot the burn window
    by_hour = Counter(l['timestamp'][:13] for l in errors)
    print('\n── Hourly burn distribution ──')
    for h in sorted(by_hour.keys()):
        print(f'  {h}  count={by_hour[h]:<5} {"#"*min(80, by_hour[h]//10)}')

    # Categorize messages
    print('\n── Error categories (first 100 chars of message clustered) ──')
    cat = Counter()
    for r in rows:
        m = r['msg']
        # cluster by first few significant words
        key = ' '.join(re.findall(r'[A-Za-z_]+', m)[:6])[:80]
        cat[key] += 1
    for k, n in cat.most_common(15):
        print(f'  {n:>5}  {k}')


if __name__ == '__main__':
    main()
