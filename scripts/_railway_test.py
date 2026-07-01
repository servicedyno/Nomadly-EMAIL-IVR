import os, json, urllib.request

TOKEN = os.environ['API_KEY_RAILWAY']
URL = "https://backboard.railway.app/graphql/v2"

def gql(query, headers):
    req = urllib.request.Request(URL, data=json.dumps({"query": query}).encode(), headers={"Content-Type":"application/json", **headers})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=45).read())
    except urllib.error.HTTPError as e:
        return {"HTTPError": e.code, "body": e.read().decode()[:400]}

# Test 1: me with Bearer
print("Bearer me:", json.dumps(gql("query { me { email name } }", {"Authorization": f"Bearer {TOKEN}"}))[:400])
# Test 2: me with Project-Access-Token style (unlikely)
print("PAT me:", json.dumps(gql("query { me { email name } }", {"Project-Access-Token": TOKEN}))[:400])
# Test 3: projects list
print("Projects:", json.dumps(gql("query { projects { edges { node { id name } } } }", {"Authorization": f"Bearer {TOKEN}"}))[:600])
