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

## 2026-09-16 — Cloud IVR production billing audit (Railway logs, 7d) + fixes F2/F3/F4- Full report: `memory/CLOUDIVR_BILLING_AUDIT_2026-09-16.md`. Log tooling: `ops/railway_billing_pull.js`, `ops/railway_grep_billing.js` (read-only, Railway GraphQL via `API_KEY_RAILWAY`).
- F2 fixed: `/twilio/voice-dial-status` billed $0 for months — `parseInt(chatId)` vs string `phoneNumbersOf._id`. Now `String()` + legacy fallback; bridge legs excluded (Telnyx leg bills them).
- F3 fixed: reconciler `altCallRef` (Telnyx leg) + master-account lookup for bridge rows → no more 560/589 false `no_charge`, no double-settle.
- F4 fixed: ghost "Twilio direct fallback" calls removed (`_abandonBridge`).
- F1 OPEN (P0 over-billing): mid-call timers deduct per minute AND hangup bills full minutes (`voice-service.js` L356/L3057/L3243). User deferred. Refund needs prod `walletLedger` query (in report).
- Tests: `js/tests/test_dial_status_billing_fix_2026-09.js`, `test_reconciler_altcallref_2026-09.js`, `test_no_ghost_direct_call_2026-09.js`; 9 existing SIP/billing suites + `/dev/reconciler-widen-test` + `/dev/call-reconciler-test` green.


## 2026-09-17 — 48h prod log audit + self-heal loop fixes
- Report: `memory/PROD_LOG_AUDIT_2026-09-17_48h.md`. Tooling: `ops/railway_48h_anomaly.js` (read-only). Payments/billing/Twilio/DB/bot all healthy; F2/F3/F4 billing fixes visibly working (all 161 "not billed" lines are correct bridge/transfer-leg exclusions).
- **FIXED (code)** — cPanel self-heal thrash on SUSPENDED accounts (ghrx51df, 38×/48h): `_repairCpPass` detects terminal WHM `/passwd` reasons (`_isTerminalPasswdReason`) and backs off `CPPASS_SUSPENDED_COOLDOWN_MIN` (6h) instead of retrying a rotation that can never succeed. Tests: `test_cpanel_suspended_selfheal_2026-09.js` 15/15.
- **QUIETED (code)** — Contabo auth spam (~200 lines/48h): `getAccessToken` auth circuit breaker (`VPS_AUTH_DOWN`, `CONTABO_AUTH_COOLDOWN_MIN` 30m) + `isAuthHealthy()`; VPS self-heal skips the whole Contabo sweep in one log when auth is down. Tests: `test_contabo_auth_breaker_2026-09.js` 10/10. Infra creds (`invalid_client`) still invalid — owner to fix.
- **IGNORED (per user)** — Connect Reseller 401 infra (prod IP not whitelisted / CR portal login broken); OpenProvider fallback covers domain pricing. CR loop already throttled per-process; residual volume is restart-amplified.

## 2026-09-22 — Windows RDP on DigitalOcean: golden images (fast ≤3-min deploys)
Goal: `POST /api/reseller/v1/rdp` must return a working Windows server in ~3 min for ws2019/ws2022/ws2025 instead of a 20-45 min QEMU conversion.
Runbook: `memory/RDP_GOLDEN_IMAGES.md`; lessons: `memory/DO_RDP_LESSONS.md`.
- ❌ Droplet **snapshots** of a converted Windows disk are unusable on DO (create/rebuild action errors, droplet auto-deleted) — reproduced 4×. Both legacy snapshots deleted.
- ✅ Pipeline rewritten to **DO Custom Images**: build droplet → QEMU install → QEMU first boot (RDP probe) → Windows self-shutdown → **offline ntfs-3g verify** (apply.ps1 sha + CloudInitApply task) → `qemu-img convert` qcow2 → HTTP serve → `POST /v2/images` (distribution Unknown) → poll → register → delete build droplet → transfer to 9 regions.
- ✅ apply.ps1 now ships on the answer ISO and is copied from the CD by FirstLogonCommands (certutil -decode silently failed on WS2019/WS2025). Verified OK on WS2022 + WS2019 + WS2025.
- ✅ Build-size fallback on `422 Size is not available` (live `GET /v2/regions` sizes; 50 GB-disk candidates only).
- ✅ Direct (customer) conversion: robust finalize (`dd` O_DIRECT + sysrq remount-ro + builtins-only reboot).
- ✅ Fast path falls back to full conversion automatically if DO deletes the droplet (create errored).
- ✅ **WS2025 fix (this fork)**: 24H2 Setup appends a 681 MB WinRE partition after C: → offline verify mounted the wrong partition (2 failed builds). `convert_to_windows.sh` now finds the OS partition by content and `sfdisk --delete`s trailing partitions so C: can grow. ws2025 build passed verify first time after the fix.
- ✅ **P0 password bug fixed (this fork)**: `provisionServer` sent `ADMIN_PASSWORD=undefined` (password lives in the secret store, not on `doRdpServers`) → Windows rejected it → customers could never log in (fast AND slow path). Diagnosed live on a kept droplet via RDP (`memory/rdp_apply_log_ws2019_bug_repro.log`). Fix: load from `getSecretPassword()`; unit tests now assert the real password in user-data + autounattend.
- ✅ apply.ps1 hardened: public DNS (67.207.67.2/3, 1.1.1.1) before DO's VPC resolver (10.x timed out for 5+ min after boot → callbacks failed), `net user /y`, SetPassword retry, `Clear-DnsClientCache` before callback retries, bootscript self-refresh retried 3×. Baked into future builds; existing images self-refresh it on later boots.
- ✅ Region transfer race: DO 422 "already being transferred" now waits for the region instead of marking it FAILED. `callbackGraceMs` 150→90 s.
- ✅ **E2E PASS**: ws2019 (image 246589188) fast path active in 3.2 min, NLA login with per-order password OK; ws2022 (image 246587962) 3.7 min, login OK. Logs in `memory/rdp_golden_e2e_ws*.log`.
- ✅ testing_agent iteration_49: 11/11 reseller RDP API + admin status + unit suite 66/66.
- ✅ **Order status via API (this fork)**: `GET /rdp/:id` returns `provisioning {status, stage, stage_label, message, progress, fast_deploy, os, eta_minutes, eta_seconds, eta_at, elapsed_seconds, time_to_active_s, credentials_ready, password_confirmed, steps[4], logs}` + top-level `credentials_ready` / `credentials_url`; `vpsPlansOf` host/status kept in sync; `/credentials` now resolves the live IP (was null for RDP). Docs updated. Live run via public API: `js/ops/rdp_status_api_e2e.js` ws2019 → active in 3.5 min, countdown/steps correct, NLA login OK (`memory/rdp_status_api_e2e_ws2019.log`).
- ✅ **Admin Telegram alerts (this fork)**: `init(db, { notifyAdmin })`; alerts (10-min de-dup) for order failed, fast-path order not active after `T.fastTargetMs` (3 min) with stuck stage, fast→slow fallback, password not applied, golden build failed, region transfer failed; `sendDailyDigest()` every 24 h (orders, fast/slow avg+max time-to-active, misses, failures) — digest disabled on the sandbox (SKIP_WEBHOOK_SYNC). Unit suite now 81/81; testing_agent iteration_50: 10/10.
- ✅ Leaked E2E droplets destroyed; E2E scripts now destroy their droplet on SIGINT/SIGTERM/SIGHUP. DO inventory = WHM, dynopay + the 2 golden-build droplets serving the pending imports (auto-destroyed after import).
- ⏭ Image refresh (rebuild with hardened apply.ps1) — SKIPPED per user.
- ⏳ Still importing at DO (22:40 UTC): ws2022 rebuild image 246589203 (queued 19:30) and ws2025 image 246605289 (queued 21:02). Registration + old-image deletion + 9-region transfer are automatic (resumable across restarts). **ws2025 E2E not yet run** (needs its image `available`): `node js/ops/rdp_golden_e2e.js --os ws2025 --region US`.
- Sandbox reseller API key in `memory/test_credentials.md`.

## 2026-09-23 (fork) — ws2025 golden image availability check (user request)
- Live DO check (token from `backend/.env`): ws2019 `246589188` + ws2022 `246587962` available in all 9 regions. **ws2025 `246641953` (`golden-ws2025-1790110923-r2`) was `available` on DO but the app showed `golden_status: none`** → the `-r2` suffix (manual re-import) did not match `^golden-ws2025-\d+$` in `syncGoldenFromDO()`/`listGoldenImages()`.
- ✅ Fix: `goldenSnapRe`/`goldenAnyRe` now accept an optional `-<suffix>` (`js/digitalocean-rdp-service.js`). Unit suite `js/tests/test_do_rdp_golden_2026-06.js` +2 assertions → 86/86.
- ✅ After nodejs restart auto-sync registered ws2025 (`available`, fast_deploy=true, 5 regions: sfo3 nyc3 lon1 fra1 ams3). Transfer to tor1/blr1/sgp1/syd1 queued via `POST /admin/rdp-golden/transfer` (DO copies sequentially; `golden_regions` grows as each lands).
- Note: `VPS_RDP_PROVIDER="azure"` in `.env` → public `GET /rdp/plans` advertises Azure; DO-RDP golden path is reached via bot / per-record routing (`digitalocean-rdp`). ws2025 E2E (`node js/ops/rdp_golden_e2e.js --os ws2025 --region US`) still not run.

## 2026-09-24 (fork) — RDP DNS fix + "slow browser" performance fixes for ALL editions / plans
- **DNS (prev. turn)**: DO VPC resolver (10.x) times out after boot → `DNS_PROBE_FINISHED_NXDOMAIN`. Live box 165.22.43.171 patched (1.1.1.1/8.8.8.8); `apply.ps1` self-tests DNS and auto-remediates. Golden rebuilds ws2019/ws2022/ws2025 triggered (builds `build-dbef380b549a` / `build-668dcb3a48fb` / `build-7338adc4a34b`, status via `node js/ops/rdp_golden_build.js status`; watcher log `memory/golden_rebuild_2026-09-24.log`).
- **Slow-browser RCA (live snapshot, `js/ops/rdp_diag_perf.ps1` via `rdp_run_ps.sh`)**: 4 GB box swapping (commit 4.17 GB > RAM, 292 pages/s), Chrome 70 procs ≈2 GB, Defender = #1 CPU with **July-2020 signatures** (eval ISO, WU off), no GPU (Chrome HW-accel = SwiftShader), Balanced power plan, SysMain/DiagTrack on. The old "perf tuning" only set `VisualFXSetting=2` (dialog radio) — effects were never actually disabled.
- ✅ `js/rdp-scripts/apply.ps1` §3b rewritten (runs at every boot on every droplet; droplets self-refresh it from `GET /api/provision/bootscript` → **no image rebuild needed**, covers the 3 images building now): real visual-effects mask `9012038012000000` (ClearType kept) for Administrator + Default hives (+HKCU when run interactively; busy hive skipped), WSearch/SysMain/DiagTrack off, CEIP/Appraiser/WER/Defrag tasks off, Defender low-prio/20 % CPU/no catch-up scans + background `Update-MpSignature -UpdateSource MMPC`, Chrome+Edge machine policies (HW-accel off, background mode / startup boost off, Memory Saver max on ≤8 GB, Edge sleeping tabs 5 min), fixed 4–8 GB pagefile (next reboot), High-Performance plan. Real-time protection + NLA untouched.
- ✅ Live box re-verified after applying interactively: free RAM 757 MB → 2.1 GB, commit 4.17 → 1.9 GB, paging 292/s → 0, Defender sigs 2020 → 2026-09-23. Evidence `memory/rdp_tune_165/out.txt`.
- ✅ `js/digitalocean-rdp-service.js` size ladder per region **Premium AMD → Premium Intel → Basic** (`do_size_slug_intel`, `PREMIUM_AMD_REGIONS`, `PREMIUM_INTEL_REGIONS`, `sizeCandidatesFor`/`sizeSlugFor` exported). nyc3/tor1/fra1 now get Premium Intel (same $28/$56/$112 as AMD) instead of Basic shared "DO-Regular" CPU; **fra1 orders no longer 422** (AMD not sold there). `createWithSizeFallback` retries the next size on DO 422 for both fast and slow paths and persists `do_size_slug`.
- ✅ Tests: `js/tests/test_do_rdp_golden_2026-06.js` 91/91 (size ladder, 422 fallback, race in "failed build droplet destroyed" fixed with waitFor). testing_agent iteration_52: 100 % backend.
- ⚠️ Existing droplets (e.g. 165.22.43.171 on `s-2vcpu-4gb` Basic) keep their size; a DO resize to `s-2vcpu-4gb-intel` needs a power-off (~1–2 min) — not done.
- 💡 Product recommendation (not implemented): 4 GB is the Windows Server floor — Standard tier customers running Chrome will still hit RAM limits; consider 8 GB as the minimum Windows tier or an in-bot "light browsing only" note on Standard.
- 🧹 **Test droplet cleanup (user request, 2026-09-24)**: destroyed `rdp-655708fc` (104.131.181.56, orphan — no record anywhere) and `rdp-ac8f897e` (165.22.43.171, owner's test order, chat 5168006768) at DO; in **production Mongo** (Railway) mirrored the bot's own delete flow: `doRdpServers` → `status: destroyed` (+`destroyed_at`/`destroy_reason`), `vpsPasswordSecrets` row deleted, `vpsPlansOf` row deleted. Also cleaned the stale `c05c84be` "ws2025-confirm" E2E leftover (droplet 603051404 already 404 at DO). Production now: 0 live DO-RDP orders. DO inventory = WHM, dynopay + the 3 golden-build droplets (auto-destroyed after import).

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

## 2026-06 fork handoff — DO Windows RDP lifecycle (bot + reseller API)
- Status: A/B/C (provider wiring, bot purchase flow with 1/2/3-month durations, bot management: reset password + reinstall) substantially implemented in code (not yet live-verified). Unit suite `js/tests/test_do_rdp_golden_2026-06.js` = 84 passed / 0 failed. App healthy (all services running, all key JS files pass `node -c`).
- MAIN REMAINING GAP: Reseller API — `POST /rdp/:id/password-reset` and `POST /rdp/:id/reinstall` endpoints DO NOT exist yet (`vpsActionHandler` only supports start/stop/reboot/shutdown). `agent_online` not yet on `GET /rdp/:id`. Docs pending.
- Also pending: golden image parallel rebuild (F1, owner-approved), testing_agent + live E2E (E2/E3).
- Full task tracker with line pointers: `/app/memory/RDP_BOT_INTEGRATION_TASKS.md`.

## 2026-06 (fork, wrap-up) — Bot interface VPS↔RDP separation (CODE ONLY, UNTESTED)
User reported confusion in the bot between Windows RDP and Linux VPS (they are different products with different plans). Fix implemented on disk but **NOT verified** — session ended per owner request before testing.
- Edited (uncommitted): `js/_index.js` (routing, menus, plan lists, subscription-detail screens; auto-renew now treats `digitalocean-rdp` as a PAYG provider), `js/vm-instance-setup.js` (VPS vs RDP plan setup + OS selection), `js/new-user-conversion.js`, and all 4 locale files `js/lang/{en,fr,zh,hi}.js` (split RDP vs VPS strings).
- Health: all 7 files pass `node -c`; nodejs/backend/frontend/mongodb RUNNING.
- ⚠️ NEXT AGENT MUST: run testing_agent (bot/backend flow) or a local sim to verify RDP purchase flow and VPS purchase flow load correctly with no UI overlap/crash. Then resume Reseller API D endpoints + F1 golden rebuilds. See `/app/memory/RDP_BOT_INTEGRATION_TASKS.md` "Highest-priority pending items".

## 2026-06 (fork, wrap-up) — WS2025 DO RDP verified; callback "DNS failure" is a sandbox artifact
Full handoff: `/app/memory/WS2025_RDP_HANDOFF_2026-06.md`.
- ✅ **ws2025 is functionally equal to ws2019/ws2022.** Live E2E (`js/ops/rdp_golden_e2e.js --os ws2025`,
  log `memory/rdp_golden_e2e_ws2025_keep2.log`): golden image 246641953 **available in all 8 regions**,
  fast deploy **active in 7.2 min**, ADSI Administrator password applied, **RDP/NLA login OK via xfreerdp**.
- ✅ **The "callback DNS resolution failure" is NOT a code bug.** On-droplet apply.log shows the password
  applies fine, then the callback to the sandbox preview host `*.preview.emergentagent.com` cannot resolve —
  because that hostname only resolves inside the Emergent K8s ingress, never on the public internet. In
  production `CALLBACK_URL` is the public Railway domain → it resolves and the callback succeeds. Backend
  also declares the order active ~90s after port 3389 opens even without the callback. **Do NOT keep
  patching apply.ps1 DNS.**
- ⏳ **REMAINING ACTIONABLE (owner go-ahead needed): Issue 2 / Task 1** — set Railway prod
  `VPS_RDP_PROVIDER=digitalocean-rdp` (currently Azure) on service `Nomadly-EMAIL-IVR` via Railway CLI
  (`/opt/node22/bin/railway`, `RAILWAY_TOKEN` in backend/.env), redeploy, then place one real ws2025
  order in prod to confirm the callback lands + credentials deliver. Deferred by design until ws2025 was
  proven (now proven). This is a LIVE PROD config change — confirm with owner first.
- 🧹 Cleanup owed: e2e left droplet **602990345** (104.131.68.31, order `rdp-109b0d03-198f-43fe-a772-39b681b6d58e`)
  running for manual inspection — destroy via `svc.cancelInstance(...)` to stop billing.

## 2026-06 (fork) — RDP order-flow polish (4 tasks) VERIFIED
User request: 4 RDP tweaks. All implemented (prior agent) and now VERIFIED this session.
1. ✅ **Bundle discount** — `js/digitalocean-rdp-service.js` `BUNDLE_DISCOUNT={1:0,2:0.10,3:0.15}`; `sellPrice()` = monthly×2×months × (1−disc). Live: Standard 2mo=$100.8 (−10%), 3mo=$142.8 (−15%); Pro/Power scale identically.
2. ✅ **Short droplet label** — `js/vm-instance-setup.js` `shortInstanceLabel()` → `nomadly-<6char>` (alphabet drops look-alikes l/o/0/1); single call site `createVPSInstance` displayName. Old `nomadly-<telegramId>-<epoch>` gone.
3. ✅ **Concise "RDP ready" msg** — `vps.vpsBoughtSuccess` (lang en/fr/zh/hi): title + credentials + ONE connect line (mstsc :3389, no SSH leak) + one short note (9 lines). "Reset Password in VPS management" → "RDP management" leak fixed.
4. ✅ **Order-flow wording** — `askRdpDuration` shows per-cycle save % (en `(save 10%)`, fr `(−10 %)`); `showDepositCryptoInfoVps` says "Windows RDP" for RDP / "VPS" for Linux; shared order summary + edition screens carry RDP wording, no VPS/SSH/Linux leaks.
- Verification: unit suites `test_do_rdp_golden_2026-06.js` 88/88, `test_vps_credentials_message.js` (all 4 langs), lang parity OK; new render regression `js/tests/verify_rdp_tasks_render.js` 44/44; **live bot sim** (mock Telegram + local Mongo, VPS_RDP_PROVIDER=digitalocean-rdp) drove RDP menu → region → plan → duration ($100.8 −10% / $142.8 −15%) → edition → order summary ($100.80 / 2 months) — all correct, no leaks, stopped before payment (no droplet created).
- ⚠️ CONFIG NOTE: vault restores `VPS_RDP_PROVIDER="azure"` in backend/.env; sim temporarily set it to `digitalocean-rdp` (production intent per 2026-09-23 note) then reverted. Owner should confirm the intended production RDP provider — the discount/duration flow only routes through DO-RDP when this = `digitalocean-rdp`.

## 2026-06 (fork) — RDP mgmt lifecycle test + 3-day grace auto-destroy (PLANNED, not yet built)
User asked to (1) live-test all RDP management (re-install/off/on/restart/renew) on one real droplet, and (2) **destroy an unrenewed RDP droplet after a 3-day grace period** (DO bills powered-off droplets per hour — today `processExpiries` only powers them off, never destroys → billing leak). User locked decisions: live box = **ws2022/US**; grace clock starts at **subscription end**; **notify the bot user (Telegram) AND the reseller API** on grace-start and on deletion.
- Full execution-ready plan: **`/app/memory/RDP_MGMT_LIFECYCLE_PLAN_2026-06.md`** (surface map, the two expiry engines to reconcile, bot-scheduler-owns-grace design, notification/locale-key spec, reseller API grace fields, live E2E + unit test plan, guardrails).
- ⚠️ Golden image rebuilds were still importing when this was written (watcher PID 3277, log `memory/golden_rebuild_2026-09-24.log`) — do NOT restart supervisor/nodejs.
- Status: investigation + plan only; NO code changed this turn (user paused execution).

