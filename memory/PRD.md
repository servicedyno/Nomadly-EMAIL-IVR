# Speechcue Cloud Phone - PRD

## Original Problem Statement
Set up and configure a multi-service application (Telegram bot + Telnyx voice/SIP + FastAPI backend + React frontend). After setup, build a public-facing SIP test page branded as "Speechcue" for users to test SIP calling.

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
  - Two tabs: "Free Test" (auto-generated temp creds) and "My Credentials" (manual entry)
  - Backend: `/api/phone/test/credentials` generates temp SIP credentials via Telnyx API
  - Rate limiting: 2 calls per IP, 60-second max call duration
  - Auto-hangup timer, connection logs, Speechcue branding (no Telnyx mention)
  - All tests passed (100% backend + frontend)

### Key Files
- `/app/frontend/src/pages/PhoneTestPage.js` - SIP test page React component
- `/app/frontend/src/App.js` - React router
- `/app/js/phone-test-routes.js` - Backend credential generation + rate limiting
- `/app/js/voice-service.js` - Telnyx voice call handling
- `/app/backend/server.py` - FastAPI proxy server

## Prioritized Backlog

### P1 - Upcoming
- Update Telegram bot SIP guide with link to test page

### P2 - Cleanup
- Remove old `SipTest.js` and `/api/sip-test-credentials` endpoint (redundant)
- Remove unused `SipTest.js` page file

### P3 - Future
- Production domain setup (`speechcue.com/phone/test`)
- Analytics dashboard for test call usage
