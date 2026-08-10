#!/usr/bin/env python3
"""READ-ONLY: CloudIVR usage report for the last 7 days (production DB)."""
import datetime as dt
from collections import defaultdict, Counter
from pymongo import MongoClient

def load_env():
    env={}
    for line in open('/app/backend/.env'):
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
    return env
E=load_env(); db=MongoClient(E['MONGO_URL'],serverSelectionTimeoutMS=15000)[E.get('DB_NAME','test')]

now=dt.datetime.utcnow()
cutoff=now-dt.timedelta(days=7)
cutoff_str=cutoff.strftime('%Y-%m-%dT%H:%M:%S')
print(f"NOW(UTC)={now:%Y-%m-%d %H:%M}  |  7-DAY CUTOFF={cutoff:%Y-%m-%d %H:%M}")
print("="*90)

users=defaultdict(lambda: {
    'calls':0,'charge_usd':0.0,'minutes':0,'duration_s':0,
    'types':Counter(),'status':Counter(),'campaigns':0,'campaign_leads':0,
    'campaign_status':Counter(),'inbound_ivr':0,'ivr_actions':Counter(),'failed':0})

# --- phoneLogs (calls + charges) ---
pl=list(db.phoneLogs.find({'createdAt':{'$gte':cutoff}}))
for d in pl:
    cid=str(d.get('chatId'))
    u=users[cid]
    u['calls']+=1
    if (d.get('chargedCurrency') or '').lower()=='usd':
        u['charge_usd']+=float(d.get('charge') or 0)
    else:
        u['charge_usd']+=float(d.get('charge') or 0)  # charge field is USD-normalized in most rows
    u['minutes']+=int(d.get('minutesBilled') or 0)
    u['duration_s']+=int(d.get('duration') or 0)
    u['types'][d.get('type') or 'unknown']+=1
    st=(d.get('callStatus') or 'unknown')
    u['status'][st]+=1
    if st in ('failed','no-answer','busy','canceled','no_answer'):
        u['failed']+=1

# --- bulkCallCampaigns ---
bc=list(db.bulkCallCampaigns.find({'createdAt':{'$gte':cutoff}}))
for d in bc:
    cid=str(d.get('chatId')); u=users[cid]
    u['campaigns']+=1
    leads=d.get('leads') or []
    u['campaign_leads']+=len(leads)
    u['campaign_status'][d.get('status') or 'unknown']+=1

# --- ivrAnalytics (inbound IVR, timestamp is ISO string) ---
ia=list(db.ivrAnalytics.find({'timestamp':{'$gte':cutoff_str}}))
for d in ia:
    cid=str(d.get('chatId')); u=users[cid]
    u['inbound_ivr']+=1
    u['ivr_actions'][d.get('action') or 'unknown']+=1

# --- scheduledCalls in window ---
sc=list(db.scheduledCalls.find({'createdAt':{'$gte':cutoff}}))

def uname(cid):
    r=db.nameOf.find_one({'_id':cid})
    return r.get('val') if r else '(no-username)'
def wallet(cid):
    w=db.walletOf.find_one({'_id':cid})
    if not w: return None
    try: return round(float(w.get('usdIn',0))-float(w.get('usdOut',0)),2)
    except: return w
def pending_bills(cid):
    return Counter(x.get('status') for x in db.pendingCallBills.find({'chatId':cid}))

print(f"\nTOTALS(7d): phoneLogs rows={len(pl)}  bulkCampaigns={len(bc)}  inboundIVR events={len(ia)}  scheduledCalls={len(sc)}")
grand_charge=sum(u['charge_usd'] for u in users.values())
grand_calls=sum(u['calls'] for u in users.values())
print(f"DISTINCT CloudIVR users(7d)={len(users)}  total calls={grand_calls}  TOTAL SPENT(phoneLogs.charge)=${grand_charge:.2f}")

print("\n"+"="*90)
print("PER-USER BREAKDOWN (sorted by spend)")
print("="*90)
for cid,u in sorted(users.items(), key=lambda kv:-kv[1]['charge_usd']):
    pb=pending_bills(cid)
    print(f"\nchatId={cid}  @{uname(cid)}  walletUSD={wallet(cid)}")
    print(f"  calls={u['calls']}  spent=${u['charge_usd']:.2f}  minutesBilled={u['minutes']}  talk={u['duration_s']}s")
    print(f"  callTypes={dict(u['types'])}  callStatus={dict(u['status'])}")
    if u['campaigns']:
        print(f"  bulkCampaigns={u['campaigns']} leads={u['campaign_leads']} status={dict(u['campaign_status'])}")
    if u['inbound_ivr']:
        print(f"  inboundIVR events={u['inbound_ivr']} actions={dict(u['ivr_actions'])}")
    issues=[]
    if u['failed']: issues.append(f"{u['failed']} failed/no-answer calls")
    needrev=pb.get('needs_review',0)+pb.get('needsReview',0)
    if needrev: issues.append(f"{needrev} bills needs_review")
    wb=wallet(cid)
    if isinstance(wb,(int,float)) and wb<1: issues.append(f"low wallet (${wb})")
    if issues: print(f"  ISSUES: {', '.join(issues)}")
    if pb: print(f"  pendingCallBills(all-time)={dict(pb)}")
