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

## 2026-06 (fork) — Phase 2 structural conversion enhancements
Approved audit items executed (all verified via custom Node suites + testing_agent iteration_47/48):
- ✅ #16 Order Resume, #22 Early Floors, #19 First-Purchase Bundle, #17 First-Session Intent Funnel (prior turns).
- ✅ #18 Lifecycle Diet + Mute + Lift Metric — `js/lifecycle-diet.js` shared throttle (1/24h cap on marketing, <72h welcome-window suppression, active-balance-wall pause, cart-nudge mute button, per-blast /start+hub-tap lift into `promoStats` with zero-lift admin alert). Wired into AutoPromo, cart-abandonment, new-user-conversion, low-balance & day-12 nudges.
- ✅ #21 Localization Parity — per-locale reverse DNS record-type map (fixed a real FR/ZH/HI DNS-add breakage where `t[recordType]` was undefined), translated `dnsProxiedChoice*` + `vp.vpsSshBlockedHelp` into FR/ZH/HI, and a global `/language` + 🌍 Change Language handler that works from any state.
- ✅ VPS credentials copy: `vpsBoughtSuccess` readiness note min→minutes in en/fr (locale parity).
- New tests: `js/tests/test_lifecycle_diet_2026-06.js` (24), `test_promo_lift_metric_2026-06.js` (13), `test_localization_parity_2026-06.js` (79). Regression: quickwins 82, all Phase 2 + i18n suites green.

## 2026-09-16 (fork) — Git commit blocker fixed
- Platform auto-commit was failing (`git add failed: ... ignored ... .env`) because `/app/.env` existed as a gitignored symlink → `backend/.env`; git literally matches an ignored root `.env` against the platform's `':(exclude).env'` pathspec → exit 1.
- Fixed: symlink removed; `js/config-setup.js` loads `[cwd/.env, ../backend/.env]`; `scripts/setup-nodejs.sh` + `scripts/vault.sh` no longer create it; 5 tests point at `/app/backend/.env`. Staging rc=0, nodejs healthy, all suites green. **Never create a root `/app/.env` again.**

## 2026-09-16 (fork) — Hosting checkout usability (user-approved 5/5)
Hosting purchase went from 9–10 screens to **4 taps** (menu → plan → domain → email/skip → 1-tap pay). New module `js/hosting-checkout-ux.js` (pure copy/keyboard/parsers, 4 locales) + wiring in `js/_index.js`:
- ✅ #1 Plan menu = comparison card with prices, durations, specs, ⭐ Most popular (`submenu3` → `hcx.planMenuText`). Buttons unchanged.
- ✅ #2 Buy screen removed — domain options live on the plan-details screen; user's hostable owned domains listed inline as `📂 example.com` (max 3, excludes domains already on an active `cpanelAccounts` plan). `buyPlan` is now an alias; `currentPlanAction()` fixes the old "Back always downgraded to Premium Weekly" bug. New `goto.selectOwnedDomain`.
- ✅ #3 Email step: no "Use this email?" confirm screen, ↩️ Back button, `✅ Use last@email` 1-tap (`state.lastOrderEmail`).
- ✅ #4 Invoice shows wallet balance; first button `👛 Pay $X from Wallet` (charges via `walletOk['hosting-pay']`, no Yes/No) or `💵 Deposit $short` (pre-fills amount + saves Order-Resume session). Loyalty applied once via `applyHostingLoyaltyOnce` (guarded by `preLoyaltyPrice`, reset in `proceedWithEmail`). Fixed: wallet confirm/resume screens showed the *domain* price instead of total for hosting; coupon Skip/apply no longer trips the 30s payment lock.
- ✅ #5 Domain taken → `checkAlternativeTLDs` (12s race) → tappable `🌐 name.sbs — $30` buttons, hosting-friendly TLDs ranked first; tapping re-runs the normal check.
- Bonus: `user.freeTrial` → `goto.freeTrial()` (was calling `selectPlan('freeTrial')` which throws); `connectExternalDomain` input validated with `isDomainLike` (previously accepted anything containing a dot).
- **DEV-only** `POST /dev/hosting-flow-sim` (404 in prod): seeds a synthetic chat (wallet/domains/lastEmail), feeds taps through the REAL handler via `bot.processUpdate`, captures replies for that chat only, refuses payment-confirming taps. Body: `{chatId, seed:{usdBal,domains,lastOrderEmail,lang,keep}, steps:[...], settleMs, cleanup}`.
- Tests: `js/tests/test_hosting_checkout_ux_2026-06.js` (101). Regression: nav_mainmenu_escape 109, quickwins 82, wallet_no_stale_charge 18, localization_parity 79 — all green. Live sim verified: owned-domain path, insufficient→Deposit→coin picker+resume session, typed/invalid email, coupon skip, Golden Back routing, register-new → taken → alternatives → tap → invoice $60 (domain+hosting), external-domain validation.

## 2026-09-16 (fork) — Domain checkout parity
- `goto['domain-pay']` now shows the wallet balance line and the same 1-tap `👛 Pay $X from Wallet` / `💵 Deposit $short` keyboard as hosting; Deposit saves an Order-Resume session (`flowType: domain-purchase`). Shared closure helpers in `_index.js`: `applyCheckoutLoyaltyOnce(step)` (price for domain / totalPrice for hosting), `checkoutWalletView(step, total, label)`, `startCheckoutDeposit(step, amount)`. `walletSelectCurrency` skips loyalty re-application for both steps. Legacy `👛 Wallet` tap still works for stale keyboards.
- Suite now 109 assertions; live sim: domain search → No → invoice w/ balance → coupon Skip → Back → re-invoice, and $15 balance → `💵 Deposit $24` → coin picker + resume session `{price:39, step:'domain-pay'}`.

## 2026-09-16 (fork) — Unified checkout layer (Cloud IVR, digital products, VPS, vCard, shortener plan, leads, bundles)
Every "choose payment method" screen now renders through one closure layer in `_index.js` (`checkoutOrder` → `checkoutWalletView` → `checkoutScreen`; taps via `hcx.parseCheckoutTap` → `runCheckoutTap` → `walletOk[key]`):
- Screens converted: `phone-pay` (Cloud IVR — **order summary + payment merged into one screen**, the "✅ Proceed to Payment" hop is gone; legacy `cpOrderSummary` forwards), `digital-product-pay` (keeps 💬 Ask Question), `virtual-card-pay`, `vps-plan-pay`, `vps-upgrade-plan-pay`, `plan-pay`, `leads-pay` (walletOk key = buyLeads/validator), `bundleConfirm` (wallet-only — no crypto/bank handlers exist), Cloud IVR plan-upgrade (`cpUpgradePayRows`, inline handler). Email Blast already had 1-tap; targeted leads has its own deposit CTA — both untouched.
- `checkoutOrder(step)` is the single price source mirroring each walletOk read (cpPrice / dpPrice / vcAmount+fee / vpsDetails / bundlePrice / price / totalPrice). Legacy `walletSelectCurrency` + `walletSelectCurrencyConfirm` (Order Resume) now display exactly that — fixes the old confirm screen showing a **stale `info.price` from a previous flow** for phone/digital/vcard/VPS (also caused by un-awaited `set(lastStep)`; step is now derived from the live action).
- Loyalty: prices at rest are undiscounted; `applyCheckoutLoyaltyOnce` mutates the charged field transiently at Pay-tap/Resume (identity-guarded → no compounding), `restoreLoyaltyMutation` undoes it on any invoice re-render. Only steps whose walletOk honours price/newPrice/totalPrice are eligible (`CHECKOUT_LOYALTY_STEPS`: plan/domain/hosting/leads/red). **Decision point for owner:** phone / digital / vcard / VPS / bundle charge fixed fields, so no tier discount is shown or applied there (previously a discount was *displayed* but the full price charged).
- Fixed along the way: Cloud IVR coupon handler was missing (`askCoupon + 'cpOrderSummary'` → codes silently ignored) — now discounts `cpPrice` in place with `cpPriceBase` for the strikethrough; bundle wallet tap was unhandled (k.pay → nothing); bundle price subtracted a stale `loyaltyDiscount`; bundle/cp state reset on fresh selection; global `💵 Deposit $N` matcher now routes through `startCheckoutDeposit` so lastStep is preserved for resume.
- Verified live via `/dev/hosting-flow-sim` (`seed.state` deep-seeding): Cloud IVR summary+pay → coupon STA158 → $46.75 → Deposit $17 → coin picker + resume `{price:46.75, step:'phone-pay'}`; bundle wallet-only deposit; digital legacy Wallet tap shows $80 (not stale $12); vCard $170 short → Deposit $70; plan-pay; leads $40 1-tap; Gold user domain: $35.10 button, no compounding on No, price restored to $39 on Back. Suite: 143 assertions + 12 regression suites green.

## 2026-09-16 (fork) — GitHub Actions `lint` workflow fixed (was MODULE_NOT_FOUND)
- Root cause: `scripts/check_lang_parity.js`, `scripts/check_panel_lang_parity.js`, `scripts/lint_async_in_if.js` hardcoded `/app/...`; the runner checks out at `/home/runner/work/<repo>/<repo>` → `require('/app/js/lang/en.js')` → MODULE_NOT_FOUND. All three now use `path.resolve(__dirname, '..')`.
- Second latent failure: `lint-lang` job had no install step but `js/lang/plan-copy.js` requires `dotenv` → added `npm install dotenv --no-save` step. Job now also runs `check_panel_lang_parity.js`.
- Panel locale drift fixed: 16 `store.*` keys (Storefront pricing/trust/login copy) added to `frontend/src/locales/{fr,hi,zh}.json`; `npm run lint:lang` green.
- Verified: both jobs simulated at `/tmp/runner/work/repo` with only the YAML-installed deps → rc=0; FR storefront renders all new keys, no raw `store.*` leaks; i18n suites 79/79 + 26/26.
- **Rule:** scripts under `scripts/` must never hardcode `/app` — CI runs elsewhere.


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
