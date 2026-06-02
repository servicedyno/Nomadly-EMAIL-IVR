import socket, hashlib, uuid, re, sys, time

def md5(s): return hashlib.md5(s.encode()).hexdigest()

def parse_auth(header):
    d = {}
    for m in re.finditer(r'(\w+)="?([^",]+)"?', header):
        d[m.group(1)] = m.group(2)
    return d

def register(server_host, sip_domain, user, password, label, timeout=6):
    """Attempt SIP REGISTER with digest auth over UDP. Returns (final_status, realm_seen, raw)."""
    try:
        ip = socket.gethostbyname(server_host)
    except Exception as e:
        return (None, None, f"DNS fail {server_host}: {e}")
    port = 5060
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    local_ip = "0.0.0.0"
    call_id = uuid.uuid4().hex
    from_tag = uuid.uuid4().hex[:8]
    branch = "z9hG4bK" + uuid.uuid4().hex[:12]
    uri = f"sip:{sip_domain}"
    aor = f"sip:{user}@{sip_domain}"

    def build(cseq, auth_header=None):
        lines = [
            f"REGISTER {uri} SIP/2.0",
            f"Via: SIP/2.0/UDP {local_ip}:5060;branch={branch}{cseq};rport",
            f"Max-Forwards: 70",
            f"From: <{aor}>;tag={from_tag}",
            f"To: <{aor}>",
            f"Call-ID: {call_id}",
            f"CSeq: {cseq} REGISTER",
            f"Contact: <sip:{user}@{local_ip}:5060>",
            f"Expires: 120",
            f"User-Agent: diag-sip-tester",
        ]
        if auth_header:
            lines.append(auth_header)
        lines += ["Content-Length: 0", "", ""]
        return "\r\n".join(lines).encode()

    try:
        # 1st REGISTER
        s.sendto(build(1), (ip, port))
        data, _ = s.recvfrom(65535)
        resp = data.decode(errors="replace")
        status1 = resp.split("\r\n")[0]
        m = re.search(r'(?:WWW-Authenticate|Proxy-Authenticate):\s*Digest\s*(.*)', resp, re.I)
        if not m:
            return (status1, None, resp[:400])
        ch = parse_auth(m.group(1))
        realm = ch.get("realm"); nonce = ch.get("nonce")
        # compute digest
        ha1 = md5(f"{user}:{realm}:{password}")
        ha2 = md5(f"REGISTER:{uri}")
        if ch.get("qop"):
            nc = "00000001"; cnonce = uuid.uuid4().hex[:16]
            response = md5(f"{ha1}:{nonce}:{nc}:{cnonce}:{ch['qop']}:{ha2}")
            auth = (f'Authorization: Digest username="{user}", realm="{realm}", nonce="{nonce}", '
                    f'uri="{uri}", response="{response}", qop={ch["qop"]}, nc={nc}, cnonce="{cnonce}"')
        else:
            response = md5(f"{ha1}:{nonce}:{ha2}")
            auth = (f'Authorization: Digest username="{user}", realm="{realm}", nonce="{nonce}", '
                    f'uri="{uri}", response="{response}"')
        if ch.get("opaque"):
            auth += f', opaque="{ch["opaque"]}"'
        # 2nd REGISTER with auth
        s.sendto(build(2, auth), (ip, port))
        data2, _ = s.recvfrom(65535)
        resp2 = data2.decode(errors="replace")
        status2 = resp2.split("\r\n")[0]
        return (status2, realm, f"challenge_realm={realm}\nfirst={status1}\nfinal={status2}")
    except socket.timeout:
        return ("TIMEOUT", None, "no response (UDP blocked or filtered?)")
    except Exception as e:
        return ("ERROR", None, str(e))
    finally:
        s.close()

creds = [
    ("FRESH probe cred 4daa5324", "gencredKN1SWBO21KlZ8IdLlWRoJOiLzMs81Acn2nyGerVWo5", "399386bdceae4cd290c0c13bab0d5c7d"),
    ("USER displayed 161ab41a",   "gencred1lwe4hOVZZJzunVSeh95RTkLYZsRAn9fjC8YOLlZV1", "5d0b93c3727b41f3aa5ea8eb656a40be"),
    ("USER reset    cf5a3abd",    "gencred9fLB6aMtWdqUfWICGcmXDiRPC0eM7hU61TeZhXr9p7", "78197d8335e84e59a95bc1d07a3ce90b"),
]
for label, user, pw in creds:
    print(f"\n############### {label} ###############")
    for server, domain in [("sip.telnyx.com","sip.telnyx.com"), ("sip.speechcue.com","sip.speechcue.com")]:
        st, realm, raw = register(server, domain, user, pw, label)
        print(f"  [server={server} domain={domain}] -> {st}  (realm={realm})")
        if st and ("403" in str(st) or "401" in str(st)):
            print("     detail:", raw.replace("\n"," | ")[:160])
