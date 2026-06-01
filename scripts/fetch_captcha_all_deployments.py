#!/usr/bin/env python3
"""Fetch logs from MANY recent Railway deployments looking for captcha mentions."""
import json, requests, re

API_KEY = "6a2add90-c53c-40c4-91b7-f6f5af75861b"
PROJECT_ID = "c23ac3d9-51c5-4242-8776-eed4e3801abe"
SERVICE_ID = "b9c4ad64-7667-4dd3-8b9a-3867ede47885"
ENV_ID = "889fd56a-720a-4020-884c-034784992666"
URL = "https://backboard.railway.app/graphql/v2"
HDR = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

def gql(q, v=None):
    r = requests.post(URL, json={"query": q, "variables": v or {}}, headers=HDR, timeout=60)
    return r.json().get("data") or {}

Q_DEPLOY = """
query($p:String!, $e:String!, $s:String!) {
  deployments(input:{projectId:$p, environmentId:$e, serviceId:$s}, first: 50) {
    edges { node { id status createdAt } }
  }
}
"""
data = gql(Q_DEPLOY, {"p": PROJECT_ID, "e": ENV_ID, "s": SERVICE_ID})
edges = data.get("deployments", {}).get("edges", [])
deployments = [e["node"] for e in edges if e["node"]["status"] in ("SUCCESS", "FAILED", "CRASHED", "REMOVED")]
print(f"Got {len(deployments)} deployments")

Q_LOGS = """
query($d:String!, $limit:Int!) {
  deploymentLogs(deploymentId:$d, limit:$limit) { timestamp message severity }
}
"""

captcha_re = re.compile(r"captcha|antired|anti-red|visitorCaptchaOff|setDomainChallengeBypass|bypass:|AntiRed-Bot|antiRedOff", re.IGNORECASE)
ai_re = re.compile(r"\[AI Support\]|\[AiSupport\]|userMsg|user_message|chat[Ii]d.*say|complaint", re.IGNORECASE)

all_lines = []
total_lines = 0
for d in deployments[:20]:
    data = gql(Q_LOGS, {"d": d["id"], "limit": 5000})
    logs = data.get("deploymentLogs") or []
    total_lines += len(logs)
    cap = [l for l in logs if captcha_re.search(l.get("message") or "")]
    print(f"  [{d['id'][:8]}] {d['createdAt']} {d['status']}: {len(logs)} lines, {len(cap)} captcha", flush=True)
    for l in cap:
        all_lines.append({"dep": d["id"][:8], "createdAt": d["createdAt"], **l})

print(f"\nTotal {total_lines} lines scanned, {len(all_lines)} captcha-related\n")

# Group AI-Support inbound user messages mentioning captcha
ai_lines = [l for l in all_lines if "[AI Support]" in (l.get("message") or "") or "[AiSupport]" in (l.get("message") or "")]
print(f"─── AI Support captcha mentions: {len(ai_lines)} ───")
for l in ai_lines[:30]:
    print(f"  [{l['createdAt'][:19]}] {(l.get('message') or '').strip()[:400]}")

# Bot toggle log lines
bot_lines = [l for l in all_lines if "[AntiRed-Bot]" in (l.get("message") or "")]
print(f"\n─── Bot toggle errors: {len(bot_lines)} ───")
for l in bot_lines[:30]:
    print(f"  [{l['createdAt'][:19]}] {(l.get('message') or '').strip()[:400]}")

# Cloudflare KV setDomainChallengeBypass logs
kv_lines = [l for l in all_lines if "setDomainChallengeBypass" in (l.get("message") or "") or "Domain bypass" in (l.get("message") or "")]
print(f"\n─── KV bypass operations: {len(kv_lines)} ───")
for l in kv_lines[:30]:
    print(f"  [{l['createdAt'][:19]}] {(l.get('message') or '').strip()[:400]}")

# Any other captcha lines (errors / warns)
other = [l for l in all_lines if l not in ai_lines and l not in bot_lines and l not in kv_lines]
err_other = [l for l in other if (l.get("severity") or "").upper() in ("ERROR", "WARN", "WARNING", "CRITICAL")]
print(f"\n─── Other captcha errors/warns: {len(err_other)} ───")
for l in err_other[:30]:
    print(f"  [{l['createdAt'][:19]}] {(l.get('severity') or '').upper()} {(l.get('message') or '').strip()[:300]}")

with open("/app/scripts/railway_captcha_all_deployments.jsonl", "w") as f:
    for l in all_lines:
        f.write(json.dumps(l) + "\n")
print(f"\nSaved → /app/scripts/railway_captcha_all_deployments.jsonl")
