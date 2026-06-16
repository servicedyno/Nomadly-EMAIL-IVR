# Fix — "Manage Nameservers" shows empty/no NS for CF-managed domains (2026-02)

## Symptom reported
@leprechaun00 pressed "🔄 Manage Nameservers" 18+ times on `coinspotsupport.com.au` between 18:08Z and 20:24Z, and every press returned a screen with empty "Current Nameservers:" or "No nameserver records found." — making the user believe NS management was broken. They eventually stumbled into "✏️ Set Custom Nameservers" and successfully set `tadeo.ns.cloudflare.com` at 20:21Z, but the bot UX was confusing all afternoon.

## Root cause
`/app/js/domain-service.js::buyDomain()` writes the new domain to `domainsOf` at registration time with `cfZoneId` + `nameserverType: 'cloudflare'` but **omits the `nameservers` field**, even though the array is already in scope (set at line 140 from `cfResult.nameservers`).

Downstream in the same file at `viewDNSRecords()`:
```js
const nameservers = meta.nameservers || []
for (const ns of nameservers) { records.unshift({ recordType: 'NS', recordContent: ns, … }) }
```

With `meta.nameservers === []` (because never populated at registration), no NS rows ever get prepended to the returned `records`. Those records are then saved into the user's `state.dnsRecords`. When the user opens `manage-nameservers-menu`, line 7785 of `_index.js` does `records.filter(r => r.recordType === 'NS')` → `[]` → the `en.t.manageNsMenu` template falls into the "No nameserver records found." branch.

The "DNS Records" parent screen also didn't render NS values, but the bug was hidden there because most users skip past it to Quick Actions.

## Fix
### `/app/js/domain-service.js`
1. **`buyDomain()` (line ~201)** — added `nameservers: Array.isArray(nameservers) && nameservers.length ? nameservers : []` to the `$set` block so every new registration persists the NS list at create time. Comment in the code references the @leprechaun00 incident to prevent regression.
2. **`viewDNSRecords()` (line ~466)** — added a self-healing branch: when a CF-managed domain has `cfZoneId` but `nameservers` is missing/empty, the function now calls `cfService.getZoneByName(domainName)`, reads `zone.name_servers`, **persists them back to `domainsOf`**, then continues to render. So even a single "DNS Management" open on an affected domain transparently repairs the data.

### `/app/scripts/backfill_domain_nameservers.js`
Idempotent one-shot script. Scanned all `domainsOf` records with a `cfZoneId` but empty/missing `nameservers`. Result on production:
- **72 domains healed** (`nameservers` field now populated from Cloudflare's actual zone data)
- 13 skipped (CF zone no longer exists for those domains — orphan records)
- 0 errored

Including @leprechaun00's `coinspotsupport.org` (now `anderson.ns.cloudflare.com, leanna.ns.cloudflare.com`) and `coinspotsupport.com.au` (already populated by the 20:21Z manual update so it didn't even need healing).

## Verification
- `mcp_lint_javascript /app/js/domain-service.js` → No blocking issues.
- `sudo supervisorctl restart nodejs` → RUNNING cleanly, all subsystems initialised.
- Direct MongoDB query of @leprechaun00's `coinspotsupport.com.au` shows `nameservers: ['daniella.ns.cloudflare.com', 'tadeo.ns.cloudflare.com']` — Manage Nameservers will now correctly render `NS1: tadeo` / `NS2: daniella` on next press.
- Backfill applied to 72/85 production domains.

## Action required
**Save to GitHub** to ship the `domain-service.js` patch to Railway. The backfill is already applied to production MongoDB (no deploy needed for that part). After the deploy, ALL future registrations will permanently populate `nameservers`, AND any user with an existing orphan record will self-heal on their next "DNS Management" open.

## Why no regression for non-CF domains
- The new `$set: { nameservers }` adds an empty array `[]` when `nameservers` isn't relevant (e.g. `provider_default`), which is what the field would have been anyway — no behaviour change for OP/CR-only domains.
- The self-healing branch is guarded by `(!nameservers || nameservers.length === 0) && db` AND only runs inside the `isCfManaged` branch — never affects OP/CR DNS paths.

## Files touched
- `/app/js/domain-service.js` — 2 surgical edits (buyDomain $set, viewDNSRecords self-heal)
- `/app/scripts/backfill_domain_nameservers.js` — new idempotent one-shot
- `/app/memory/MANAGE_NAMESERVERS_BLANK_FIX_2026-02.md` — this writeup
