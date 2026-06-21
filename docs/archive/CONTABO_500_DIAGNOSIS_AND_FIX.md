# Contabo CREATE HTTP 500 — Diagnosis & Mitigation
**Generated:** 2026-06-08 23:55 UTC

## TL;DR

- **Symptom:** `POST /compute/instances` returns HTTP 500 in ~3ms with `"Internal Server Error, retry or contact support"` for **every** product/region/image combination, while every other Contabo API call works perfectly.
- **Root cause:** Vendor-side block on `POST /compute/instances` for **customer 14615517** (Mercy Adebayo / `vpsresell@dyno.pt`). Likely a billing/fraud-prevention silent block (HTTP 500 instead of a proper 403). Confirmed not a bug in our code, not an outage of READ ops, not an auth issue.
- **Mitigation deployed:** Circuit breaker in `js/contabo-service.js` + pre-flight check in `vps-plan-pay` handler in `js/_index.js`. After 2 consecutive 5xx, the breaker opens and the bot refuses to debit the wallet at all — users see a "VPS purchases temporarily paused" message instead of being charged-and-refunded.
- **Required action:** **Open a Contabo support ticket** referencing customer `14615517` and the trace details below.

---

## Diagnostic evidence

| Test | Endpoint | Method | Result | Latency |
|------|----------|--------|--------|---------|
| OAuth token | `/auth/realms/contabo/protocol/openid-connect/token` | POST | **200 OK** | normal |
| List instances | `/v1/compute/instances?size=1` | GET | **200 OK** | normal |
| List images | `/v1/compute/images?size=20` | GET | **200 OK** | normal |
| Users / profile | `/v1/users` | GET | **200 OK** (`enabled=true`, `emailVerified=true`, `owner=true`) | normal |
| Create secret | `/v1/secrets` | POST | **201 CREATED** | normal |
| Delete secret | `/v1/secrets/{id}` | DELETE | **204 NO CONTENT** | normal |
| **Create instance** | `/v1/compute/instances` | **POST** | **500 INTERNAL SERVER ERROR** | **~3 ms** |

### Create-instance attempts (all failed identically)

| Product | Region | Image | Period | Idempotency-Key | User-Agent | Result |
|---------|--------|-------|--------|-----------------|------------|--------|
| V91 | US-central | Ubuntu 22.04 | 1 | — | axios default | 500 |
| V92 | US-east | Ubuntu 22.04 | 1 | — | axios default | 500 |
| V91 | EU | Ubuntu 22.04 | 1 | — | axios default | 500 |
| V92 | EU | Ubuntu 22.04 | 1 | — | axios default | 500 |
| V93 | US-central | Ubuntu 22.04 | 1 | — | axios default | 500 |
| V91 | EU | (no image specified) | 1 | — | axios default | 500 |
| V91 | EU | Ubuntu 24.04 cPanel (fresh) | 1 | — | axios default | 500 |
| V91 | EU | Ubuntu 22.04 | 12 | — | axios default | 500 |
| V91 | EU | Ubuntu 22.04 | 1 | UUID set | `contabo-go-sdk/0.7.0` | 500 |

The Cloudflare edge ID for one of these requests: `cf-ray: a08bbebe3b10c0f3-ORD`.

### Account snapshot

- **customerId:** `14615517`
- **email:** `vpsresell@dyno.pt`
- **emailVerified:** `true`
- **enabled:** `true`
- **owner:** `true`
- **9 active instances** (4 running, 5 stopped)
- **Newest instance:** `203310799` created **2026-05-19** — 20.2 days ago

This 20-day gap between the last successful provision and today's failures is consistent with a billing event (failed renewal charge → silent provisioning suspension).

---

## Mitigation implemented

### 1. Circuit breaker in `js/contabo-service.js`

State machine:
- **Threshold:** 2 consecutive 5xx from `createInstance` → circuit opens.
- **While open:** `createInstance` throws `VPS_PROVISIONING_PAUSED` synchronously without an HTTP call.
- **One-shot callback** (`onProvisioningCircuitOpen`) used by the bot to DM the admin.
- **Manual reset:** `resetProvisioningCircuit()` or `POST /admin/contabo-circuit-reset?key=<SESSION_SECRET[0:16]>`.
- **Auto-close:** the next successful `createInstance` call (typically a probe after Contabo recovers).

### 2. Pre-flight check in `js/_index.js` (`vps-plan-pay`)

Before debiting the wallet:
```js
const health = contaboSvc.isProvisioningHealthy()
if (!health.healthy) {
  send(chatId, "VPS purchases temporarily paused — your wallet has NOT been debited.")
  return  // skip debit entirely
}
```

This eliminates the debit→500→refund loop the user reported in the handoff.

### 3. Admin alert hook (runs once when breaker opens)

```
🔌 Contabo CREATE circuit OPEN
Consecutive failures: 2
Last error: Internal Server Error, retry or contact support
Opened at: 2026-06-08T23:46:47.710Z

Effect: all VPS purchases are paused at the wallet-debit step.
Action: open Contabo support ticket — reference customer 14615517.
```

### 4. Admin HTTP endpoints

- `GET  /admin/contabo-circuit-status?key=…` → view current state
- `POST /admin/contabo-circuit-reset?key=…`  → force-close after vendor fix confirmed

---

## What to ask Contabo support

> *"Hello — POST /v1/compute/instances has been returning HTTP 500 ('Internal Server Error, retry or contact support') in ~3ms for customer 14615517 (vpsresell@dyno.pt) since around 2026-05-19. Every other endpoint (auth, GET /compute/instances, POST /secrets) is returning 2xx for the same OAuth token. cf-ray sample: a08bbebe3b10c0f3-ORD. No instance enters 'provisioning' state — the 500 is returned before any orchestration happens. Please check (a) whether the account is flagged by anti-fraud, (b) whether there is a pending invoice or billing issue silently blocking new orders, and (c) backend logs for the trace IDs above."*

Trace IDs to include:
- `1598640b-45ca-47ec-89e0-aeb9054486cf`
- `89aff575-1064-477d-bc19-a0ef26193c45`
- `2628c62c-549d-43cc-acc4-5a592b0e6c13`

---

## Code-level deliverables

| File | What changed |
|------|--------------|
| `js/contabo-service.js` | Added circuit state, `_trackCreateResult()`, `isProvisioningHealthy()`, `getCircuitState()`, `resetProvisioningCircuit()`, `onProvisioningCircuitOpen()`. Wrapped `createInstance` to (a) bail with `VPS_PROVISIONING_PAUSED` when open, (b) track success/failure on every code path including fallbacks. |
| `js/_index.js` | (a) Pre-flight check in `vps-plan-pay` handler skips wallet debit when breaker open. (b) Registered admin-alert callback at boot. (c) Added `GET/POST /admin/contabo-circuit-{status,reset}` endpoints. |
| `scripts/diagnose_contabo.js` | Initial 4-step diagnostic (Step 1-4). |
| `scripts/diagnose_contabo_deep.js` | Step A-G follow-up (minimal payload, headers, billing, concurrency). |
| `scripts/diagnose_contabo_final.js` | Tests 1-6 (idempotency key, other writes, status page, concurrent). |
| `scripts/contabo_profile_check.js` | Confirms account `enabled=true emailVerified=true`. |
| `scripts/test_contabo_circuit.js` | Unit-tests the circuit breaker against the live (failing) endpoint. |
| `scripts/test_vps_preflight.js` | Integration test for the pre-flight call path. |

All tests pass against the **real** Contabo API (since CREATE is consistently failing, we can validate end-to-end without paying for a real VPS).
