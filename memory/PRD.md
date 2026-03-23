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
- **P0 Bug Fix + Pricing Overhaul: "Show worst-case, charge best-case"**
  - **Root Cause**: When ConnectReseller fails, silent fallback to OpenProvider occurs. Users could see one price but be charged differently.
  - **New Strategy**: Always show the HIGHER registrar price upfront. Try the cheaper registrar first. If it succeeds, users get a savings surprise. If fallback to expensive registrar, they pay exactly what was shown.
  - **Changes Applied**:
    1. `domain-service.js` → `checkDomainPrice()`: Now returns worst-case price as `price`, plus `cheaperPrice`, `cheaperRegistrar`, `expensiveRegistrar` fields
    2. `domain-service.js` → `registerDomain()`: Returns `registrarChanged`, `actualPrice` on fallback. Re-checks OP price before fallback.
    3. `_index.js` → `buyDomainFullProcess()`: Saves `registrarFallback`, `actualRegistrar` to user state
    4. `_index.js` → `domain-pay` walletOk: Charges `cheaperPrice` when cheaper registrar succeeds (savings!), or `shownPrice` on fallback
    5. Bank callback: Credits savings difference to NGN wallet balance
    6. BlockBee + DynoPay crypto callbacks: Credits savings difference to USD wallet balance
    7. Admin notifications on every savings event for accounting
  - **Savings Messages**:
    - Wallet: "You saved $X! Only $Y was charged instead of $Z."
    - Bank/Crypto: "You saved $X! The difference has been credited to your wallet balance."
  - **Test**: 10/10 unit tests passing (`js/tests/test_domain_price_fix.js`)

## Pricing Flow Summary

| Scenario | User Sees | Wallet Charge | Bank/Crypto |
|---|---|---|---|
| Both registrars, cheaper succeeds | Higher price ($39) | Cheaper price ($30), savings msg | Paid $39, $9 credited to wallet |
| Both registrars, fallback to expensive | Higher price ($39) | Full $39 (no savings) | Paid $39 (no adjustment) |
| Only one registrar | That price | That price | That price |
| Equal prices | Either | Same price | Same price |

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
- `state`: `{ _id: chatId, action, ...info, cheaperPrice?, cheaperRegistrar?, expensiveRegistrar?, actualPrice?, actualRegistrar?, registrarFallback? }`

## Key Files
- `js/_index.js` — Main bot logic, payment handlers
- `js/domain-service.js` — Domain registration, DNS, registrar routing, dual-pricing
- `js/op-service.js` — OpenProvider integration
- `js/cr-domain-price-get.js` — ConnectReseller pricing
- `js/utils.js` — Currency conversion, wallet utilities
- `js/anti-red-service.js` — Cloudflare Worker protection
- `js/cpanel-routes.js` — Frontend API routes
- `js/tests/test_domain_price_fix.js` — Unit tests for pricing logic
