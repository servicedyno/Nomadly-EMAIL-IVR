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
- **P0 Bug Fix: Domain Price Discrepancy**
  - **Root Cause**: When ConnectReseller fails (e.g., insufficient funds), silent fallback to OpenProvider occurs without price re-verification. Users may be shown ConnectReseller's cheaper price but the actual cost through OpenProvider is higher.
  - **Fix Applied**:
    1. `domain-service.js` → `registerDomain()`: On CR→OP fallback, re-checks OP price via `checkDomainAvailability` and returns `actualPrice` + `registrarChanged` flag
    2. `_index.js` → `buyDomainFullProcess()`: Saves `actualPrice` and `actualRegistrar` to user state when fallback occurs
    3. `_index.js` → `domain-pay` walletOk: Uses actual registrar price for wallet deduction; notifies user of price adjustment
    4. Bank/Crypto/DynoPay callbacks: Log price discrepancies and notify admin when platform absorbs cost difference
  - **Test**: 6/6 unit tests passing (`js/tests/test_domain_price_fix.js`)

## Prioritized Backlog

### P1
- Add NGN currency support to Fincra deposit confirmation webhook flows

### P2
- Add monitoring for OpenExchangeRates API availability in production

### Backlog / Refactoring
- Break `_index.js` (22k+ lines) into feature-specific modules (hosting, domains, phone, marketplace, etc.)

## Key DB Schema
- `walletOf`: `{ _id: chatId, usdIn, usdOut, ngnIn, ngnOut }`
- `cpanelAccounts`: `{ chatId, domain, cpUser, plan, addonDomains: [] }`
- `registeredDomains`: `{ _id: domainName, registrar, owner, registeredAt }`
- `state`: `{ _id: chatId, action, ...info, actualPrice?, actualRegistrar? }`
- `domainsOf`: `{ domainName, chatId, registrar, nameserverType, cfZoneId, ... }`

## Key Files
- `js/_index.js` — Main bot logic, payment handlers
- `js/domain-service.js` — Domain registration, DNS, registrar routing
- `js/op-service.js` — OpenProvider integration
- `js/cr-domain-price-get.js` — ConnectReseller pricing
- `js/utils.js` — Currency conversion, wallet utilities
- `js/anti-red-service.js` — Cloudflare Worker protection
- `js/cpanel-routes.js` — Frontend API routes
