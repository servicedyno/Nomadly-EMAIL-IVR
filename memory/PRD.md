# Speechcue Cloud Phone - PRD

## Original Problem Statement
Set up and configure a multi-service application (Telegram bot + Telnyx voice/SIP + FastAPI backend + React frontend). After setup, build a public-facing SIP test page branded as "Speechcue" with abuse-prevention gating via Telegram OTP.

## Architecture
- **Frontend:** React (port 3000) with Tailwind CSS and @telnyx/webrtc
- **Backend:** FastAPI (port 8001) acting as reverse proxy to Node.js Express (port 5000)
- **Node.js:** Telegram bot + Telnyx voice service + SIP test credentials API
- **Database:** External MongoDB
- **Routing:** Kubernetes ingress routes `/api/*` to FastAPI, all other routes to React frontend

## What's Been Implemented

### Completed
- [x] Environment setup with all API keys configured in `backend/.env`
- [x] Telegram bot running via supervisor (`telegrambot` service)
- [x] FastAPI reverse proxy to Node.js Express (voice webhooks, telegram webhooks, phone test API)
- [x] SIP call routing fix in `voice-service.js` (connection_id-based routing)
- [x] **Speechcue SIP Test Page** (Feb 2026)
  - React component at `/phone/test` (`PhoneTestPage.js`)
  - Two tabs: "Free Test" (OTP-gated) and "My Credentials" (manual entry)
  - **Telegram OTP authentication** — users send `/test` to @Nomadlybot bot to get a 6-digit code
  - Backend: `/api/phone/test/verify-otp` verifies OTP and generates SIP credentials tracked by chatId
  - Rate limiting by **Telegram chatId** (not IP) — 2 calls per user, 60s max duration
  - OTP expires in 5 minutes, single-use
  - All tests passed (100% backend, 95%+ frontend)

### Key Files
- `/app/frontend/src/pages/PhoneTestPage.js` - SIP test page with OTP flow
- `/app/frontend/src/App.js` - React router
- `/app/js/phone-test-routes.js` - OTP verification, credential generation, rate limiting
- `/app/js/_index.js` - Telegram bot `/test` command handler
- `/app/js/voice-service.js` - Telnyx voice call handling
- `/app/backend/server.py` - FastAPI proxy server

### MongoDB Collections
- `testOtps` - Stores OTPs with chatId, expiry (TTL index)
- `testCredentials` - Stores generated SIP creds linked to chatId

## Prioritized Backlog

### P1 - Upcoming
- Update Telegram bot SIP guide messages with link to test page

### P2 - Cleanup
- Remove old `SipTest.js` and `/api/sip-test-credentials` endpoint (redundant)

### P3 - Future
- Production domain setup (`speechcue.com/phone/test`)
- Analytics dashboard for test call usage
