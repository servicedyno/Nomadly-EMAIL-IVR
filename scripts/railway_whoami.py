import os, json, urllib.request, urllib.error
TOKEN = os.environ["API_KEY_RAILWAY"]
URL = "https://backboard.railway.app/graphql/v2"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

def gql(query, hdr_mode="bearer"):
    body = json.dumps({"query": query}).encode()
    h = {"Content-Type": "application/json", "User-Agent": UA}
    if hdr_mode == "bearer":
        h["Authorization"] = f"Bearer {TOKEN}"
    else:
        h["Project-Access-Token"] = TOKEN
    req = urllib.request.Request(URL, data=body, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_httperror": e.code, "body": e.read().decode()[:300]}

print("=== me (bearer) ==="); print(json.dumps(gql("{ me { id name email } }"))[:400])
print("\n=== projects via me (bearer) ===")
print(json.dumps(gql("{ me { projects { edges { node { id name } } } } }"))[:800])
print("\n=== treat token as PROJECT token (Project-Access-Token header) ===")
print(json.dumps(gql("{ projectToken { projectId environmentId } }", hdr_mode="project"))[:400])
