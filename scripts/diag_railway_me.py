import os, json, urllib.request
from pathlib import Path

env = {}
for line in Path('/app/backend/.env').read_text().splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    env[k] = v.strip().strip('"').strip("'")

TOKEN = env['API_KEY_RAILWAY']

def gql(query, headers):
    body = json.dumps({"query": query}).encode()
    req = urllib.request.Request("https://backboard.railway.app/graphql/v2",
        data=body, headers={"Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        **headers})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=30).read())
    except urllib.error.HTTPError as e:
        return {"HTTPError": e.code, "body": e.read().decode()[:500]}
    except Exception as e:
        return {"error": str(e)}

hdr = {"Authorization": f"Bearer {TOKEN}"}

q = 'query { me { name email projects { edges { node { id name environments { edges { node { id name } } } services { edges { node { id name } } } } } } } }'
r = gql(q, hdr)
print(json.dumps(r, indent=2)[:4000])
