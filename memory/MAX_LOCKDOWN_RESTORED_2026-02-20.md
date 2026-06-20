# Maximum-Lockdown Restored on New WHM Droplet

**Date:** 2026-02-20
**Triggered by:** User asked "is the new server hardened the same way as before?" — answer was **no**, the DO firewall was not recreated during the 2026-06-17 emergency WHM migration.

## Why this was needed

After the 2026-06-17 WHM migration (`/app/memory/WHM_MIGRATION_2026-06-17.md`), customer DNS + bot code + CF tunnel all moved cleanly to the new droplet, but the DigitalOcean cloud firewall that previously locked down ports 25/80/110/143/443/465/587/993/995/2082-2087/2095-2096 was **never reattached**. The new droplet `578369745` (`68.183.77.106`) was sitting wide open with the exact set of fingerprint-vector ports that triggered the original 2026-05-01 DigitalOcean abuse complaint via Cloudflare for `huntingtononlinebanking.it`.

The cert SAN had improved (now generic `68-183-77-106.cprapid.com`, no brand fingerprint) and DNS had no zone A→origin records, but the mail/SMTP/IMAP banners on 25/110/143/465/587/993/995 still leaked server identity and the WHM panel was publicly fingerprint-able on 2087.

## Pre-flight audit (before applying)

Script: `/tmp/audit_origin_leaks.py` (Python urllib + concurrent.futures, uses `CLOUDFLARE_API_KEY` from env)

```
Scanned 327 CF zones.
Zones with A → 68.183.77.106 (new origin):   0
Zones with A → 209.38.241.9 (old origin):    0
Verdict: SAFE TO LOCK FULLY — no zone resolves directly to the origin.
```

The pre-flight is much cleaner than the 2026-05-01 lockdown which required migrating 270 zones first. The 2026-06-17 migration script already moved all 395 CNAMEs to the new tunnel `b395cebc-4b7a-4aba-8ced-e11665c26b30`.

## What was applied

**Approach (a)** — reuse existing firewall `fa8b27c8-405b-4328-8939-c5d2106d2cea` ("hostbay-tunnel-only"). It had been sitting unattached since the old droplet 557194941 was destroyed (post-14-day retention window per WHM_MIGRATION doc).

```
DO API call:
  POST https://api.digitalocean.com/v2/firewalls/fa8b27c8.../droplets
  Body: {"droplet_ids": [578369745]}
  Response: HTTP 204 No Content

Firewall status: succeeded (within 3 seconds)
Droplet IDs:     [578369745]
```

Rules (unchanged from 2026-05-01 final state — already correct on the firewall object):

```
INBOUND
  tcp/22       from 0.0.0.0/0 + ::/0   (SSH — kept to avoid lockout)
  icmp         from 0.0.0.0/0 + ::/0   (ping)
  — everything else BLOCKED —

OUTBOUND
  tcp/1-65535  to 0.0.0.0/0 + ::/0     (cloudflared tunnel needs outbound)
  udp/1-65535  to 0.0.0.0/0 + ::/0
  icmp         to 0.0.0.0/0 + ::/0
```

## Verification (immediately after attach)

Direct port scan of `68.183.77.106` from non-CF source (this dev pod):

```
port 22    🔴 OPEN       (SSH — intentional)
port 25    🔒 BLOCKED
port 80    🔒 BLOCKED
port 110   🔒 BLOCKED
port 143   🔒 BLOCKED
port 443   🔒 BLOCKED
port 465   🔒 BLOCKED
port 587   🔒 BLOCKED
port 993   🔒 BLOCKED
port 995   🔒 BLOCKED
port 2082  🔒 BLOCKED
port 2083  🔒 BLOCKED
port 2086  🔒 BLOCKED
port 2087  🔒 BLOCKED
port 2095  🔒 BLOCKED
port 2096  🔒 BLOCKED
```

Tunnel hostnames (bot's path to WHM/cPanel — must keep working):

```
cpanel-api.hostbay.io/login/    → HTTP 401  ✅  (cPanel auth required = tunnel alive)
whm-api.hostbay.io/login/       → HTTP 401  ✅  (WHM auth required = tunnel alive)
panel.1.hostbay.io/login/       → HTTP 200  ✅
```

Customer site through CF anycast:

```
moxx.co  → HTTP 200  ✅
```

## What this fixes

| Vector | Before today | After today |
|---|---|---|
| Mail-server banner fingerprint (25/465/587/110/143/993/995) | 🔴 OPEN | 🔒 BLOCKED |
| Direct HTTP/HTTPS bypass of Cloudflare (80/443) | 🔴 OPEN | 🔒 BLOCKED |
| WHM/cPanel panel publicly discoverable (2082-2087, 2095-2096) | 🔴 OPEN | 🔒 BLOCKED |
| Bot's path to WHM API | ✅ already via tunnel | ✅ still via tunnel |
| Customer hosting traffic | ✅ already via tunnel + CF anycast | ✅ unchanged |

## Operational reference

| Resource | Value |
|---|---|
| DO firewall ID | `fa8b27c8-405b-4328-8939-c5d2106d2cea` |
| DO firewall name | `hostbay-tunnel-only` |
| Current droplet | `578369745` (whm2-fra1-20260617-1601) |
| IP | `68.183.77.106` |
| Region | `fra1` |
| OS | AlmaLinux 9 |
| CF tunnel ID | `b395cebc-4b7a-4aba-8ced-e11665c26b30` (replaces the historical `f63ce7b5-...`) |
| CF account | `ed6035ebf6bd3d85f5b26c60189a21e2` (`expressdrop247@gmail.com`) |
| DO API token | stored in `/app/backend/.env` as `DIGITALOCEAN_API_TOKEN` |

## Outstanding / P2

- **Tighten SSH (port 22)** — currently open from anywhere. Long-standing P2 from the 2026-05-01 docs. User has not provided their SSH source IP yet.
- **Stale env vars on this dev pod** — `/app/backend/.env` still has `WHM_HOST=209.38.241.9`, `WHM_DROPLET_ID=557194941`, `CF_TUNNEL_CNAME=f63ce7b5-...`. Production Railway env is up-to-date (per `WHM_MIGRATION_2026-06-17.md`). On this dev pod, with `SKIP_WEBHOOK_SYNC=true`, stale values are harmless — the dev pod never mutates production WHM/CF state.
- **Old firewall reused** — same firewall ID as the historical doc, so any older runbook referencing `fa8b27c8...` still works.

## Reverting

```bash
# Detach firewall from new droplet (re-opens everything)
curl -s -X DELETE \
  -H "Authorization: Bearer $DIGITALOCEAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.digitalocean.com/v2/firewalls/fa8b27c8-405b-4328-8939-c5d2106d2cea/droplets" \
  -d '{"droplet_ids":[578369745]}'
```

## Re-applying / re-attaching after a future migration

```bash
curl -s -X POST \
  -H "Authorization: Bearer $DIGITALOCEAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.digitalocean.com/v2/firewalls/fa8b27c8-405b-4328-8939-c5d2106d2cea/droplets" \
  -d '{"droplet_ids":[<NEW_DROPLET_ID>]}'
```
