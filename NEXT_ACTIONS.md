# Next Actions — White-Label Platform

Consolidated backlog of next steps after the white-label pass (backend + frontend + bot
in-chat copy in all 4 locales are now env-driven; see `BRANDING.md` for the full config reference).

Status legend: ☐ = not started · ◐ = partially done · ✅ = done

---

## P0 — Do next (highest value)

### ☐ Apply Your Brand (one-shot rebrand)
Flip the entire platform to a new brand by setting env vars — no code change.
- **What**: collect the new bot name, `@handle`, support handles, colours, domains and a logo URL.
- **Where**: `backend/.env` (`CHAT_BOT_BRAND`, `CHAT_BOT_NAME`, `CHAT_BOT_USERNAME`, `SMS_APP_NAME`,
  `BRAND_PHONE_NAME`, `SUPPORT_HANDLE`, `SUPPORT_HANDLE_2`, `PANEL_DOMAIN`, `SIP_DOMAIN`,
  `CALL_PAGE_URL`, `BRAND_NAMESERVERS`, `TG_CHANNEL`, `TG_HANDLE`) and `frontend/.env`
  (`REACT_APP_BRAND_*`, `REACT_APP_BRAND_LOGO_URL`, `REACT_APP_BRAND_FAVICON_URL`).
- **Then**: `sudo supervisorctl restart nodejs frontend`.
- **Trigger**: "Apply my brand: <name>, <@handle>, <logo url>, ..."

### ☐ Verify in Telegram (live end-to-end)
Confirm the rebranded menus/messages render correctly in an actual chat.
- **Blocker**: needs a SAFE dev bot token (the pod must NOT drive the live prod bot — dev guards
  `BOT_ENVIRONMENT=development` + `SKIP_WEBHOOK_SYNC=true` are in place).
- **Trigger**: provide a throwaway BotFather token → I'll drive `/start` and key flows.

---

## P1 — Nice to have soon

### ☐ Fix FR "plan subscribed" glitch (pre-existing)
`fr.t.planSubscribed` in `js/lang/fr.js` contains a literal `${SMS_APP_NAME}` inside a
single-quoted string, so it never interpolates (shows raw text to French users).
- **Fix**: concatenate `SMS_APP_NAME`/`BRAND` (mirror the other locales) or convert to a template literal.
- Unrelated to the white-label task; flagged during it.

### ☐ Brand API expansion
Expose more of the brand on `GET /api/branding` (`publicBranding()` in `js/branding.js`):
add `phoneBrand`, `botHandle`, `nameservers`, `logoUrl` so the storefront/panel can pull them
dynamically instead of relying on build-time `REACT_APP_*`.

### ☐ Brand preview tool (admin)
A small admin page that previews how the bot/web copy looks under a hypothetical brand before
going live (renders `serviceAd`, welcome bonus, promo footers with a temp brand string).

---

## P2 — Polish / future

### ☐ Neutral placeholder logo + favicon
Generate a clean, brand-agnostic logo + favicon set so a fresh brand looks polished on day one
before the reseller supplies real assets. Wire as the default `REACT_APP_BRAND_LOGO_URL`/favicon.

### ☐ Go-live checklist as guided setup
Turn the `BRANDING.md` §3 checklist (BotFather, DNS/NS, support handles, registrant entity,
assets) into a step-by-step guided flow / script for standing up a new reseller brand.

### ☐ Cosmetic: header-comment brand names
`js/branding.js`, several `js/*.js` and `js/lang/*.js` still say "Nomadly" in top-of-file
comments (developer-facing only, never shown to users). Optional cleanup for a pure fork.

---

## Reference — what's already DONE (white-label)
- ✅ `js/branding.js` (backend) + `frontend/src/branding.js` — single source of truth, env-driven.
- ✅ Backend copy: `auto-promo.js`, `ai-support.js`, `sms-app-service.js`, `monetization-engine.js`.
- ✅ Frontend: `index.html` title/description, App/PanelLogin/Storefront brand marks + logo/favicon hooks.
- ✅ Bot in-chat copy: `js/lang/{en,fr,zh,hi}.js` (all 4 locales).
- ✅ `GET /api/branding` endpoint (public subset).
- ✅ `BRANDING.md` — full env reference + logo how-to + go-live checklist.
- ✅ Sales & Profit dashboard (`/sales`, flat 30% margin) + CNAM billing fix (prior session).

_Note: all code changes reach production only after **Save to GitHub → Railway redeploy**._
