# ✅ Maximum Origin Lockdown — RESTORED

**Date:** 2026-05-01 (final state)

## Final firewall state (DO cloud firewall `fa8b27c8...`)

```
INBOUND
  tcp/22       from anywhere      (SSH only — kept to avoid lockout)
  icmp         from anywhere      (ping)
  — every other port BLOCKED —

OUTBOUND
  tcp/* udp/* icmp  to anywhere   (cloudflared tunnel needs outbound)
```

## Verified end-to-end (post-lockdown)

```
Direct origin scan from non-CF source:
  22:    OPEN              ← SSH (intentional)
  80:    BLOCKED ✅
  443:   BLOCKED ✅
  2083:  BLOCKED ✅
  2087:  BLOCKED ✅

Tunnel hostnames:
  https://cpanel-api.hostbay.io/login/  → HTTP 401  ✅
  https://whm-api.hostbay.io/login/     → HTTP 401  ✅

Production:
  No `control-plane DOWN` events since deploy   ✅
  New HTTPS health probe via WHM_API_URL        ✅
```

## What was deployed (Railway commit `9e5e1b73`)

1. **`js/cpanel-proxy.js`** — `getBaseUrl()` routes through `CPANEL_API_URL`
   when set; injects `CF-Access-Client-Id`/`Secret` headers on tunneled
   requests; all 4 cPanel API entrypoints (UAPI, json-api/cpanel, addon,
   subdomain) routed through the tunnel.

2. **`js/whm-service.js`** — `WHM_BASE` uses `WHM_API_URL` when set; CF
   Access headers injected via axios instance defaults.

3. **`js/cpanel-health.js`** — health probe uses `_tunnelHttpsProbe()`
   (HEAD `/login/` → expects HTTP 401) when `WHM_API_URL` is set;
   falls back to legacy TCP probe otherwise. CF Access headers injected.

4. **Cloudflare Tunnel** (account `ed6035eb...`, tunnel `f63ce7b5-...`):
   ```yaml
   - hostname: cpanel-api.hostbay.io  → https://localhost:2083
   - hostname: whm-api.hostbay.io     → https://localhost:2087
   - service: http://209.38.241.9:80   (catch-all, existing)
   ```

5. **DNS** in `hostbay.io` zone: proxied CNAMEs for both tunnel hostnames.

6. **Railway env vars:**
   ```
   CPANEL_API_URL = https://cpanel-api.hostbay.io
   WHM_API_URL    = https://whm-api.hostbay.io
   ```

7. **WHM/cPanel SSL cert** swapped from `server.hostbay.io` → `CN=localhost`
   self-signed (no brand SANs, even if 2083/2087 ever briefly exposed
   in future, no fingerprint vector).

## Origin fingerprint surface — eliminated

Before today the abuse-fingerprinting vectors that exposed
`209.38.241.9 ↔ panel.1.hostbay.io ↔ huntingtononlinebanking.it` were:

| Vector | Before | After |
|---|---|---|
| `mail.<domain>` A → origin in 270 zones | 🔴 leaks via DNS | ✅ all purged + CNAME→tunnel |
| `<domain>` A → origin (apex/www in 270 zones) | 🔴 leaks via DNS | ✅ migrated to CNAME→tunnel |
| Open ports 80/443/25/110/143 etc. | 🟡 some banners | 🔒 all blocked |
| `cpanel.*`/`webmail.*` A records (77 of them) | 🔴 leaks via DNS | ✅ all purged |
| Open ports 2083/2087 (cPanel/WHM) | 🔴 cert SAN fingerprint | 🔒 blocked |
| WHM cert SAN `server.hostbay.io` | 🔴 brand fingerprint | ✅ replaced with `localhost` |
| Bot direct API access via `WHM_HOST:2083` | 🔴 needs origin port open | ✅ via tunnel + Access-ready |

## Deferred (one click each)

- **Cloudflare Zero Trust Access** — script ready at `/app/setup_zero_trust.py`.
  After user clicks "Enable Access" in dashboard, the script auto-creates
  service token, wraps both tunnel hostnames in Access apps with non_identity
  policies, and pushes the token to Railway. Fully prepared bot-side code
  changes (CF-Access-Client-Id/Secret headers in axios calls).

- **Tighten SSH (22)** — currently from anywhere. Lock to a specific IP
  allow-list if user provides their office/home IPs.

- **Rotate the DigitalOcean droplet** — DNS history services (SecurityTrails,
  ViewDNS, crt.sh) retain pre-fix records forever. Only a fresh IP
  invalidates that history.

## Operational reference

- DO firewall ID: `fa8b27c8-405b-4328-8939-c5d2106d2cea`
- DO droplet ID: `557194941`
- CF tunnel ID: `f63ce7b5-43f2-4fc8-ab74-28481e29ce7e`
- CF account ID: `ed6035ebf6bd3d85f5b26c60189a21e2`
- hostbay.io zone ID: `3b067b0400f8051c0a962c86d773de6b`
