import socket, hashlib, uuid, re, time, os, json, urllib.request, urllib.error

KEY = os.environ["TELNYX_API_KEY"]; CONN = os.environ["TELNYX_SIP_CONNECTION_ID"]
BASE = "https://api.telnyx.com/v2"
def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            b = r.read(); return r.status, (json.loads(b) if b else {})
    except urllib.error.HTTPError as e:
        b = e.read(); return e.code, (json.loads(b) if b.strip() else {})

def md5(s): return hashlib.md5(s.encode()).hexdigest()
def parse_auth(h):
    d={};
    for m in re.finditer(r'(\w+)="?([^",]+)"?', h): d[m.group(1)]=m.group(2)
    return d
def register(server, domain, user, pw, timeout=6):
    try: ip = socket.gethostbyname(server)
    except Exception as e: return f"DNS_FAIL {e}"
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.settimeout(timeout)
    cid=uuid.uuid4().hex; tag=uuid.uuid4().hex[:8]; br="z9hG4bK"+uuid.uuid4().hex[:12]
    uri=f"sip:{domain}"; aor=f"sip:{user}@{domain}"
    def build(cseq, auth=None):
        L=[f"REGISTER {uri} SIP/2.0",f"Via: SIP/2.0/UDP 0.0.0.0:5060;branch={br}{cseq};rport","Max-Forwards: 70",
           f"From: <{aor}>;tag={tag}",f"To: <{aor}>",f"Call-ID: {cid}",f"CSeq: {cseq} REGISTER",
           f"Contact: <sip:{user}@0.0.0.0:5060>","Expires: 120","User-Agent: diag"]
        if auth: L.append(auth)
        L+=["Content-Length: 0","",""]; return "\r\n".join(L).encode()
    try:
        s.sendto(build(1),(ip,5060)); resp=s.recvfrom(65535)[0].decode(errors="replace")
        m=re.search(r'(?:WWW|Proxy)-Authenticate:\s*Digest\s*(.*)',resp,re.I)
        if not m: return resp.split("\r\n")[0]
        ch=parse_auth(m.group(1)); realm=ch.get("realm"); nonce=ch.get("nonce")
        ha1=md5(f"{user}:{realm}:{pw}"); ha2=md5(f"REGISTER:{uri}")
        if ch.get("qop"):
            nc="00000001";cn=uuid.uuid4().hex[:16]
            rr=md5(f"{ha1}:{nonce}:{nc}:{cn}:{ch['qop']}:{ha2}")
            auth=f'Authorization: Digest username="{user}", realm="{realm}", nonce="{nonce}", uri="{uri}", response="{rr}", qop={ch["qop"]}, nc={nc}, cnonce="{cn}"'
        else:
            rr=md5(f"{ha1}:{nonce}:{ha2}")
            auth=f'Authorization: Digest username="{user}", realm="{realm}", nonce="{nonce}", uri="{uri}", response="{rr}"'
        s.sendto(build(2,auth),(ip,5060)); resp2=s.recvfrom(65535)[0].decode(errors="replace")
        return resp2.split("\r\n")[0]
    except socket.timeout: return "TIMEOUT"
    except Exception as e: return f"ERR {e}"
    finally: s.close()

# Create a brand new credential, then poll registration every 45s up to ~13 min
st, res = api("POST","/telephony_credentials",{"connection_id":CONN})
d=res.get("data",{})
cid=d["id"]; user=d["sip_username"]; pw=d["sip_password"]
print(f"[{time.strftime('%H:%M:%S')}] CREATED {cid} user={user[:20]}... status={st}", flush=True)
t0=time.time()
for i in range(18):
    r = register("sip.telnyx.com","sip.telnyx.com",user,pw)
    elapsed=int(time.time()-t0)
    print(f"[{time.strftime('%H:%M:%S')}] +{elapsed:4d}s -> {r}", flush=True)
    if "200" in r:
        print(f"*** PROPAGATED after ~{elapsed}s ***", flush=True); break
    time.sleep(45)
# cleanup
st2,_=api("DELETE",f"/telephony_credentials/{cid}")
print(f"Deleted test cred {cid} status={st2}", flush=True)
