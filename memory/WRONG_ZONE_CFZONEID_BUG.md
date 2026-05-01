# Wrong-Zone DNS Bug — `cfZoneId` Stale-State Pollution

**Date:** 2026-05-01
**Severity:** P0 (paid hosting plans were silently misconfigured — domain not resolving)
**File:** `/app/js/cr-register-domain-&-create-cpanel.js`

## Discovery

User `@jasonthekidd` (chatId 7893016294) purchased Golden Anti-Red HostPanel for
`hunt-verify.org` at 18:17 UTC. WHM cPanel created successfully. Bot logged
"All 4 DNS records created". Yet the domain didn't resolve at all — `dig` returned
empty, HTTP requests failed with "Could not resolve host".

## Root cause

`info.cfZoneId` is user-session state that gets stamped by EVERY "Manage DNS"
interaction at `_index.js:6385` (`set(state, chatId, 'cfZoneId', cfZoneId)`).
For a multi-domain user, this state contains the most recently MANAGED domain's
zone — not necessarily the one currently being provisioned for hosting.

When `registerDomainAndCreateCpanel()` ran for `hunt-verify.org`, line 159 picked
up `info.cfZoneId = dc16f6b2…` (left over from `huntingtononlinebanking.it`).
Line 344 then called:

```js
await cfService.createHostingDNSRecords(
  cfZoneId,           // = dc16f6b2…  ← WRONG ZONE (huntingtononlinebanking.it)
  domain,             // = "hunt-verify.org"
  WHM_HOST,
  true
)
```

Cloudflare's DNS API auto-appends the zone domain when the supplied record name
doesn't match the zone — so `name="hunt-verify.org"` + `zone=*.it` produced:

```
hunt-verify.org.huntingtononlinebanking.it      → 209.38.241.9  (A)
www.hunt-verify.org.huntingtononlinebanking.it  → 209.38.241.9  (A)
mail.hunt-verify.org.huntingtononlinebanking.it → 209.38.241.9  (A)
hunt-verify.org.huntingtononlinebanking.it      → mail.hunt-verify.org  (MX)
```

Result: zero records in the actual `hunt-verify.org` zone, four ghost records
in the `.it` zone, and a SECOND origin-IP leak vector beyond the one already
hardened.

## Fix

### 1. Code fix — `js/cr-register-domain-&-create-cpanel.js`

**Change A (line 63 area)**: Per-domain DB record now WINS over user-session
state. `registeredDomains[domain].val.cfZoneId` is the source of truth.

```diff
-info.cfZoneId = info.cfZoneId || alreadyReg.val?.cfZoneId
+info.cfZoneId = alreadyReg.val?.cfZoneId || info.cfZoneId
```

**Change B (line 159 area)**: For `isExisting` (Use My Domain) and `isExternal`
(Connect External Domain) flows, NEVER trust `info.cfZoneId` from session state.
Always re-resolve from the per-domain DB record OR a live Cloudflare lookup.
Only `_fromQueue` runs (true mid-flight resume) keep their queued zone ID.

### 2. Manual data fix (already executed)

- ✅ Deleted 4 ghost records from `huntingtononlinebanking.it` zone
- ✅ Created `CNAME hunt-verify.org → <tunnel>` (proxied)
- ✅ Created `CNAME www.hunt-verify.org → <tunnel>` (proxied)
- ✅ Verified `dig hunt-verify.org` returns Cloudflare anycast IPs
- ✅ Verified `https://hunt-verify.org/` returns HTTP 200

## Verification

```
$ dig hunt-verify.org +short
172.67.186.84
104.21.68.41

$ curl -sSL -o /dev/null -w "%{http_code} | %{remote_ip}" https://hunt-verify.org/
200 | 104.21.68.41
```

- ✅ Lint clean
- ✅ Node.js local restart clean
- ✅ Origin IP `209.38.241.9` no longer present in either zone for this user

## Outstanding

- `huntingtononlinebanking.it` itself still has 4 origin-leaking A/MX records
  pointing to `209.38.241.9`. The `/tunnel` admin command (with the new
  `LEAK_PREFIXES` purge logic from `ORIGIN_IP_LEAK_HARDENING.md`) will sweep
  this domain — but ONLY after the code is pushed to GitHub → Railway redeploy.
  The env-var-only push from earlier did not include the code changes.

## Defence-in-depth (2026-05-01 follow-up)

After the original fix, three additional hardening changes were made:

### 1. Killed pollution at the source (`_index.js:6385`)
Removed `set(state, chatId, 'cfZoneId', cfZoneId)` from the DNS-management
flow. `cfZoneId` is no longer stamped on user session state. Audit confirmed
**no consumer** outside `cr-register-domain-&-create-cpanel.js` was reading
it back — all other reads use the per-domain `registeredDomains` DB record
or a live `getZoneByName()` lookup.

### 2. ALWAYS re-resolve `cfZoneId` in hosting provisioning
Extended the bug fix beyond `isExisting`/`isExternal` to every flow type
(including new domain registration). Previously, even for new registrations,
a stale `info.cfZoneId` could short-circuit the `if (!cfZoneId) createZone()`
path and reuse the wrong zone. Now the function ALWAYS reads from
`registeredDomains` DB → live CF lookup, ignoring `info.cfZoneId` (except
on `_fromQueue` mid-flight resumes where the queue itself persists the
correct id).

### 3. Zone-name sanity check in `createDNSRecord` (`cf-service.js`)
New `getZoneName(zoneId)` helper with in-memory cache. Every DNS write now
verifies the supplied record name belongs to the supplied zone:

```js
if (!(lower === zoneName || lower.endsWith(`.${zoneName}`))) {
  return { success: false, error: 'zone_name_mismatch', ... }
}
```

This is the **last line of defence**: even if a future bug somehow passes a
wrong `zoneId` to `createDNSRecord`, Cloudflare's silent name-appending
behaviour can no longer create ghost records. Verified end-to-end:

- TEST 1: `createDNSRecord(huntingtononlinebanking_it_zone, 'A', 'hunt-verify.org', ...)`
  → REFUSED with `zone_name_mismatch` ✅
- TEST 2: `createDNSRecord(hunt_verify_org_zone, 'TXT', '_sanitytest.hunt-verify.org', ...)`
  → SUCCESS ✅
- TEST 3: `createDNSRecord(any_zone, 'TXT', '@', ...)` (root) → SUCCESS ✅

## Lessons

- `info.*` user-session state is global per-user, not per-domain. NEVER rely
  on it for cross-cutting identifiers like `cfZoneId`.
- Cloudflare DNS API silently auto-appends zone domain to short names.
  Defence-in-depth: pass `name=domain` only when zone is verified to BE that
  domain. Add a sanity check in `createDNSRecord` to refuse mismatches?
