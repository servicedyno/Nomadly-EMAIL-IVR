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
- [x] **Speechcue SIP Test Page** — React at `/phone/test`, OTP via `/testsip`, 2 calls + 1 referral bonus
- [x] **Refer-a-Friend** — Referral deep links `t.me/Nomadlybot?start=ref_XXXX`, +1 bonus call
- [x] **Subscribe-to-plan messaging** — After using test calls, `/testsip` directs to Cloud Phone plan
- [x] **Main menu SIP discovery** — Greeting shows "Try SIP calling free" for new users + keyboard button "🧪 Test SIP Free" in all 4 languages (en/hi/fr/zh)
- [x] **SIP guide updated** — `phone-config.js` includes speechcue.com/phone/test + `/testsip`
- [x] **Cleanup** — Removed `SipTest.js`, `/api/sip-test-credentials`, unused imports

### Key Files
- `/app/frontend/src/pages/PhoneTestPage.js` - SIP test page
- `/app/js/phone-test-routes.js` - OTP + referral + credential logic
- `/app/js/_index.js` - Bot handlers: `/testsip`, Test SIP Free button, `/start ref_`, main menu greeting
- `/app/js/lang/{en,hi,fr,zh}.js` - All languages have testSip button + keyboard
- `/app/js/phone-config.js` - SIP guide with test page link
- `/app/backend/server.py` - Clean proxy server

### MongoDB Collections
- `testOtps` - OTPs with chatId + TTL (5 min)
- `testCredentials` - SIP creds linked to chatId, tracks callsMade
- `testReferrals` - Referral codes, bonus tracking

## Prioritized Backlog

### P3 - Future
- Production DNS setup for `speechcue.com`
- Test call analytics dashboard
- Multi-language support for web test page
