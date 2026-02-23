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

## ⚡ CRITICAL — Emergent Agent Deployment Setup

**On every fresh deployment, the agent MUST run this setup script FIRST before any other work:**

```bash
bash /app/scripts/setup-nodejs.sh
```

### What the setup script does:
1. **Detects current pod URL** from `REACT_APP_BACKEND_URL` in `frontend/.env`
2. **Updates `SELF_URL` and `SELF_URL_PROD`** in `backend/.env` to `<pod_url>/api` (required for Telnyx/Telegram webhooks)
3. **Creates `.env` symlink** — `/app/.env` → `/app/backend/.env` (Node.js `dotenv` loads from `/app`)
4. **Installs Node.js dependencies** — `yarn install` in `/app`
5. **Creates supervisor config** for Node.js at `/etc/supervisor/conf.d/supervisord_nodejs.conf`
6. **Starts Node.js Express server** on port 5000 via supervisor

### Why this is needed:
- The FastAPI backend (`server.py`) is a **reverse proxy** that forwards all `/api/*` requests to Node.js Express on port 5000
- Without the Node.js server running, **all API calls return 502**
- The Node.js process is NOT in the default supervisor config (it's created by the setup script)
- `SELF_URL` must match the current pod URL for webhooks to reach the server

### Manual setup (if script fails):
```bash
# 1. Symlink .env
ln -sf /app/backend/.env /app/.env

# 2. Update SELF_URL in backend/.env to current pod URL + /api
# Example: SELF_URL=https://webrtc-call-handler.preview.emergentagent.com/api

# 3. Install deps
cd /app && yarn install

# 4. Create /etc/supervisor/conf.d/supervisord_nodejs.conf:
#    [program:nodejs]
#    command=node js/start-bot.js
#    directory=/app
#    autostart=true
#    autorestart=true
#    stderr_logfile=/var/log/supervisor/nodejs.err.log
#    stdout_logfile=/var/log/supervisor/nodejs.out.log

# 5. Start
sudo supervisorctl reread && sudo supervisorctl update
sudo supervisorctl restart nodejs
```

### Verifying deployment:
```bash
# All 4 services should be RUNNING
sudo supervisorctl status

# Check Node.js started correctly
tail -n 30 /var/log/supervisor/nodejs.out.log

# Verify webhooks use current pod URL
grep "Voice webhook:" /var/log/supervisor/nodejs.out.log
```

---

## What's Been Implemented

### Completed
- [x] Environment setup with all API keys in `backend/.env`
- [x] Telegram bot running via supervisor
- [x] FastAPI reverse proxy to Node.js Express
- [x] SIP call routing fix in `voice-service.js`
- [x] **SIP Credential Revert** — Removed 6-digit PIN system, reverted to Telnyx `gencred...` credentials
- [x] **Outbound SIP Call Fix** — Fixed ANI Override misconfiguration on Telnyx SIP Connection
- [x] **Billing Logic Overhaul** — Fixed zero-minute billing for SIP calls, correct billing notifications
- [x] **Inbound Call UI** — WebRTC page handles incoming calls with Answer/Reject overlay
- [x] **Domain Management Fix** — Corrected Cloudflare zone creation for user-owned domains
- [x] **Tap-to-Copy SIP Username** — Made SIP username copyable in Telegram bot messages
- [x] **Inbound Call Disconnect Fix (Feb 2026)** — Fixed 3 issues: (1) Ring leg now uses correct SIP Connection ID, (2) Removed `webhook_url: null` from API calls, (3) Added bridge transfer check to prevent outbound handler from interfering with ring legs
- [x] **Speechcue SIP Test Page** — React at `/phone/test`, OTP via `/testsip`, 2 calls + 1 referral bonus
- [x] **Refer-a-Friend** — Referral deep links `t.me/Nomadlybot?start=ref_XXXX`, +1 bonus call
- [x] **Subscribe-to-plan messaging** — After using test calls, `/testsip` directs to Cloud Phone plan
- [x] **Main menu SIP discovery** — Greeting shows "Try SIP calling free" for new users + keyboard button "🧪 Test SIP Free" in all 4 languages (en/hi/fr/zh)
- [x] **SIP guide updated** — `phone-config.js` includes speechcue.com/phone/test + `/testsip`
- [x] **Cleanup** — Removed `SipTest.js`, `/api/sip-test-credentials`, unused imports
- [x] **CNAM fix** — Wired Telnyx CNAM into bulk lead generation (Telnyx → Multitel → SignalWire)
- [x] **Lead job persistence** — Jobs saved to MongoDB, SIGTERM flush, partial result delivery
- [x] **SIP webhook race condition** — Event buffer for out-of-order call events
- [x] **Node.js deployment setup** — Automated script, supervisor config, .env symlink

### Key Files
- `/app/frontend/src/pages/PhoneTestPage.js` - SIP test page
- `/app/js/phone-test-routes.js` - OTP + referral + credential logic
- `/app/js/_index.js` - Bot handlers: `/testsip`, Test SIP Free button, `/start ref_`, main menu greeting
- `/app/js/lang/{en,hi,fr,zh}.js` - All languages have testSip button + keyboard
- `/app/js/phone-config.js` - SIP guide with test page link
- `/app/js/voice-service.js` - Voice/SIP with event buffer for race conditions
- `/app/js/cnam-service.js` - CNAM lookup chain with cache
- `/app/js/lead-job-persistence.js` - Lead job crash recovery
- `/app/backend/server.py` - FastAPI reverse proxy to Node.js
- `/app/scripts/setup-nodejs.sh` - Automated deployment setup

### MongoDB Collections
- `testOtps` - OTPs with chatId + TTL (5 min)
- `testCredentials` - SIP creds linked to chatId, tracks callsMade
- `testReferrals` - Referral codes, bonus tracking
- `leadJobs` - Lead generation job persistence
- `phoneNumbersOf` - User phone number assignments
- `phoneLogs` - Call/SMS usage logs

## Prioritized Backlog

### P3 - Future
- Production DNS setup for `speechcue.com`
- Test call analytics dashboard
- Multi-language support for web test page
