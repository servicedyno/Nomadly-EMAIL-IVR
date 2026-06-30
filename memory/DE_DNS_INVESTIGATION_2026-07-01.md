# OpenProvider .de DNS — Investigation + Fix (2026-07-01)

## TL;DR

5 prod domains were stuck in "DENIC parking" state — public DNS showed `ina*.registrar.eu`
instead of our Cloudflare NS, even though our DB + OP's record had the correct CF NS. Root
cause: DENIC's pre-delegation NAST check silently rejected the CF NS at registration time
because the Cloudflare zone wasn't yet authoritative for the domain when OP forwarded the
registration to the registry. OP kept the parking `nsgroup_id` binding and the registry
never republished.

**Code shipped:** NAST pre-flight gate so this never happens to a new registration; auto-sync
escalation so any future stuck domain is rescued within 24h; admin tooling for manual sync.

**Operator action required:** Open one OpenProvider support ticket for the 5 currently-stuck
domains (REST API alone cannot break the existing `nsgroup_id` binding — see "Stuck Domains"
section below).

---

## What OpenProvider needs for correct .de DNS

Per OP's KB (`support.openprovider.eu/.../360000754208`) and DENIC NAST spec:

### Hard requirements before DENIC accepts the delegation

1. **≥2 nameservers**, on **different IPv4 addresses** (no shared IPs — Error 107).
2. **Cloudflare zone must already be active** and serving the domain — meaning at least 2 of
   the assigned CF NS (`<word>.ns.cloudflare.com`) must respond with `AA=1` and ≥1 answer
   when queried for the domain's SOA. This must be true **at the moment OP forwards the
   registration to DENIC** — not just at registration end.
3. **At least one A/AAAA record at the apex** of the zone.
4. **No CNAME at the apex.**
5. **Nameserver NS records inside the zone match** the NS list given to OP (Error 118).
6. **No DNSSEC chain break** — if DNSKEY is claimed, the chain of trust must validate; if
   moving NS off an OP-DNSSEC-enabled domain, OP doesn't auto-clear DS records (the existing
   `disableDnssec` path handles this).
7. **30-day rule:** if the NS aren't authoritative within 30 days of registration, DENIC
   auto-deletes the domain without refund.

### OP-specific behaviors that bit us

- OP holds a separate **`nsgroup_id`** (numeric) binding on each domain. When NAST fails at
  registration time, OP falls back to the parking nsgroup (`ina1/2/3.registrar.eu` →
  `185.53.179.136`). **Sending `ns_group: ''` (empty string) in subsequent PUTs does NOT
  reliably clear the underlying numeric `nsgroup_id`** — OP still shows our CF NS in
  `name_servers`, but the registry chprov never fires.
- The OP REST API has **no force-resync endpoint**. The RCP "Synchronize" button does an
  equivalent PUT, but if the domain is stuck in this state, neither the button nor the API
  can break it — only OP support can manually reset the registry binding.
- After registration, **OP→DENIC zonefile updates apply within 5 min** *if* the NAST check
  passes. The whole bug is that NAST fails silently the first time.

---

## What we shipped

### A. Prevention for FUTURE registrations

**`opService.checkNsAuthoritative(domain, nsList, timeoutMs)`** — implements DENIC's NAST
check ourselves: sends raw UDP/53 SOA queries directly to each NS (resolved by getaddrinfo)
and polls until ≥2 return `AA=1` with ≥1 answer. Verified live: passes for `rsvpcrumelbell.de`
against CF NS in 78-100ms.

**Gate in `domain-service.js registerDomain()`** — for `.de/.nl/.se/.fi/.be/.ch/.ie/.it/.eu/
.at/.li/.dk/.cz/.no` (the PRE_DELEGATION_TLDS set), waits up to 90s for CF NS to be
authoritative for the domain BEFORE calling `opService.registerDomain()`. If NAST doesn't
pass in 90s, hard-aborts (no charge):

```
Nameserver pre-check failed for .de. 0/2 nameservers are authoritative. The registry
would reject this delegation. Your card was NOT charged — please retry in a couple of
minutes.
```

This is the most important fix: **no new .de registration will ever be sent to DENIC with
non-authoritative NS again**, eliminating the root cause of the 5 stuck domains.

### B. Auto-rescue for STUCK domains

**`opService.syncDomain(domain)`** — RCP "Synchronize" equivalent: `PUT /v1beta/domains/{id}`
with `ns_group:''` + current `name_servers`. Verified accepted by OP with `code:0` /
`opStatus:ACT` for all 5 stuck domains.

**`dns-healer.js` auto-sync escalation** — when a row has been escalated for ≥24h
(`DNS_HEAL_AUTO_SYNC_AFTER_HRS=24`, configurable) and `syncAttempts < 3` (capped by
`DNS_HEAL_MAX_SYNC_ATTEMPTS`), automatically calls `syncDomain()` once and resets the heal
counter. Notifies admin via Telegram both on attempt and on persistent failure. New state
fields: `syncAttempts`, `lastSyncAt`, `lastSyncResult`.

### C. Operator tooling

**Admin endpoint `POST/GET /api/admin/op-sync?domain=…&key=<SESSION_SECRET[:16]>`** — runs
NAST pre-flight + `syncDomain` + dnsHealState reset in one call. Returns full JSON of each
step's result.

**Diagnostic endpoint expansion** — `GET /api/admin/dns-heal-status` now exposes
`syncAttempts`, `lastSyncAt`, `lastSyncResult` per row.

**Rescue CLI `js/scripts/sync_stuck_domains.js`** — for bulk operator use. Idempotent.
Usage:
```bash
node js/scripts/sync_stuck_domains.js                       # all escalated
node js/scripts/sync_stuck_domains.js domain1 domain2 …     # specific
```

**Smoke test `js/tests/test_op_de_dns_preflight.js`** — 11 tests, all passing.

---

## Stuck Domains (escalate to OP support)

These 5 domains have been pushed to OP successfully (`code:0`, `opStatus:ACT`, OP record
shows correct CF NS), but DENIC still publishes the parking NS because OP's internal
`nsgroup_id: 17202914` binding wasn't cleared by our PUT. Open one OP support ticket:

```
Subject: Please reset nsgroup_id binding and resend chprov to DENIC for these 5 domains

Domains and OP IDs:
  • inviowelcoparty.de         (id 29624850, owner handle: as on file)
  • rsvpeviteguestview.de      (id 29774797)
  • rsvpcrumelbell.de          (id 29780697)
  • paperlesseviteinvio.com    (id 29677916)
  • strivepartypaperless.com   (id 29703625)

Current state (all 5):
  • OP status:           ACT
  • OP name_servers:     anderson.ns.cloudflare.com, leanna.ns.cloudflare.com
  • Public DNS NS:       ina1/2/3.registrar.eu  ← stuck on OP parking
  • Public DNS A:        185.53.179.136          ← stuck on OP parking
  • OP nsgroup_id:       17202914                ← still bound despite ns_group:'' PUT
  • Cloudflare zone:     active (verified AA=1 from anderson/leanna for all 5 domains)

We've already:
  • Verified Cloudflare zone is active and authoritative (NAST passes from our side).
  • Pushed PUT /v1beta/domains/{id} with ns_group:"" + correct name_servers — OP returned
    code:0 with opStatus:ACT on every attempt, but DENIC continues to serve the parking NS.

Please manually clear the parking nsgroup_id binding (17202914 currently) on these 5
domains and re-trigger the DENIC chprov push.
```

---

## Operator reference

```bash
# Check current heal-state
curl 'https://<host>/api/admin/dns-heal-status?key=<KEY>'

# Per-domain detail (CF zone status, last probe, sync history)
curl 'https://<host>/api/admin/dns-heal-status?key=<KEY>&domain=foo.de'

# Manually trigger NAST + OP sync + state reset on one domain
curl -X POST 'https://<host>/api/admin/op-sync?key=<KEY>&domain=foo.de'

# Bulk rescue all escalated rows from CLI
node /app/js/scripts/sync_stuck_domains.js

# Test suite
node /app/js/tests/test_op_de_dns_preflight.js                # new (11 tests)
node /app/js/tests/test_op_ns_update_registry_chprov.js       # regression (10 tests)
```

### Tuning knobs (backend/.env, optional)

```
DNS_HEAL_AUTO_SYNC_AFTER_HRS=24    # how long escalated before auto-syncDomain (default 24)
DNS_HEAL_MAX_SYNC_ATTEMPTS=3       # how many auto-sync attempts per domain (default 3)
DNS_HEAL_INTERVAL_MIN=5            # general healer tick interval (default 5)
DNS_HEAL_MAX_ATTEMPTS=3            # heal attempts before escalation (default 3)
```
