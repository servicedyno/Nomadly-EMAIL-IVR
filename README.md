# Nomadly — Telegram Bot + Cloud Phone Platform

Multi-service application: Telegram bot, Telnyx/Twilio voice/SIP, FastAPI backend, React frontend.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Kubernetes Ingress                     │
│  /api/*  →  FastAPI (8001)  →  Node.js Express (5000)    │
│  /*      →  React Frontend (3000)                        │
└──────────────────────────────────────────────────────────┘
```

| Service           | Port  | Role                                               |
|-------------------|-------|----------------------------------------------------|
| React Frontend    | 3000  | UI — SIP test page, admin panel                    |
| FastAPI Backend   | 8001  | Reverse proxy to Node.js + CORS                   |
| Node.js Express   | 5000  | Core business logic: Telegram bot, webhooks, APIs  |
| MongoDB           | 27017 | Local instance (also connects to external Railway) |

### Request Flow
1. All requests hit the Kubernetes ingress
2. Paths starting with `/api/` → FastAPI on port 8001
3. FastAPI strips `/api/` prefix and proxies to Node.js Express on port 5000
4. All other paths → React frontend on port 3000

---

## ⚡ Quick Setup (Emergent Agent)

**Run this ONE command after any fresh deployment:**

```bash
bash /app/scripts/setup-nodejs.sh
```

This script handles everything:
- Detects current pod URL from `frontend/.env`
- Updates `SELF_URL` / `SELF_URL_PROD` to `<pod_url>/api`
- Creates `.env` symlink so Node.js reads `backend/.env`
- Installs Node.js dependencies (`yarn install`)
- Creates supervisor config for Node.js
- Starts the Node.js process

---

## Environment Variables

### Protected (NEVER modify)
- `frontend/.env` → `REACT_APP_BACKEND_URL` (set by platform)
- `backend/.env` → `MONGO_URL` (database connection)

### Webhook Configuration
- `SELF_URL` and `SELF_URL_PROD` in `backend/.env` **MUST** use the current pod URL with `/api` suffix
- The setup script auto-detects this from `REACT_APP_BACKEND_URL`
- Example: `https://webrtc-call-handler.preview.emergentagent.com/api`

### Key API Credentials (in backend/.env)
| Variable | Service |
|----------|--------|
| `TELNYX_API_KEY` | Telnyx voice/SIP/SMS |
| `TELNYX_SIP_CONNECTION_ID` | SIP connection |
| `TELNYX_MESSAGING_PROFILE_ID` | SMS messaging |
| `TELNYX_CALL_CONTROL_APP_ID` | Call control |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Twilio backup |
| `TELEGRAM_BOT_TOKEN_PROD` | Telegram bot |
| `API_KEY_RAILWAY` | Railway deployment |
| `CLOUDFLARE_API_KEY` | DNS management |
| `FINCRA_*` | Payment processing |
| `BREVO_API_KEY` | Email service |

---

## File Structure

```
/app/
├── backend/
│   ├── .env              ← All environment variables (single source of truth)
│   └── server.py         ← FastAPI reverse proxy to Node.js
├── frontend/
│   ├── .env              ← REACT_APP_BACKEND_URL (platform-managed)
│   └── src/
│       └── pages/
│           └── PhoneTestPage.js  ← SIP test page
├── js/                   ← Node.js Express application
│   ├── _index.js         ← Main entry: Express routes + Telegram bot
│   ├── start-bot.js      ← Startup with config-setup
│   ├── config-setup.js   ← Environment detection + defaults
│   ├── config.js         ← App configuration
│   ├── db.js             ← MongoDB connection
│   ├── voice-service.js  ← Telnyx voice/SIP/IVR handling
│   ├── sms-service.js    ← SMS service with limits + overage
│   ├── telnyx-service.js ← Telnyx API wrapper
│   ├── twilio-service.js ← Twilio API wrapper
│   ├── cnam-service.js   ← CNAM lookup (Telnyx→Multitel→SignalWire)
│   ├── phone-test-routes.js ← SIP test OTP + credentials
│   ├── lead-job-persistence.js ← Lead job crash recovery
│   └── ...               ← Domain, hosting, payment services
├── scripts/
│   └── setup-nodejs.sh   ← Automated deployment setup
├── .env                  ← Symlink → backend/.env (for Node.js dotenv)
├── package.json          ← Node.js dependencies
└── memory/
    └── PRD.md            ← Product requirements + deployment docs
```

---

## Supervisor Services

| Program   | Config File | Command |
|-----------|-------------|---------|
| backend   | `supervisord.conf` (readonly) | `uvicorn server:app --port 8001` |
| frontend  | `supervisord.conf` (readonly) | `yarn start` (port 3000) |
| mongodb   | `supervisord.conf` (readonly) | `mongod --bind_ip_all` |
| **nodejs** | `supervisord_nodejs.conf` | `node js/start-bot.js` |

```bash
# Check all services
sudo supervisorctl status

# Restart individual service
sudo supervisorctl restart nodejs
sudo supervisorctl restart backend

# View Node.js logs
tail -f /var/log/supervisor/nodejs.out.log
tail -f /var/log/supervisor/nodejs.err.log
```

---

## MongoDB Collections

| Collection | Purpose |
|------------|--------|
| `testOtps` | SIP test OTPs (TTL 5 min) |
| `testCredentials` | SIP test creds per chatId |
| `testReferrals` | Referral codes + bonus tracking |
| `leadJobs` | Lead generation job persistence |
| `phoneNumbersOf` | User phone number assignments |
| `phoneLogs` | Call/SMS usage logs |

---

## Troubleshooting

### Node.js not running
```bash
bash /app/scripts/setup-nodejs.sh
```

### Webhooks not working
1. Check SELF_URL matches current pod: `grep SELF_URL /app/backend/.env`
2. Must end with `/api` — e.g., `https://webrtc-call-handler.preview.emergentagent.com/api`
3. Re-run setup script to auto-fix: `bash /app/scripts/setup-nodejs.sh`

### 502 errors on /api/* routes
- Node.js Express (port 5000) is down
- Fix: `sudo supervisorctl restart nodejs`
- Check logs: `tail -n 50 /var/log/supervisor/nodejs.out.log`

### Environment variables not loading
- Verify symlink: `ls -la /app/.env` should point to `backend/.env`
- If missing: `ln -sf /app/backend/.env /app/.env`
