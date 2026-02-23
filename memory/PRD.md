# Speechcue Cloud Phone - PRD

## Original Problem Statement
Set up and configure a multi-service application (Telegram bot + Telnyx voice/SIP + FastAPI backend + React frontend). Build a public-facing SIP test page branded as "Speechcue" with Telegram OTP gating, referral system, and abuse prevention.

## Architecture
- **Frontend:** React (port 3000) with Tailwind CSS and @telnyx/webrtc
- **Backend:** FastAPI (port 8001) acting as reverse proxy to Node.js Express (port 5000)
- **Node.js:** Telegram bot + Telnyx voice service + SIP test credentials API
- **Database:** External MongoDB (Railway) + local MongoDB
- **Routing:** Kubernetes ingress routes `/api/*` to FastAPI, all other routes to React frontend

---

## CRITICAL — Emergent Agent Deployment Setup

**On every fresh deployment, the agent MUST run this setup script FIRST before any other work:**

```bash
bash /app/scripts/setup-nodejs.sh
```

### What the setup script does:
1. **Detects current pod URL** from `REACT_APP_BACKEND_URL` in `frontend/.env`
2. **Updates `SELF_URL` and `SELF_URL_PROD`** in `backend/.env` to `<pod_url>/api`
3. **Creates `.env` symlink** — `/app/.env` -> `/app/backend/.env`
4. **Installs Node.js dependencies** — `yarn install` in `/app`
5. **Creates supervisor config** for Node.js
6. **Starts Node.js Express server** on port 5000 via supervisor

---

## What's Been Implemented

### Completed
- [x] Environment setup with all API keys in `backend/.env`
- [x] Telegram bot running via supervisor
- [x] FastAPI reverse proxy to Node.js Express
- [x] Domain Registration Flow Fixes (CF zone -> Domain Reg -> WHM -> DNS)
- [x] URL Shortener Flow Fix (Cloudflare NS + CNAME on CF)
- [x] Lead Generation Persistence (resume after deployment)
- [x] URL Shortener Activation Persistence
- [x] Hosting Confirmation Email (clean template, proper fields)
- [x] SIP Credential, Billing, Inbound Call, CNAM fixes
- [x] Speechcue SIP Test Page with OTP + Referral
- [x] **Price Consistency Fix (Feb 2026)** — Fixed domain pricing inconsistency ($14 vs $9) in `domain-service.js`. Root cause: when both CR and OP registrars had a domain available, code always preferred CR regardless of price; if CR was flaky, OP price was used instead, causing fluctuations. Fix: now picks the cheapest price when both registrars are available.

### Key Files
- `/app/js/domain-service.js` - Unified domain service (price consistency fix here)
- `/app/js/_index.js` - Main bot logic (14k+ lines)
- `/app/js/cr-domain-price-get.js` - ConnectReseller pricing
- `/app/js/op-service.js` - OpenProvider pricing
- `/app/js/hosting/plans.js` - Hosting plan definitions
- `/app/js/lead-job-persistence.js` - Lead job crash recovery
- `/app/js/shortener-activation-persistence.js` - Shortener persistence
- `/app/js/mail-service.js` - Brevo email templates
- `/app/backend/server.py` - FastAPI reverse proxy to Node.js

### Key Pricing Logic
- Domain prices: fetched from CR + OP in parallel, marked up by `PERCENT_INCREASE_DOMAIN` (3.25x), min `MIN_DOMAIN_PRICE` ($5)
- Hosting plans: Weekly $5, Premium $75, Golden $100 (from .env)
- Total = domain price + hosting price (or just hosting if existing domain)

## Prioritized Backlog

### P1 - Next Up
- Verify Multi-User Caller ID (ANI) handling
- Full regression test of billing logic

### P2 - Refactoring
- Break `_index.js` monolith into feature modules
- Split `voice-service.js` webhook switch into focused event handlers

### P3 - Future
- Production DNS setup for `speechcue.com`
- Test call analytics dashboard
- Multi-language support for web test page
