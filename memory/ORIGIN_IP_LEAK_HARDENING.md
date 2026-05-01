# Origin IP Leak Hardening — All Hosting Plans

**Date:** 2026-05-01
**Severity:** P0 (legal/abuse exposure — DigitalOcean abuse report received)
**Scope:** Every hosting plan (Premium Weekly, Premium HostPanel 30-day, Golden HostPanel 30-day)

## Trigger

DigitalOcean forwarded a Cloudflare trademark-infringement complaint for `huntingtononlinebanking.it`
identifying the droplet `ubuntu-s-1vcpu-2gb-fra1-01` at `209.38.241.9`. The origin IP was
exposed in public DNS because the hosting-provisioning flow was creating origin-leaking
A records.

## Root cause (audit in `js/cf-service.js`)

`createHostingDNSRecords()` — called by every hosting plan — had TWO leak paths:

1. **Web records fallback:** When `CF_TUNNEL_CNAME` was unset (which was true on Railway
   production — only dev had it), the code silently fell back to `A record → WHM_HOST (209.38.241.9)`
   for root + www. All hosting domains leaked the origin IP.
2. **Mail records (unconditional):** `mail.<domain>` A → `WHM_HOST` was **always** created,
   even when the tunnel WAS configured. This is the actual record that exposed the origin for
   `huntingtononlinebanking.it` (mail subdomains are historically indexed by abuse scanners).

Subdomain creation in `cpanel-routes.js:921–929` had the same silent-fallback bug.

## Fix

### 1. `js/cf-service.js`
- New env-driven config block (`MAIL_RELAY_HOST`, `MAIL_RELAY_PRIORITY`, `LEAK_PREFIXES`).
- `createHostingDNSRecords()` — **REFUSES** to provision if `CF_TUNNEL_CNAME` is unset.
  Returns `{success:false, error:'tunnel_not_configured'}`. Mail records are skipped entirely
  unless `MAIL_RELAY_HOST` is set, in which case MX → external relay is published (no `mail.*`
  A record, ever).
- `createDefaultDNSRecords()` — If caller passes `WHM_HOST` as the `serverIP`, auto-upgrades
  to CNAME → tunnel (when tunnel is set) OR refuses (when tunnel is unset). Callers passing a
  non-origin IP continue to work as before.
- `migrateToTunnel()` — Extended to also purge origin-leaking subdomains. Any A record for
  `mail.`, `cpanel.`, `webmail.`, `webdisk.`, `whm.`, `autodiscover.`, `autoconfig.` pointing to
  `WHM_HOST` is deleted. Leaky MX records (→ origin or → `mail.<domain>`) are deleted. If
  `MAIL_RELAY_HOST` is set, a clean MX → relay is added.

### 2. `js/cpanel-routes.js`
- Subdomain creation (line 921–935): Removed the A-record fallback. If `CF_TUNNEL_CNAME` is
  unset, the DNS record is skipped (with a warning log) instead of leaking.

### 3. `js/_index.js` — `/tunnel` admin command
- Now also sweeps addon domains (previously only primary).
- Reports `leaksPurged` count (mail/cpanel/webmail A records deleted).
- Updated header to reflect both tunnel migration and leak-purge behavior.

### 4. Railway production config
- Pushed `CF_TUNNEL_CNAME=f63ce7b5-43f2-4fc8-ab74-28481e29ce7e.cfargotunnel.com` via
  Railway GraphQL API. Verified via read-back. Railway auto-redeploys in ~30s.
- `MAIL_RELAY_HOST` intentionally left unset → no mail records published for new plans
  (safest default; user opted to skip mail for now).

## Verification

- ✅ Lint clean
- ✅ Node.js local restart: zero errors
- ✅ Unit-level tests confirm:
  - `createHostingDNSRecords` with tunnel unset → refuses, returns `tunnel_not_configured`
  - `createHostingDNSRecords` with tunnel set → creates root/www CNAMEs only, skips mail
  - `createDefaultDNSRecords` passing `WHM_HOST` with tunnel unset → refuses with
    `origin_ip_leak_blocked`
  - `createDefaultDNSRecords` passing `WHM_HOST` with tunnel set → upgrades to CNAME
- ✅ Railway env verified: `CF_TUNNEL_CNAME` is set, new deployment BUILDING

## Post-deploy runbook (for admin, via Telegram)

1. Wait for Railway deploy to reach SUCCESS (~2-3 min after variableUpsert).
2. Run `/tunnel status` to confirm tunnel is healthy.
3. Run `/tunnel` — this now migrates **every** hosting zone + purges all origin-leaking
   subdomains (mail, cpanel, webmail, webdisk, autodiscover, autoconfig). The summary line
   will include `<N> origin-leaks purged`.
4. Verify a few zones via `dig <domain> +short` — should return only Cloudflare anycast IPs
   (`104.21.x.x`, `172.67.x.x`), never `209.38.241.9`.
5. Verify `dig mail.<domain>` returns NXDOMAIN (no record) — or the mail relay only.

## Env var reference (Railway)

| Var | Status | Purpose |
|---|---|---|
| `CF_TUNNEL_CNAME` | ✅ SET (`f63ce7b5-...`) | Required — tunnel target for all hosting DNS |
| `MAIL_RELAY_HOST` | ⛔ unset | Optional — external MX host. Leave unset to skip mail DNS entirely |
| `MAIL_RELAY_PRIORITY` | default `10` | MX priority if `MAIL_RELAY_HOST` is set |
| `WHM_HOST` | `209.38.241.9` | Origin — never published to DNS after this fix |

## Caveats (user-side ops, not code)

- **DNS history leak:** `securitytrails.com` and CT logs still have the pre-fix records for
  existing domains. The `/tunnel` admin command purges Cloudflare zones, but third-party DNS
  history services retain old records forever. Rotating the DO droplet (new IP) is the only
  way to invalidate that history.
- **Mail:** With `MAIL_RELAY_HOST` unset, no MX records are created. Any existing customer
  whose MX pointed to `mail.<domain>` will have mail delivery break after `/tunnel` runs. If
  customers need email, set `MAIL_RELAY_HOST` to an external provider (Zoho, Brevo, etc.)
  BEFORE running `/tunnel` — the migration will add clean MX records automatically.
- **cloudflared on WHM:** Sites only work if `cloudflared` is actually running on the WHM box.
  `CF_TUNNEL_CNAME` is the hostname; the tunnel daemon must be up and routing.
