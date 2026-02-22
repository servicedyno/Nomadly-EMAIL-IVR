# Nomadly - PRD & Setup Log

## Original Problem Statement
Set up environment variables for the Nomadly application. Configure backend .env with all required API keys, service credentials, and configuration values. Use the current pod URL for webhooks with /api prefix.

## Architecture
- **Frontend**: React (CRA + Craco + Tailwind CSS)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (local pod instance)
- **Pod URL**: https://setup-wizard-113.preview.emergentagent.com

## What's Been Implemented (Jan 2026)
- **Backend .env configured** with 144 environment variables covering:
  - MongoDB (local + Railway external reference)
  - Telegram bot integration (dev + prod tokens)
  - Payment gateways: Fincra, DynoPay, BlockBee crypto
  - Telephony: Twilio, SignalWire, Telnyx
  - Domain/Hosting: Cloudflare, OpenProvider, Render, Railway
  - Mail: Brevo (SMTP relay)
  - Phone service plans: Starter/Pro/Business tiers
  - Link shortening: Bitly, Cuttly, Alcazar
  - Singapore business registration details
  - Pricing configs, feature flags, and more
- **SELF_URL & SELF_URL_PROD** set to current pod URL with /api: `https://setup-wizard-113.preview.emergentagent.com/api`
- **Formatting fixes**: Corrected `:` to `=` for MIN_DOMAIN_PRICE and WHM_TOKEN, removed trailing whitespace from PRO_MINUTES
- Backend verified running and connecting to MongoDB

## Key Decisions
- Local pod MONGO_URL preserved (`mongodb://localhost:27017`) for pod functionality
- User's Railway MONGO_URL stored as `RAILWAY_MONGO_URL` for reference
- DB_NAME set to "test" per user request

## Prioritized Backlog
- P0: Import and set up the actual Nomadly application codebase (server routes, frontend UI)
- P1: Connect to Railway MongoDB if needed for production data
- P2: Set up Telegram bot webhook endpoints
- P2: Configure payment gateway webhook endpoints (Fincra, DynoPay)
- P3: Domain management integration (Cloudflare, OpenProvider)

## Next Tasks
- User to provide the actual Nomadly application codebase for migration
- Configure webhook endpoints for Telegram, payment gateways
- Build out the application UI and backend routes
