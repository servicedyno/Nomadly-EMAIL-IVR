#!/usr/bin/env python3
"""Pull full context for the IVR upgrade incidents."""
import os, json, urllib.request
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

TOKEN=os.environ['RAILWAY_PROJECT_TOKEN']
PID=os.environ['RAILWAY_PROJECT_ID']; EID=os.environ['RAILWAY_ENVIRONMENT_ID']; SID=os.environ['RAILWAY_SERVICE_ID']
body=json.dumps({"query":f'query {{ variables(projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}") }}'}).encode()
req=urllib.request.Request("https://backboard.railway.app/graphql/v2",data=body,
   headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN})
v=json.loads(urllib.request.urlopen(req).read())['data']['variables']
from pymongo import MongoClient
db=MongoClient(v['MONGO_URL'])[v.get('DB_NAME') or 'test']

# Targeted users
TARGETS = ['8226424150','8541381736','8273560746','817673476','2086091807','7260961801','6352268805','7775130199']

H = {"Content-Type":"application/json","User-Agent":"Mozilla/5.0","Project-Access-Token":TOKEN}
def gql(q):
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=json.dumps({"query":q}).encode(), headers=H)
    return json.loads(urllib.request.urlopen(req).read())

# Latest deployment
q1 = f'query {{ deployments(input: {{projectId: "{PID}", environmentId: "{EID}", serviceId: "{SID}"}}, first: 5) {{ edges {{ node {{ id status }} }} }} }}'
dep_id = next(e['node']['id'] for e in gql(q1)['data']['deployments']['edges'] if e['node']['status']=='SUCCESS')

for cid in TARGETS:
    print("\n" + "="*72)
    name_doc = db.nameOf.find_one({'_id':cid},{'val':1}) or {}
    name = name_doc.get('val','?')
    print(f"CHAT {cid}  (@{name})")
    print("="*72)

    # Phone numbers
    pdoc = db.phoneNumbersOf.find_one({'_id':cid})
    if pdoc:
        nums = pdoc.get('numbers') or (pdoc.get('val',{}).get('numbers') if isinstance(pdoc.get('val'),dict) else None) or []
        print(f"📞 Phone numbers ({len(nums)}):")
        for n in nums[:5]:
            if isinstance(n,dict):
                print(f"   {n.get('phoneNumber')} | plan={n.get('plan')} | price=${n.get('planPrice')} | status={n.get('status','active')} | expires={str(n.get('expiresAt'))[:10]}")

    # phoneTransactions
    txns = list(db.phoneTransactions.find({'chatId':str(cid)}).sort('timestamp',1))
    print(f"\n💳 phoneTransactions ({len(txns)}):")
    for t in txns:
        s = {k:v for k,v in t.items() if k not in ('_id','chatId')}
        print(f"   {str(t.get('timestamp'))[:19]} | {json.dumps(s, default=str)[:280]}")

    # AI chat history
    convo = list(db.aiSupportChats.find({'chatId':cid},{'role':1,'content':1,'createdAt':1,'_id':0}).sort('createdAt',1))
    print(f"\n💬 AI conversations ({len(convo)} msgs):")
    for m in convo:
        ts = m['createdAt'].strftime('%m-%d %H:%M') if isinstance(m['createdAt'],datetime) else str(m['createdAt'])
        role = m.get('role','?')
        ctext = (m.get('content') or '').replace('\n',' ').strip()
        print(f"   {ts} [{role:9s}] {ctext[:380]}")

    # Escalations
    escs = list(db.escalations.find({'chatId':str(cid)}).sort('createdAt',1))
    if escs:
        print(f"\n🚨 Escalations ({len(escs)}):")
        for e in escs:
            print(f"   {str(e.get('createdAt'))[:19]} | reason={e.get('reason')} | status={e.get('status')}")
            print(f"      user: {(e.get('userMessage') or '')[:200]}")
            print(f"      ai:   {(e.get('aiResponse') or '')[:200]}")

    # Support ratings
    rates = list(db.supportRatings.find({'chatId':cid}).sort('createdAt',1))
    if rates:
        print(f"\n⭐ Support ratings ({len(rates)}):")
        for r in rates:
            print(f"   {str(r.get('createdAt'))[:19]} | rating={r.get('rating')} | comment={(r.get('comment') or '')[:200]}")

    # Wallet
    w = db.walletOf.find_one({'_id':cid}) or {}
    if w:
        usd = (w.get('usdIn',0) or 0) - (w.get('usdOut',0) or 0)
        ngn = (w.get('ngnIn',0) or 0) - (w.get('ngnOut',0) or 0)
        print(f"\n💰 Wallet: ${usd:.2f} USD | ₦{ngn:.0f}")

    # Railway log search for this chatId
    q = f'query {{ deploymentLogs(deploymentId: "{dep_id}", limit: 25, filter: "{cid}") {{ message timestamp severity }} }}'
    try:
        r = gql(q)
        logs = r.get('data',{}).get('deploymentLogs') or []
        if logs:
            interesting = [l for l in logs if any(k in (l.get('message') or '').lower() for k in
                ['upgrad','plan','error','fail','renew','expir','sip','ivr','sub-number','prorat'])]
            if interesting:
                print(f"\n📜 Recent log lines ({len(interesting)} interesting of {len(logs)}):")
                for l in interesting[:12]:
                    msg = (l.get('message') or '').replace('\n',' ').strip()[:320]
                    print(f"   {l.get('timestamp','')[:19]} | {msg}")
    except Exception as e:
        print(f"   log fetch error: {e}")
