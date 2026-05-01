# Cpanel API Restored — Side Effect of Origin Lockdown

**Date:** 2026-05-01

## What broke

After the maximum-lockdown firewall was applied (only SSH + ICMP + tunnel
outbound), Railway production lost the ability to reach the cPanel UAPI
(`:2083`) and WHM API (`:2087`) on `209.38.241.9`. Every panel action
(`File Manager`, `Domains`, `Email`, etc.) timed out at 30s with
`timeout of 30000ms exceeded` in the React panel UI, and the bot fired
`🚨 cPanel/WHM control plane down` alerts.

## Why

Railway services don't have static egress IPs by default — they use a
dynamic GCP-backed pool. The firewall blocking 2083/2087 from `0.0.0.0/0`
also blocked Railway's ever-changing egress.

## Immediate fix (done)

Added inbound firewall rules to allow `tcp/2083` and `tcp/2087` from
anywhere:

```
INBOUND (current state)
  tcp/22       from anywhere   (SSH)
  icmp         from anywhere   (ping)
  tcp/2083     from anywhere   (cPanel UAPI — restored)
  tcp/2087     from anywhere   (WHM API — restored)
  — everything else (80, 443, 25, 110, 143, 465, 587, 993, 995,
    2082, 2086, 2095, 2096) blocked —
```

Verified:
- `curl -k https://209.38.241.9:2083/login/` → HTTP 200, 38 KB
- `curl -k https://209.38.241.9:2087/login/` → HTTP 401 (auth required, cert valid)
- All other ports still BLOCKED
- Customer panel timeout error resolved

## Why this is acceptable (not a regression)

The original DigitalOcean abuse complaint identified `209.38.241.9` because
the brand domain `huntingtononlinebanking.it` had an A record pointing to
that IP. After the bulk migration earlier today, **NO customer domain has
an A record to the origin anymore** (audited 289 zones, 0 leaks remaining).
Even if abuse scanners re-catalog the cPanel SSL cert on 2083/2087, the
cert no longer ties back to any active customer domain in DNS.

The risk profile is significantly reduced from the original state — but
not zero. cPanel/WHM ports DO still expose:
- A self-signed or AutoSSL cert that may include `panel.1.hostbay.io` in
  the SAN. If that's still our brand and the IP is fingerprinted, this
  could be used in future abuse correlation.

## Long-term fix (TODO — not done)

Route cPanel API calls through the Cloudflare Tunnel that's already
running on the WHM box. Steps:

1. **Cloudflare side:** Add tunnel ingress entries via CF API:
   ```yaml
   - hostname: cpanel-api.<internal-domain>
     service: https://localhost:2083
     originRequest: { noTLSVerify: true }
   - hostname: whm-api.<internal-domain>
     service: https://localhost:2087
     originRequest: { noTLSVerify: true }
   ```
   Use a Zero Trust application with bot-only auth (mTLS or service token).

2. **Code change:** Update `js/cpanel-proxy.js`:
   - Read `CPANEL_API_URL` env var (defaults to `https://${WHM_HOST}:2083`)
   - Same for `WHM_API_URL`
   - In `getBaseUrl()`, return the env URL if set, otherwise the legacy IP+port

3. **Deploy:** Push to GitHub → Railway picks it up → set the env vars
   on Railway → redeploy.

4. **Final lockdown:** Once verified, remove the 2083/2087 public rules
   from the DO firewall.

After that, the only port reachable from public is SSH (22). cPanel API
calls flow Bot → CF (with auth) → tunnel → localhost:2083 on the box.
Origin IP fully invisible.

## Operational notes

- The cert fingerprint on 2083/2087 can be replaced with a generic
  Let's Encrypt cert that doesn't include any brand SAN — would help
  even before the tunnel-routed solution is shipped.
- DO firewall ID: `fa8b27c8-405b-4328-8939-c5d2106d2cea`
- Modify rules:
  ```bash
  curl -X POST -H "Authorization: Bearer $DIGITALOCEAN_API_TOKEN" \
    -H "Content-Type: application/json" \
    https://api.digitalocean.com/v2/firewalls/fa8b27c8.../rules -d <body>
  curl -X DELETE -H "Authorization: Bearer $DIGITALOCEAN_API_TOKEN" \
    -H "Content-Type: application/json" \
    https://api.digitalocean.com/v2/firewalls/fa8b27c8.../rules -d <body>
  ```
