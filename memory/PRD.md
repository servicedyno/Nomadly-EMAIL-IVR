# PRD — Nomadly Cloud IVR + Telegram Bot

## Original problem statement (this fork session, Feb 2026)
User inherited a fully-set-up Nomadly bot pod pointed at LIVE PRODUCTION. Task became: mine Railway production logs, identify complaints from real users (starting with @blacknmilds), find root causes, and ship fixes.

## Architecture (unchanged from previous fork)
- React frontend (port 3000)
- FastAPI proxy (port 8001) — forwards `/api/*` to Node
- **Node.js Express + Telegram Bot API** (port 5000) — most business logic lives here
- MongoDB (LIVE PRODUCTION via Railway `mongo:...@roundhouse.proxy.rlwy.net:52715`)
- Railway CLI in sandbox (`/opt/node22/bin/railway` + `RAILWAY_TOKEN=API_KEY_RAILWAY` from .env) — grants read access to production `Nomadly-EMAIL-IVR` service logs.

## Guardrails (never touch)
- `BOT_ENVIRONMENT="production"` in `/app/backend/.env`
- `SKIP_WEBHOOK_SYNC="true"` — critical safeguard preventing the sandbox from hijacking the production Telegram webhook

## What was implemented in this Feb 2026 fork
See CHANGELOG.md for the running log. High-level list:
- ✅ WAV → MP3 auto-transcode at upload time (`audio-library-service.js`)
- ✅ Audio-proxy Content-Type derived from file extension for legacy WAVs already in `ivrAudioStore`
- ✅ Bulk IVR NANP normalization (10-digit paste → `+1XXXXXXXXXX`, was `+40…` = Romania)
- ✅ AI Support KB disambiguates Quick IVR (TTS) vs Bulk IVR (uploaded audio); NANP fix documented
- ✅ `editMessageText "message can't be edited"` fallback spam — terminal-error short-circuit + per-session log dedup + streaming short-circuit
- ✅ VPS deletion spam — Contabo "already been canceled" now treated as idempotent success; admin alert throttled to ≥6h with 10-retry hard-stop; `Auto-Deleted` post skipped for no-op cycles

## 2026-09-14 — User-journey / conversion audit (analysis only, no bot changes)
- Report: `/app/memory/USER_JOURNEY_AUDIT_2026-09-14.md` (exec summary, journey map, pain-point register, ranked recs, 30-day plan)
- Data: read-only 7-day Railway log sample in `/app/investigations/journey7d/` via `ops/railway_journey_pull.js`; analysis `ops/journey_funnel_analysis.py`
- Headline: 36 new users → 1 deposit, 0 purchases; VPS checkout 8/8 failed (Contabo invalid_client); social proof is seeded random; `markPurchased` fires before balance check (kills recovery nudges); no order resume after top-up; 10k promos/week with zero /start lift; 0/30 welcome coupons redeemed.

## 2026-06 (fork) — 11 approved Quick Wins IMPLEMENTED + VERIFIED
Implemented fixes #1,#3,#4,#5,#6,#7,#8,#9,#10,#11,#12 from the audit (skipped #2 + VPS bug per user).
Verified by testing_agent iteration_46: Node suite `js/tests/test_quickwins_2026-09.js` = **82/82 pass**; live `POST /api/dev/support-routing-test` = pass:true; nodejs healthy; zero regressions.
- #1 purchased-flag ordering — `_finalizeWalletPurchase()` fires after a successful charge (`_index.js`)
- #3 single price source — overage/forwarding rate read from env in `monetization-engine.js` (matches `phone-config.js`); `$0.04` copy removed
- #4 cart-nudge copy — dead `/menu → Daily Coupon` replaced by live coupon line + `t.me/?start=open_<hub>` deep link (`cart-abandonment.js`)
- #5 pre-filled balance wall — `getInsufficientBalanceMessage` (`improved-messages.js`) + `💵 Deposit $N` tap jumps to coin/method picker (`_index.js`)
- #6 actionable underpayment — `sentLessMoney` rewritten + main-menu keyboard on all sends (lang/*.js, `_index.js`)
- #7 trial → Pro CTA — `TRIAL_PRO_CTA` after /testsip pre-selects Pro + surfaces welcome coupon (`_index.js`)
- #8 hosting total line — `generateDomainFoundText(...total...)` shows plan+domain=Total today (lang/*.js, `_index.js`)
- #9 domain shortener prompt — reworded to recommend register-first (lang/*.js)
- #10 menu hierarchy — row 1 = Cloud IVR + Hosting; Refer & Earn/Marketplace pushed down (lang/*.js)
- #11 typed-text → AI support — help/trouble intents routed via `isColdSupportQuestion` (`_index.js`; live check `/api/dev/support-routing-test`)
- #12 welcome-offer deep link — links to most-browsed hub via `buildWelcomeCta`/`HUB_DEEPLINKS` (`new-user-conversion.js`, `_index.js`)

## Prioritized backlog (P0/P1/P2)
### P0 (from 2026-09-14 audit)
- ✅ DONE — move `markPurchased`/`recordPaymentCompleted` after a successful charge (audit #3 / fix #1)
- ✅ DONE — single price source + cart-nudge copy (audit #4/#5 → fixes #3/#4)
- OPEN — Hide/fix VPS until Contabo creds valid; auto-ticket on provisioning failure (Contabo `invalid_client`, 100% VPS checkout failure). Explicitly skipped by user for now.
- OPEN — Replace seeded social proof with real counts (Quick Win #2, skipped). `new-user-conversion.js:694-700`.

### P1
- _(none open — all P1s from BLACKNMILDS_CLOUDIVR_COMPLAINTS have been fixed)_

### P2
- **Bulk IVR $50 minimum-balance surfacing** — currently only errors at Launch after 6 form steps. Surface at Bulk IVR entry screen or block flow at "Select Caller ID" when wallet < $50.
- **Root-cause investigation for the underlying "message can't be edited" error** — resilience is now in place, but Telegram is still returning this on every reply. Instrumentation exists (log dedup shows the real error message once per session), next step is to see what makes the placeholder uneditable (suspected: interaction between `parse_mode=HTML` on very short italic-only placeholders + `reply_markup` with `ReplyKeyboardMarkup`).
- **File modularization** — `js/_index.js` is 48,983 lines. Testing-agent flagged this in iteration 45 (not blocking, but a scale/maintenance concern).

## Test files (running suite)
- `/app/backend/tests/test_blacknmilds_fixes.js` — WAV+NANP fixes (5 assertions)
- `/app/backend/tests/test_support_reply_fixes.js` — KB + fallback dedup source patterns
- `/app/backend/tests/test_deliver_final_reply.js` — 7 runtime scenarios of `deliverFinalReply`
- `/app/backend/tests/test_vps_delete_idempotent.js` — 6 tests for VPS delete idempotency + throttle math (testing-agent iteration 45)

## Reference documents
- `/app/memory/BLACKNMILDS_CLOUDIVR_COMPLAINTS_2026-02.md` — full investigation report with railway log excerpts and file:line pointers for each fix
- `/app/investigations/rl_prod_5k.log` — 5000-line prod log snapshot used for initial investigation
- `/app/investigations/rl_prod_vps.log` — 3000-line prod log snapshot showing the VPS deletion spam pattern
