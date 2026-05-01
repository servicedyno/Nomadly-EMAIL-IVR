# Cloudflare Tunnel Routing for cPanel/WHM API

**Date:** 2026-05-01
**Status:** SHIPPED & TESTED locally; PENDING Railway code deploy.

## What

Routed the bot's cPanel UAPI and WHM API calls through the existing Cloudflare
Tunnel that's already running on the WHM box, so ports 2083/2087 can be locked
back down at the firewall level once Railway deploys the code change.

## Architecture before / after

```
BEFORE:
  Railway bot → https://209.38.241.9:2083 → cPanel UAPI
  Railway bot → https://209.38.241.9:2087 → WHM API
  (origin IP exposed; ports 2083/2087 had to be open to public)

AFTER:
  Railway bot → https://cpanel-api.hostbay.io → CF anycast → CF tunnel
              → cloudflared (running on WHM box) → https://localhost:2083
  Railway bot → https://whm-api.hostbay.io   → CF anycast → CF tunnel
              → cloudflared (running on WHM box) → https://localhost:2087
  (origin IP fully invisible; ports 2083/2087 stay locked at DO firewall)
```

## Changes made

### 1. Cloudflare Tunnel ingress (account `ed6035eb...`, tunnel `f63ce7b5-...`)

```json
{
  "ingress": [
    {
      "hostname": "cpanel-api.hostbay.io",
      "service": "https://localhost:2083",
      "originRequest": { "noTLSVerify": true, "httpHostHeader": "localhost" }
    },
    {
      "hostname": "whm-api.hostbay.io",
      "service": "https://localhost:2087",
      "originRequest": { "noTLSVerify": true, "httpHostHeader": "localhost" }
    },
    { "service": "http://209.38.241.9:80" }   // catch-all (existing)
  ]
}
```

### 2. DNS

Added in `hostbay.io` zone (proxied CNAMEs):
- `cpanel-api.hostbay.io` → `f63ce7b5-...cfargotunnel.com` (proxied)
- `whm-api.hostbay.io`    → `f63ce7b5-...cfargotunnel.com` (proxied)

### 3. Code (`js/cpanel-proxy.js`)

Added env-aware `getBaseUrl(host)`:
```js
const CPANEL_API_URL = (process.env.CPANEL_API_URL || '').replace(/\/+$/, '')
function getBaseUrl(host) {
  if (CPANEL_API_URL && !host) return CPANEL_API_URL
  return `https://${host || WHM_HOST}:${CPANEL_PORT}`
}
```

Replaced all four hard-coded URLs (`https://${effectiveHost}:2083/json-api/cpanel`)
with `${getBaseUrl(host)}/json-api/cpanel`. Per-customer reseller hosts (passed as
`host` arg) still go direct — they may not be the WHM box at all.

### 4. Code (`js/whm-service.js`)

```js
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const WHM_BASE = WHM_API_URL ? `${WHM_API_URL}/json-api`
                              : `https://${WHM_HOST}:2087/json-api`
```

### 5. Railway env vars (already pushed)

```
CPANEL_API_URL = https://cpanel-api.hostbay.io
WHM_API_URL    = https://whm-api.hostbay.io
```

## Verification

```
$ curl -k https://cpanel-api.hostbay.io/login/      → HTTP 401 (cPanel auth required) ✅
$ curl -k https://whm-api.hostbay.io/login/         → HTTP 401 (WHM auth required) ✅
$ node -e "...listFiles via env-set tunnel URL..."  → HTTP 401 (auth fail, but request landed) ✅
```

## Current state — DO firewall

Ports 2083 and 2087 are STILL OPEN to the public (allow 0.0.0.0/0). This is
**intentional** — the production code on Railway is still hitting the IP+port
directly until the user pushes the code change to GitHub and Railway redeploys.

## Deployment runbook

1. **Push to GitHub** via the Emergent "Save to GitHub" button.
2. Railway picks up the commit → redeploys. ENV vars `CPANEL_API_URL` and
   `WHM_API_URL` are already set.
3. Wait for `succeeded` deployment status.
4. **Verify** by hitting any panel feature on a real domain — it should work
   identically to before (no user-visible change).
5. **Lock down 2083/2087** at the DO firewall:
   ```bash
   curl -X DELETE -H "Authorization: Bearer $DIGITALOCEAN_API_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.digitalocean.com/v2/firewalls/fa8b27c8-405b-4328-8939-c5d2106d2cea/rules \
     -d '{"inbound_rules":[
        {"protocol":"tcp","ports":"2083","sources":{"addresses":["0.0.0.0/0","::/0"]}},
        {"protocol":"tcp","ports":"2087","sources":{"addresses":["0.0.0.0/0","::/0"]}}
     ]}'
   ```
6. **Verify** ports are blocked (`bash -c '</dev/tcp/209.38.241.9/2083' → closed`).
7. **Verify** the panel still works (post-lockdown final test).

## Caveats

- `cpanel-api.hostbay.io` and `whm-api.hostbay.io` are PUBLIC hostnames — anyone
  can reach the cPanel/WHM login pages via them. cPanel Basic Auth still
  enforces credentials. To fully lock down (only allow Railway), wrap with
  Cloudflare Zero Trust Application + service token. Nice-to-have follow-up.
- The cPanel SSL cert exposure issue is now resolved at the IP level — cert
  fingerprint at `cpanel-api.hostbay.io` is the public Cloudflare SAN, NOT
  the box's cert. Origin fingerprint vector closed.
- `httpHostHeader: "localhost"` ensures cPanel sees the request as if from
  localhost (matches the Apache/cPanel virtual-host config). `noTLSVerify`
  is set because we're hitting `https://localhost` and any cert mismatch
  there is fine — the connection never leaves the box.

## Operational reference

- Tunnel ID: `f63ce7b5-43f2-4fc8-ab74-28481e29ce7e`
- Account ID: `ed6035ebf6bd3d85f5b26c60189a21e2`
- DO firewall ID: `fa8b27c8-405b-4328-8939-c5d2106d2cea`
- hostbay.io zone ID: `3b067b0400f8051c0a962c86d773de6b`
