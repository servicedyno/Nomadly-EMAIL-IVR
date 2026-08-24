# White-Label Branding Guide

This platform is a **single-tenant white label**: every brand name, handle, logo,
colour and infrastructure host is driven by environment variables. Nothing changes
until you override a variable — the current brand (Nomadly / HostBay / SpeechCue)
is the built-in default everywhere.

There are two config surfaces, both env-driven with sensible fallbacks:

- **Backend / bot** — `js/branding.js` (reads `backend/.env`)
- **Frontend / web UI** — `frontend/src/branding.js` (reads `frontend/.env`, build-time)

After editing `.env`, restart the affected service:
`sudo supervisorctl restart nodejs` (bot) and/or `sudo supervisorctl restart frontend` (web UI).

---

## 1. Backend / bot brand (`backend/.env`)

| Variable | Controls | Current default |
|---|---|---|
| `CHAT_BOT_BRAND` | Main brand name shown in bot copy, AI support, promos, welcome bonus | `Nomadly` |
| `CHAT_BOT_NAME` | Bot display name | `Nomadly Bot` |
| `CHAT_BOT_USERNAME` | Bot @username used in SMS-app messages (e.g. `MyBot` → `@MyBot`) | `@NomadlyBot` |
| `SMS_APP_NAME` | Name of the Android BulkSMS app | `Nomadly BulkSMS App` |
| `BRAND_PHONE_NAME` | Cloud-phone sub-brand (promos) | `SpeechCue` |
| `SUPPORT_HANDLE` | Primary support Telegram handle | `@onarrival1` |
| `SUPPORT_HANDLE_2` | Secondary / group support handle (promo footers) | `@Hostbay_support` |
| `APP_SUPPORT_LINK` | Support t.me link | `https://www.t.me/nomadlysupport` |
| `TG_CHANNEL` / `TG_HANDLE` | Community channel link + handle | `https://t.me/Hostbay` / `@Hostbay` |
| `PANEL_DOMAIN` | Hosting panel host | `panel.1.hostbay.io` |
| `SIP_DOMAIN` | SIP server host | `sip.speechcue.com` |
| `CALL_PAGE_URL` | Browser call page | `https://1.speechcue.com/call` |
| `BRAND_NAMESERVERS` | Internal nameservers (comma-separated), referenced in AI support | `ns1.hostbay.io,ns2.hostbay.io` |
| `BRAND_LOGO_URL` | (optional) logo image URL exposed via `/api/branding` | *(empty)* |

`GET /api/branding` returns the public (non-secret) subset for the frontend.

## 2. Frontend / web UI brand (`frontend/.env`)

| Variable | Controls | Current default |
|---|---|---|
| `REACT_APP_BRAND_NAME` | Brand name in admin UI | `Nomadly` |
| `REACT_APP_BRAND_BOT_NAME` | Header/footer bot name | `NomadlyBot` |
| `REACT_APP_BRAND_BOT_USERNAME` | Telegram deep-link username | `Nomadlybot` |
| `REACT_APP_BRAND_TAGLINE` | Tagline | `Bot Analytics` |
| `REACT_APP_BRAND_POWERED_BY` | Footer "Powered by" | `Speechcue` |
| `REACT_APP_BRAND_SUPPORT` | Support handle | `@onarrival1` |
| `REACT_APP_BRAND_COLOR` | Accent colour | `#34d399` |
| `REACT_APP_BRAND_PANEL_NAME` | Hosting-panel brand (login, storefront, page title) | `HostBay` |
| `REACT_APP_BRAND_PHONE_NAME` | Cloud-phone brand | `Speechcue` |
| `REACT_APP_PANEL_DOMAIN` | Panel host used for landing-page routing | `panel.hostbay.io` |
| `REACT_APP_BRAND_LOGO_URL` | **Logo image URL** (see below) | *(empty)* |
| `REACT_APP_BRAND_FAVICON_URL` | **Favicon image URL** (browser tab icon) | *(empty)* |

The page title / meta description in `frontend/public/index.html` are built from
`%REACT_APP_BRAND_PANEL_NAME%` at build time.

### Adding your own logo & favicon (no code change)
1. Upload your logo/favicon somewhere public (S3, your CDN, Cloudinary, etc.) and copy the direct image URL.
2. In `frontend/.env` set:
   ```
   REACT_APP_BRAND_LOGO_URL=https://your-cdn.com/logo.png
   REACT_APP_BRAND_FAVICON_URL=https://your-cdn.com/favicon.png
   ```
3. `sudo supervisorctl restart frontend`.

The logo automatically appears in the admin header, the storefront, and the hosting-panel
login (falling back to the brand initial / built-in mark when no URL is set). The favicon is
applied at runtime.

---

## 3. Real-world go-live checklist (outside the code)
These are operational steps to fully stand up a new brand — no code edits required:

1. **Telegram bot** — create a new bot via **@BotFather**, set `TELEGRAM_BOT_TOKEN_PROD`
   (+ `CHAT_BOT_USERNAME`) and the admin/notify chat IDs.
2. **Domains / DNS** — point `PANEL_DOMAIN`, `SIP_DOMAIN`, `CALL_PAGE_URL` at your own
   hosts and publish your own `BRAND_NAMESERVERS`.
3. **Support** — set `SUPPORT_HANDLE`, `SUPPORT_HANDLE_2`, `APP_SUPPORT_LINK`,
   `TG_CHANNEL`, `TG_HANDLE`.
4. **Legal / registrant** — update the registrant / company env vars (AU_*, SINGAPORE_*)
   to your own entity if you register domains.
5. **Assets** — set the logo/favicon URLs (section 2 above).
