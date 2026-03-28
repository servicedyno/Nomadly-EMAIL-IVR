# Contabo Direct VPS — Implementation Plan

> **Project**: Nomadly Telegram Bot
> **Goal**: Replace dead Nameword VPS intermediary with direct Contabo API v1 integration
> **Payment**: Wallet balance, Crypto (DynoPay/BlockBee), NGN
> **Date**: March 2026

---

## 1. Architecture Overview

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  Telegram     │────▶│  Bot (_index.js)   │────▶│ contabo-service  │
│  User Chat    │◀────│  Conversation Flow │◀────│ .js (API Layer)  │
└──────────────┘     └───────────────────┘     └────────┬─────────┘
                              │                         │
                              ▼                         ▼
                     ┌────────────────┐        ┌────────────────┐
                     │   MongoDB      │        │  Contabo API   │
                     │  vpsPlansOf    │        │  api.contabo   │
                     │  vpsTransacts  │        │  .com/v1/      │
                     │  secrets (SSH) │        └────────────────┘
                     └────────────────┘
```

**Key Change**: `vm-instance-setup.js` (838 lines, all Nameword calls) gets replaced by `contabo-service.js` which calls Contabo API v1 directly. The bot conversation flow in `_index.js` stays largely intact — only the data model adapts to Contabo's structure.

---

## 2. Contabo API v1 Endpoints Used

### Authentication
- **Token**: `POST https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token`
- OAuth2 password grant using `CONTABO_CLIENT_ID`, `CONTABO_CLIENT_SECRET`, `CONTABO_API_USER`, `CONTABO_API_PASSWORD`
- Token cached in memory, auto-refreshed 60s before expiry

### Core Endpoints
| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| List Products | GET | `/v1/compute/products` | VPS plans with specs + base pricing |
| List Regions | GET | `/v1/regions` | EU, US-central/east/west, UK, Asia, AU |
| List Images | GET | `/v1/images` | OS options (Ubuntu, Debian, CentOS, etc.) |
| Create Instance | POST | `/v1/compute/instances` | Deploy new VPS |
| List Instances | GET | `/v1/compute/instances` | All instances on account |
| Get Instance | GET | `/v1/compute/instances/{id}` | Single instance details |
| Start Instance | POST | `/v1/compute/instances/{id}/actions/start` | Power on |
| Stop Instance | POST | `/v1/compute/instances/{id}/actions/stop` | Power off |
| Restart Instance | POST | `/v1/compute/instances/{id}/actions/restart` | Reboot |
| Reinstall Instance | PUT | `/v1/compute/instances/{id}` | Reinstall OS/image |
| Cancel Instance | POST | `/v1/compute/instances/{id}/cancel` | Delete/terminate |
| Create Secret | POST | `/v1/secrets` | Store SSH public key |
| List Secrets | GET | `/v1/secrets` | All stored SSH keys |
| Delete Secret | DELETE | `/v1/secrets/{id}` | Remove SSH key |

### Required Headers (all requests)
```
Authorization: Bearer {access_token}
x-request-id: {uuid}
Content-Type: application/json
```

---

## 3. Credentials (already in `.env`)

```
CONTABO_CLIENT_ID=INT-14615517
CONTABO_CLIENT_SECRET=oC5ZDisOxJ6nk4dnQRXAhPMb02MaoKXu
CONTABO_API_USER=vpsresell@dyno.pt
CONTABO_API_PASSWORD=Katiekendra123@
```

### New env vars to add
```
VPS_MARKUP_PERCENT=50          # % markup on Contabo base price (default 50%)
VPS_CURRENCY=USD               # Display currency
```

---

## 4. Pricing Strategy

Prices pulled dynamically from Contabo products API. Configurable markup via `VPS_MARKUP_PERCENT`.

| Contabo Plan | vCPUs | RAM | Storage | Contabo ~$/mo | 50% Markup | Sell Price |
|-------------|-------|-----|---------|---------------|------------|------------|
| Cloud VPS 10 (V1) | 4 | 8 GB | 75 GB NVMe | $4.99 | +$2.50 | **$7.49** |
| Cloud VPS 20 | 6 | 18 GB | 150 GB NVMe | $8.99 | +$4.50 | **$13.49** |
| Cloud VPS 30 | 8 | 24 GB | 200 GB NVMe | $15.99 | +$8.00 | **$23.99** |
| Cloud VPS 40 | 12 | 48 GB | 250 GB NVMe | $23.99 | +$12.00 | **$35.99** |
| Cloud VPS 50 | 16 | 64 GB | 300 GB NVMe | $35.99 | +$18.00 | **$53.99** |

Region surcharges (from Contabo location fees) are added on top:
- EU: Free
- US Central/East/West, UK: +$0.95–$1.95/mo
- Asia (Singapore/Japan): +$3.95–$5.95/mo
- Australia (Sydney): +$1.95–$5.95/mo

---

## 5. Implementation Phases

### Phase 1: Contabo API Service Layer
**File**: `js/contabo-service.js`

**Functions to build**:
```
getAccessToken()             — OAuth2 token with caching + auto-refresh
listProducts()               — Fetch VPS plans with specs/pricing
listRegions()                — Fetch available regions + location fees
listImages()                 — Fetch OS images
createSecret(name, sshKey)   — Store SSH public key
listSecrets()                — List stored SSH keys
deleteSecret(secretId)       — Remove SSH key
createInstance(opts)          — Deploy new VPS instance
getInstance(instanceId)      — Get instance details (IP, status, etc.)
listInstances()              — List all instances
startInstance(instanceId)    — Power on
stopInstance(instanceId)     — Power off
restartInstance(instanceId)  — Reboot
reinstallInstance(id, opts)  — Reinstall OS
cancelInstance(instanceId)   — Terminate/delete
applyMarkup(basePrice)       — Apply VPS_MARKUP_PERCENT
```

**Test**: Run each function standalone against the Contabo API with the existing credentials.

---

### Phase 2: Replace `vm-instance-setup.js`
**File**: Rewrite `js/vm-instance-setup.js`

Map old Nameword functions → new Contabo functions:

| Old (Nameword) | New (Contabo) |
|----------------|---------------|
| `fetchAvailableCountries()` | `listRegions()` |
| `fetchAvailableRegionsOfCountry(c)` | *(merged — Contabo regions are flat)* |
| `fetchAvailableZones(r)` | *(removed — Contabo doesn't have zones)* |
| `fetchAvailableDiskTpes()` | *(removed — disk included in product)* |
| `fetchAvailableVPSConfigs()` | `listProducts()` with markup |
| `fetchAvailableOS()` | `listImages()` |
| `createVPSInstance()` | `createInstance()` via Contabo API |
| `changeVpsInstanceStatus(d, s)` | `startInstance/stopInstance/restartInstance` |
| `deleteVPSinstance()` | `cancelInstance()` |
| `fetchUserVPSList(telegramId)` | `listInstances()` filtered by user tag |
| `fetchVPSDetails(tid, vpsId)` | `getInstance(instanceId)` |
| `generateNewSSHkey()` | `createSecret()` |
| `uploadSSHPublicKey()` | `createSecret()` |
| `fetchUserSSHkeyList()` | `listSecrets()` filtered by user |
| `unlinkSSHKeyFromVps()` | Reinstall without that key |
| `upgradeVPSPlanType()` | Cancel old + create new (Contabo doesn't have in-place upgrade) |
| `renewVPSPlan()` | *(Contabo handles billing — track in MongoDB)* |
| `sendVPSCredentialsEmail()` | *(Keep as-is)* |

**Test**: Verify all exports work with mocked and real Contabo API calls.

---

### Phase 3: Adapt Bot Flow in `_index.js`

#### 3a. Simplify Region Selection
**Old flow**: Country → Region → Zone (3 steps)
**New flow**: Region (1 step) — Contabo has ~8 flat regions

```
User taps "🖥 VPS"
→ Bot shows: "Select a region:"
  [🇪🇺 Europe (EU)]
  [🇺🇸 US Central] [🇺🇸 US East] [🇺🇸 US West]
  [🇬🇧 United Kingdom]
  [🇸🇬 Singapore] [🇯🇵 Japan]
  [🇦🇺 Australia]
```

Merge states `askCountryForVPS` + `askRegionAreaForVPS` + `askZoneForVPS` + `confirmZoneForVPS` → single `askRegionForVPS` state.

#### 3b. Plan Selection
After region, show available products with marked-up pricing:

```
📦 Cloud VPS Plans (EU Region):

1️⃣ Cloud VPS 10
   4 vCPU | 8 GB RAM | 75 GB NVMe
   💰 $7.49/mo

2️⃣ Cloud VPS 20
   6 vCPU | 18 GB RAM | 150 GB NVMe
   💰 $13.49/mo

3️⃣ Cloud VPS 30
   8 vCPU | 24 GB RAM | 200 GB NVMe
   💰 $23.99/mo
```

#### 3c. OS Selection
```
🖥 Select Operating System:
  [Ubuntu 22.04] [Ubuntu 24.04]
  [Debian 12] [CentOS Stream 9]
  [AlmaLinux 9] [Rocky Linux 9]
  [Windows Server 2022]
```

#### 3d. SSH Key Flow
Keep existing SSH key flow, rewired to Contabo secrets API.

#### 3e. Payment Confirmation
```
📋 Order Summary:
━━━━━━━━━━━━━━━
🖥 Cloud VPS 20
📍 US East
💻 Ubuntu 24.04
🔑 SSH Key: my-key
💰 Price: $13.49/mo

Pay with:
  [💰 Wallet ($13.00)]
  [₿ Crypto]
  [₦ NGN]
```

#### 3f. Instance Management
```
🖥 VM-Instance-1
━━━━━━━━━━━━━━━
Status: 🟢 RUNNING
IP: 168.119.xxx.xxx
Region: US East
Plan: Cloud VPS 20 (6 vCPU / 18 GB)
OS: Ubuntu 24.04

[⏹ Stop] [🔄 Restart]
[📋 Subscription] [🔑 SSH Keys]
[⬆️ Upgrade] [🗑 Delete]
```

---

### Phase 4: MongoDB Schema

#### `vpsPlansOf` collection (user's VPS instances)
```json
{
  "_id": "uuid",
  "chatId": 7155573693,
  "contaboInstanceId": 12345678,
  "name": "VM-Instance-1",
  "productId": "V1",
  "region": "US",
  "imageId": "uuid-of-os",
  "imageName": "Ubuntu 24.04",
  "ip": "168.119.xxx.xxx",
  "status": "running",
  "specs": { "vCPU": 4, "ram": 8, "disk": 75 },
  "price": 7.49,
  "currency": "USD",
  "secretIds": ["secret-uuid"],
  "credentials": { "username": "root", "password": "encrypted" },
  "createdAt": "2026-03-28T...",
  "expiresAt": "2026-04-28T...",
  "autoRenew": true
}
```

#### `vpsTransactions` collection
```json
{
  "_id": "uuid",
  "chatId": 7155573693,
  "type": "purchase|renewal|upgrade",
  "instanceId": "uuid",
  "amount": 7.49,
  "currency": "USD",
  "paymentMethod": "wallet|crypto|ngn",
  "status": "completed",
  "createdAt": "2026-03-28T..."
}
```

---

### Phase 5: Payment Integration

All three payment methods already exist in the bot:

| Method | Flow | Status |
|--------|------|--------|
| **Wallet** | Deduct from `walletOf` balance | ✅ Built — wire to VPS price |
| **Crypto** | DynoPay/BlockBee BTC/USDT/ETH payment | ✅ Built — create payment intent with VPS ref |
| **NGN** | Naira bank transfer / Flutterwave | ✅ Built — wire to VPS price in NGN |

Reuse existing `vps-plan-pay` action state and `bank-pay-vps` endpoint.

---

### Phase 6: Notifications & Tracking

- **Purchase notification**: `notifyGroup("🖥 VPS Purchased! User X just deployed a Cloud VPS 20 in US East")`
- **Credential delivery**: Send IP + username + password via Telegram DM (+ optional email)
- **Expiry tracking**: Existing `checkVpsExpiry()` cron job — adapt to Contabo data model
- **Auto-renewal**: Deduct from wallet on expiry if enabled

---

## 6. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `js/contabo-service.js` | **NEW** | Contabo API v1 wrapper (auth, products, instances, secrets) |
| `js/vm-instance-setup.js` | **REWRITE** | Replace Nameword calls with contabo-service calls, keep exports |
| `js/_index.js` | **MODIFY** | Adapt VPS flow states, simplify region selection, wire new service |
| `backend/.env` | **ADD** | `VPS_MARKUP_PERCENT=50` |
| Railway env vars | **ADD** | `VPS_MARKUP_PERCENT=50` |

---

## 7. Testing Checklist

- [ ] Contabo OAuth2 token fetch + cache + refresh
- [ ] List products returns valid plans with pricing
- [ ] List regions returns available regions
- [ ] List images returns OS options
- [ ] Create secret (SSH key) succeeds
- [ ] Create instance succeeds and returns IP
- [ ] Start/Stop/Restart instance works
- [ ] Reinstall instance works
- [ ] Cancel instance works
- [ ] Bot flow: region → plan → OS → SSH → payment → provision
- [ ] Wallet payment deducts correctly
- [ ] Crypto payment creates intent and credits on callback
- [ ] NGN payment flow works
- [ ] Instance management (start/stop/restart/delete) from bot
- [ ] notifyGroup fires on VPS purchase
- [ ] Credentials delivered to user via DM
- [ ] MongoDB tracks instances and transactions

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Contabo API rate limits | Token caching, request deduplication |
| Instance creation takes time | Show "⏳ Provisioning..." message, poll status |
| User creates multiple instances | Track per-user in MongoDB, enforce limits if needed |
| Contabo doesn't support in-place upgrade | Cancel + recreate flow, warn user about data loss |
| SSH key management complexity | Store key↔user mapping in MongoDB alongside Contabo secrets |
| Contabo API downtime | Graceful error messages, retry with exponential backoff |

---

## 9. Execution Order

1. **Build `contabo-service.js`** — test API calls independently
2. **Rewrite `vm-instance-setup.js`** — map old exports to new Contabo calls
3. **Adapt `_index.js` bot flow** — simplify regions, wire new service
4. **Test full flow** — end-to-end purchase + management
5. **Deploy to Railway** — add env vars, push code
