#!/usr/bin/env python3
"""Pull only USER-FACING bot replies and analyze UX issues.
Bot prefixes outgoing messages with 'reply:' in logs."""
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

    # Pull all bot outgoing replies
    print('Pulling user-facing reply lines …')
    replies = paginate('reply:', anchor_iso, floor_iso, max_pages=30)
    print(f'  Total reply lines fetched: {len(replies)}')

    # Each reply log looks like:
    #   "reply: <html-text-of-message> <button1>,<button2>,... \tto: <chat_id>"
    # Extract recipient + first 100 chars of body
    user_messages = []
    chat_msg_count = defaultdict(int)
    for l in replies:
        m = l['message']
        # Find "reply:" and "to:"
        if 'reply:' not in m: continue
        rest = m.split('reply:', 1)[1]
        chat_match = re.search(r'\tto:\s*(\d+)', rest)
        chat = chat_match.group(1) if chat_match else 'unknown'
        body = rest.split('\tto:')[0].strip() if '\tto:' in rest else rest.strip()
        chat_msg_count[chat] += 1
        user_messages.append({'ts':l['timestamp'],'chat':chat,'body':body[:600]})

    print(f'  Unique chat IDs that received replies: {len(chat_msg_count)}')

    # Daily reply volume
    by_day = Counter(m['ts'][:10] for m in user_messages)
    print('\n── Bot reply volume by day ──')
    for d in sorted(by_day):
        print(f'  {d}: {by_day[d]} replies')

    # Top 20 message templates (first 80 chars normalized)
    print('\n── Top 25 message templates sent to users (after normalizing) ──')
    norm = Counter()
    for m in user_messages:
        b = m['body']
        # strip dynamic parts: numbers, IDs, amounts, dates
        n = re.sub(r'\d+', '#', b)
        n = re.sub(r'\s+', ' ', n)[:140]
        norm[n] += 1
    for tpl, c in norm.most_common(25):
        print(f'  [{c:>5}] {tpl}')

    # Identify potentially confusing/repetitive replies
    print('\n── Repeated identical replies sent to the SAME chat (>=3 times in 6 days) ──')
    chat_msg_pairs = Counter()
    for m in user_messages:
        n = re.sub(r'\d+', '#', m['body'])[:140]
        chat_msg_pairs[(m['chat'], n)] += 1
    spam_users = [(k,v) for k,v in chat_msg_pairs.items() if v>=5]
    print(f'  {len(spam_users)} (chat, template) pairs sent ≥5×')
    for (chat, tpl), c in sorted(spam_users, key=lambda x: -x[1])[:15]:
        print(f'    chat={chat}  ×{c}  → {tpl[:120]}')

    # User-facing error patterns
    print('\n── User-facing error/warning replies (containing ⚠️ ❌ 🚫 in reply body) ──')
    err_replies=[m for m in user_messages if any(e in m['body'] for e in ['⚠️','❌','🚫','😔'])]
    print(f'  {len(err_replies)} error-emoji replies')
    err_tpl=Counter(re.sub(r'\d+','#', m['body'])[:140] for m in err_replies)
    for tpl,c in err_tpl.most_common(15):
        print(f'  [{c:>4}] {tpl}')

    # User-facing 'try again' patterns
    print('\n── Replies containing "try again", "later", "wait" ──')
    retry_replies=[m for m in user_messages if any(w in m['body'].lower() for w in ['try again','please wait','later','sorry','support','contact'])]
    print(f'  {len(retry_replies)} retry-or-wait replies')
    rtpl=Counter(re.sub(r'\d+','#', m['body'])[:140] for m in retry_replies)
    for tpl,c in rtpl.most_common(10):
        print(f'  [{c:>4}] {tpl}')

    # Top 20 most-messaged users
    print('\n── Top 20 users receiving most bot replies ──')
    for chat,c in sorted(chat_msg_count.items(), key=lambda x:-x[1])[:20]:
        print(f'  chat={chat}: {c} replies received')

    # Save
    with open('/app/logs_prod/_ux_replies.json','w') as f:
        json.dump({
            'total_replies': len(user_messages),
            'unique_chats': len(chat_msg_count),
            'by_day': dict(by_day),
            'top_templates': norm.most_common(50),
            'top_error_replies': err_tpl.most_common(30),
            'retry_replies': rtpl.most_common(20),
            'top_recipients': sorted(chat_msg_count.items(), key=lambda x:-x[1])[:30],
        }, f, indent=2, default=str)
    print('\nSaved → /app/logs_prod/_ux_replies.json')


if __name__=='__main__':
    main()
