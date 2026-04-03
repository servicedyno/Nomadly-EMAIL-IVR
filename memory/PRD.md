# PRD - Nomadly Platform

## Architecture
- React Frontend (port 3000)
- FastAPI Backend (port 8001) - reverse proxy to Node.js
- Node.js Express (port 5000) - core business logic
- MongoDB (port 27017)

## Recent Fixes (Railway Log Anomalies)
1. **Fix 1**: Added notifyGroup() to all 4 hosting payment paths (Wallet, Bank NGN, BlockBee, DynoPay)
2. **Fix 2**: Added displayMainMenuButtons to goto object (was called but never defined)
3. **Fix 3**: Fixed SSH key PEM-to-OpenSSH conversion (proper SSH wire format)
4. **Fix 4**: Added Contabo NVMe↔SSD product fallback for unavailable products
5. **Fix 5**: Added WHM CERT_NOT_YET_VALID retry + admin alert for clock skew
6. **Fix 6**: Added Contabo createSecret password validation guard

## Original Problem Statement
Multi-service platform (Telegram bot + React frontend + Node.js backend) managing domains, hosting, URL shortening, wallet/payments, and Cloud Phone (SIP/IVR/voice).

## Core Architecture
- **Backend**: Node.js monolith (`js/_index.js`) — Telegram bot state machine (22k+ lines)
- **Frontend**: React app via `cpanel-routes.js`
- **Database**: MongoDB
- **Key Integrations**: Telegram, Cloudflare, cPanel/WHM, ConnectReseller, OpenProvider, OpenExchangeRates, Twilio, Telnyx, BlockBee/DynoPay

## Completed (Current Session — Feb 2026)

### Domain Pricing: "Show worst-case, charge best-case"
- Shows higher registrar price; charges cheaper when possible; credits savings
- Tests: 10/10 passing

### BulkIVR Smart Wallet
- $50 min only for first-time or zero-balance; returning users run freely
- `BULK_CALL_MIN_WALLET` configurable via .env
- Tests: 10/10 passing

### SIP Outbound Call Fix (Twilio numbers on Telnyx SIP)
- **Bug**: @lamanifestor calls rejected — Telnyx D51 error (Twilio number not verified on Telnyx)
- **Root Cause (from Railway logs)**:
  1. `transferCall(callControlId, sipUri, twilioNumber)` → D51 rejection
  2. Connection ANI override set to Twilio number → auto-routed calls also rejected
  3. Fallback code referenced undefined `_twilioClient` variable
- **Fix**:
  1. `TELNYX_DEFAULT_ANI=+18556820054` — valid Telnyx number used as `from` for SIP bridge transfers
  2. ANI override reset to default before transfer (prevents auto-routing race)
  3. `_attemptTwilioDirectCall()` helper — proper Twilio sub-account credential lookup + direct call fallback
- **Files**: `js/voice-service.js`, `backend/.env`

## Prioritized Backlog
- P2: Add monitoring for OpenExchangeRates API
- Backlog: Refactor `_index.js` into feature modules

## Key Files
- `js/voice-service.js` — SIP outbound/inbound, IVR, call forwarding
- `js/telnyx-service.js` — Telnyx API wrapper
- `js/bulk-call-service.js` — BulkIVR campaigns
- `js/domain-service.js` — Domain registration, dual-registrar pricing
- `js/tests/test_domain_price_fix.js` — Domain pricing tests
- `js/tests/test_bulkivr_wallet.js` — BulkIVR wallet tests
