# OVHcloud Migration — VPS Provider Swap (2026-02)

## Why
The Contabo account ran out of funds — VPS provisioning stalled in `pending_payment` state. We migrated the bot's default VPS backend to OVHcloud while keeping Contabo as an optional fallback for legacy records.

## What changed
1. **`/app/js/ovh-service.js`** (NEW, 600 lines) — full OVH API wrapper:
   - Signed-request helper (SHA-1 + AS/CK with server-time cache)
   - Cart-based order flow: `POST /order/cart` → `assign` → `POST /vps` → `POST /options` → `configuration` × N → `checkout` → poll `/me/order/{id}/status`
   - Circuit breaker mirroring `contabo-service.js`
   - `OVH_DRY_RUN=true` env flag for safe testing (builds + deletes carts, no checkout)
   - Mirrors EVERY export of `contabo-service.js` so callers don't need to change

2. **`/app/js/vps-provider.js`** (NEW, 130 lines) — provider abstraction:
   - Reads `VPS_DEFAULT_PROVIDER` (default `ovh`) and `VPS_CONTABO_FALLBACK_ENABLED`
   - `getProvider()` — returns default backend service
   - `dispatchByInstanceId(id)` — routes to OVH (`^vps-`) vs Contabo (`^\d+$`) by ID format
   - `buildSmartProxy()` — drop-in replacement for `contabo-service`; per-instance ops auto-route, catalog ops use default

3. **`/app/js/vm-instance-setup.js`** — one-line change at imports:
   ```js
   const contabo = require('./vps-provider').buildSmartProxy()
   ```
   - All 50+ `contabo.X(...)` call sites continue to compile
   - NEW orders go to OVH (default)
   - EXISTING Contabo records still operate via Contabo (legacy IDs are numeric)
   - `provider: 'ovh'` field stored on every new `vpsPlansOf` doc for explicit per-record routing

4. **`/app/js/vm-instance-setup.js`** — disk-type screen returns NVMe-only when OVH is active (OVH catalog has no NVMe/SSD split).

5. **`/app/backend/.env`** — added OVH credentials & flags:
   ```
   OVH_APP_KEY="547807098e261b35"
   OVH_APP_SECRET="b0a079be6b20649f1b4d3f8729f130cc"
   OVH_CONSUMER_KEY="8ab431c4da9ab46bfb8a4bb950fcc3d9"
   OVH_ENDPOINT="https://ca.api.ovh.com/1.0"
   OVH_SUBSIDIARY="WE"
   OVH_DEFAULT_DATACENTER="BHS"
   VPS_DEFAULT_PROVIDER="ovh"
   VPS_CONTABO_FALLBACK_ENABLED="false"
   OVH_DRY_RUN="true"          # SAFETY: NEVER place real orders in dev/staging
   ```

## New OVH plan ladder (Option C "hybrid")
**Linux VPS** (200% markup, OVH "WE" subsidiary, USD)
| Tier | productId | OVH planCode | Specs | OVH raw | Customer |
|------|-----------|--------------|-------|---------|----------|
| 1 | VST1  | vps-starter-1-2-20    | 1c / 2 GB / 20 GB  | $4.20  | **$12.60** *(Linux only)* |
| 2 | VVL4  | vps-value-1-4-20      | 1c / 4 GB / 20 GB  | $9.20  | **$27.60** |
| 3 | VLE4  | vps-le-4-4-80         | 4c / 4 GB / 80 GB  | $11.00 | **$33.00** |
| 4 | VES8a | vps-essential-2-8-40  | 2c / 8 GB / 40 GB  | $18.80 | **$56.40** |
| 5 | VES8b | vps-essential-2-8-160 | 2c / 8 GB / 160 GB | $25.00 | **$75.00** |
| 6 | VLE16 | vps-le-16-16-160      | 16c / 16 GB / 160 GB | $45.00 | **$135.00** |

**Windows RDP** (200% markup, base VPS + windows-option addon)
| Tier | productId | OVH planCode + windows-option | OVH raw | Customer |
|------|-----------|-------------------------------|---------|----------|
| 1 | — | *(no RDP — starter is Linux-only)* | — | — |
| 2 | VVL4  | vps-value-1-4-20 + option-windows-value-1-4-20   | $15.70 | **$47.10** |
| 3 | VLE4  | vps-le-4-4-80 + option-windows-le-4-4-80         | $34.00 | **$102.00** |
| 4 | VES8a | vps-essential-2-8-40 + option-windows-essential-2-8-40 | $34.80 | **$104.40** |
| 5 | VES8b | vps-essential-2-8-160 + option-windows-essential-2-8-160 | $55.50 | **$166.50** |
| 6 | VLE16 | vps-le-16-16-160 + option-windows-le-16-16-160   | $125.00 | **$375.00** |

## Datacenters (user picks at order)
`BHS` (Canada), `GRA` / `SBG` (France), `WAW` (Poland), `DE` (Frankfurt), `UK` (London), `SGP` (Singapore), `SYD` (Sydney), `YNM` (Mumbai)

## Tests
1. `/app/js/tests/test_ovh_service.js` — 16 assertions, all passing:
   - health-check, listProducts (Linux + RDP), listRegions, listImages, calc-price, _buildCart (Linux), _buildCart (Windows), Linux-only guard on Tier 1 RDP, dry-run createInstance
2. `/app/js/tests/test_ovh_flow_e2e.js` — end-to-end bot flow: region → disk-type → tier → OS → dry-run createVPSInstance. All passing.

## Known UX gaps (Phase 2 work)
1. **Password push**: OVH does not accept root password / cloud-init at provisioning time. Linux users with an SSH key work immediately; Linux users without one must wait for OVH's email-delivered initial credentials. We can later auto-rebuild with cloud-init via `/vps/{sn}/rebuild + sshKey + userData` once we polish the create-flow timing.
2. **VPS upgrade flow**: `upgradeInstance` is stubbed on OVH (throws). User-facing upgrade currently requires cancel + reorder. OVH supports upgrades via a different "upgradeOffer" cart flow that we'll wire later.
3. **Auto-renew toggle on existing records**: OVH cancel uses `PUT /vps/{sn}/serviceInfos` (sets `renew.deleteAtExpiration=true`). Behaves like Contabo's cancelDate for downstream logic.

## Safety
- **OVH_DRY_RUN=true** is set in `/app/backend/.env` for this dev environment. Any provisioning attempt builds & deletes the cart without checking out. Remove this flag in production only when ready.
- Smart proxy automatically routes existing Contabo records back to Contabo, so the OVH switch never affects in-flight Contabo VPSes.

## Rollback plan
If OVH provisioning has problems in production, set in `.env`:
```
VPS_DEFAULT_PROVIDER="contabo"
VPS_CONTABO_FALLBACK_ENABLED="false"
```
…and restart `nodejs`. All callers will revert to Contabo without any code change.
