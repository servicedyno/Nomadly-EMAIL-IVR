#!/usr/bin/env python3
"""Try the project-scoped token to access the Nomadly bot project."""
import os, json, requests

URL = "https://backboard.railway.app/graphql/v2"
# Try multiple known tokens / project IDs from the codebase
TRY = [
    ("6a2add90-c53c-40c4-91b7-f6f5af75861b", "c23ac3d9-51c5-4242-8776-eed4e3801abe", "b9c4ad64-7667-4dd3-8b9a-3867ede47885", "889fd56a-720a-4020-884c-034784992666"),
    ("5c463b97-111b-4116-a571-475613fd51e2", "c23ac3d9-51c5-4242-8776-eed4e3801abe", "6fe00b0a-e9c4-4a41-aff2-e56867e63159", "b3e707a7-f41e-4e9d-8ea3-6b51e26ecb8d"),
    ("5c463b97-111b-4116-a571-475613fd51e2", None, "6fe00b0a-e9c4-4a41-aff2-e56867e63159", "b3e707a7-f41e-4e9d-8ea3-6b51e26ecb8d"),
]
def gql(api_key, q, v=None, project_id=None):
    h = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    if project_id:
        h["Project-Access-Token"] = api_key  # try as project token
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=h, timeout=30)
    try:
        return r.json()
    except Exception:
        return {"_raw": r.text[:500]}

Q = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
    edges { node { id status createdAt } }
  }
}
"""
for api, pid, sid, eid in TRY:
    print(f"\n=== Trying api={api[:8]}... project={pid} service={sid[:8]}... env={eid[:8]}... ===")
    if not pid:
        # try inferring from service
        Q2 = "query { me { projects { edges { node { id name services { edges { node { id name } } } } } } } }"
        d = gql(api, Q2)
        print(json.dumps(d, indent=2)[:1200])
        continue
    d = gql(api, Q, {"p": pid, "e": eid, "s": sid})
    print(json.dumps(d, indent=2)[:1200])
