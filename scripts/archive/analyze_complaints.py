#!/usr/bin/env python3
"""
Pull AI-support customer complaints + IVR upgrade-related issues from the
production MongoDB via Railway GraphQL.
"""
import os, sys, json, urllib.request, urllib.error, re
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict

# Load env
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN = os.environ['RAILWAY_PROJECT_TOKEN']
PID   = os.environ['RAILWAY_PROJECT_ID']
EID   = os.environ['RAILWAY_ENVIRONMENT_ID']
SID   = os.environ['RAILWAY_SERVICE_ID']

body = json.dumps({"query": f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req  = urllib.request.Request("https://backboard.railway.app/graphql/v2",
    data=body, headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN})
v = json.loads(urllib.request.urlopen(req).read())['data']['variables']

prod_mongo = v.get('MONGO_URL')
prod_db    = v.get('DB_NAME') or 'nomadly'
print(f"[+] Connecting to production DB: {prod_db}")

from pymongo import MongoClient
client = MongoClient(prod_mongo, serverSelectionTimeoutMS=15000)
db = client[prod_db]

# Quick health
print(f"[+] Users in prod (nameOf): {db.nameOf.count_documents({})}")
print(f"[+] aiSupportChats count: {db.aiSupportChats.count_documents({})}")
print(f"[+] supportRatings count: {db.supportRatings.count_documents({})}")
print(f"[+] userErrors count: {db.userErrors.count_documents({})}")
print(f"[+] supportSessions count: {db.supportSessions.count_documents({})}")
print()

# ─── Time window ───
days = int(os.environ.get('DAYS', '14'))
since = datetime.now(timezone.utc) - timedelta(days=days)
print(f"[+] Analysis window: last {days} days (since {since.isoformat()})")
print()

# ─── 1. AI Support — USER messages (what customers complained about) ───
print("=" * 70)
print(f"1) AI SUPPORT — Customer messages (last {days} days)")
print("=" * 70)

user_msgs = list(db.aiSupportChats.find(
    {"role": "user", "createdAt": {"$gte": since}},
    {"chatId": 1, "content": 1, "createdAt": 1, "_id": 0}
).sort("createdAt", -1).limit(2000))

print(f"Total user messages in window: {len(user_msgs)}")
unique_users = {m['chatId'] for m in user_msgs}
print(f"Unique users contacting AI support: {len(unique_users)}")
print()

# ─── 2. Topic classification (keyword tagging) ───
TOPICS = {
    'cloudivr_upgrade': r'(upgrade|change plan|switch plan|prorat|upgrad).*(ivr|pro|business|starter|phone|plan)|(ivr|pro|business|starter|plan).*(upgrade|prorat)',
    'cloudivr_general': r'\b(ivr|cloud ivr|cloudivr|sip|caller id|otp collect|quick ivr|bulk ivr)\b',
    'phone_plan':       r'\b(starter|pro plan|business plan|my plan|plan price|plan cost|renew)\b',
    'payment':          r'\b(payment|paid|charge|refund|deposit|wallet|topup|top.up|crypto|usdt|btc)\b',
    'domain':           r'\b(domain|dns|nameserver|registration)\b',
    'hosting':          r'\b(hosting|cpanel|whm|file manager|upload)\b',
    'vps':              r'\b(vps|rdp|server|reinstall)\b',
    'sms':              r'\b(sms|bulk ?sms|message|delivery|sender id)\b',
    'leads':            r'\b(lead|leads|email lead|phone lead|extract)\b',
    'marketplace':      r'\b(marketplace|product|seller|buyer|escrow)\b',
    'url_shortener':    r'\b(url|short|shortener|link)\b',
    'virtual_card':     r'\b(virtual card|vcc|3ds)\b',
    'email_validation': r'\b(email valid|validation|smtp|spam|deliverab)\b',
    'login_account':    r'\b(login|account|cannot access|locked|password)\b',
    'refund':           r'\b(refund|money back|return)\b',
    'bug_broken':       r"(not working|doesn'?t work|broken|error|fail|stuck|hang|crash|freez)",
    'billing_dispute':  r'\b(wrong (price|amount|charge)|overcharg|double charg|charged twice)\b',
}

topic_counts = Counter()
topic_examples = defaultdict(list)
ivr_upgrade_msgs = []

for m in user_msgs:
    txt = (m.get('content') or '').lower()
    matched_any = False
    for topic, rx in TOPICS.items():
        if re.search(rx, txt, re.I):
            topic_counts[topic] += 1
            if len(topic_examples[topic]) < 3:
                topic_examples[topic].append(m)
            matched_any = True
    if re.search(TOPICS['cloudivr_upgrade'], txt, re.I) or \
       (re.search(r'\b(ivr|pro|business|starter|plan)\b', txt, re.I) and
        re.search(r'(upgrade|upgrad|change|switch|prorat|cost.*?diff|differen)', txt, re.I)):
        ivr_upgrade_msgs.append(m)
    if not matched_any:
        topic_counts['_other'] += 1

print("Topic frequencies:")
for topic, n in topic_counts.most_common():
    print(f"  {topic:22s} {n:4d}")
print()

print("─" * 70)
print("Sample examples per topic (truncated 220 chars):")
for topic in ['cloudivr_upgrade','cloudivr_general','phone_plan','payment','refund',
              'bug_broken','billing_dispute','virtual_card','hosting','sms','leads',
              'domain','vps','url_shortener','marketplace','email_validation','login_account']:
    if topic_examples.get(topic):
        print(f"\n[{topic}]")
        for ex in topic_examples[topic]:
            ts = ex['createdAt'].strftime('%Y-%m-%d %H:%M') if isinstance(ex['createdAt'], datetime) else str(ex['createdAt'])
            ctext = (ex.get('content') or '').replace('\n',' ').strip()[:220]
            print(f"  • {ts} | chat={ex['chatId']} | {ctext}")

# ─── 3. Cloud-IVR upgrade focus ───
print()
print("=" * 70)
print(f"2) CLOUD-IVR PLAN UPGRADE ISSUES — last {days} days")
print("=" * 70)
print(f"Matching messages: {len(ivr_upgrade_msgs)}")
print(f"Distinct users:    {len({m['chatId'] for m in ivr_upgrade_msgs})}")
print()

# Group by user, fetch their plan
ivr_users = defaultdict(list)
for m in ivr_upgrade_msgs:
    ivr_users[m['chatId']].append(m)

for cid, msgs in list(ivr_users.items())[:25]:
    name_doc = db.nameOf.find_one({'_id': cid}, {'val': 1})
    plan_doc = db.planOf.find_one({'_id': cid})
    phone_doc = db.phoneNumbersOf.find_one({'_id': cid}) if 'phoneNumbersOf' in db.list_collection_names() else None
    wallet = db.walletOf.find_one({'_id': cid}, {'usdIn':1,'usdOut':1,'ngnIn':1,'ngnOut':1}) or {}
    print(f"\n── chat={cid}  name={name_doc.get('val') if name_doc else '?'}  plan={plan_doc.get('plan') if plan_doc else None}")
    if phone_doc:
        # show their phone plan(s)
        phones = phone_doc.get('val') or {}
        if isinstance(phones, dict):
            for pn, info in list(phones.items())[:5]:
                if isinstance(info, dict):
                    print(f"    📞 {pn}  plan={info.get('plan')}  status={info.get('status')}  until={info.get('endingTime')}")
                else:
                    print(f"    📞 {pn}  {info}")
    if wallet:
        usd = (wallet.get('usdIn',0) or 0) - (wallet.get('usdOut',0) or 0)
        ngn = (wallet.get('ngnIn',0) or 0) - (wallet.get('ngnOut',0) or 0)
        print(f"    💰 wallet: ${usd:.2f} USD | ₦{ngn:.0f}")
    for m in msgs[:8]:
        ts = m['createdAt'].strftime('%m-%d %H:%M') if isinstance(m['createdAt'], datetime) else str(m['createdAt'])
        ctext = (m.get('content') or '').replace('\n',' ').strip()[:260]
        print(f"    🗨 {ts}: {ctext}")
    # Pull what the AI replied to each user message (next assistant msg)
    asst = list(db.aiSupportChats.find(
        {"chatId": cid, "role": "assistant", "createdAt": {"$gte": msgs[-1]['createdAt']}},
        {"content":1,"createdAt":1,"_id":0}
    ).sort("createdAt", 1).limit(8))
    for a in asst[:3]:
        ts = a['createdAt'].strftime('%m-%d %H:%M') if isinstance(a['createdAt'], datetime) else str(a['createdAt'])
        ctext = (a.get('content') or '').replace('\n',' ').strip()[:260]
        print(f"    🤖 {ts}: {ctext}")

# ─── 4. Support ratings (NEG / NEUTRAL) ───
print()
print("=" * 70)
print(f"3) NEGATIVE / NEUTRAL SUPPORT RATINGS — last {days} days")
print("=" * 70)
ratings = list(db.supportRatings.find(
    {"createdAt": {"$gte": since}}
).sort("createdAt", -1).limit(500))
print(f"Total ratings: {len(ratings)}")
rate_counts = Counter()
for r in ratings: rate_counts[r.get('rating')] += 1
print(f"Distribution: {dict(rate_counts)}")
neg = [r for r in ratings if r.get('rating') in ('bad','negative','👎', 1, '1','poor','dissatisfied') or
       (isinstance(r.get('rating'),(int,float)) and r.get('rating') < 4)]
print(f"\nNeg/neutral entries ({len(neg)}):")
for r in neg[:25]:
    ts = r['createdAt'].strftime('%m-%d %H:%M') if isinstance(r.get('createdAt'), datetime) else str(r.get('createdAt'))
    print(f"  • {ts} | chat={r.get('chatId')} | rating={r.get('rating')} | comment={(r.get('comment') or '')[:200]}")

# ─── 5. Recent user-facing errors ───
print()
print("=" * 70)
print(f"4) USER-FACING ERRORS (userErrors collection, last 24h TTL)")
print("=" * 70)
errs = list(db.userErrors.find({}).sort("timestamp", -1).limit(500))
print(f"Total entries: {len(errs)}")
err_counts = Counter()
err_examples = defaultdict(list)
for e in errs:
    feat = e.get('feature','?')
    err_counts[feat] += 1
    if len(err_examples[feat]) < 3: err_examples[feat].append(e)
print("By feature:")
for f, n in err_counts.most_common():
    print(f"  {f:30s} {n:4d}")
print("\nSample errors per feature:")
for f, exs in err_examples.items():
    print(f"\n[{f}]")
    for e in exs:
        ts = e['timestamp'].strftime('%m-%d %H:%M') if isinstance(e.get('timestamp'), datetime) else str(e.get('timestamp'))
        print(f"  • {ts} | chat={e.get('chatId')} | {(e.get('error') or '')[:240]}")

print()
print("=" * 70)
print("DONE")
print("=" * 70)
