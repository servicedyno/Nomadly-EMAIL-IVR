# Speechcue Cloud Phone - PRD

## Original Problem Statement
Set up and configure a multi-service application (Telegram bot + Telnyx voice/SIP + FastAPI backend + React frontend). Build a public-facing SIP test page branded as "Speechcue" with Telegram OTP gating, referral system, and abuse prevention.

## Architecture
- **Frontend:** React (port 3000) with Tailwind CSS and @telnyx/webrtc
- **Backend:** FastAPI (port 8001) acting as reverse proxy to Node.js Express (port 5000)
- **Node.js:** Telegram bot + Telnyx voice service + SIP test credentials API
- **Database:** External MongoDB
- **Routing:** Kubernetes ingress routes `/api/*` to FastAPI, all other routes to React frontend

## What's Been Implemented

### Completed
- [x] Environment setup with all API keys in `backend/.env`
- [x] Telegram bot running via supervisor
- [x] FastAPI reverse proxy to Node.js Express
- [x] SIP call routing fix in `voice-service.js`
- [x] **Speechcue SIP Test Page** (Feb 2026)
  - React component at `/phone/test`
  - Telegram OTP authentication via `/testsip` command
  - Rate limiting by chatId: 2 base calls + 1 referral bonus (max 3)
  - 60-second auto-disconnect for test calls
  - "Free Test" and "My Credentials" tabs
- [x] **Refer-a-Friend System** (Feb 2026)
  - When test limit reached, bot generates referral link: `t.me/Nomadlybot?start=ref_XXXX`
  - New user joining via link triggers +1 bonus call for referrer
  - Max 1 bonus per referrer (total max = 3 calls)
  - Deep link handling in `/start ref_` command
- [x] **SIP Guide Updated** — `phone-config.js` softphoneGuide includes speechcue.com/phone/test link + `/testsip` mention
- [x] **Cleanup** — Removed old `SipTest.js`, `/api/sip-test-credentials` endpoint, unused imports
- [x] **server.py cleaned up** — Pure proxy, no redundant endpoints

### Key Files
- `/app/frontend/src/pages/PhoneTestPage.js` - SIP test page with OTP flow
- `/app/frontend/src/App.js` - React router
- `/app/js/phone-test-routes.js` - OTP + referral + credential logic
- `/app/js/phone-config.js` - SIP guide with test page link
- `/app/js/_index.js` - Bot handlers: `/testsip`, `/start ref_`
- `/app/js/voice-service.js` - Telnyx voice call handling
- `/app/backend/server.py` - FastAPI proxy server

### MongoDB Collections
- `testOtps` - OTPs with chatId + TTL index (5 min expiry)
- `testCredentials` - SIP creds linked to chatId
- `testReferrals` - Referral codes, referrer chatId, bonus tracking

## Prioritized Backlog

### P3 - Future
- Production domain DNS setup (`speechcue.com` → app)
- Test call analytics dashboard
- Multi-language support for test page
