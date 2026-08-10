#!/usr/bin/env python3
"""Ad-hoc Railway production log probe (READ-ONLY)."""
import os, json, sys, urllib.request, re
from collections import Counter, defaultdict

def load_env():
    env = {}
    with open('/app/backend/.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

ENV = load_env()
TOKEN = ENV['API_KEY_RAILWAY']
PID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
EID = "889fd56a-720a-4020-884c-034784992666"
SID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
URL = "https://backboard.railway.app/graphql/v2"

def gql(query):
    body = json.dumps({"query": query}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Content-Type": "application/json",
        "Project-Access-Token": TOKEN,
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 railway-probe",
    })
    return json.loads(urllib.request.urlopen(req, timeout=40).read())

def latest_deploy():
    q = 'query { deployments(input: {projectId: "%s", environmentId: "%s", serviceId: "%s"}, first: 1) { edges { node { id status createdAt } } } }' % (PID, EID, SID)
    d = gql(q)
    return d['data']['deployments']['edges'][0]['node']

def logs(deploy_id, limit=1000, filt=None):
    if filt:
        q = 'query { deploymentLogs(deploymentId: "%s", limit: %d, filter: "%s") { message timestamp severity } }' % (deploy_id, limit, filt)
    else:
        q = 'query { deploymentLogs(deploymentId: "%s", limit: %d) { message timestamp severity } }' % (deploy_id, limit)
    d = gql(q)
    return d['data']['deploymentLogs']

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'info'
    dep = latest_deploy()
    if cmd == 'info':
        print(json.dumps(dep, indent=2))
    elif cmd == 'fetch':
        filt = sys.argv[2] if len(sys.argv) > 2 else None
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
        out = logs(dep['id'], limit=limit, filt=filt)
        print(f"# {len(out)} log lines (filter={filt})")
        for l in out:
            print(f"{l.get('timestamp','')} [{l.get('severity','')}] {l.get('message','')}")
