import os, json, urllib.request, urllib.error

TELNYX_API_KEY = os.environ["TELNYX_API_KEY"]
CONN_ID = os.environ["TELNYX_SIP_CONNECTION_ID"]
BASE = "https://api.telnyx.com/v2"

def call(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={"Authorization": f"Bearer {TELNYX_API_KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())
    except Exception as e:
        return None, {"error": str(e)}

print("============ CREDENTIAL CONNECTION", CONN_ID, "============")
st, res = call("GET", f"/credential_connections/{CONN_ID}")
print("status", st)
if st == 200:
    d = res["data"]
    for k in ["id","connection_name","active","user_name","sip_uri_calling_preference",
              "webhook_event_url","outbound","inbound","rtcp_settings","encode_contact_header_enabled"]:
        if k in d:
            print(f"  {k}: {json.dumps(d[k]) if isinstance(d[k],(dict,list)) else d[k]}")
else:
    print(json.dumps(res, indent=2)[:1000])

for label, cred_id in [("ACTIVE +18886146831", "161ab41a-061e-4606-97c5-803a8581c0c4"),
                       ("OLD +18337215318", "9834a5a4-7ec8-4b25-ad93-9be53e360c04")]:
    print(f"\n============ TELEPHONY CREDENTIAL {label} : {cred_id} ============")
    st, res = call("GET", f"/telephony_credentials/{cred_id}")
    print("status", st)
    if st == 200:
        d = res["data"]
        for k in ["id","sip_username","connection_id","resource_id","name","expired","expires_at","created_at","updated_at"]:
            if k in d:
                print(f"  {k}: {d[k]}")
    else:
        print(json.dumps(res, indent=2)[:800])

# List credentials on the connection (page 1) to see if the gencred usernames are present
print("\n============ LIST telephony_credentials on connection (first 250) ============")
st, res = call("GET", f"/telephony_credentials?filter[connection_id]={CONN_ID}&page[size]=250")
print("status", st)
if st == 200:
    data = res.get("data", [])
    print("total on this page:", len(data))
    targets = {"gencred9fLB6aMtWdqUfWICGcmXDiRPC0eM7hU61TeZhXr9p7":"ACTIVE",
               "gencredZ1T2p9O6BA1GJ4sZQmCnH1EDr093XqBbJGnjc8AOrJ":"OLD"}
    for c in data:
        u = c.get("sip_username","")
        if u in targets:
            print(f"  FOUND {targets[u]} cred on connection: id={c['id']} user={u} expired={c.get('expired')}")
    meta = res.get("meta", {})
    print("meta:", json.dumps(meta))
else:
    print(json.dumps(res, indent=2)[:800])
