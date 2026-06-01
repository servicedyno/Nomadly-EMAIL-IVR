#!/usr/bin/env python3
"""Fetch Railway production logs and surface every captcha/antiRed mention,
plus any AI-support inbound message mentioning captcha. Used to find the
specific bot user who reported "captcha still on after I turned it off"."""
import os, sys, json, requests, re
from datetime import datetime, timezone

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(query, variables=None):
    r = requests.post(URL, json={"query": query, "variables": variables or {}}, headers=HDR, timeout=60)
    try:
        j = r.json()
    except Exception:
        print("NON-JSON:", r.status_code, r.text[:500]); sys.exit(1)
    if "errors" in j and j["errors"]:
        print("GQL ERRORS:", json.dumps(j["errors"], indent=2))
    return j.get("data") or {}

Q_DEPLOY = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 5) {
    edges { node { id status createdAt } }
  }
}
"""
data = gql(Q_DEPLOY, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = (((data or {}).get("deployments") or {}).get("edges")) or []
success = [e["node"] for e in edges if e["node"].get("status") == "SUCCESS"]
if not success:
    print("No SUCCESS deployments"); sys.exit(1)

print(f"─── Scanning {len(success)} recent deployments for captcha mentions ───\n")

Q_LOGS = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) {
    timestamp message severity
  }
}
"""

CAPTCHA_PATTERNS = [
    r"captcha",
    r"antired",
    r"anti-red",
    r"visitor.{0,5}captcha",
    r"visitorCaptchaOff",
    r"setDomainChallengeBypass",
    r"bypass:",
    r"DomainChallengeBypass",
    r"AntiRed-Bot",
    r"Verifying.{0,3}your.{0,3}browser",
]
COMPLAINT_PATTERNS = [
    r"still.{0,15}on",
    r"not.{0,10}off",
    r"didn'?t.{0,10}work",
    r"still.{0,15}showing",
    r"still.{0,15}active",
    r"keeps.{0,10}coming",
    r"won'?t.{0,10}go.{0,10}away",
]

captcha_re = re.compile("|".join(CAPTCHA_PATTERNS), re.IGNORECASE)
complaint_re = re.compile("|".join(COMPLAINT_PATTERNS), re.IGNORECASE)

all_captcha_lines = []
ai_support_captcha_lines = []
for dep in success[:3]:
    data = gql(Q_LOGS, {"d": dep["id"], "limit": 5000})
    logs = data.get("deploymentLogs") or []
    print(f"  [{dep['id'][:8]}] {dep['createdAt']}: {len(logs)} lines")
    for l in logs:
        m = (l.get("message") or "")
        if captcha_re.search(m):
            all_captcha_lines.append({"dep": dep["id"][:8], **l})
        if "[AI Support]" in m and ("captcha" in m.lower() or "antired" in m.lower()):
            ai_support_captcha_lines.append({"dep": dep["id"][:8], **l})

print(f"\n─── {len(all_captcha_lines)} captcha-related log lines ───\n")
# Sort by timestamp desc
all_captcha_lines.sort(key=lambda x: x.get("timestamp",""), reverse=True)
for l in all_captcha_lines[:100]:
    ts = l.get("timestamp","")
    msg = (l.get("message") or "").strip()[:280]
    print(f"  [{ts}] {msg}")

print(f"\n─── {len(ai_support_captcha_lines)} AI-Support captcha lines ───\n")
for l in ai_support_captcha_lines[:30]:
    ts = l.get("timestamp","")
    msg = (l.get("message") or "").strip()[:400]
    print(f"  [{ts}] {msg}")

# Save full dump
with open("/app/scripts/railway_logs_captcha.jsonl", "w") as f:
    for l in all_captcha_lines:
        f.write(json.dumps(l) + "\n")
print(f"\n✅ Saved {len(all_captcha_lines)} lines to /app/scripts/railway_logs_captcha.jsonl")
