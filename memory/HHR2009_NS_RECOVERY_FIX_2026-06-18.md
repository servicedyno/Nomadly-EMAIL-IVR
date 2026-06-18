# HHR2009 Recovery NS-Push Bug — Root Cause & Fix
**Date:** 2026-06-18

## TL;DR
When the prior agent ran `/app/scripts/recover_hhr2009_hosting.js` to complete @HHR2009's 2026-06-17 09:48 UTC hosting purchase (interrupted by old-WHM disk-full), the cPanel account + CF DNS records were created — **but the Cloudflare nameservers were never pushed to the OpenProvider registry**. That step exists in the normal payHosting flow but was missing from the manual recovery script.

## Why the registry never received CF NS

### What OP shows vs what the registry shows
| Domain | OP internal DB | Public DNS (registry) |
|---|---|---|
| `strivepartypaperless.com` | `anderson.ns.cloudflare.com`, `leanna.ns.cloudflare.com` | `ina1.registrar.eu.` / `ina2.registrar.eu.` / `ina3.registrar.eu.` |
| `inviowelcoparty.de` | same | same OP parking NS |

Both OP-side records were correct; only the registry-side push was missing. Same class of bug as the documented `rsvpeviteopen.de` incident in `/app/js/op-service.js:683-694`:

> *"For TLDs where OP holds a separate 'nameserver group' (notably .de via DENIC), sending only `name_servers` updates OP's internal state but DOES NOT always trigger a registry re-publication... sending `ns_group: ''` alongside `name_servers` resets the group binding and forces OP to push a fresh `domain:update` to the registry."*

### Why the normal flow handles this but the recovery script didn't

**Normal payHosting (`/app/js/cr-register-domain-&-create-cpanel.js:483-510`):**
- For **new domains**: `op.registerDomain()` is called with `name_servers: [CF NS]` in the payload. OP stores the NS and *attempts* a registry push at registration time. For most TLDs this works; for some (DENIC, occasional Verisign) the registry push is silently queued/dropped.
- For **existing/external domains**: `domainService.postRegistrationNSUpdate()` is called explicitly, which routes through `op.updateNameservers()` → `_sendNsUpdate()` → PUT with `ns_group: ''` (the force-push quirk).

**Recovery script `/app/scripts/recover_hhr2009_hosting.js` (BEFORE this fix):**
- Step [5/8] created CF DNS records + SSL settings, but never called either `op.updateNameservers()` or `postRegistrationNSUpdate()`. So when the original 09:48 UTC registry push silently failed, there was no retry.

## What was fixed in this session

### 1. ✅ Immediate user-impact fix
Ran `/app/scripts/push_hhr2009_cf_ns_to_op.js` against OpenProvider. Both `op.updateNameservers()` calls returned `{success: true}`. The PUT with `ns_group: ''` was sent. Registry propagation (10 min – 24 h) is now in progress. Once it lands:
- `strivepartypaperless.com` and `inviowelcoparty.de` traffic will start hitting Cloudflare.
- AntiRed worker (already deployed in the CF zones) will intercept and protect.
- Chrome's "red" warning should clear as the OP parking page (`185.53.179.136`) drops out of public DNS.

### 2. ✅ Permanent: patched the recovery script (`recover_hhr2009_hosting.js`)
Inserted a "5b — Force OP→registry NS re-push" block right after CF SSL setup. Reads CF NS from `registeredDomains.val.nameservers` and calls `opService.updateNameservers()`. Idempotent and non-blocking on failure. So future hosting recoveries will not leave the registry side stranded.

### 3. ✅ Permanent: patched the auto-startup WHM migration (`/app/js/cpanel-migration.js:158`)
Old code only set `whmHost`. New code also:
- `$unset` stale `protectionRepairCount`, `protectionLastSkipReason`, `protectionStuckAt`, `protectionRepairUpdatedAt` (the heartbeat will re-evaluate the account from a clean slate on the new server).
- `$set` `migratedAt: new Date()` + `prevWhmHost` (parity with the ad-hoc 2026-06-17 migration's schema, gives auditability).

## Remaining work (NOT executed — pending user approval)

### One-shot unstick for the 19 already-migrated accounts
The cpanel-migration.js patch above will only help **future** migrations. The 19 accounts migrated on 2026-06-17 16:18 still carry their stale pin flags. To restore heartbeat coverage immediately, run from a Node REPL connected to prod Mongo:
```javascript
db.cpanelAccounts.updateMany(
  { whmHost: '68.183.77.106', protectionRepairCount: { $gte: 3 } },
  {
    $unset: {
      protectionRepairCount: '',
      protectionLastSkipReason: '',
      protectionStuckAt: '',
      protectionRepairUpdatedAt: '',
    },
  },
)
// expected: 19 modified
```

### Deeper fix in the NORMAL flow (optional)
The same registry-push gap exists at registration time in `cr-register-domain-&-create-cpanel.js:250-281`. For new domains it relies entirely on OP propagating the NS at registration time. To make that bulletproof, add a forced `op.updateNameservers(domain, regResult.nameservers)` follow-up after a successful `domainService.registerDomain()` whenever `nsChoice === 'cloudflare'`. This would cost one extra API call per registration but eliminate this entire bug class.

## Files touched
- ✅ `/app/scripts/push_hhr2009_cf_ns_to_op.js` (new) — one-shot user fix, executed
- ✅ `/app/scripts/recover_hhr2009_hosting.js` (patched lines 213–250) — recovery script now has NS push
- ✅ `/app/js/cpanel-migration.js` (patched line 158) — startup migration now clears stuck flags + stamps schema fields

## Monitoring
```bash
# Watch NS propagation
dig @1.1.1.1 strivepartypaperless.com NS +short
dig @1.1.1.1 inviowelcoparty.de NS +short
# Expected within 1-24h: anderson.ns.cloudflare.com / leanna.ns.cloudflare.com
```
