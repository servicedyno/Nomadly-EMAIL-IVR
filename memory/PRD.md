# PRD - Nomadly Platform

## Original Problem Statement
Multi-service platform (Telegram bot + React frontend + Node.js backend) managing domains, hosting, URL shortening, and wallet/payment systems. Key services include cPanel/WHM hosting management, domain registration (ConnectReseller + OpenProvider dual registrar), dual-currency (USD/NGN) wallet, Cloudflare DNS management, and anti-red protection.

## Core Architecture
- **Backend**: Node.js monolith (`js/_index.js`) — Telegram bot state machine (22k+ lines)
- **Frontend**: React app via `cpanel-routes.js`
- **Database**: MongoDB
- **Secondary Backend**: FastAPI (proxy)
- **Key Integrations**: Telegram, Cloudflare, cPanel/WHM, ConnectReseller, OpenProvider, OpenExchangeRates, Twilio, BlockBee/DynoPay

## What's Been Implemented

### Completed (Previous Sessions)
- Full NGN Wallet Integration across all 8+ payment flows
- Cached currency conversion (`usdToNgn`, `ngnToUsd`) with API failure handling
- Anti-Red Cloudflare Worker hardening with Proof-of-Interaction challenge
- Addon domain auto-protection with retry and Telegram notifications
- Dynamic minimum NGN deposit (~$10 USD equivalent)

### Completed (Current Session — Feb 2026)

#### Domain Pricing Overhaul: "Show worst-case, charge best-case"
- `checkDomainPrice()` now returns worst-case (higher) price to user, tracks both registrar prices
- `registerDomain()` returns `registrarChanged`, `actualPrice` on fallback
- All 5 payment paths (wallet USD/NGN, bank, BlockBee crypto, DynoPay crypto) updated with savings logic
- Savings messages: wallet charges less; bank/crypto credits difference to wallet
- Admin notifications on every savings event
- Tests: 10/10 passing (`js/tests/test_domain_price_fix.js`)

#### BulkIVR Smart Wallet Requirement
- **Previously**: All campaigns required $50 minimum wallet balance (hard block)
- **Now**: $50 minimum only for first-time campaigns OR when balance is near zero (can't cover even one call at $0.15/min)
- Returning users with existing balance can launch campaigns freely
- Pre-campaign estimate always shown (leads count, estimated cost, calls covered)
- Low balance warning (soft) when balance < estimated campaign cost
- Mid-campaign pause already existed (pauses when wallet depleted)
- `BULK_CALL_MIN_WALLET` configurable via `.env` (default $50)
- Tests: 10/10 passing (`js/tests/test_bulkivr_wallet.js`)

## Prioritized Backlog

### P1
- Add NGN currency support to Fincra deposit confirmation webhook flows

### P2
- Add monitoring for OpenExchangeRates API availability in production

### Backlog / Refactoring
- Break `_index.js` (22k+ lines) into feature-specific modules

## Key DB Schema
- `walletOf`: `{ _id: chatId, usdIn, usdOut, ngnIn, ngnOut }`
- `bulkCallCampaigns`: `{ id, chatId, status, leads: [], stats, twilioSubAccountSid, ... }`
- `state`: `{ _id: chatId, action, ...info, cheaperPrice?, registrarFallback? }`

## Key Files
- `js/_index.js` — Main bot logic, payment handlers
- `js/bulk-call-service.js` — BulkIVR campaign management, smart wallet checks
- `js/domain-service.js` — Domain registration, dual-registrar pricing
- `js/utils.js` — Currency conversion, wallet utilities
- `js/tests/test_domain_price_fix.js` — Domain pricing tests
- `js/tests/test_bulkivr_wallet.js` — BulkIVR wallet requirement tests
