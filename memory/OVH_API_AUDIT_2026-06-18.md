# OVH API Audit — 2026-06-18

## TL;DR
- **Resource creation API: HEALTHY** — `VST1` Nano cart built, configured, priced ($4.20), validated in dry-run (only `checkout` step skipped). 4 sec total.
- **VPS power management (reboot/stop/start): HEALTHY** — POST endpoints accept and complete tasks. Live-tested reboot completed in 23s; stop task `done` in 17s.
- **Auto-renew endpoint EXISTS, but codebase is using the WRONG endpoint** — `/app/js/ovh-service.js:788` calls a legacy path that silently no-ops on the `automatic` field. Modern `PUT /services/{numericId}` works correctly (live-tested toggle OFF → ON, end-to-end).
- ⚠️ This means **`cancelInstance()` in the codebase silently lies to callers** — VPS auto-renew is NOT actually being turned off when "Cancel VPS" is invoked through the bot.

---

## What works on the OVH API (verified live)

### Resource creation (dry-run, $0 spent)
| Step | Endpoint | Result |
|---|---|---|
| OAuth signature | `X-Ovh-Application` + `X-Ovh-Signature` | ✅ HTTP 200 |
| Catalog lookup | `GET /order/catalog/public/vps?ovhSubsidiary=WE` | ✅ VST1 plan found |
| Cart create | `POST /order/cart` | ✅ cartId returned |
| Item add + configure | `POST /order/cart/{id}/vps` + region/OS | ✅ accepted by `requiredConfiguration` |
| Total compute | `GET /order/cart/{id}` | ✅ `$4.20` (matches catalog) |
| Cleanup | `DELETE /order/cart/{id}` | ✅ |

### VPS read endpoints
| Endpoint | Result |
|---|---|
| `GET /vps` | ✅ list of service names |
| `GET /vps/{sn}` | ✅ full state including `vcore`, `memoryLimit`, `state`, `cluster` |
| `GET /vps/{sn}/ips` | ✅ both v4 + v6 |
| `GET /vps/{sn}/serviceInfos` | ✅ includes legacy `serviceId` (long), renewal info, contact |
| `GET /vps/{sn}/tasks` + `/{id}` | ✅ task audit trail |
| `GET /services/{numericId}` | ✅ modern unified service object (route, billing, renew, lifecycle) |

### VPS power management (live-tested on `vps-87bd7636.vps.ovh.net`)
| Endpoint | Result |
|---|---|
| `POST /vps/{sn}/reboot` | ✅ task `rebootVm` → done in **23 s**, state remained `running` |
| `POST /vps/{sn}/stop` | ✅ task `stopVm` → done in **17 s** (3rd-party automation kept restarting VPS mid-test, so couldn't observe state flip to `stopped` for long — task itself completed cleanly per OVH) |
| `POST /vps/{sn}/start` | ✅ visible in `/tasks` history multiple times — task type `startVm`, all `done` |

### Auto-renew management — **THIS IS WHERE THE CODEBASE BUG LIVES**

#### ❌ Legacy endpoint (what codebase uses — SILENTLY BROKEN)
```js
// /app/js/ovh-service.js:788
PUT /vps/{sn}/serviceInfos  body: { renew: { automatic: false, deleteAtExpiration: true, period: 1 } }
```
Live test results on `automatic` / `forced` / `deleteAtExpiration` fields:
- HTTP `200 null` ← OVH accepts the call without complaint
- Field value: **unchanged after PUT** ← silent no-op
- Only `renew.period` is actually mutable via this path

#### ✅ Modern endpoint (what should be used)
```js
PUT /services/{numericServiceId}  body: { renew: { mode: 'manual'|'automatic', period: 'P1M' } }
```
Live test on the same VPS:
- Before: `renew.current.mode = automatic`
- PUT `{renew: {mode: 'manual', period: 'P1M'}}` → HTTP 200 → field actually flipped to `manual` ✅
- Restore PUT `{mode: 'automatic'}` → field flipped back to `automatic` ✅
- Bookended cleanly — no human-visible side effect

Numeric `serviceId` comes from `(GET /vps/{sn}/serviceInfos).serviceId` (it's a number, not a UUID). For our test VPS: `40881233`.

---

## Production bug fix required

### `/app/js/ovh-service.js:785-792` — current (broken)
```js
async function cancelInstance(serviceName, _opts = {}) {
  await ovhRequest('PUT', `/vps/${serviceName}/serviceInfos`, {
    renew: { automatic: false, deleteAtExpiration: true, period: 1 },
  })
  return { instanceId: serviceName, action: 'cancel', method: 'auto-renew-off' }
}
```

### Suggested replacement
```js
async function cancelInstance(serviceName, _opts = {}) {
  // Resolve the modern numeric serviceId (the IAM UUID is *not* what billing
  // endpoints take — they need the legacy long integer also exposed via
  // /vps/{sn}/serviceInfos.serviceId).
  const info = await ovhRequest('GET', `/vps/${serviceName}/serviceInfos`)
  if (!info?.serviceId) throw new Error(`No numeric serviceId for ${serviceName}`)

  // Modern unified-services endpoint. Older /vps/{sn}/serviceInfos PUT
  // silently no-ops the `automatic` field — confirmed 2026-06-18 against
  // ca.api.ovh.com. The /services/{id} path is what the customer console
  // uses now and is the only path that actually mutates renew.mode.
  await ovhRequest('PUT', `/services/${info.serviceId}`, {
    renew: { mode: 'manual', period: 'P1M' },
  })
  return { instanceId: serviceName, action: 'cancel', method: 'renew-mode-manual', serviceId: info.serviceId }
}
```

### Scope of impact
- Anyone who has tapped "Cancel VPS" or "Stop auto-renew" through the bot since the codebase started using this path has had their VPS continue to auto-renew anyway.
- ALL existing `vps-*` services whose users *believed* they had cancelled may still auto-renew on their `nextBillingDate`.
- I can produce a list of affected services on request (anything in `cpanelAccounts` / `vpsAccounts` with `cancelled: true` but `nextBillingDate` still in the future).

---

## Side-finding: this test VPS has unknown 3rd-party automation
- `vps-87bd7636.vps.ovh.net` was delivered 2026-06-17. Has been observed cycling between `stopped` ↔ `running` at ~3 min intervals during my testing window, **with no actor I can identify** (no Node.js code in `/app/js/` references this serviceName, no cron). Possibilities:
  - OVH's own auto-recovery if it considers the VPS "should be running"
  - A customer-side monitoring agent (UptimeRobot/Datadog) issuing wake-ups
  - A scheduled task elsewhere in the operator's infra
- Not a blocker for the audit, but worth checking who put it there.
