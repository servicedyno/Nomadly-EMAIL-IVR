import os, json, urllib.request, urllib.error
KEY = os.environ["TELNYX_API_KEY"]
CONN = os.environ["TELNYX_SIP_CONNECTION_ID"]
BASE = "https://api.telnyx.com/v2"
def call(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

# Create a throwaway credential, sending our own username/password to see if Telnyx honors or ignores them
SENT_USER = "test_DIAGNOSTIC_ignoreme"
SENT_PASS = "MyProvidedPassword123abc"
st, res = call("POST", "/telephony_credentials", {"connection_id": CONN, "sip_username": SENT_USER, "sip_password": SENT_PASS})
print("CREATE status:", st)
d = res.get("data", res)
print("FULL create response data:")
print(json.dumps(d, indent=2))
cred_id = d.get("id")
print("\n--- ANALYSIS ---")
print("sent sip_username:", SENT_USER, "-> returned:", d.get("sip_username"), "(IGNORED?" , d.get("sip_username")!=SENT_USER, ")")
print("sent sip_password:", SENT_PASS, "-> returned:", d.get("sip_password"), "(IGNORED?", d.get("sip_password")!=SENT_PASS, ")")
print("returned password present?:", bool(d.get("sip_password")))

# cleanup
if cred_id:
    st2,_ = call("DELETE", f"/telephony_credentials/{cred_id}")
    print("\nDELETED throwaway cred:", cred_id, "status", st2)
