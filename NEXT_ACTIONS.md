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

### ✅ Fix FR "plan subscribed" glitch (pre-existing) — DONE 2025-07
`fr.t.planSubscribed` in `js/lang/fr.js` had escaped `\${SMS_APP_NAME}` / `\${SMS_APP_LINK}`
inside a template literal, so French users saw the raw text. Removed the backslashes
(lines 385 & 392) so they interpolate like every other locale. Verified by rendering
`t.planSubscribed` → now shows the brand name + real download link. Node reloaded.

### ☐ Fix `vs_*` voice-notification interpolation (pre-existing, ALL 4 locales) — NEW, found 2025-07
The ~26 `vs_*` call/voice notification functions in `js/lang/{en,fr,zh,hi}.js` escape their
`${param}` placeholders (e.g. `vs_outboundCallFailed: (from,to,reason) => \`... \${from} → \${to} ...\``).
`translation.js` calls them as `value(...args)` with NO second-pass `${}` replacement, so they
render literal `${from} → ${to}` instead of the actual numbers/amounts. Confirmed empirically.
- **Fix**: remove the backslash before each `${...}` in the `vs_*` entries across all 4 locales
  (unescape ~100+ placeholders), then verify a sample of each renders real values.
- **Scope/risk**: touches live voice/call/SMS-overage notifications — test before shipping.

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
