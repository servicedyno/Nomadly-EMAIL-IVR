#!/usr/bin/env python3
"""READ-ONLY production Mongo exploration for CloudIVR analysis."""
import os, json, datetime as dt
from pymongo import MongoClient

def load_env():
    env = {}
    with open('/app/backend/.env') as f:
        for line in f:
            line=line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
    return env
ENV=load_env()
db=MongoClient(ENV['MONGO_URL'], serverSelectionTimeoutMS=10000)[ENV.get('DB_NAME','test')]

def summ(name, limit_sample=1):
    try:
        c=db[name]
        n=c.estimated_document_count()
        print(f"\n===== {name} (count~{n}) =====")
        doc=c.find_one(sort=[('_id',-1)])
        if doc:
            # show keys and a trimmed sample
            print("keys:", list(doc.keys()))
            s=json.loads(json.dumps(doc, default=str))
            # trim long values
            for k,v in list(s.items()):
                if isinstance(v,str) and len(v)>120: s[k]=v[:120]+'...'
            print("sample:", json.dumps(s, default=str)[:1500])
    except Exception as e:
        print(f"{name}: ERR {e!r}")

for coll in ['callLogs','phoneLogs','bulkCallCampaigns','scheduledCalls','ivrAnalytics','walletLedger','phoneNumbersOf','pendingCallBills','transactions']:
    summ(coll)
