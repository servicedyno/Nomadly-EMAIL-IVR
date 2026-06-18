# Addon-Domain NS Delegation Bug — Root Cause & Fix

**Date:** 2026-06-18
**Severity:** P0 (every addon-domain purchase from OpenProvider produced a broken hosting panel)
**Found-by:** HHR2009 (chatId 1960615421) bought `inviolivepaperless.com` as addon at 2026-06-18 11:30 — hosting panel showed error, DNS didn't propagate.

## Live Symptom

`inviolivepaperless.com` after purchase + cPanel addon-attach:
- Live NS at `ns1.openprovider.nl, ns2.openprovider.be, ns3.openprovider.eu` (OP defaults)
- CF zone status: **`pending`** with `activation_failure_reason: ns_delegated_from_provider`
- No A record served → cPanel addon page error → SSL can't issue

## Root Cause

`/app/js/addon-domain-flow.js:attachAddonDomain` does:
1. cPanel `addaddondomain` ✅
2. Persist to `cpanelAccounts.addonDomains[]` ✅
3. Create Cloudflare zone ✅
4. Cleanup conflicting DNS + create hosting CNAMEs ✅
5. SSL Flexible + AOP + Origin CA + anti-red ✅
6. **Update OP nameservers to point to Cloudflare** ❌ **(missing — never called)**

For primary-domain hosting purchases, the bot's separate domain-registration flow calls `opService.updateNameservers(...)` with the CF NS as part of NS setup. For addon-domain purchases, that step was simply never wired in — `addon-domain-flow.js` assumed the domain was already delegated.

Same root cause was observed earlier for `rsvpeviteopen.org` (also HHR2009, 2026-06-11) — rescued by an ad-hoc heal job `heal_rsvpeviteopen_org_2026-02`.

## Immediate Fix (live)

Ran `/app/js/scripts/fix_inviolivepaperless_ns.js`:
- Called `opService.updateNameservers('inviolivepaperless.com', ['anderson.ns.cloudflare.com', 'leanna.ns.cloudflare.com'])`
- DNSSEC was on at OP → auto-disabled by `updateNameservers` (DNSSEC-PostNS guard)
- Propagation probe: **registry confirmed 2/2 CF NS in 3,070 ms** ✅
- CF zone re-activation triggered via `PUT /zones/{id}/activation_check`
- Result: CF zone status flipped to **`active`** in <1 min; `dig +short A inviolivepaperless.com` → `104.21.83.100, 172.67.221.156`
- Patched `registeredDomains.inviolivepaperless.com.val` with full metadata (registrar, NS list, opDomainId, opStatus, etc.) so future audit jobs find it
- Audit row inserted: `nsAuditLog._id=<auto>, action="addon_ns_fix"`

## Code Fix (prevents recurrence)

`/app/js/addon-domain-flow.js` — `runDnsAndProtection` now captures the CF nameservers from `createZone()` and, **after the CF zone is ready but BEFORE the protection pipeline runs**, calls `opService.updateNameservers(domain, cfNs)` if (a) the domain's registrar is OpenProvider in `registeredDomains` and (b) current NS isn't already pointed at CF.

- Non-fatal: if NS update fails, the addon attach still succeeds. DnsHealer will retry later.
- Logs into `nsAuditLog` for traceability.
- Non-OpenProvider registrars are skipped (only logged) — addon-domain registration through other registrars happens via different code paths that already handle NS setup.

## Regression Test

`/app/js/__tests__/addon-domain-ns-delegation.test.js` — 9 assertions covering:
1. OpenProvider registrar → NS update fires with correct args
2. registeredDomains.val.nameservers updated to CF NS
3. nsAuditLog row inserted
4. Already-delegated domain → no second call
5. Non-OP registrar → skipped
6. Unknown registrar → safe-default skip

Run: `node /app/js/__tests__/addon-domain-ns-delegation.test.js` — passes (9/9).

## Files Changed

- `/app/js/addon-domain-flow.js` — added NS-delegation block (lines 252–350 after edit).
- `/app/js/__tests__/addon-domain-ns-delegation.test.js` — new.
- `/app/js/scripts/fix_inviolivepaperless_ns.js` — one-shot live rescue.
- `/app/js/scripts/forensic_hhr2009_addon.js` — diagnosis helper (read-only).
- `/app/js/scripts/probe_inviolivepaperless.js` — CF + OP probe (read-only).
- `/app/js/scripts/check_registrar.js` — registry metadata diff (read-only).

## Verified

- ESLint: 4 pre-existing warnings (unchanged), 0 new.
- 9/9 regression test assertions pass.
- Live verification:
  - `dig +short NS inviolivepaperless.com @1.1.1.1` → CF NS ✅
  - `dig +short A inviolivepaperless.com @1.1.1.1` → CF edge IPs ✅
  - CF zone status: `active` ✅
