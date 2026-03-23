# PRD - Nomadly Platform

## Original Problem Statement
Multi-service platform (Telegram bot + React frontend + Node.js backend) managing domains, hosting, URL shortening, and wallet/payment systems. Key services include cPanel/WHM hosting management, domain registration (ConnectReseller + OpenProvider dual registrar), dual-currency (USD/NGN) wallet, Cloudflare DNS management, anti-red protection, and Cloud Phone (SIP/IVR/voice).

## Core Architecture
- **Backend**: Node.js monolith (`js/_index.js`) — Telegram bot state machine (22k+ lines)
- **Frontend**: React app via `cpanel-routes.js`
- **Database**: MongoDB
- **Secondary Backend**: FastAPI (proxy)
- **Key Integrations**: Telegram, Cloudflare, cPanel/WHM, ConnectReseller, OpenProvider, OpenExchangeRates, Twilio, Telnyx, BlockBee/DynoPay

## What's Been Implemented (Current Session — Feb 2026)

### Domain Pricing Overhaul: "Show worst-case, charge best-case"
- `checkDomainPrice()` shows HIGHER price, tries cheaper registrar first
- Savings credited to wallet (wallet/bank/crypto paths)
- Admin notifications on savings events
- Tests: 10/10 passing

### BulkIVR Smart Wallet Requirement
- $50 minimum only for first-time campaigns or zero balance
- Returning users can launch with any balance
- Pre-campaign estimate + low balance warnings
- `BULK_CALL_MIN_WALLET` configurable via .env

### SIP Outbound Call Fix (Twilio numbers on Telnyx SIP)
- **Root Cause**: User @lamanifestor has Twilio number (+18888645099) but SIP credential is on Telnyx connection. When code transferred call via Telnyx with `from=+18888645099`, Telnyx rejected: "Unverified origination number D51"
- **Fix**:
  1. Removed `from` parameter from Telnyx-to-Twilio SIP bridge transfer (Twilio SIP handler sets correct caller ID)
  2. Removed 200ms delay — transfer fires immediately to beat Telnyx auto-routing race condition
  3. Added Twilio direct call fallback when Telnyx transfer fails (fetches sub-account creds from user's phoneNumbersOf doc)
- **Files**: `js/voice-service.js` (lines ~1198-1250)

## Prioritized Backlog

### P2
- Add monitoring for OpenExchangeRates API availability

### Backlog / Refactoring
- Break `_index.js` (22k+ lines) into feature-specific modules

## Key DB Schema
- `walletOf`: `{ _id: chatId, usdIn, usdOut, ngnIn, ngnOut }`
- `phoneNumbersOf`: `{ _id: chatId, val: { numbers: [...], twilioSubAccountSid, twilioSubAccountToken } }`
- `state`: `{ _id: chatId, action, ...info, cheaperPrice?, registrarFallback? }`

## Key Files
- `js/_index.js` — Main bot logic, payment handlers
- `js/voice-service.js` — SIP outbound/inbound, IVR, call forwarding, recording
- `js/telnyx-service.js` — Telnyx API wrapper (transferCall, hangupCall, etc.)
- `js/bulk-call-service.js` — BulkIVR campaign management
- `js/domain-service.js` — Domain registration, dual-registrar pricing
- `js/utils.js` — Currency conversion, wallet utilities
