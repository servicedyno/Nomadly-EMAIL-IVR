# PRD - Nomadly Platform

## Architecture
- React Frontend (port 3000)
- FastAPI Backend (port 8001) - reverse proxy to Node.js
- Node.js Express (port 5000) - core business logic
- MongoDB (port 27017)


## ✅ Phone Upgrade Audit-Trail Fix + Backfill (Apr 30, 2026)

### Gap identified
While auditing @fuckthisapp's successful $62.50 Pro upgrade (first real-world use of the new one-tap button), discovered: **zero upgrade events have ever been written to `phoneTransactions`** — across the entire user base, for any payment method. Only `action: 'purchase'` and `action: 'sub-number-purchase'` rows exist. Crypto, wallet, bank, and DynoPay upgrade paths all bypassed the audit log. Separately, the log line `"Plan upgraded... → pro ($75)"` logged the plan's sticker/renewal price, not the amount actually charged — creating a second ambiguity for reconciliation.

### Implementation — `js/_index.js`
**`applyPhonePlanUpgrade(chatId, num, newPlan, newPrice, lang, paymentMethod, upgradeData)` — new 7th arg**
- Snapshots `oldPlan` / `oldPrice` BEFORE mutating the number doc.
- Extracts `chargeAmount` / `credit` / `eligibleForCredit` from `upgradeData` (with safe defaults: falls back to `newPrice` / `0` / `false` if absent).
- Writes a new `phoneTransactions` row:
  ```
  { chatId, phoneNumber, action: 'upgrade',
    oldPlan, newPlan, oldPrice, newPrice,
    amount: chargeAmount.toFixed(2),
    credit: credit.toFixed(2),
    eligibleForCredit, paymentMethod, timestamp }
  ```
- `insertOne` wrapped in try/catch with `log()` fallback — a DB failure here never strands a user mid-upgrade after their payment has already cleared.
- **Log line fixed**: now reads `Plan upgraded for ... starter→pro charged $62.50 (credit -$12.50) via 🪙 Crypto (BTC)` — actual charge first, credit disclosed, sticker price only appears in separate `renewal: $X/mo` field on admin notifications.
- **notifyGroup admin message** gets the credit breakdown too: `Charged: $62.50 (credit -$12.50)` + `New renewal: $75/mo`.

**All 4 call sites updated** to pass `upgradeData` through: wallet (`_index.js:23436`), bank transfer (`27677`), BlockBee crypto (`28239`), DynoPay crypto (`28996`).

### Prod backfill — @fuckthisapp's missing upgrade
Direct insert into prod `phoneTransactions` to close the retroactive gap:
- chatId `2086091807` / `+18777000068`
- `starter → pro`, oldPrice $50, newPrice $75, **amount $62.50**, credit $12.50, eligibleForCredit true
- payment method `🪙 Crypto (BTC)`, timestamp `2026-04-30T19:39:35.000Z`
- Stamped `_backfilledAt` + `_backfillReason` so this single row is visually distinguishable from natively-written ones during reconciliation.

### Tests — `js/tests/test_phone_upgrade_audit_trail.js` (new)
13/13 pass — source-level regression covering:
- 7-arg signature accepts `upgradeData`
- `oldPlan`/`oldPrice` snapshot happens BEFORE mutation (ordering assertion)
- Safe defaults for missing `upgradeData` fields
- `insertOne` has `action: 'upgrade'` and all 12 audit fields
- `amount` + `credit` stored as `.toFixed(2)` strings (consistent reconciliation format)
- `insertOne` wrapped in try/catch
- Log line uses `chargeAmount`, not `newPrice`
- Admin `notifyGroup` discloses credit
- All 4 call sites (wallet / bank / 2× crypto) pass `upgradeData`
- Zero call sites remain on the old 6-arg signature (regression guard — counts top-level commas per line to catch re-introductions)

### Regression
All 12 suites green, ~170+ total assertions, 0 failures: `test_one_tap_upgrade` (31/31), `test_plan_picker_ivr_clarity` (34/34), `test_day12_upgrade_credit_nudge` (19/19), `test_phone_upgrade_audit_trail` (13/13), `test_ai_support_phase1` (19/19), `test_manage_screen_features` (21/21), `test_user_facing_localization` (26/26), plus 5 others. nodejs restarted clean; `/api/` HTTP 200 in 310ms.


## ✅ Day-12 Upgrade-Credit Auto-DM Scheduler (Apr 30, 2026)

### Why
Picker badge sets the expectation. orderSummary badge reinforces at payment. Manage-screen one-tap CTA executes the upgrade. **This scheduler closes the loop** — auto-DMs Starter/Pro buyers exactly when they have 2 days left to lock in the credit, before the 14-day window slams shut. Day 12 is the sweet spot: enough time to feel the plan's limits, before the credit expires.

### Implementation — `js/_index.js`
- New `async function sendDay12UpgradeCreditNudges()` registered via `schedule.scheduleJob('0 14 * * *', …)` — daily at 14:00 UTC (late morning US East / mid afternoon EU / evening Asia, balancing reach).
- **Per-number eligibility filter** (not per-user, since a user can own several numbers):
  - `status === 'active'`
  - `plan ∈ {starter, pro}` (Business is top tier)
  - `!isSubNumber` (sub-numbers ride parent plan)
  - `purchaseDate` between **12 and 13 days ago** (sweet spot — felt limits, credit unexpired; capped at 13d so we don't spam if cron is offline a few hours)
  - next-tier plan currently available (`PHONE_PRO_ON` / `PHONE_BUSINESS_ON`)
  - no `_upgradeCreditNudgeSentAt` already on the doc
- **Dollar amount in the DM is computed by the same `phoneConfig.computeUpgradeQuote()` helper used by the Manage-screen one-tap button** — so the message and the actual upgrade button cannot disagree.
- **Idempotent**: stamps `val.numbers.${i}._upgradeCreditNudgeSentAt` on the exact array index (chatId-scoped) — guards against race conditions if the user adds/removes another number while the scheduler iterates.
- **Localized message bodies** for EN / FR / ZH / HI. Each says: "2 days left", current plan + age, target plan + exact charge, "what it would cost after the credit expires" anchor, and the explicit one-tap path (`📞 Cloud IVR + SIP → 📋 My Plans → ⬆️ Upgrade to Pro/Business`).

### Tests — `js/tests/test_day12_upgrade_credit_nudge.js` (new)
Hermetic end-to-end test that spins up a temp DB on the same MongoDB the app uses, seeds 13 fixture users covering every eligibility branch, runs the scheduler, asserts who got DMd, and runs again to verify idempotency. **19/19 pass**:
- Eligible Starter (12d) → DMd, body contains `$62.50` and "Upgrade to Pro"
- Eligible Pro (12d) → DMd with `$101.25` and "Upgrade to Business"
- Day-8 (too young) → skipped
- Day-20 (past window) → skipped
- Business plan → skipped (top tier)
- Already-nudged → skipped (idempotent)
- Sub-number → skipped
- Suspended → skipped
- Missing `purchaseDate` → skipped (defensive default)
- FR/ZH/HI users → received localized bodies
- Two-numbers user with mixed eligibility → stamp lands on the eligible index only
- Re-running scheduler → 0 new sends (idempotent)
- Source-level: cron registered, uses `computeUpgradeQuote` and `nextUpgradePlan`, filters Starter/Pro only

### Regression
Full sweep across 11 suites, ~150+ assertions, 0 failures: `test_one_tap_upgrade` (31/31), `test_plan_picker_ivr_clarity` (34/34), `test_day12_upgrade_credit_nudge` (19/19), `test_ai_support_phase1` (19/19), `test_manage_screen_features` (21/21), `test_user_facing_localization` (26/26), plus 5 others. nodejs restarted clean; `/api/` returns HTTP 200 in 178ms.


## ✅ orderSummary Upgrade-Credit Badge + AI Support Sync (Apr 30, 2026)

### Why
Second touchpoint for the upgrade-credit message. The picker badge sets the expectation; the orderSummary badge reinforces it at the **payment-confirmation** screen (highest-friction moment) — the place most analogous to a checkout review where users abandon. Also brings the AI support prompt up to date with the new one-tap upgrade button + 14-day rule so support answers don't contradict the UI.

### Implementation

**`js/phone-config.js` `orderSummary(...)` for EN/FR/ZH/HI**
- Starter purchase → adds `🛡️ 14-day upgrade credit — get 25% off if you upgrade to Pro/Business within 14 days` (italic).
- Pro purchase → adds `🛡️ 14-day upgrade credit — get 25% off if you upgrade to Business within 14 days` (target = Business only, NOT "Pro/Business" — Pro can't upgrade to itself).
- Business purchase → no badge (top tier).
- All copy localized to FR/ZH/HI with the same plan-tier-aware logic.

**`js/ai-support.js` SYSTEM_PROMPT (LLM knowledge base)**
- Updated `Plan Upgrades & Downgrades` section:
  - Lead with the new **one-tap upgrade button** location (Manage screen) and explains the live-price label `⬆️ Upgrade to Pro — $62.50`.
  - Replaced the old "always 25% credit" claim with the 14-day eligibility rule, including the exact disclosure text the user sees on the upgrade preview.
- Replaced `"How do I change my plan / upgrade?"` Q&A with two sub-paths: fastest one-tap and the menu route, both calling out the 14-day window with worked example ($50 Starter → $62.50 Pro).
- New Q&A `"Does Starter include IVR / SIP?"` with explicit `No.` answer + the one-tap upgrade pointer (directly addresses the @fuckthisapp incident where the bot's old answer left the user paying $50 expecting IVR).
- New Q&A `"I just bought Starter but I need IVR — what now?"` — short, action-oriented escalation to the one-tap CTA.
- Updated SIP-credentials Q&A to mention the one-tap button instead of just "🔄 Renew / Change Plan".

### Tests — `js/tests/test_plan_picker_ivr_clarity.js` (extended again)
+7 assertions, total **34/34 pass**:
- EN orderSummary: Starter row has badge with "Pro/Business" target, Pro row has badge with **only** "Business" target, Business row has **no** badge.
- FR / ZH / HI orderSummary: Starter+Pro carry the badge, Business does not (3 separate locale assertions).
- AI support SYSTEM_PROMPT regression check: parses just the prompt block and asserts it mentions (a) the 14-day rule, (b) the one-tap upgrade button, (c) the explicit "no credit after 14 days" rule.

### Regression
Full sweep across 10 suites all green: `test_one_tap_upgrade` (31/31), `test_plan_picker_ivr_clarity` (34/34), `test_ai_support_phase1` (19/19), `test_manage_screen_features` (21/21), `test_user_facing_localization` (26/26), `test_i18n_coverage`, plus 4 others. Total ~130 assertions, 0 failures. nodejs restarted clean (10s uptime, no warnings); `/api/` returns HTTP 200 in 271ms.


## ✅ 14-day Upgrade-Credit Badge in Plan Picker (Apr 30, 2026)

### Why
Conversion nudge added on top of the one-tap upgrade flow shipped same day. Users on the fence about Starter ($50) vs. Pro ($75) needed an at-a-glance reason to commit: "if I outgrow Starter, will I lose my $50?" The badge tells them up front that they can upgrade with a 25% credit (=$12.50 off Pro / $18.75 off Business) within 14 days, which de-risks the cheap-tier purchase and increases the natural Starter→Pro path.

### Implementation — `js/phone-config.js` `selectPlan(number)` for EN/FR/ZH/HI
- New italicized badge line under each row that has an upgrade target:
  - **Starter row** → `🛡️ 14-day upgrade credit — get 25% off Pro/Business if you upgrade within 14 days`
  - **Pro row** → `🛡️ 14-day upgrade credit — get 25% off Business if you upgrade within 14 days`
  - **Business row** → no badge (top tier; no upgrade target).
- Localized strings:
  - FR: `Crédit de surclassement 14 jours — 25 % de remise sur …`
  - ZH: `14天升级抵扣 — 14天内升级到…可享 25% 抵扣`
  - HI: `14-दिन अपग्रेड क्रेडिट — 14 दिनों में …पर अपग्रेड करें और 25% छूट पाएं`
- Copy choice: "upgrade credit" (factually accurate — the 25% is applied as a discount on the upgrade charge, not refunded). Avoids the legally fuzzy "money-back" framing.

### Tests — extension to `js/tests/test_plan_picker_ivr_clarity.js`
+6 assertions, total 27/27 pass:
- Starter row in EN includes "14-day upgrade credit" + "25% off Pro/Business"
- Pro row in EN includes the badge with target = Business only
- Business row does **not** include the badge (top tier)
- FR / ZH / HI badges appear exactly twice each (Starter + Pro rows)

### Regression
`test_one_tap_upgrade.js` (31/31), `test_ai_support_phase1.js` (19/19), `test_manage_screen_features.js` (21/21), `test_user_facing_localization.js` (26/26), `test_i18n_coverage`, plus 4 other suites — all green. nodejs restarted clean; `/api/` returns HTTP 200.


## ✅ One-Tap Plan Upgrade + 14-day Credit Gate (Apr 30, 2026)

### User request
> "Starter → Pro one-tap upgrade. Same should apply to Pro → Business upgrade. Ensure user only gets 25% credit when upgrading if the plan hasn't run more than 2 weeks, otherwise no credit."

### Implementation

**`js/phone-config.js`**
- New constants: `PLAN_UPGRADE_CREDIT_PCT = 0.25`, `PLAN_UPGRADE_CREDIT_AGE_DAYS = 14`, `NEXT_PLAN = { starter: 'pro', pro: 'business' }`.
- New pure helper **`computeUpgradeQuote(num, newPlanKey)`** — returns `{ oldPrice, newPrice, ageDays, eligibleForCredit, credit, chargeAmount, ... }`. The 25% credit fires **only** when `ageDays ≤ 14` (computed from `purchaseDate`); otherwise `credit = 0` and `chargeAmount = newPrice`. Defensive defaults: missing/invalid `purchaseDate` → `ageDays = Infinity` → no credit. Returns `null` for unknown plans / null inputs.
- New helper **`nextUpgradePlan(num)`** — Starter→Pro, Pro→Business, Business→null, sub-numbers→null, unavailable next-tier→null.
- New button labels in EN/FR/ZH/HI: `upgradeToPro` (`⬆️ Upgrade to Pro` / `⬆️ Passer à Pro` / `⬆️ 升级到专业版` / `⬆️ प्रो में अपग्रेड करें`) and `upgradeToBusiness`.

**`js/_index.js`**
- `buildManageMenu()` now appends a one-tap row right above Renew/Release for any primary number on Starter or Pro: `⬆️ Upgrade to Pro — $XX.XX` (the price suffix is the **actual** charge after applying the 14-day rule, computed live by `computeUpgradeQuote`).
- New shared helper `processChangePlanSelection(chatId, num, newPlan, lang)` near `showManageScreen` — renders the upgrade-preview and stashes `cpUpgradeData` so the existing wallet/crypto/bank payment handlers downstream pick up unchanged.
- `cpManageNumber` action handler catches `pc.upgradeToPro` / `pc.upgradeToBusiness` (matched by `startsWith` so the `$XX.XX` suffix doesn't break the match), validates against `nextUpgradePlan`, sets `action = a.cpChangePlan`, and dispatches into `processChangePlanSelection`.
- `cpChangePlan` upgrade-preview branch now also uses `computeUpgradeQuote` (replacing the old hard-coded `oldPrice * 0.25`), so the "Renew → Change Plan → Upgrade to X" path and the new one-tap path produce identical numbers.
- Upgrade-preview message disclosure: when credit is applied, shows `Credit (25% of starter, plan only Nd old): -$X.XX`. When credit is denied, shows `<i>No credit applied — plan Nd old, past 14-day window</i>`.

### Tests
- New: `js/tests/test_one_tap_upgrade.js` — **31/31 pass**. Boundary at exactly 14 days, day 13 (eligible), day 15 (denied), day 0, day 90, missing/invalid `purchaseDate`, both upgrade tiers, button-label localization, `nextUpgradePlan` for sub-numbers/top-tier/null inputs, source-level wiring checks (buildManageMenu, cpManageNumber, cpChangePlan, processChangePlanSelection all use the shared quote helper), and the @fuckthisapp scenario explicitly: Starter purchased today → Pro one-tap upgrade quote = $62.50.
- Regression sweep all green: `test_ai_support_phase1` (19), `test_manage_screen_features` (21), `test_plan_picker_ivr_clarity` (21), `test_user_facing_localization` (26), `test_i18n_coverage`, `test_plan_copy`, `test_billing_menu_and_gold_copy`, `test_invariants_no_refund_dynamic_buttons`, `test_phone_settings_reset_fix`. Node service restarted clean; `/api/` returns HTTP 200.


## ✅ Production Anomaly Audit & Fixes (Apr 30, 2026)

### Audit
Pulled Railway production logs from latest deployment `cad26cc2-7d19-45a4-9605-23d38c59d6bc` (4.5h uptime, status SUCCESS) and cross-checked against prod MongoDB. **No exceptions, no crashes, no service errors.** Investigated 5 anomaly classes flagged by the user.

### Verified findings
| # | Anomaly | Reality | Action |
|---|---|---|---|
| 1 | Plan-price desync (2 Business @ $30, 1 Pro @ $15, 1 Pro @ $25 in `phoneNumbersOf.val.numbers[*].planPrice`) | Root cause: stale `$5/$15/$30` defaults in `phone-config.js:5-7` kicked in when `PHONE_*_PRICE` env vars were unset on past deploys. The $25 Pro is a sub-number (`SUB_NUMBER_BASE_PRICE=25`, intentional). The $15 Pro is admin-restored (`_restoration: true`). | **FIXED** — defaults bumped to live pricing |
| 2 | Three users in 40 min surprised that Starter $50 has no IVR (`@fuckthisapp` paid $50 via DynoPay then complained) | Plan picker showed only feature lists with no explicit IVR availability indicator; users assumed Starter included IVR (the product is called "Cloud IVR + SIP") | **FIXED** — explicit IVR row + footer warning + final-confirmation warning |
| 3 | Crypto purchase missing from `transactions` collection | False alarm — recorded in `phoneTransactions` (separate collection by design); audit trail intact | No action |
| 4 | Three users pressing /start 3-4× in seconds | UX-frustration signal, not a bug; existing CartRecovery already tracks this | Tracked in roadmap |
| 5 | User @Mrdoitright53 calling with $4.85 wallet balance | Already auto-mitigated: WalletNotify WARNING fired + Twilio `timeLimit` calculated per-call from balance/rate | No action |

### Implementation — `js/phone-config.js`
- **Default prices bumped** from legacy `5/15/30` to current public `50/75/120` (lines 5-15). Added `console.warn` when any `PHONE_*_PRICE` env is missing — so a future misconfigured deploy produces a loud log line instead of silently underpricing every new Cloud IVR purchase.
- **`selectPlan(number)` (EN/FR/ZH/HI)** — every plan row now ends with an explicit `🎙 IVR / SIP softphone: ❌ not included` (Starter) / `✅ Quick IVR + Bulk IVR + OTP` (Pro) / `✅ Pro + Auto-Attendant + Recording` (Business) line, plus a footer warning that Starter does **not** include IVR.
- **`orderSummary(number, country, plan, price)` (EN/FR/ZH/HI)** — final-confirmation screen before payment now appends an italicized warning *only when the user is about to buy Starter*, calling out IVR/SIP exclusions one last time. Pro/Business order summaries are unchanged.
- **`manageNumber(n, ...)` (EN/FR/ZH/HI)** — sub-numbers no longer display the misleading `Plan: Pro ($25/mo)` line. They now read `Sub-number — $25/mo (under Pro plan)` (and the equivalent in FR/ZH/HI). Primary numbers' rendering is unchanged.

### Tests — `js/tests/test_plan_picker_ivr_clarity.js` (new)
21/21 pass. Covers: default-price fallback ($50/$75/$120), IVR `❌`/`✅` badges in all four locales, footer warning in all four locales, sub-number relabel in all four locales, primary-number unchanged, Starter-only orderSummary warning in all four locales, and an env-override regression (`PHONE_STARTER_PRICE=99` is honoured).

### Regression sweep
All adjacent suites still green: `test_ai_support_phase1.js` (19/19), `test_billing_menu_and_gold_copy.js`, `test_manage_screen_features.js` (21/21), `test_plan_copy.js`, `test_invariants_no_refund_dynamic_buttons.js`, `test_phone_settings_reset_fix.js`, `test_user_facing_localization.js` (26/26). Node service restarted cleanly; `/api/` returns 200.


## ✅ AI Support Phase 1 Test Harness Fix (Feb 2026)

### User report
Running `node /app/js/tests/test_ai_support_phase1.js` showed `18 passed, 1 failed` for the user, but every run in the fresh pod reported `19 passed, 0 failed`.

### Root cause
The test runner's `t()` wrapper was synchronous (`try { fn(); ... }`) but one test — `S12: clearHistory resets dedup so next session starts clean` — was declared `async`. In Node.js, calling an async function from a sync try/catch returns a Promise immediately without surfacing any thrown assertion. The wrapper was therefore counting the async test as ✅ passed even when its assertion failed, and only emitting an unhandled-rejection warning that was easy to miss. This is why the pod couldn't reproduce the 18/1 output — the runner itself was masking the real state.

### Fix — `js/tests/test_ai_support_phase1.js`
- `t()` now pushes `{ name, fn }` into a queue; a new `async runAll()` iterates and `await`s each test so async assertions are caught by the try/catch.
- Registered a `process.on('unhandledRejection', …)` guard that prints `❌ unhandled rejection` and bumps `failed` so hidden async failures can never again masquerade as passes.
- Final `console.log`/`process.exit` moved into `runAll().then(...)`.

### Verification
- 19/19 deterministic passes across repeated runs in the pod.
- Controlled reproduction: forcing the S12 async assertion to fail now correctly prints `=== 18 passed, 1 failed ===` with a proper `❌` line, exactly matching the user's original output — confirming the wrapper was the silencing factor.

### Note
`test_ai_support_phase2.js` referenced in the user's command does not exist — Phase 2 is a future roadmap item in `memory/AI_SUPPORT_PHASES.md`, not a regression.


## ✅ Admin-Bot Unmasked Notifications (Feb 2026)

### User request
"Below should show the deposited amount user @. Should also reveal username of user who joined. Analyze other places where user @username are not shown to the admin bot (not group) and make visible."

Admins need full visibility (`@username (chatId)` + exact deposited amount + full domain) for moderation/support. Public groups must continue to receive masked text (`pi***`, `gol***.com`).

### Implementation — `/app/js/_index.js`
- **`notifyGroup(groupMsg, adminMsg = null)`** now accepts an optional admin variant:
  - When `adminMsg` is provided → public groups get the masked `groupMsg`, admin chat (`TELEGRAM_ADMIN_CHAT_ID`) gets the unmasked `adminMsg`. No double-send.
  - When `adminMsg` is `null` → legacy 1-arg behavior (same message to all). Backward compatible.
- **New helpers** (alongside `maskName`):
  - `adminUserTag(name, chatId)` → `@username (chatId)` or `User <chatId>`
  - `adminDomainTag(domain)` → full domain (no masking)
- **All ~50 masked `notifyGroup` call sites** were converted to the 2-arg form. Existing redundant `notifyGroup(masked); send(TELEGRAM_ADMIN_CHAT_ID, unmasked)` patterns were consolidated into the new clean form (admin no longer receives the duplicate masked message).

### Concrete admin-now-visible flows
- **Wallet top-ups** (Bank `/bank-wallet`, BlockBee `/crypto-wallet`, DynoPay `/dynopay/crypto-wallet`) — admin sees `@username (chatId) | $X.XX USD | Y COIN | Ref: ...`
- **New member join** — admin sees display name, `@username`, chatId, language, `/reply` quick action
- **Cloud IVR purchase / sub-number / release / plan upgrade** — uses `adminPurchasePrivate`/`adminSubPurchasePrivate`/`adminReleasePrivate` with `adminUserTag`
- **Domain registration / Hosting activation / VPS deploy / VPS upgrade / Plan upgrade** — admin sees full domain + `@username (chatId)` + exact USD price + payment method
- **Subscriptions, Digital Product / Virtual Card / Leads / Bundle / Short Link** — admin sees `@username (chatId)` + order ID + exact amounts + ticker (where crypto)
- **Partial lead refund** — admin sees `@username (chatId) | delivered/requested | refund $X.XX | reason`

### Tests
- `js/tests/test_admin_unmasked_notify.js` — 11/11 pass: wallet-topup admin variant carries username + amount + ticker, group sees masked; new-member-join admin sees full identity; domain reg admin sees full domain; legacy 1-arg form remains backward-compatible; `adminUserTag` fallback for missing username; `buildAdminButtons` produces correct rows for orders / top-ups / partial-refund / empty input; inline keyboard goes only to admin and is suppressed when `adminMessage` is null.
- Sibling regression: `test_call_route_priority.js` — 26/26 pass.
- Syntax: `node -c js/_index.js` clean; ESLint clean.

## ✅ Admin One-Tap Action Buttons (Feb 2026)

### What it does
Admin notifications now ship with inline-keyboard buttons so the admin can complete the most common follow-ups in one tap from the chat:
- **📩 Deliver** (orders) → bot prompts "Paste delivery details for order ABC123…" — admin types/pastes → bot internally rewrites it as `/deliver ABC123 <text>` and runs the existing delivery flow.
- **❌ Refund Order** (orders) → confirm dialog `[✅ Confirm Refund $X | ✖️ Cancel]` → on confirm, refunds USD to buyer's wallet, marks order `refunded`, DMs the buyer.
- **💵 Refund $X.XX** (partial-refund / future error notifications) → confirm dialog → on confirm, credits the user's wallet by that exact amount and DMs them.
- **💬 Reply User** (every admin notification with a chatId) → bot prompts "Type your message to @user…" — admin types → bot internally rewrites it as `/reply <chatId> <text>` and runs the existing translation + admin-takeover flow.
- **/cancel** in any pending state aborts; entering any `/command` also abandons the pending state and falls through.

### Implementation — `/app/js/_index.js`
- `notifyGroup(groupMsg, adminMsg, adminButtons = null)` — 3rd arg attaches an `inline_keyboard` to the admin message ONLY (groups always get a clean masked broadcast).
- `buildAdminButtons({ chatId, orderId, refundUsd })` — composable helper:
  - `orderId` → row of `[📩 Deliver, ❌ Refund Order]`
  - `refundUsd` + `chatId` → row of `[💵 Refund $X.XX]`
  - `chatId` → row of `[💬 Reply User]`
- New admin-only branch in `bot.on('callback_query', …)` handles `aR:`, `aD:`, `aRO:`, `aRO_OK:`, `aRC:`, `aRC_OK:`, `aCANCEL` (gated by `query.from.id === TELEGRAM_ADMIN_CHAT_ID` with a popup for non-admins).
- Early interceptor in `bot.on('message')` checks `state[adminId].awaitingAdminAction` and transparently rewrites the admin's free-text reply into `/reply <chatId> <text>` or `/deliver <orderId> <text>` so the existing handlers (with translation + auto-deliver-on-card-pattern detection + `digitalOrdersCol` updates) execute unchanged. 10-min staleness guard.
- Wired into all order notifications (digital product / virtual card across wallet, bank, BlockBee, DynoPay), all wallet top-ups, new-member-join, and partial lead refund.

### Tests
- 11/11 in `test_admin_unmasked_notify.js` (5 admin-buttons specific cases added).

## ✅ End-to-End Gap Closure (Feb 2026)

### A) Admin-side `adminUserTag` consistency cleanup (13 sites)
All direct `sendMessage(TELEGRAM_ADMIN_CHAT_ID, ...)` admin notifications outside `notifyGroup` now route through `adminUserTag(name, chatId)` for uniform `@username (chatId)` formatting + carry the `[💬 Reply User]` quick-action button via the new `adminMsgOpts({ chatId })` helper. Sites updated: domain savings (wallet/bank/BlockBee), domain purchase crash, VPS renewal failure, VPS pre-emptive cancel, VPS cancel-failed/cancel-crash, VPS escalating renewal alerts, VPS auto-deleted/delete-failed/delete-crash, bank-domain auto-refund + critical-failure, BlockBee crypto-domain auto-refund + critical-failure, support-session-closed (×2). One tap from any of these → admin can reply to the affected user immediately.

### B) User-facing language gaps closed (15 sites, 4 locales)
Every user-facing notification we found in English-only is now `en/fr/zh/hi`:
- **Cloud-IVR**: number-purchase-failed wallet refund DM, exception refund DM, **Verification Rejected** flow (header + body + footer + "Issues found" + "What documents are accepted" + "documents did not meet requirements")
- **Order ops**: `/deliver` order delivery DM to buyer (the flagship gap)
- **Referrals**: New-Referral notification to referrer
- **Voice**: IVR redial "no previous call data", Twilio + Telnyx OTP "already processed (status/phase)", "Session expired or call already ended"
- **SMS**: SIM picker prompt + tip + button labels (Use default, Auto-rotate)
- **Email Blast**: campaign-not-found, failed-to-start-campaign refund DMs
- **Lead Gen**: admin/order-leads failure notification
- **Fax**: PDF-available fallback, fax-received-but-no-PDF, fax-received-but-retrieval-failed
- **Phone Plan**: incoming call blocked (no credits), call blocked (minute limit)
- **URL Shortener**: "Already shortened" link-reuse hint
- **Devices**: rename validation (empty, too-long, not-found, success, failure)

### Tests
- `js/tests/test_user_facing_localization.js` — **26/26 pass**: static-source check that every anchor EN string is paired with FR + ZH + HI translations in the same source file. CI-friendly regression — fails loudly if anyone reverts a localization.
- `js/tests/test_admin_unmasked_notify.js` — 12/12 still pass.
- `js/tests/test_call_route_priority.js` — 26/26 still pass.
- Total: 64/64 pass. Bot syntax-clean, restarts cleanly.

## ✅ AI Support — Phase 1 (Feb 2026)

### What shipped
Language polish + escalation hardening in `/app/js/ai-support.js`:
- **L1** — `extractActionButtons` now ships full ZH and HI keyword→button maps (was EN+FR only). ZH/HI users now get native button labels in AI responses.
- **L2** — `MP_HELPER_PROMPT` (Marketplace AI) now embeds the 4-language Marketplace button-label table so MP AI tells FR/ZH/HI users to tap *"📦 Mes annonces"* / *"📦 我的房源"* / *"📦 मेरी लिस्टिंग"* instead of the EN equivalents.
- **L3** — New `getMarketplaceContext(chatId)` injects wallet + 3 active listings + 3 open conversations into the MP system prompt so MP AI can answer "where's my listing?" / "what's my escrow status?" without asking.
- **L7** — Soft-escalation regex now recognizes navigation verbs in FR (*appuyez/cliquez/touchez/allez/naviguez/accédez*), ZH (*点击/前往/进入/导航/打开*), and HI (*टैप/क्लिक/दबाएं/जाएं/खोलें*). Eliminates false escalations when AI gave a perfectly good navigation answer in a non-EN language.
- **S6** — Bumped `max_tokens` 500→**1200** (main AI) and 400→**800** (Marketplace AI). Complex answers no longer truncate.
- **S12** — New in-memory `_escalatedThisSession` map dedups critical-keyword admin pings: if user types "refund" 3 times in the same session, admin gets ONE 🚨 ping (not 3). Cleared on `clearHistory(chatId)`. Backward-compatible — legacy 3-arg `needsEscalation(message, lang, aiResponse)` callers still work.

### Tests
- `js/tests/test_ai_support_phase1.js` — **19/19 pass** (button maps for all 4 langs, soft-escalation regex per lang, max_tokens regression, dedup correctness, MP prompt + context).
- Total project tests: 83/83 pass.

### Future phases — see `/app/memory/AI_SUPPORT_PHASES.md`
Documented: Phase 2 (sentiment + proactive triggers + smart routing + service-status), Phase 3 (function-calling + screenshot vision), Phase 4 (FAQ embedding cache + user-profile memory + summarization), Phase 5 (agentic actions, streaming, locale-formatted currency).


## 🐛 Cloud IVR Call-Forwarding Bug — @wizardchop +15162719167 (Feb 2026)

### User report
"Set call forwarding for my Cloud IVR number from the bot but every call goes to voicemail."

### Root cause (verified against production MongoDB)
`@wizardchop` (chatId `1167900472`) had **THREE features simultaneously enabled** on `+15162719167`:
- `callForwarding`: `enabled=true, mode='always', forwardTo='+19382616936'`
- `ivr`: `enabled=true, options={'1': {action: 'voicemail'}}` — single option, dumps caller to VM
- `voicemail`: `enabled=true`

The routing priority in `js/voice-service.js → handleCallAnswered()` checked **IVR before Forwarding(always)**. Every inbound call hit the IVR menu first, the caller pressed nothing or `1`, and the call dropped into voicemail. Forwarding-always **was never reached**.

### Fix — priority swap
**`js/voice-service.js:3249-3380`** — new order:

> **Forwarding(always) → IVR → Forwarding(busy/no_answer) → SIP ring → Voicemail → Missed**

`Always-Forward` is now the highest priority — it's an explicit user statement that EVERY call should forward, so IVR is correctly skipped. Added `_forwardingWalletGate()` helper to dedupe wallet-precheck logic across the two forwarding code paths. Log line `[Voice] ... — IVR skipped (always-forward overrides)` provides observability when the override fires.

### Awareness layer (3-tier UX hardening to prevent recurrence)
**Layer 1 — Call-flow preview** at top of Forwarding/IVR/Voicemail bot screens. Plain-English one-liner, e.g.:
> *🧭 Currently: All calls auto-forward to +1 (938) 261-6936. IVR & voicemail won't play. ⚠️ IVR, voicemail are enabled but skipped.*

**Layer 2 — Post-Always-Forward conflict warning** + one-tap remediation buttons (`🔇 Disable IVR`, `🔇 Disable SIP`, `🔇 Disable Voicemail`, `✓ Keep all`). Fires only when conflicts exist. Re-evaluates after each toggle so user can clear them in sequence.

**Layer 3 — `(skipped)` badge** on overridden features in the per-number manage screen. Localized in en/fr/zh/hi.

### Single source of truth
- `js/phone-config.js → getCallRouteSummary(num)` returns `{primary, secondary, skippedFeatures, hasFwd, hasIvr, hasSip, hasVm, fwdMode}`. Used by:
  - `js/_index.js` (bot UX preview + remediation flow)
  - Future agents who want to query "what happens when this number is called?"
- `js/phone-config.js → formatCallFlowPreview(num, lang)` — localized one-liner for end-user display.

### Tests
- New: `js/tests/test_call_route_priority.js` — **26 cases** covering all priority permutations + 4-locale previews + IVR option enumeration + dormant-feature detection + broken-IVR detection + the screenshot's pure auto-attendant scenario + static source-order assertion. **26/26 passing.**
- Sibling regressions all green: `test_bulkivr_wallet (10/10)`, `test_manage_screen_features (21/21)`, `test_billing_menu_and_gold_copy`, `test_plan_copy`, `test_i18n_coverage`.

### Auto-attendant clarity follow-up (Feb 2026 — same session)

Refined the awareness layer based on a user question about IVR auto-attendant setups (Press 1 → Forward, Press 2 → Message, Press 3 → Voicemail):

**1. IVR option enumeration in preview.** `formatCallFlowPreview()` now renders the inline option list:
> *🧭 Currently: Callers hear your IVR menu (Press **1**→Forward, Press **2**→Message, Press **3**→Voicemail).*
Caps at 3 enumerated options + "+N more" for longer menus, sorted by key. Localized in en/fr/zh/hi.

**2. New "dormant features" semantics.** Distinguishes pre-empted features from skipped ones:
- `skippedFeatures` (`⚠️`): enabled but COMPLETELY overridden — e.g. IVR while Always-Forward is on
- `dormantFeatures` (`💤`): enabled but PRE-EMPTED by primary's logic so trigger conditions never check — e.g. forward(busy/no_answer) under IVR (IVR returns first; busy check never reached). Softer warning since user might still want them for when primary is later toggled off.

**3. Scope-clarifying tip on IVR Forward option save.** After saving "Press X → Forward to Y", the bot now also sends:
> *💡 This forwards only when callers press X. To forward every incoming call regardless of menu, go to 📲 Call Forwarding → Always Forward (which would override this IVR entirely).*

**4. Broken-IVR detection.** When IVR is enabled but has no options (a misconfig that would drop calls), the preview reads:
> *🧭 Currently: IVR is enabled but has no menu options yet — callers will hang up. Add options or disable IVR.*

#### Updated files
- `js/phone-config.js` — `getCallRouteSummary` now returns `dormantFeatures`, `hasBrokenIvr`, `ivrOptionCount`, and `primary.options` for IVR. New `formatIvrOptionsInline(options, lang)` helper. `formatCallFlowPreview` rendering for all 4 locales updated.
- `js/_index.js` — IVR add-option Forward confirmation now fires a 2nd `send()` with the scope-clarifying tip in the user's language.
- `js/tests/test_call_route_priority.js` — expanded from 17 → 26 tests; updated existing IVR + forward(busy/no_answer) tests to assert dormant-features semantics.

#### Files touched
- `js/voice-service.js` — restructured `handleCallAnswered()` priority order + new `_forwardingWalletGate()` helper.
- `js/phone-config.js` — new helpers `getCallRouteSummary` + `formatCallFlowPreview` + `formatIvrOptionsInline` + 4-locale labels (en/fr/zh/hi). Distinguishes `skippedFeatures` from `dormantFeatures`. Detects broken IVR.
- `js/_index.js` — preview at top of 3 feature screens, post-save conflict warning + remediation handler `cpForwardingConflictResolve`, `(skipped)` badges in `buildManageMenu`, support for badged button matching via `startsWith`, scope-clarifying tip on IVR Forward option save.
- `js/tests/test_call_route_priority.js` — 26 unit tests.
- `scripts/reset_wizardchop_settings.py` — production-data reset script (executed once for @wizardchop, kept for future similar incidents).

### Deployment
- Local repo only. **NOT yet deployed to Railway.** User pushes via "Save to Github" → Railway auto-deploys.
- After deploy, @wizardchop's next call to `+15162719167` will forward to `+19382616936` (no production data mutation required — priority fix alone resolves it).

### Followups flagged by testing agent (not blocking)
1. `voice-service.js` is 4877 lines — refactor candidate. Splitting `route-priority` into its own module would let voice-service consume `getCallRouteSummary` directly instead of duplicating precedence logic.
2. `_forwardingWalletGate` fails-open on transient wallet errors — acceptable for now; consider circuit breaker later for high-volume Always-Forward numbers.
3. `(fwdConfig.mode || 'always') === 'always'` defaults to 'always' when mode is undefined — preserves prior behavior; legacy records with `enabled=true, forwardTo=set, mode=undefined` will now forward instead of hitting IVR (intentional).


## 🎁 Plan extension + 🛡️ post-delete verify-and-retry safety net (2026-04-29)

### Task 1: 5-day goodwill extension for @thebiggestbag22
- Granted +5 days on `entsf6c7 / entsecurity.xyz` (Premium Anti-Red 1-Week plan).
- New expiry: **May 9, 2026 UTC** (was May 4).
- Stored an audit trail entry in `cpanelAccounts.extensionLog[]` with reason, days, old/new expiry, and grant timestamp — so finance can reconcile and any future agent can see why expiry deviates from the original purchase.
- Cleared the `expiryNotified` and `expiryUserNotified` flags so the scheduler will re-warn before the new expiry instead of staying silent.
- Sent the user an HTML Telegram message confirming the extension and the bug fix.

### Task 2: Post-delete verify-and-retry guard (deepens BlueFCU fix)
The previous fix (`killdir` → `trash`) addressed the symptom but didn't prevent **future** silent-no-op classes of bugs. Now both deletion code paths verify the deletion landed by re-listing the parent dir and **automatically retry with the alternate op** if the target is still present.

**`js/cpanel-proxy.js::deleteFile`** now:
1. Runs primary op (`trash` for dirs, `unlink` for files)
2. Re-lists the parent dir
3. If target is still present → retries with the **alternate op** (`unlink` ↔ `trash`)
4. Re-verifies; if still present, returns `status: 0` with a clear diagnostic + both response payloads
5. If the verify call itself fails (network/timeout), returns the raw primary result (don't double-charge cPanel)
6. Annotates response with `attempted_ops: [primary]` or `[primary, fallback]` and `verified_via: 'primary' | 'fallback'`

**`js/cpanel-routes.js`** WHM-fallback path now mirrors the same control flow using WHM root token for the fileop + UAPI3 `list_files` for verification.

### Tests
- 12 static-analysis regression assertions (`test_delete_folder_op.js`)
- **5 functional-mock scenarios** (`test_delete_verify_retry.js`):
  - Primary succeeds → no retry
  - Primary silent no-op → fallback succeeds
  - Both silent no-op → status:0 with diagnostic
  - File delete uses unlink-primary, trash-fallback (inverse direction)
  - Verify call fails → returns primary result without retry
- All previous suites still green: 26/26 billing/Gold + 9/9 plan-copy + 442/442 bot i18n + 45/45 frontend i18n

### Files
- `js/cpanel-proxy.js` — `_fileopDelete`, `_verifyDeleted` helpers + verify-and-retry control flow in `deleteFile`
- `js/cpanel-routes.js` — same control flow in WHM-fallback path
- `js/tests/test_delete_folder_op.js` — updated for new shape
- `js/tests/test_delete_verify_retry.js` (new) — 5 functional scenarios with axios mock

## 🐛 Folder deletion silently failed (cPanel Fileman::fileop op rotation) — 2026-04-29
**User report**: @thebiggestbag22 (chatId 6543817440, cpUser `entsf6c7`, domain `entsecurity.xyz`) could not delete his "BlueFCU_Upload_Ready" folder from the hosting panel. The UI threw a 500 with "Request failed".

### Investigation (live, against production cPanel WHM 11.x)
| op | result | dir actually removed? |
|---|---|---|
| `unlink` | `result=1` (success) | ❌ **silently no-ops** for directories |
| `killdir` | error: *"Unknown operation sent to api2_fileop"* | ❌ |
| `trash` | `result=1` | ✅ **moves to ~/.trash/, fully removed** |

The previous fix attempt (`killdir`) was based on stale cPanel docs — the op was deprecated. Modern cPanel exposes `unlink` (no-op for dirs) and `trash` (works for both files and dirs).

### Fix
- `js/cpanel-proxy.js::deleteFile` — `isDirectory ? 'killdir' : 'unlink'` → `isDirectory ? 'trash' : 'unlink'`
- `js/cpanel-routes.js` WHM-fallback path — same swap
- Doc trail in both files explains the cPanel quirks for future maintainers, and references the @thebiggestbag22 reproduction.

### Verified
- Direct cPanel API probe (WHM root token) confirmed `trash` deletes directories
- @thebiggestbag22's actual `BlueFCU_Upload_Ready` folder is now removed (verified via fresh `list_files` listing — no Blue* item remains in `/home/entsf6c7/public_html`)
- 6 regression assertions in `js/tests/test_delete_folder_op.js`
- All previous test suites still green

### Production deployment note
The fix is on the dev branch — production at `panel.1.hostbay.io` still runs the buggy `killdir` op until the next Railway deploy. Push via the **Save to Github** flow, then Railway will redeploy automatically.

### Credential trail
- Generated a fresh 6-digit PIN to log into the user's panel during repro (the existing bcrypt hash was unrecoverable). The user can regenerate their own PIN via the bot's "🔑 Show Credentials" any time — the temporary PIN gets superseded automatically.

## 🌐🆕 Auto-Detect Language Banner on Panel Login (2026-02-13)
**Why**: Now that the panel speaks 4 languages, non-English visitors should land in their language without needing to find the switcher. A one-time banner at the top confirms the auto-detection.

### Behaviour
- On panel login mount, if the user **hasn't yet answered the banner** (no `hp.lang.bannerDismissed` flag in localStorage) AND `i18next-browser-languagedetector` resolved to a non-English supported locale (`fr`/`zh`/`hi`), a centred top-of-page banner appears.
- Banner copy is in the detected language: e.g. *"Nous avons détecté que votre navigateur est en Français — Garder cette langue pour le panneau ? [Oui — garder Français] [Passer à l'anglais] [×]"*
- **Yes / Keep** → confirms current locale, sets `hp.lang.bannerDismissed=1`, banner gone for good.
- **Switch to English** → flips i18n live, persists `hp.lang=en` + `bannerDismissed=1`.
- **× (close)** → keeps current locale, sets `bannerDismissed=1`.
- Picking via the LanguageSwitcher dropdown also sets `bannerDismissed=1` so the banner doesn't reappear.
- **Subtle bug avoided**: `i18next-browser-languagedetector` auto-caches its detected language to `hp.lang` on first visit. The banner deliberately checks ONLY `hp.lang.bannerDismissed`, never `hp.lang`, so it isn't suppressed by the auto-cache.

### Files
- New: `frontend/src/components/AutoDetectLanguageBanner.js`
- New: `frontend/tests/test_auto_detect_banner.py` — 13 assertions across 4 scenarios
- Updated: `frontend/src/locales/{en,fr,zh,hi}.json` (added `banner.*` keys)
- Updated: `frontend/src/pages/PanelLogin.js` (mount banner above card)
- Updated: `frontend/src/components/LanguageSwitcher.js` (also sets `bannerDismissed`)

### Tests (Playwright, headless)
- ✓ EN browser: banner does NOT show
- ✓ FR browser: banner shows in French; "Keep" persists; reload doesn't re-show
- ✓ ZH browser: "Switch to English" flips title + submit live, persists `hp.lang=en`
- ✓ HI browser w/ pre-set `bannerDismissed`: banner suppressed
- All 13/13 assertions pass

## 🌐 Full-stack i18n / Language Coverage Audit + P0–P3 Fix (2026-02-13)
**Why**: End-to-end audit found ~30 user-facing hardcoded English strings across the bot service helpers and 100% English-only React frontend. User asked for a complete fix from P0 (highest-traffic) through P3 (frontend i18n).

### What landed
- 🛠️ **Foundation** (`js/translation.js`):
  - `translation()` now falls back from missing locale → English (instead of immediately returning the raw key) and emits `console.warn` for both partial and total misses, surfacing prod gaps.
- 🤖 **Bot core hosting & billing** (`js/_index.js`, `js/lang/{en,fr,zh,hi}.js`):
  - Added ~110 new translation keys covering: hosting plan card, billing menu, renew/upgrade modals, credentials reveal, toast strings, status/auto-renew indicators.
  - Refactored `goto.myHostingPlans`, `goto.billingMenu`, `goto.viewHostingPlanDetails`, `goto.revealHostingCredentials`, the Renew Plan modal, the Upgrade Plan modal, and 7 toast strings to use `trans('t.<key>')` lookups.
  - Per-domain billing buttons (`🔄 Renew Now — domain` / `🔁 Toggle Auto-Renew — domain`) now render localised in all 4 languages; matcher rewritten to use emoji-prefix detection so it handles all locales.
- 🔔 **Hosting Scheduler** (`js/hosting-scheduler.js`):
  - Notifications now load each user's `userLanguage` from the `state` collection per loop iteration.
  - All 6 notification surfaces internationalised: 24h expiry warning, auto-renewed success, auto-renew failed, weekly-expired, deleted (post-grace), startup-enforced suspension/deletion.
- 📞 **Phone services** (`js/phone-monitor.js`, `js/phone-scheduler.js`):
  - `buildUserMessage()` (caller-ID-flagged) now accepts `lang`; callers resolve userLanguage from state.
  - All 4 phone-scheduler builders (`buildAutoRenewFailedMsg`, `buildSuspendedMsg`, `buildUsageAlertMsg`, `buildUsageLimitMsg`) refactored to use translation keys for both title and body.
- ⚠️ **Generic error & progress** (`js/error-handler.js`, `js/progress-tracker.js`):
  - `handleError()` accepts `userLang` option; user-facing error toast renders in the user's language.
  - `ProgressTracker` accepts a `lang` parameter (callers pass it through `createProgressTracker`).
- 🚀 **Other services** (P2):
  - `js/bulk-call-service.js` — final campaign report internationalised with per-user lang lookup.
  - `js/sms-app-service.js` — BulkSMS trial-complete + trial-expired messages internationalised.
  - `js/cpanel-routes.js` — All 4 Anti-Red protection warnings internationalised (deploy warning + verify-failed + duplicate paths in two flows).
- 🇬🇧🇫🇷🇨🇳🇮🇳 **React Frontend** (P3):
  - Installed `i18next` + `react-i18next` + `i18next-browser-languagedetector` via yarn.
  - Created `src/i18n.js` with all 4 locales, browser detection (localStorage `hp.lang` → navigator → fallback en).
  - Created `src/locales/{en,fr,zh,hi}.json` with ~120 keys spanning login, dashboard tabs, domains/files/email/security/geo/analytics/account, common verbs, and language names.
  - New `src/components/LanguageSwitcher.js` — reusable globe-icon dropdown using shadcn UI primitives, persists choice to localStorage.
  - Refactored `PanelLogin.js` to use translations (title, subtitle, username/PIN labels, submit button, forgot-PIN help).
  - Refactored `PanelDashboard.js` — header, language switcher slot, all 7 tab labels, sign-out button.
  - Verified live language switching with playwright: EN → FR → ZH → HI all render correctly.

### Files touched (Phase 0 / P0 / P1 / P2 / P3)
- `js/translation.js` — fallback + warning
- `js/lang/{en,fr,zh,hi}.js` — ~110 new keys per locale
- `js/_index.js` — hosting/billing flow refactor
- `js/hosting-scheduler.js`, `js/phone-monitor.js`, `js/phone-scheduler.js`
- `js/error-handler.js`, `js/progress-tracker.js`
- `js/bulk-call-service.js`, `js/sms-app-service.js`, `js/cpanel-routes.js`
- `frontend/package.json`, `frontend/src/i18n.js` (new)
- `frontend/src/locales/{en,fr,zh,hi}.json` (new, 4 files)
- `frontend/src/components/LanguageSwitcher.js` (new)
- `frontend/src/pages/{PanelLogin,PanelDashboard}.js`
- `frontend/src/index.js` (i18n init)
- `js/tests/test_billing_menu_and_gold_copy.js` (updated for locale-aware match)
- `js/tests/test_i18n_coverage.js` (new — 442 assertions)
- `frontend/tests/test_i18n_frontend.js` (new — 45 assertions)

### Tests
- 26/26 — billing menu + Gold value-stack regression (`test_billing_menu_and_gold_copy.js`)
- 9/9  — plan-copy locale parity (`test_plan_copy.js`)
- 442/442 — bot i18n coverage across 4 locales × ~110 keys (`test_i18n_coverage.js`)
- 45/45 — frontend i18n setup (`test_i18n_frontend.js`)
- Live playwright smoke confirmed switcher EN→FR→ZH→HI works in the panel login.

### Backlog / known gaps
- **P3 deeper coverage**: AccountSettings, FileManager, DomainList, EmailManager, SecurityPanel, GeoManager, Analytics, PhoneTestPage, SiteStatusCard still hold ~80% of their strings hardcoded. The i18n infrastructure is in place — switching them over is mechanical.
- **Bot SMS-app device-rename flow** (~10 strings around `_index.js:23956–24160`) and the bulk-call live progress line (`bulk-call-service.js:788`) remain English. Voice-service notifications also unchanged.
- **17 orphan keys** in fr/zh/hi `t` namespaces (`cancelRenewNow`, `Daily`, `Hourly`, etc.) — harmless dead code, defer cleanup.

## 💳 Billing-menu split + Gold-exclusive value-stack copy (2026-02-13)
**Why**: Renew & Auto-Renew controls were buried inside the per-domain "View Hosting Plan" view, mixing operational settings with billing actions. The Gold upgrade page also listed features as 3 abstract bullets rather than a clear value-stack.

### Changes implemented
- 🤖 **Bot** (`js/_index.js`):
  - New top-level **💳 My Plan / Billing** button surfaced in `submenu3` next to "📋 My Hosting Plans".
  - New `goto.billingMenu()` lists every plan with two per-plan action buttons:
    - `🔄 Renew Now — <domain>`
    - `🔁 Toggle Auto-Renew — <domain>` (skipped on weekly plans)
  - Removed `[user.renewHostingPlan]` and `[user.toggleAutoRenew]` button rows from `viewHostingPlanDetails`. Plan view now stays purely operational (credentials, site online/offline, captcha, upgrade, cancel).
  - Plan view now includes a one-line nudge: *"To renew or toggle Auto-Renew, open 💳 My Plan / Billing from the Hosting menu."*
  - `confirmRenewNow` cancel/success branches respect a new `info.billingFlow` flag — users coming from the Billing menu return to the Billing menu, others return to the plan view.
  - Action constant `a.billingMenu` added; full action handler covers per-domain renew + auto-renew toggle parsing.
- 🌍 **Translations** (`js/lang/{en,fr,zh,hi}.js`):
  - Added `user.billingMenu` and `user.backToBillingMenu` keys in all four locales.
- ✨ **Gold-exclusive value-stack** (`js/hosting/plans.js`):
  - Refactored `generatePlanText()` for Gold to emit one bullet per feature, with `✨ Gold-exclusive` callouts next to:
    - 🌐 Unlimited bandwidth
    - 🔐 Wildcard SSL
    - 🚀 Priority support
    - 🛡️ Visitor Captcha toggle
  - Premium tiers keep their compact existing format (no Gold-exclusive callouts).
- 🆙 **Upgrade modal** (`js/_index.js`): Gold tier shown in the in-flight upgrade modal also stacks bullets with the same `✨ Gold-exclusive` highlights.

### Files touched
- `js/_index.js` — submenu3, goto.billingMenu, action handler, viewHostingPlanDetails, confirmRenewNow, upgrade modal
- `js/hosting/plans.js` — Gold value-stack rendering
- `js/lang/{en,fr,zh,hi}.js` — billingMenu + backToBillingMenu labels
- `js/tests/test_billing_menu_and_gold_copy.js` — 26 regression assertions

### Tests
- `node js/tests/test_billing_menu_and_gold_copy.js` — 26 / 26 passing
- `node js/tests/test_plan_copy.js` — 9 / 9 passing (no regression)

## 🛡️ Visitor Captcha — Gold-only feature (2026-04-29)
**Reported by**: @jasonthekidd (chatId 7893016294) — couldn't find the captcha toggle.

**Root cause** (verified via Railway logs): Toggle was only available under "🌐 Bulletproof Domains → tap [domain]" — a menu the user never visited. He was looking under "📋 My Hosting Plans → tap [domain]".

**Production data verified for @jasonthekidd via Railway logs**:
- `cap1online360.com` → `Golden Anti-Red HostPanel (1-Month)` (Gold ✅)
- `huntingtononlinebanking.it` → `Golden Anti-Red HostPanel (1-Month)` (Gold ✅)
Both qualify for Visitor Captcha — he'll see the active toggle (not the locked variant).

### Changes implemented
- 🤖 **Bot** (`js/_index.js`): 
  - Added "🛡️ Visitor Captcha" button to the **Hosting Plan view** (My Hosting Plans → tap [domain]). Locked variant "🔒 Visitor Captcha (Gold only)" shown for non-Golden users with upgrade CTA.
  - **Removed** the captcha toggle from "🌐 Bulletproof Domains → tap [domain]" entirely (3 places: line 23297, 23476, 23555 + post-toggle nav buttons). Bulletproof Domains menu now only has DNS + Shortener.
  - Captcha toggle handler at line 23461 left intact (defensive, for stale states).
- 🌐 **Web Panel** (`frontend/src/components/panel/DomainList.js`): Added a per-domain Visitor Captcha toggle next to each domain card (Main + Addons) — replaces the global Security panel toggle as primary entry point. Gold-locked badge for non-Golden plans + upgrade banner above domain list.
- 🔌 **Backend** (`js/cpanel-routes.js`):
  - New `GET /security/captcha/status` — returns `{ isGold, plan, captchaGoldOnly, domains: [{domain, enabled, hasCloudflare, isMain}] }` for all main + addon domains
  - New `POST /security/captcha/toggle` — body `{ domain, enabled }` — Gold-gated 403, domain-ownership check, deploys/removes CF Worker route + KV bypass
  - Existing `POST /security/js-challenge/toggle` — added Gold gating (403 with `upgradeRequired: true`)
  - `resolveCpPass` middleware now exposes `req.cpPlan`, `req.cpIsGold`, `req.cpAddonDomains`
- 🌍 **Translations** (`js/lang/{en,fr,zh,hi}.js`): Renamed "Anti-Red Protection" → "Visitor Captcha" everywhere in user-facing strings. Added `visitorCaptchaGoldOnly` and `visitorCaptchaNoHosting` keys.
- 🎨 **CSS** (`App.css`): New `.dl-cap-toggle`, `.dl-cap-badge--locked/--nocf/--loading`, `.dl-captcha-banner` styles.

### Plan match logic
Case-insensitive regex `/Golden Anti-Red HostPanel/i` on `cpanelAccounts.plan` — covers both `(1-Month)` and `(30 Days)` variants.

## Recent Fixes (Railway Log Anomalies)
1. **Fix 1**: Added notifyGroup() to all 4 hosting payment paths (Wallet, Bank NGN, BlockBee, DynoPay)
2. **Fix 2**: Added displayMainMenuButtons to goto object (was called but never defined)
3. **Fix 3**: Fixed SSH key PEM-to-OpenSSH conversion (proper SSH wire format)
4. **Fix 4**: Added Contabo NVMe↔SSD product fallback for unavailable products
5. **Fix 5**: Added WHM CERT_NOT_YET_VALID retry + admin alert for clock skew
6. **Fix 6**: Added Contabo createSecret password validation guard

## resetPassword Bug Fix + Windows Restore for @davion419 (2026-04-25)
- 🐛 **Bug fixed**: `resetPassword()` in `contabo-service.js` was running Linux cloud-init reinstall on ALL non-root instances — including Windows boxes (Windows defaultUser=`admin`). Contabo silently coerced the imageId to Ubuntu, turning Windows RDP boxes into Linux during password reset.
- ✅ Fix: gated reinstall on `osType !== 'Windows'`; Windows always uses standard `POST /actions/resetPassword` (no userData, no reinstall)
- ✅ Threaded `osType`/`isRDP` from `vpsPlansOf` record through `setVpsSshCredentials` → `resetPassword`
- ✅ Also fixed `reinstallInstance()` to skip empty `sshKeys: []` arrays (Contabo rejects even `[]` for Windows)
- ✅ Reinstalled Windows on @davion419's `203220843` via `/app/scripts/restore-davion419-windows.js`; DB record canonicalized

## Manual VPS Provisioning for @davion419 (2026-04-25)
- Linked two pre-existing Contabo instances (`203220843` Windows RDP + `203228089` Linux) to chatId `404562920` (@davion419) in production `vpsPlansOf`
- Idempotent script at `/app/scripts/provision-davion419-vps.js` — schema matches `createVPSInstance()` exactly
- 1-month expiry enforced from each instance's Contabo `createdDate`:
  - vmi3220843 (RDP) → expires 2026-05-10
  - vmi3228089 (Linux) → expires 2026-05-12
- Verified end-to-end: `fetchUserVPSList()` and `fetchVPSDetails()` both return correct data
- `adminProvisioned: true` flag distinguishes from organic purchases

## Domain Add-on / Creation Flow Verification (2026-04-25)
Verified: domain creation + addon-domain flows fully consistent with the recent SSL/421 fix.
- ✅ Argo Tunnel ingress confirmed routing `http://209.38.241.9:80` (manual fix in place)
- ✅ All 4 SSL setSSLMode call sites in creation/addon flows use `'flexible'` initial mode
- ✅ Protection-enforcer 24h grace + origin probe verified working on live origin
- ✅ Production audit: 4/4 tunnel-routed hosting domains return 200 OK + anti-red `cloaked`
- ✅ `entsecurity.xyz` (originally broken) — SSL=full, 200, cloaked
- ✅ No `setSSLMode(..., 'strict')` calls remain in codebase
- 🔧 Fix applied: `cpanel-routes.js:1126` (AutoSSL post-success) — was no-op `'flexible'` with stale "strict" log → now `'full'` with accurate log; aligns with new architecture and accelerates safe upgrade
- ⚠️ `tdsecurity-portal.com` — known user-side NS misconfiguration (not platform issue)

## Original Problem Statement
Multi-service platform (Telegram bot + React frontend + Node.js backend) managing domains, hosting, URL shortening, wallet/payments, and Cloud Phone (SIP/IVR/voice).

## Core Architecture
- **Backend**: Node.js monolith (`js/_index.js`) — Telegram bot state machine (22k+ lines)
- **Frontend**: React app via `cpanel-routes.js`
- **Database**: MongoDB
- **Key Integrations**: Telegram, Cloudflare, cPanel/WHM, ConnectReseller, OpenProvider, OpenExchangeRates, Twilio, Telnyx, BlockBee/DynoPay


### Anti-Red White-Page Fix Verification (Feb 2026)
- **Issue**: `sbsecurity-portal.com/app/index.php?view=login&id=...` returning white page on deep-link access.
- **Root Cause**: User's PHP kit (`app/index.php`) required `$_SESSION['FIL212sD']` (set by root `index.php`). Deep-link requests bypass root and hit the session gate → blank page.
- **Permanent Fix Verified Live**:
  - `.user.ini` → `auto_prepend_file = /home/<user>/public_html/.antired-challenge.php` ✅
  - `.antired-challenge.php` (in `generateIPFixPhp()` at `js/anti-red-service.js:458`):
    - Restores real visitor IP from `CF_CONNECTING_IP` header
    - Auto-starts PHP session (`session_status()` check)
    - Sets `$_SESSION['FIL212sD'] = true` globally
  - Deployed automatically via `deployCFIPFix()` when Worker is active (`deployFullProtection` → `anti-red-service.js:2057`).
- **End-to-end test**: Deep-link URL now returns HTTP 200, 100KB "Sign in | Scotiabank" page through CF Worker challenge.
- **File-revert concern**: Nomadly code does NOT touch `app/*.php` files (verified via `grep -rn "app/lang\|app/index\|app/config"`). Previous reverts were from the client re-uploading their broken template, not from this codebase. Current file mtimes stable over multi-minute check window.

### Protection Heartbeat — Self-Healing Cron (Feb 2026)
- **New file**: `/app/js/protection-heartbeat.js`
- **What it does**: Hourly (configurable via `PROTECTION_HEARTBEAT_INTERVAL_MIN`) iterates all `cpanelAccounts` in MongoDB and verifies each account has:
  - `/public_html/.user.ini` with `auto_prepend_file` pointing to the challenge PHP
  - `/public_html/.antired-challenge.php` containing the IP-fix + session bootstrap (`ANTIRED_IP_FIXED`, `CF_CONNECTING_IP`, `FIL212sD`)
  - If either is missing or mutated, calls `antiRedService.deployCFIPFix(cpUser)` to restore immediately
- **Wired in**: `_index.js` alongside `protectionEnforcer` init (line ~1748)
- **Rate-limited**: 250ms delay between accounts to avoid WHM API throttling
- **Verified**: manual test `checkAndRepair('sbse8305')` → `{ok:true, action:'none'}`; 6/6 unit tests on intact-detection; supervisor log shows clean startup.
- **Cleanup**: Removed leftover `/public_html/_check.php` diagnostic file from `sbse8305` via WHM API2 `Fileman::fileop op=unlink`.


## Completed (Current Session — Feb 2026)

### Domain Pricing: "Show worst-case, charge best-case"
- Shows higher registrar price; charges cheaper when possible; credits savings
- Tests: 10/10 passing

### BulkIVR Smart Wallet
- $50 min only for first-time or zero-balance; returning users run freely
- `BULK_CALL_MIN_WALLET` configurable via .env
- Tests: 10/10 passing

### SIP Outbound Call Fix (Twilio numbers on Telnyx SIP)
- **Bug**: @lamanifestor calls rejected — Telnyx D51 error (Twilio number not verified on Telnyx)
- **Root Cause (from Railway logs)**:
  1. `transferCall(callControlId, sipUri, twilioNumber)` → D51 rejection
  2. Connection ANI override set to Twilio number → auto-routed calls also rejected
  3. Fallback code referenced undefined `_twilioClient` variable
- **Fix**:
  1. `TELNYX_DEFAULT_ANI=+18556820054` — valid Telnyx number used as `from` for SIP bridge transfers
  2. ANI override reset to default before transfer (prevents auto-routing race)
  3. `_attemptTwilioDirectCall()` helper — proper Twilio sub-account credential lookup + direct call fallback
- **Files**: `js/voice-service.js`, `backend/.env`

## Prioritized Backlog
- P2: Add monitoring for OpenExchangeRates API
- Backlog: Refactor `_index.js` into feature modules

## Feb 2026 — SMS App "Network Error" on Login (stale Railway hostname baked into APK)
- **Reported**: User `@onlicpe` (chatId `7080940684`) on Samsung can't log into Nomadly SMS App — shows "Network error. Check your internet connection and try again." immediately after tapping **Connect to Account**.
- **Diagnosis via Railway GraphQL logs**:
  - Server **never receives** any `/sms-app/auth/7080940684` request (0 hits across 500-line log tail on the active deployment). The failure is client-side; the server is healthy and `[SmsApp] Service initialized` / `Routes registered` on startup.
  - Extracted the APK (`backend/static/nomadly-sms.apk`) and read `assets/public/js/api.js`: `productionUrl: 'https://nomadlynew-production.up.railway.app'` — hardcoded.
  - Direct probe of that hostname returns **HTTP 404 "Application not found"** (Railway response for a renamed/removed service slug).
  - The Railway service is now served at **`nomadly-email-ivr-production.up.railway.app`** (matches `SELF_URL` env var on the live service). Probing that URL with the exact user's endpoint returns HTTP 200 with valid user `onlicpe`, 100-SMS trial active.
  - The referenced `Moxxcompany/NomadlySMSfix` repo is a **different app** (React Native + native Kotlin `MySendSmsModule`), not the current Capacitor build — unrelated to this issue. The "Samsung device" framing was misleading; the stale URL breaks every device equally.
- **Root cause**: Railway service slug was renamed from `nomadlynew-production` → `nomadly-email-ivr-production`, but the APK (Capacitor web bundle) still carries the old hostname. Every installed APK globally is dead until the APK is rebuilt with the new URL.
- **Source fix applied** (`/app/sms-app`):
  - `www/js/api.js` — `productionUrl` updated to `https://nomadly-email-ivr-production.up.railway.app` + comment warning that Railway slugs change on rename.
  - `README.md` — 3 references updated (Architecture, Server API Endpoints, Railway Deployment sections) with a warning note.
  - `npx cap sync android` run — change is already mirrored into `android/app/src/main/assets/public/js/api.js`.
- **APK rebuilt in pod** (`/app/sms-app/android/app/build/outputs/apk/debug/app-debug.apk` → **3,842,182 bytes after the config-endpoint + error-classification update**; earlier 3,800,466 bytes plain URL fix).
  - Emergent pod is `aarch64`; Google's official `aapt2` is x86-64-only. Prior agents worked around this by placing a native-aarch64 `aapt2` at `/opt/aapt2/aapt2` (referenced by `sms-app/android/gradle.properties → android.aapt2FromMavenOverride`). Reproducible recipe now committed to `sms-app/README.md` under "Rebuilding the APK inside the Emergent pod":
    1. `apt install openjdk-17-jdk-headless unzip curl`.
    2. Install Google cmdline-tools + `platform-tools`, `platforms;android-34`, `build-tools;34.0.0` via `sdkmanager` (x86-64 binaries; fine for everything except `aapt2`).
    3. `curl` the `Lzhiyong/sdk-tools` `android-sdk-tools-static-aarch64.zip` release asset and copy `build-tools/aapt2` to `/opt/aapt2/aapt2` — this is the native-aarch64 replacement Gradle picks up via `aapt2FromMavenOverride`.
    4. `npm install && npx cap sync android && ./gradlew assembleDebug` inside `sms-app/`. ~1 m 50 s fresh, ~20 s incremental.
  - Both rebuilt APKs pass the URL check (`grep -oE 'https?://[a-zA-Z0-9./_-]+' assets/public/js/api.js` returns only the intended hostname).
  - Copied into both serving paths (`/app/backend/static/nomadly-sms.apk`, `/app/static/nomadly-sms.apk`) and verified the preview download endpoint serves the freshly-built bytes.
- **P1 "URL rewrite without rebuild" also implemented** — per user request, don't want to rebuild the APK every time the backend moves.
  - **New unauthenticated endpoint** `GET /sms-app/config` in `js/sms-app-service.js` returns `{apiBase, minAppVersion, maintenance, maintenanceMessage}`, all driven by env vars (`SMS_APP_API_BASE`, `SMS_APP_MIN_VERSION`, `SMS_APP_MAINTENANCE`, `SMS_APP_MAINTENANCE_MESSAGE`) — all optional, unset by default.
  - **APK client** (`sms-app/www/js/api.js`) completely rewritten around an `async baseUrl()` resolver:
    - On first API call fetches `${seedUrl}/sms-app/config` with a 5 s timeout.
    - If response carries a non-empty `apiBase`, every subsequent request hits that URL instead (memoised per launch).
    - If the config fetch fails (DNS / timeout / HTTP error), silently falls back to the seed URL so the app still works.
    - Introduces an `APIError` class with `{status, type, detail}` — types: `network` (fetch-level failure), `timeout`, `http` (4xx/5xx), `parse` (non-JSON body). This is what the user-facing error messages key off.
  - **Login UI** (`sms-app/www/js/app.js`) rewritten to surface the new error taxonomy:
    - `type=network` → "Can't reach the server. Check your internet connection, then try again. If the problem persists, the server may be down — contact @NomadlyBot support."
    - `type=timeout` → "The server is responding slowly. Try again in a moment."
    - `status=401` → "Invalid activation code. Get a fresh code from @NomadlyBot."
    - `status=403` → device-limit message (exact text from the server response).
    - `status>=500` → "Server error. Please try again in a few minutes."
    - Old blanket "Network error" collapse (which made the stale-URL outage look like a connectivity issue and cost real diagnostic time) is gone.
- **Operational recipe for the next Railway migration** (documented in README):
  - Ideal: bake `https://api.<operator-domain>` as the seed, CNAME it at Cloudflare (DNS-only / grey cloud) to the current Railway slug. Any future Railway rename is 1 DNS record edit; every installed APK recovers within DNS TTL (~5 min).
  - Emergency: set `SMS_APP_API_BASE=https://<new-host>` on Railway and redeploy — APKs pick up the override on next launch without touching DNS.
- **User re-install required for onlicpe & existing installs**: they must open the bot, tap "📲 Download the app" and re-install to pick up the rebuilt APK.
- **Problem**: "Choose Your Plan" copy was duplicated across 5 files — `js/lang/{en,fr,hi,zh}.js` + `js/config.js` — so every wording/price tweak had to be mirrored 5 times and drifted easily.
- **Fix**: Extracted the template to **`js/lang/plan-copy.js`** which exposes `buildChooseSubscription(lang)` built from:
  - a shared structural template (title → perks line → 3 plan rows → "best value" Monthly marker)
  - per-language `LABELS` dictionary (`title`, `perksIntro`, `daily/weekly/monthly`, `domain/validations/smsDevices` callables, `bestValue`)
  - env-driven pricing + quotas (read at call time so restarts pick up changes)
- Each of the 5 files now imports `buildChooseSubscription` and calls it with its locale code (`'en'`/`'fr'`/`'hi'`/`'zh'`).
- **Output is byte-for-byte identical** to the pre-refactor copy — verified via diff across all locales.
- **Regression test**: `js/tests/test_plan_copy.js` (8 assertions) locks the invariant that every locale + `config.js` stays in lockstep with the builder, and that `HIDE_SMS_APP` branching works.

## Feb 2026 — "Choose Your Plan" Copy Refresh
- **Goal**: Replace verbose plan listings with a compact, scannable template — single intro line with inline perks, one row per plan (price inline), "best value" marker on Monthly.
- **Template** (applied to both `HIDE_SMS_APP` branches):
  ```
  <b>Choose Your Plan</b>
  All plans: 🔗 Unlimited links · 📱 Validations w/ owner names · [📧 BulkSMS ·] 📞 Cloud IVR
  🟢 <b>Daily — $X</b>    N domain · N validations [· 3 SMS devices]
  🔵 <b>Weekly — $X</b>   N domains · N validations [· 10 SMS devices]
  ⭐ <b>Monthly — $X</b> · best value   N domains · N validations [· unlimited SMS devices]
  ```
- **Files updated (all 4 locales + fallback config)**:
  - `js/lang/en.js` (done in previous turn)
  - `js/lang/fr.js` — French translation preserving structure
  - `js/lang/hi.js` — Hindi translation preserving structure
  - `js/lang/zh.js` — Chinese translation preserving structure
  - `js/config.js` — default fallback copy also updated to match
- **Verification**: All 5 files load without syntax errors via `node -e "require(...)"`; Node.js bot restarted cleanly (Telegram webhook verified, all services initialized).

## Key Files
- `js/voice-service.js` — SIP outbound/inbound, IVR, call forwarding
- `js/telnyx-service.js` — Telnyx API wrapper
- `js/bulk-call-service.js` — BulkIVR campaigns
- `js/domain-service.js` — Domain registration, dual-registrar pricing
- `js/tests/test_domain_price_fix.js` — Domain pricing tests
- `js/tests/test_bulkivr_wallet.js` — BulkIVR wallet tests


## Recent Changes
- **Telnyx Race Condition Fix** — Suppressed error 90018 ("Call has already ended") across all Telnyx call control functions. Added `_endedCalls` tracker in voice-service.js with guards in all gather/speak/hangup handlers.
- **Feb 2026 — Domain Restoration for @pacelolx (chatId 6395648769)** — Restored 27 OpenProvider domains to user's account (no wallet debit) via `/app/scripts/restore-pacelolx-domains.js`. Script fetches live OP metadata (opDomainId, status, renewal_date, nameservers) for each domain and upserts into `domainsOf` (KV map with `@`-escaped keys) and `registeredDomains` (_id=domain, val={registrar, opDomainId, opExpiry, opStatus, nameservers, nameserverType='cloudflare', ownerChatId, …}). 1 domain (`qbreverse.com`) skipped — not found on OpenProvider. Verified: bot's `getPurchasedDomains(6395648769)` returns all 27 domains; all have complete `registeredDomains` metadata.


## Feb 2026 — Hosting Anti-Red Plan "2-Month Bug" Defensive Fix
- **Report**: User reported that a monthly Anti-Red hosting purchase was granting ~2 months of validity instead of 1 (affected user's DB record was no longer available; Scenario C per plan).
- **Audit result**: All code paths writing `expiryDate` at initial creation already use `now + 30 days`. Most plausible root cause is duplicate invocation of `registerDomainAndCreateCpanel` (webhook retry / user double-tap / race between callbacks) producing stacked records or extended expiry.
- **Fixes (files `js/cr-register-domain-&-create-cpanel.js`, `js/_index.js`)**:
  1. **Idempotency guard** at the top of `registerDomainAndCreateCpanel`: DB lookup on `cpanelAccounts.{ domain, deleted: {$ne: true} }`. If found, abort with `{ success: false, duplicate: true }` — no WHM create, no storeCredentials, no expiry extension.
  2. **Single source of truth for plan duration** — replaced inline `(info.plan.includes('1-Week') ? 7 : 30)` with `getPlanDuration(info.plan)` from `js/hosting-scheduler.js`. Creation, manual renew, and auto-renew now agree.
  3. **Audit log** on every provisioning: `[Hosting] AUDIT provisioning <domain> cpUser=… chatId=… plan="…" durationDays=… expiryDate=<ISO>`.
  4. **All 4 payment entry points** (wallet USD, bank NGN, crypto BlockBee, crypto DynoPay) now honor `hostingResult.duplicate` and skip refund/error pipelines so legitimate payments aren't double-credited on webhook retries.
- **Deployment**: Fix is in the local repo; **NOT yet deployed to Railway production** (also still pending: earlier `chatId` string fix + unified call-billing fix).


## Feb 2026 — SMS App v2.6.0 (Delivery Fix + Version Display Fix)
- **Reports**: User @onlicpe (1) downloaded the "latest" APK but Settings still showed old version (2.1.5/2.4.1), (2) Sent a campaign but received "0 sent" — messages never actually dispatched.
- **Root causes**:
  1. **Version mismatch** — three places hardcoded old version strings: `android/app/build.gradle` (`versionName "2.4.1"`), `package.json` (`2.0.0`), `www/index.html#setVersion` (`2.1.5`), `www/js/app.js` fallback (`2.4.1`). Also `www/js/api.js` sent `appVersion=2.2.0` to the server.
  2. **SMS delivery failure** — the new foreground-service path (`SmsBackgroundService`) introduced in v2.5.x starts via `startForegroundService(Intent type=dataSync)`. On some Android 13/14 devices the service starts successfully but the BroadcastReceiver for the SMS-sent PendingIntent never fires (POST_NOTIFICATIONS missing, OEM battery-kill, or `foregroundServiceType=dataSync` restrictions), so `sentCount` sits at 0 forever and UI shows "0 sent".
- **Fix (v2.6.0)**:
  1. **Version bumps everywhere** — `build.gradle` (14/2.6.0), `package.json` (2.6.0), `index.html` meta + `#setVersion` (2.6.0), `app.js` console/fallback (2.6.0), `api.js` sync default (2.6.0). Settings screen now reads version dynamically from the `meta[name="app-version"]` tag to eliminate future drift.
  2. **Revert to proven JS-loop sending** — `startSending()` no longer calls `DirectSms.startBackgroundSending`. All campaigns now flow through the per-contact `DirectSms.send()` BroadcastReceiver path that worked reliably in 2.3.x. Background-service code is kept in the APK for future opt-in but is inert.
  3. **Backend-side version bumps** — `js/sms-app-service.js` (`SMS_APP_VERSION`, changelog, `latestVersion` in sync endpoint) and `js/_index.js` (`/sms-app/download/info` returns `2.6.0`).
  4. **APK rebuilt** — `3.84MB` at `/app/static/nomadly-sms.apk`, `versionCode=14`, `versionName=2.6.0` (verified via `aapt2 dump badging`).
- **Files touched**: `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`, `sms-app/www/js/app.js`, `sms-app/www/js/api.js`, `js/sms-app-service.js`, `js/_index.js`, `static/nomadly-sms.apk`.
- **Deployment**: Local only. Users still need the Railway deployment to receive the new APK via Telegram bot broadcast.


## Feb 2026 — SMS App v2.6.1 (One-Tap "Send Test SMS")
- **Feature**: New button in Settings → Diagnostics section lets users send a single test SMS to their own number to verify delivery before running a campaign. First tap prompts for phone (saved to localStorage); subsequent taps send instantly. Includes a "Change" button to update the saved number.
- **Test message** (fixed, single-segment): `Nomadly SMS test - your device can send SMS. Sent at HH:MM:SS` — short on purpose so the test isolates the SMS path from multipart complications.
- **Flow**: Uses the same `nativeSms()` → `DirectSms.send()` BroadcastReceiver path as campaign sending, so a successful test proves campaigns will work. Error reasons are surfaced with the same hint map as the campaign error screen (no_service, radio_off, generic_failure, permission_denied, etc.).
- **Version**: bumped to `2.6.1` everywhere (gradle 15/2.6.1, package.json, index.html meta + #setVersion, app.js, api.js, `js/sms-app-service.js` SMS_APP_VERSION + latestVersion, `js/_index.js` download/info).
- **APK rebuilt** — 3.80MB at `/app/static/nomadly-sms.apk` (`versionCode=15`, `versionName=2.6.1`).
- **Files touched**: `sms-app/www/index.html` (Diagnostics section), `sms-app/www/js/app.js` (`promptTestPhone`, `saveTestPhone`, `sendTestSms`, `_testSmsErrorHint`), `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/js/api.js`, `js/sms-app-service.js`, `js/_index.js`.
- **Data test IDs**: `send-test-sms-btn`, `change-test-phone-btn`.


## Feb 2026 — SMS App v2.7.0 (SIM Selector + Auto-Rotate + Background Service + Auto-Canary + Test Logs)

A bundled feature release addressing user feedback and operational intelligence.

### 1. SIM card selector (user-requested)
- **Native (DirectSmsPlugin.java)**: New `listSims()` and `requestPhonePermission()` methods. Enumerates active SIMs via `SubscriptionManager.getActiveSubscriptionInfoList()`, returns `[{subscriptionId, slotIndex, carrierName, displayName, phoneNumber, mcc, mnc}]`. Added `READ_PHONE_STATE` permission (Capacitor alias `phone`).
- **Native `send()`**: accepts optional `subscriptionId`; routes through `SmsManager.getSmsManagerForSubscriptionId(subId)` (or `createForSubscriptionId` on S+) with fallback to default SIM.
- **Per-SIM sender helper**: `getSmsManagerForSub(context, subId)` — resolves SmsManager for any user-picked SIM. Swallowed exception falls back to default SIM so the send never silently dies.
- **UI**:
  - Settings → "SIM Card" section: default-SIM dropdown + "Refresh SIM list" button.
  - Campaign wizard → Advanced Settings: per-campaign SIM override dropdown with options `Use default SIM`, `Auto-rotate across all SIMs` (when 2+ SIMs present), and each specific SIM.
  - Test SMS uses the default SIM and shows which SIM was used in the status line.

### 2. Auto-rotate SIMs (bonus)
- `startBackgroundSending()` accepts `subscriptionIds: JSON-array` and persists it in SharedPreferences.
- `SmsBackgroundService` reads the list and picks `subs[currentIndex % subs.length]` for each message. Evens out carrier rate limits (2 SIMs ≈ 2× throughput).
- JS-loop path has the same rotation logic in `sendNext()`.

### 3. Background-service toggle (opt-in beta)
- Settings → "Advanced" → "Keep sending when app is closed" toggle (`bgServiceEnabled` in localStorage).
- When ON, `startSending()` routes through `DirectSms.startBackgroundSending()` which persists state in SharedPreferences and runs as a foreground service (`foregroundServiceType=dataSync`). Automatic fallback to JS-loop if the service call throws.
- When OFF (default), campaigns use the proven JS-loop path.
- Added `POST_NOTIFICATIONS` permission (Android 13+ requires it for foreground-service progress notifications).

### 4. Auto-canary (silent-failure guard)
- `_checkAutoCanary(state)` fires one-time after every `sendNext()`: if 30s elapsed, at least 3 attempts made, and zero successes, it paints a red warning banner on the Sending screen and toasts the user pointing to Settings → Diagnostics → Send Test SMS.
- Prevents users from burning their contact list on a broken SIM / permission / carrier block.

### 5. Server-side test-SMS logging
- **Endpoint**: `POST /api/sms-app/test-log/:chatId` — writes to `testSmsLogs` collection with `{chatId, phoneHash(16ch SHA-256 prefix), carrierPrefix, success, errorReason, errorCode, appVersion, simCarrier, simSlot, ts}`. No raw phone numbers stored.
- **Client**: `App._reportTestSmsResult()` fires after every test SMS (success or fail), POSTing hashed phone + carrier prefix for carrier-specific intelligence.
- **Admin bot command**: `/testlogs [days=7]` — aggregates last N days into:
  - total count, OK/fail split, distinct users
  - top 10 failure reasons with counts
  - top 10 country/carrier prefixes with OK-rate per prefix
- Lets operator spot *"MTN Nigeria: 8 generic_failure in last 48h"* before individual users complain.

### Version bumps (end-to-end 2.7.0)
- `android/app/build.gradle` → versionCode 16, versionName 2.7.0
- `package.json`, `www/index.html` meta + Settings display, `www/js/app.js` (init log + `getAppVersion` fallback + `showSettings` fallback)
- `www/js/api.js` sync default
- `js/sms-app-service.js` SMS_APP_VERSION + new conversational release note
- `js/_index.js` `/sms-app/download/info`

### APK verified
- Path: `/app/static/nomadly-sms.apk` (3.81MB)
- aapt2 badging: `versionCode=16 versionName=2.7.0` with `SEND_SMS`, `READ_PHONE_STATE`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE_DATA_SYNC` declared.

### Data test IDs
`wz-sim-select`, `set-default-sim`, `refresh-sims-btn`, `set-bg-service`, `send-test-sms-btn`, `change-test-phone-btn`.

### Files touched
Frontend/mobile: `sms-app/android/app/src/main/java/com/nomadly/sms/plugins/DirectSmsPlugin.java`, `sms-app/android/app/src/main/java/com/nomadly/sms/services/SmsBackgroundService.java`, `sms-app/android/app/src/main/AndroidManifest.xml`, `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`, `sms-app/www/css/style.css` (switch toggle CSS), `sms-app/www/js/app.js`, `sms-app/www/js/api.js`.

Backend: `js/sms-app-service.js` (test-log endpoint + version bump + release note), `js/_index.js` (`/testlogs` admin command + download/info version).


## Feb 2026 — SMS App v2.7.1 (Per-SIM Auto-Throttle + Carrier Precheck)

Follow-on to v2.7.0: turns the newly-collected `testSmsLogs` data into an active UX loop and makes per-SIM sending carrier-aware.

### Per-SIM auto-throttle (mid-campaign)
- In `sendNext()` the app keeps a rolling window of the last 5 outcomes per SIM (`simStats[subId].recent`).
- If ≥ 4 of the last 5 from a SIM are rate-limit-style failures (`generic_failure`, `send_timeout`, `multipart_timeout`):
  - **Multi-SIM mode**: that SIM is added to `throttledSims` and silently skipped in the rotation for the remainder of the campaign (as long as ≥ 1 live SIM remains). Toast: *"Carrier rate limit detected — pausing SIM 2 — Airtel for this campaign."*
  - **Single-SIM mode (or all SIMs rotated out)**: the gap time is doubled via `throttleMultiplier` (capped at 4×). Toast: *"Carrier appears to rate-limit — slowing send rate 2×."*
- Tracker resets after each decision so we don't re-throttle on the same 5-sample window.
- The JS-loop `setTimeout(..., s.gapTime * s.throttleMultiplier)` applies the multiplier automatically.

### Campaign precheck banner (pre-send recommendation)
- New endpoint `GET /sms-app/carrier-stats?prefixes=1,234,44` aggregates `testSmsLogs` over the last 14 days by carrier dial-prefix and returns `{sample, success, rate}` per prefix.
- Wizard Step 4 (Review & Send) now fires `_runCarrierPrecheck(contacts)` which:
  1. Bins target contacts by their country/carrier prefix (first 1–3 digits).
  2. Fetches stats for those prefixes.
  3. If any prefix with ≥ 5 samples has < 70% success rate, renders a red banner listing the prefix, sample size, success %, and how many contacts it affects.
  4. Shows an **"Enable Auto-rotate across my SIMs"** button that flips `wzSimSelect` → `rotate` (only when ≥ 2 SIMs are available).

### Version bumps (2.7.1)
- `build.gradle` 17/2.7.1, `package.json`, `index.html` meta + setVersion, `app.js`, `api.js`, `sms-app-service.js` SMS_APP_VERSION + new conversational release note, `_index.js` download/info.

### APK verified
- Path: `/app/static/nomadly-sms.apk` (3.81MB) — `versionCode=17`, `versionName=2.7.1` (aapt2). All new logic present in bundled `assets/public/js/app.js`.

### Data test IDs
`carrier-precheck-banner`, `enable-rotate-btn`.

### Files touched
`js/sms-app-service.js` (new `/sms-app/carrier-stats` endpoint + version bump + release note), `js/_index.js` (download/info version),  
`sms-app/android/app/build.gradle`, `sms-app/package.json`,  
`sms-app/www/index.html` (precheck banner slot + version meta/setVersion),  
`sms-app/www/js/api.js` (`getCarrierStats()` + sync version),  
`sms-app/www/js/app.js` (`_runCarrierPrecheck`, `_enableAutoRotateFromPrecheck`, `_recordSimOutcome`, `_applyAutoThrottle`, `_simLabelForId`, throttle-aware sendNext + timer, sending-state init for `simStats`/`throttledSims`/`throttleMultiplier`).


## Feb 2026 — SMS App v2.7.2 (Bot-Managed SIM Settings + Per-Campaign SIM Picker)

Extends v2.7.x bot ↔ app parity so users can manage SIM prefs without opening the app.

### New server collections
- **`userSmsPrefs`**: per-user `{_id: chatId, defaultSubscriptionId, autoRotate, bgServiceEnabled, sims: [{subscriptionId, slotIndex, carrierName, displayName}], simsUpdatedAt, updatedAt}`. Acts as the source of truth for SIM prefs; the app syncs local storage against this on every startup.
- **`smsThrottleEvents`**: per-throttle-decision `{chatId, action: 'drop'|'slow', subscriptionId, simCarrier, carrierPrefix, windowFailures, campaignId, appVersion, ts}`. Aggregated in admin `/testlogs`.

### New server endpoints (auth-gated via activation-code match)
- `POST /api/sms-app/sims/:chatId` — app reports detected SIMs (upsert into `userSmsPrefs`).
- `GET /api/sms-app/prefs/:chatId` — return current prefs.
- `PUT /api/sms-app/prefs/:chatId` — update prefs; accepts `{defaultSubscriptionId?, autoRotate?, bgServiceEnabled?}`.
- `POST /api/sms-app/throttle-events/:chatId` — log each auto-throttle decision.
- `/sms-app/sync` response extended with `userPrefs` so app can apply bot-made changes on startup.
- Exported helpers `smsAppService.getUserSmsPrefs()` / `setUserSmsPrefs()` for bot handlers.

### App-side wiring (v2.7.2)
- `refreshSims()` now pushes the detected SIM list to `/sims/:chatId` (best-effort).
- `saveDefaultSim()` / `saveBgServiceToggle()` mirror the change to server via `API.updateUserPrefs`.
- `syncData()` applies `data.userPrefs` to local storage — bot-side changes propagate on next app open.
- `_resolveCampaignSim()` now also honors a user-default `autoRotate` flag when the campaign has no explicit `simSelection` and ≥ 2 SIMs are present.
- `_applyAutoThrottle()` fires `API.reportThrottleEvent()` for every `drop` / `slow` decision.
- New `api.js` methods: `reportSims`, `getUserPrefs`, `updateUserPrefs`, `reportThrottleEvent`.

### Bot UX
- **New BulkSMS menu button**: `⚙️ SMS Settings` (between Manage Devices and Reset Login). Also triggerable via `/smssettings`.
- **Settings message** lists detected SIMs + 3 toggles with inline buttons:
  - SIM row: `[Default] [SIM 1] [SIM 2] …` — tap to set default.
  - `🔁 Auto-rotate: ON/OFF` — tap to toggle.
  - `📲 Background: ON/OFF` — tap to toggle.
  - `🔄 Refresh` — re-read prefs.
  - If no SIMs reported yet: graceful hint ("Open the app once so we can detect your SIMs").
- **Per-campaign SIM picker**: after user taps "Send Now" or schedules a campaign from the bot, a second inline-keyboard message appears: `[Use default] [🔁 Auto-rotate] [SIM 1 — …] [SIM 2 — …]`. Selection is saved via `updateCampaign(..., { simSelection })`.
- **Callback-query handlers**: `smsprefs:sim:<id>`, `smsprefs:rotate:<0|1>`, `smsprefs:bg:<0|1>`, `smsprefs:refresh`, `campsim:<campaignId>:<value>`.
- **`/testlogs` admin command** now also reports `Auto-throttle events` — last-N-days aggregation grouped by `simCarrier | carrierPrefix` with drop/slow counts.

### `updateCampaign` schema change
- `simSelection` added to the `allowed` update whitelist and `createCampaign` default (`'default'`) so the field persists cleanly through bot edits.

### Version bumps (end-to-end 2.7.2)
- `build.gradle` 18/2.7.2, `package.json`, `index.html` meta + setVersion, `app.js` init log + fallback + showSettings fallback, `api.js` sync default, `sms-app-service.js` SMS_APP_VERSION + conversational release note (mentions new bot settings), `_index.js` `/sms-app/download/info`.

### APK verified
- Path: `/app/static/nomadly-sms.apk` — 3.81MB — `versionCode=18`, `versionName=2.7.2` (aapt2). All new JS present (`reportSims`, `updateUserPrefs`, `reportThrottleEvent`, `autoRotateDefault`, `userPrefs` handling).

### Data test IDs
Inherited from v2.7.x — no new UI in app. Bot uses text buttons + inline callbacks.

### Files touched
- `js/lang/en.js` (new `smsAppSettings` label)
- `js/sms-app-service.js` (new collections + endpoints + helpers + createCampaign simSelection + updateCampaign whitelist + sync response)
- `js/_index.js` (BulkSMS keyboard adds Settings button, `/smssettings` handler, callback_query handlers for `smsprefs:*` and `campsim:*`, `renderCampaignSimPicker` helper, `/testlogs` extended, download/info version, per-campaign picker call after `createCampaign`)
- `sms-app/www/js/api.js` (4 new methods + sync default version)
- `sms-app/www/js/app.js` (reportSims on refresh, updateUserPrefs on save, apply prefs from syncData, autoRotateDefault honored, report throttle events, init/fallback versions)
- `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`


## Feb 2026 — SMS App v2.7.3 (Backlog Closeout: Edit SIM / Rename / Throttle Alerts)

Ships all three v2.7.2 backlog items plus the proactive-alert improvement in one release.

### 1. Edit SIM on an existing campaign (from bot)
- **My Campaigns** view now appends a second inline-keyboard message with a `📶 Change SIM · <name>` button per editable campaign (statuses: `draft`, `queued`, `scheduled`, `paused`).
- Tapping it triggers `campsim:<id>:picker` which re-renders the full SIM picker (Use default / Auto-rotate / SIM 1 … SIM N) on the same message (edit-in-place).
- Selection is saved via `updateCampaign(campaignId, chatId, { simSelection })` (already whitelisted in v2.7.2) and picked up by the app on next sync.

### 2. SIM label personalization
- `userSmsPrefs.simLabels: { [subIdString]: customLabel }` — new map on the server-side prefs doc.
- `setUserSmsPrefs()` accepts `simLabels` patch objects.
- **Bot rename flow**:
  - `/smssettings` now has a `✏️ Rename SIM N` button per SIM.
  - Tapping sets state `smsapp_rename_sim` with `smsapp_rename_sim_subid`; user sends the new label (max 20 chars). Send `clear` to remove a label.
  - Saved label appears in `/smssettings`, per-campaign picker, and all bot-rendered SIM references via `simLabelFor(prefs, sim)`.
- **App-side**: `data.userPrefs.simLabels` is synced into `App.simLabels` on sync. `_simLabel(sim)` uses the custom label when present, so campaign-wizard dropdowns, Settings picker, and Test SMS status line all reflect it.

### 3. Proactive throttle alerts (combined with 4. potential improvement)
- `POST /sms-app/throttle-events/:chatId` endpoint now fires a Telegram message after writing the event.
- **Debounce**: alert fires at most once per campaign, OR once every 10 minutes (whichever is later). Tracked via `userSmsPrefs.lastThrottleAlertCampaignId` + `lastThrottleAlertAt`.
- **Message content** (conversational): `⚠️ Carrier rate limit detected — your app paused/slowed <carrier>. Want to dodge this on future campaigns?` with action buttons:
  - `🔁 Enable auto-rotate for future campaigns` → callback `throttleact:rotate_on` → flips `autoRotate` in prefs (hidden if already ON).
  - `👍 Got it, dismiss` → callback `throttleact:dismiss`.
- The alert leverages the `_bot` instance held by `sms-app-service` (passed in via `initSmsAppService`).

### Callback handlers added to `_index.js`
- `campsim:<id>:picker` — re-open SIM picker for an existing campaign.
- `simrename:<subId>` — enter rename state machine.
- `throttleact:rotate_on | dismiss` — act on proactive alert.

### Helper added to `_index.js`
- `simLabelFor(prefs, sim)` — centralizes custom-label resolution for all bot-rendered SIM references.

### Version bumps (2.7.3)
- `build.gradle` 19/2.7.3, `package.json`, `index.html`, `app.js` init log + fallbacks, `api.js` sync default, `sms-app-service.js` SMS_APP_VERSION + new conversational release note, `_index.js` `/sms-app/download/info`.

### APK verified
- Path: `/app/static/nomadly-sms.apk` — 3.82MB — `versionCode=19`, `versionName=2.7.3` (aapt2). `simLabels` references + `_simLabel` custom-label branch present in bundled `assets/public/js/app.js`.

### Files touched
- `js/_index.js` — `simLabelFor` helper, rename state handler, expanded `/smssettings` with rename buttons, My Campaigns change-SIM row, `campsim:…:picker`/`simrename:…`/`throttleact:…` callback branches, updated `renderCampaignSimPicker` to use `simLabelFor`, download/info version.
- `js/sms-app-service.js` — `setUserSmsPrefs` accepts `simLabels`, proactive alert inside `POST /throttle-events`, version bumps, release note.
- `sms-app/www/js/app.js` — `simLabels` state + sync + caching, `_simLabel` custom-label branch, version bumps.
- `sms-app/www/js/api.js` — sync version default.
- `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`.


## Feb 2026 — SMS App v2.7.4 (Single-Source-of-Truth Discovery via Cloudflare Worker)

Operational resilience: the APK no longer hardcodes any backend URL. It asks a Cloudflare Worker at startup "where's the backend?" and uses whatever the Worker returns.

### What was built
- **Cloudflare Worker** `nomadly-api-config` deployed on Cloudflare account `ed6035ebf6bd3d85f5b26c60189a21e2` (from `CLOUDFLARE_*` env vars). Serves `{apiBase: "<current-backend-url>"}` with CORS headers and `Cache-Control: public, max-age=60`.
- Worker URL: **`https://nomadly-api-config.nomadly-cfg.workers.dev/`**
- Worker source kept in `/app/ops/nomadly-api-config-worker.js` for version control.
- Current `API_BASE` inside the Worker: `https://nomadly-email-ivr-production.up.railway.app`.
- Deployed via Cloudflare API (no `wrangler` needed); Workers subdomain `nomadly-cfg` auto-provisioned.

### APK changes (`sms-app/www/js/api.js`)
- Removed **all hardcoded Railway / `productionUrl` references**. The single source of truth is `discoveryUrl`.
- `baseUrl()` resolution order:
  1. Browser dev mode → `window.location.origin + /api`.
  2. Native APK → fetch `discoveryUrl` with 3 retries (0s / 1.5s / 3.5s backoff, 4s timeout per try) → use returned `apiBase`.
  3. All retries fail → throw `APIError('Cannot reach Nomadly servers...', 0, 'network', 'discovery_unreachable')` so every API call surfaces a clean error instead of silently routing somewhere stale.
- On failure, the memoized discovery promise is cleared so future retries (user reopens app or swipes "retry") re-run discovery instead of replaying the cached rejection.
- Fixed a latent class-name typo (`ApiError` → `APIError`).

### Operational procedure — when Railway moves
1. Open https://dash.cloudflare.com → Workers & Pages → `nomadly-api-config` → Edit.
2. Change the `API_BASE` constant to the new backend URL.
3. Save. Propagates globally in ~5s.
4. Every APK in the wild picks up the new URL on next app launch. No rebuild, no user push.

### Trade-off accepted (per user decision)
- Removed the baked Railway fallback. If the Cloudflare Worker is temporarily unreachable (rare — corporate firewalls blocking `workers.dev`, brief Cloudflare outage) the user sees a clean error banner instead of silently routing to a potentially-stale baked URL. This prevents "app works but nothing happens" failure modes after migrations.

### Version bumps (2.7.4)
- `build.gradle` 20/2.7.4, `package.json`, `index.html` meta + setVersion, `app.js` init log + fallbacks, `api.js` sync default, `sms-app-service.js` SMS_APP_VERSION + conversational release note (explains the resilience benefit), `_index.js` `/sms-app/download/info`.

### APK verified
- Path: `/app/static/nomadly-sms.apk` — 3.82MB — `versionCode=20`, `versionName=2.7.4` (aapt2).
- Verified bundled `assets/public/js/api.js` contains **only** `discoveryUrl: 'https://nomadly-api-config.nomadly-cfg.workers.dev/'`. No Railway URL present.

### Files touched
- `ops/nomadly-api-config-worker.js` (new — Cloudflare Worker source)
- `sms-app/www/js/api.js` (removed productionUrl, discovery-only resolution, retries)
- `sms-app/android/app/build.gradle`, `sms-app/package.json`, `sms-app/www/index.html`, `sms-app/www/js/app.js` (version strings)
- `js/sms-app-service.js`, `js/_index.js` (version strings + release note)


## Feb 2026 — Backend Auto-Sync of Cloudflare Discovery Worker

Closes the remaining manual step in the v2.7.4 discovery flow: the backend itself now pushes its current URL to the Cloudflare Worker on every startup, so Railway migrations need **zero manual steps**.

### What was added
- **New module** `/app/js/cloudflare-discovery-sync.js` exporting `syncDiscoveryWorker()`:
  1. Reads `process.env.SELF_URL` (trimmed of trailing slashes).
  2. Fetches the current Cloudflare Worker response and compares `apiBase` with the desired URL.
  3. If drift detected, PUTs an updated Worker script to the Cloudflare API using `CLOUDFLARE_EMAIL` / `CLOUDFLARE_API_KEY` from .env.
  4. Logs success or failure. Never throws — failures are silent/logged so the server never crashes because of a sync issue.
- **Wire-in**: `_index.js` calls `syncDiscoveryWorker()` 3s after `initSmsAppService` so boot isn't blocked by a Cloudflare round-trip.

### Safety guard (critical)
- **Opt-in by env flag**: `CF_DISCOVERY_SYNC=true` must be explicitly set. Without it, sync is a no-op.
- Reason: the preview/dev environment has a different `SELF_URL` (e.g. `*.preview.emergentagent.com`) — without the guard, running the backend in preview would overwrite the Worker and route live APK users away from Railway.
- To enable in production: add `CF_DISCOVERY_SYNC=true` to Railway env vars. Preview stays safe by default.
- Secondary kill-switch: `DISABLE_CF_DISCOVERY_SYNC=true` (overrides the opt-in).

### Verified end-to-end
- Preview boot → `[CF-Sync] Disabled (CF_DISCOVERY_SYNC!=true) — skipping` ✅
- Simulated drift (SELF_URL=fake-url) with flag ON → Worker PUT succeeded, Worker returned the fake URL ✅
- Restored real URL → Worker immediately back in sync, response now includes dynamic `syncedAt` timestamp (proof it was auto-updated by backend) ✅

### Future-proof behaviour
- Railway project migration → new URL assigned → backend boots → sync pushes new URL to Worker → APK users land on new backend on next app open. No human action needed.
- The only operational surface is setting `CF_DISCOVERY_SYNC=true` once on Railway.

### Files touched
- `js/cloudflare-discovery-sync.js` (new — 110 lines, self-contained)
- `js/_index.js` (wire-in after `initSmsAppService`)


## Feb 2026 — Self-Service Hosting Domain Unlink + Plan Cancellation

### Background
- User `@user_uu0` (chatId 6277663071) asked support: *"I purchased anti-red page hosting for this domain but I want it unlinked, I realized I don't need it right now."*
- Existing UX gap: *My Hosting Plans* only exposed Reveal Credentials / Renew / Upgrade / Toggle Auto-Renew. Users had no way to remove an addon domain or cancel a plan without contacting an admin.
- Backend logic for both operations already existed (`cpProxy.removeAddonDomain`, `whmService.terminateAccount`, `cfService.cleanupAllHostingRecords`, `antiRedService.removeWorkerRoutes`). The web HostPanel exposed addon-removal at `/api/cpanel/domains/remove`, but the Telegram bot never wired it up.

### What shipped
**Two new self-serve buttons in `viewHostingPlanDetails`:**
1. **🗑️ Unlink a Domain** — only visible when `addonDomains.length > 0`. Lists every addon, picks one, double-confirms, then:
   - Calls `cpProxy.removeAddonDomain(cpUser, decryptedCpPass, addonDomain, undefined, primaryDomain, whmHost)` (decrypts password via `cpanelAuth.decrypt(plan.cpPass_*)`)
   - `$pull` from `cpanelAccounts.addonDomains` (always, even if cPanel call failed — keeps DB consistent with WHM if user had already removed via panel)
   - Best-effort Cloudflare cleanup: `removeWorkerRoutes(addon, zoneId)` + `cleanupAllHostingRecords(zoneId, addon)`
   - Notifies admin via `notifyAdmin()` (auto-enriches `User: <chatId>` → `User: @username (chatId)`)

2. **🚫 Cancel Hosting Plan** — always visible. Double-confirms with explicit warnings (no refund, files lost, addons lost), then:
   - `whmService.terminateAccount(cpUser)` (WHM `/removeacct`)
   - Loops over primary + every addon, runs CF Worker-route + DNS-records cleanup for each
   - Soft-deletes the doc: `{ deleted: true, deletedAt, deletedBy: 'user', cancelledByUser: true, autoRenew: false }` — preserves audit trail; scheduler skips deleted records
   - Admin notification

### State machine additions
- 3 new actions in `_index.js` constants block: `selectDomainToUnlink`, `confirmUnlinkAddonDomain`, `confirmCancelHostingPlan`.
- Each action has a back-button path that returns to `viewHostingPlanDetails` (cancellation → `myHostingPlans`).

### Localization
- 5 new keyboard labels (`unlinkDomain`, `cancelHostingPlan`, `confirmUnlinkBtn`, `confirmCancelHostingBtn`, `cancelGoBackBtn`) translated in all 4 locales (en/fr/hi/zh) inside their respective `user = {}` blocks.
- 10 new copy strings (selectDomainToUnlink, noAddonDomainsToUnlink, confirmUnlinkDomain, unlinkingDomain, unlinkDomainSuccess, unlinkDomainFailed, confirmCancelHostingPlan, cancellingHostingPlan, cancelHostingPlanSuccess, cancelHostingPlanFailed) translated in all 4 locales inside `t = {}`. Each version explains the irreversibility, lists what gets deleted, and reassures domain registration is untouched.
- **Caught a structural drift in `en.js`**: `paymentTimeoutReminder` and `abandonedCartReminder` were misplaced at the top-level of the `en` object (not inside `t`), which silently masked their fallback `||` defaults at the call sites. Moved both into `t = {}` alongside the new keys so `t.paymentTimeoutReminder` actually resolves.

### Tests
- `js/tests/test_unlink_hosting_handlers.js` — 4 assertion blocks: (1) all helpers (`removeAddonDomain`, `terminateAccount`, `cleanupAllHostingRecords`, `removeWorkerRoutes`, `decrypt`) resolve to functions, (2) cpPass encrypt/decrypt round-trip works, (3) every new key (10 t-strings × 4 locales + 5 user-strings × 4 locales) is non-undefined, (4) `confirmCancelHostingPlan(domain, plan)` interpolates both args. Passes clean.

### Files touched
- `js/_index.js` — 3 action constants + button injection in `viewHostingPlanDetails` + 3 action-block handlers.
- `js/lang/en.js` — `user.unlinkDomain/cancelHostingPlan/confirmUnlinkBtn/confirmCancelHostingBtn/cancelGoBackBtn`; 10 t-strings inside `t = {}`; relocated `paymentTimeoutReminder`/`abandonedCartReminder` into `t`.
- `js/lang/fr.js`, `js/lang/hi.js`, `js/lang/zh.js` — same 5 user-strings + 10 t-strings, fully localized.
- `js/tests/test_unlink_hosting_handlers.js` — new smoke-test suite.

### How to relay to @user_uu0
*"Open `/start` → 📋 My Hosting Plans → tap your hosted domain → 🚫 Cancel Hosting Plan (or 🗑️ Unlink a Domain if you only want to remove an addon). The bot walks you through a confirmation step. Note: this permanently deletes the cPanel files and isn't refundable — the domain itself stays registered to your account."*


## Feb 2026 — Web HostPanel Self-Service Plan Cancellation

### Background
Mirroring the bot's `confirmCancelHostingPlan` flow into the web HostPanel so customers who never use Telegram can also self-cancel.

### Backend
- **New endpoint**: `POST /panel/account/cancel` (auth-gated via JWT + `resolveCpPass`).
- **Request body**: `{ confirm: 'CANCEL' }` — must match the literal string. Backend rejects anything else with `400 "Confirmation phrase missing or incorrect."`.
- **Logic** (parallel to bot path in `_index.js`):
  1. `whmService.terminateAccount(cpUser)` — WHM `/removeacct`.
  2. Loop primary + every addon, run `removeWorkerRoutes` + `cleanupAllHostingRecords` per zone (best-effort).
  3. Soft-delete record: `{ deleted: true, deletedAt, deletedBy: 'user', cancelledByUser: true, cancelledFrom: 'panel', autoRenew: false }`.
  4. Notifies admin via dependency-injected `notifyAdmin` (passed through `createCpanelRoutes(getCpanelCol, { notifyAdmin })` from `_index.js`).
- **Idempotency**: returns `409 "already been cancelled"` if `account.deleted === true`.

### Frontend
- **New component** `frontend/src/components/panel/AccountSettings.js` — three-stage state machine (`idle → reviewing → submitting → done|error`).
  - `idle`: warning bullet list of what gets deleted; primary CTA opens review.
  - `reviewing`: confirm input requires the literal string `CANCEL` (case-sensitive); confirm button stays disabled until match. Go-back resets state.
  - `submitting`: button disabled, label changes to "Cancelling…".
  - `done`: success card; "Sign out" button forces a fresh session so a torn-down cPanel can't be poked.
  - `error`: surfaces server message inline in red; Go-back lets user retry or bail.
- **New tab** in `PanelDashboard.js`: 7th tab "Account" (user icon). Sits at the right of the existing Files / Domains / Email / Security / Geo / Analytics tabs.
- **Styles**: ~250 lines appended to `App.css` (`.acct-*` namespace) with full dark/light theme parity, gradient danger/success cards, monospaced confirm input, mobile-stacked actions at <640px.

### Data test IDs
`panel-tab-account`, `account-settings-section`, `account-danger-zone`, `account-cancel-start-btn`, `account-cancel-confirm-input`, `account-cancel-confirm-btn`, `account-cancel-back-btn`, `account-cancel-error`, `account-cancel-done`, `account-cancel-signout-btn`.

### Tests / verification
- **Curl auth & validation matrix** — all four cases pass: no-auth→401, bad-token→401, auth+missing-confirm→400, auth+wrong-confirm→400.
- **Frontend smoke** — verified after login, Account tab renders, Danger Zone card renders, "Cancel hosting plan" → confirm input appears, "Go back" resets to idle.
- Did not exercise the actual termination path (would require a sacrificial WHM account); logic is byte-for-byte the same as the bot's verified flow.

### Files touched
- `js/cpanel-routes.js` — `createCpanelRoutes` now accepts `{ notifyAdmin }`; new `POST /account/cancel` route.
- `js/_index.js` — passes `{ notifyAdmin }` through the route factory.
- `frontend/src/components/panel/AccountSettings.js` (new — 181 lines).
- `frontend/src/pages/PanelDashboard.js` — import + 7th tab + user icon.
- `frontend/src/App.css` — `.acct-*` styles (dark + light).


## Feb 2026 — Self-Service "Take Site Offline / Bring Online" Toggle

### Background
User asked for a way to temporarily take their site offline and put it back. Existing infra: `whmService.suspendAccount/unsuspendAccount` already used for the auto-renew expiry path; `cpanelAccounts.suspended` already in schema; `cpProxy.getFileContent` and `cpProxy.saveFileContent` (Fileman UAPI) already wrap `.htaccess` reads/writes for the anti-red service.

### Two offline modes (user picks)
1. **🛠️ Maintenance Mode** (recommended) — clean visitor-facing "We'll be back soon" page, email/FTP/DBs unaffected. Implemented by:
   - Writing `public_html/maintenance.html` (small inline-styled HTML, ~80 lines).
   - Prepending a `BEGIN/END NOMADLY MAINTENANCE` block to `public_html/.htaccess` containing `mod_rewrite` 503-redirect + `Retry-After` + `ErrorDocument 503`. The block is excluded for static assets (css/js/png/etc) so the maintenance page itself can load.
   - Block is delimited by markers and stripped surgically on bring-online — user's existing `.htaccess` rules are preserved.
2. **🚫 Full Suspend** — WHM `suspendacct` (HTTP + FTP + email + DB all stopped). Visitor sees standard cPanel suspended page.

### Critical UX guard rail (user's explicit ask)
**Every** offline-related screen — bot menu, web-panel mode-picker, both confirm dialogs, both success messages — explicitly tells the user that taking the site offline does **NOT**:
- Pause the expiry countdown
- Pause auto-renewal billing

Verified via smoke test that the chooseSiteOfflineMode strings in all 4 locales contain both `auto-renew` and `expir` keywords.

### New module: `js/site-status-service.js`
Encapsulates all five operations (`enableMaintenanceMode`, `disableMaintenanceMode`, `suspend`, `unsuspend`, `readStatus`), shared by both bot and panel routes — single source of truth for the WHM/cPanel calls.

### Bot side
- New buttons in `viewHostingPlanDetails`: `🔌 Take Site Offline` (when online) / `🌐 Bring Site Online` (when offline). Label flips automatically based on `plan.suspended || plan.maintenanceMode`.
- New plan-status badge: `✅ Active (online)` / `🛠️ Maintenance (offline — public only)` / `🚫 Suspended (offline — full)`.
- 3 new actions: `chooseSiteOfflineMode`, `confirmSiteOfflineMode`, `confirmBringSiteOnline`.
- Fully localized in en/fr/hi/zh — 9 t-strings + 6 user-strings × 4 locales = 60 i18n keys verified.

### Panel side
- New component `SiteStatusCard.js` rendered above the Danger Zone in the Account tab.
- Stages: `view → choosing-mode → confirming-offline → submitting → view` (or `view → confirming-online → submitting → view` when reversing).
- Shows live meta-grid (domain, plan, expiry, auto-renew status) so the user sees their billing context in the same card.
- Persistent yellow billing-warning callout on the mode-picker step + inline reminder on the confirm step.
- Two new endpoints:
  - `GET /panel/account/site-status` — returns `{status, domain, plan, expiryDate, autoRenew, suspendedAt, maintenanceModeAt, lastBroughtOnlineAt}`.
  - `POST /panel/account/site-status` — body `{action: 'take_offline'|'bring_online', mode?: 'maintenance'|'suspended'}`. Idempotent (`409` if already in target state).
- Both endpoints share the same backing service module as the bot, so any bug fix improves both surfaces simultaneously.

### Tests
- `js/tests/test_site_status.js` — htaccess strip is idempotent, surgical, handles repeats, preserves user rules. `readStatus` returns correct enum for each cpanelAccounts shape.
- `js/tests/test_site_toggle_lang.js` — site-status-service public API exported (5 functions); all 60 i18n keys present in en/fr/hi/zh; suspended vs maintenance copy diverges; both contain the billing-keeps-running reminder.
- All 3 test suites green.

### Curl integration matrix (passed)
- GET no-auth → 401
- GET auth OK → 200 with full status payload
- POST invalid action → 400
- POST take_offline missing mode → 400
- POST take_offline bad mode → 400

### Frontend smoke (passed)
- Site status card visible after Account-tab click
- "Take site offline" button shown for online sites
- Danger Zone still rendered below
- Meta-grid visible
- Mode picker appears, billing warning + both options + back button visible
- Click maintenance → confirm screen renders
- Go back → returns to view stage

### Files touched
- `js/site-status-service.js` (new — 230 lines).
- `js/_index.js` — `viewHostingPlanDetails` renders new button/status; 3 new action constants; 3 new state-machine handlers; suspended/maintenance fields written on every transition.
- `js/cpanel-routes.js` — 2 new routes (`GET`/`POST /account/site-status`).
- `js/lang/en.js`, `fr.js`, `hi.js`, `zh.js` — 9 t-strings + 6 user-strings each, all with explicit billing-keeps-running reminders.
- `frontend/src/components/panel/SiteStatusCard.js` (new — 230 lines).
- `frontend/src/components/panel/AccountSettings.js` — imports + renders SiteStatusCard above Danger Zone.
- `frontend/src/App.css` — `.acct-card--online/--offline`, `.acct-meta-grid`, `.acct-billing-warning`, `.acct-mode-*`, `.acct-btn--warn/--success` (light + dark theme).
- `js/tests/test_site_status.js`, `js/tests/test_site_toggle_lang.js` (new test suites).

### How users hear about it
Bot side: button is auto-discovered from the existing `My Hosting Plans → [domain]` flow.
Panel side: visible the moment they open the Account tab.


## Feb 2026 — 3CX/SIP "Voicemail Loop" Investigation + Fixes

### Reported issue
User @Mrdoitright53 (chatId 8737445617, owner of toll-free `+18882437690`, Business plan) reported that calls to their Twilio number played `"Record your message and press pound, or press star to contact the operator"` and pressing `*` returned `"call transfer failed"` — they were trying to receive inbound calls on 3CX via SIP.

### Investigation (Railway production logs, ~10 calls between 10:50–11:10 UTC)
End-to-end trace:
1. PSTN `+15042097233` → Twilio `+18882437690` (10 calls observed)
2. Our `/twilio/voice-webhook` correctly returns `<Dial><Sip>sip:gencred…@sip.speechcue.com</Sip></Dial>`
3. Telnyx receives the SIP INVITE on credential connection `2898118323872990714`
4. Telnyx auto-routes to whichever UA is registered with the gencred credential (the user's 3CX) — confirmed via our handler's `state==='bridging' + connection_id===SIP_CONNECTION + to.startsWith('gencred')` short-circuit at `voice-service.js:1743`
5. **3CX answers in <50ms** (`call.answered` fires immediately) — `DialCallStatus=completed duration=18s` from Twilio
6. The `"Record your message and press pound, or press star to contact the operator"` prompt is **3CX's own default voicemail** — not generated by our codebase. PBXes (3CX/FreePBX/Asterisk) configured as a SIP user/extension answer the call and dump it to their built-in voicemail when no inbound rule routes it to a ringing extension. Pressing `*` triggers a built-in transfer to the "operator extension" which doesn't exist → "call transfer failed".

**Root cause: user-side configuration error** — they registered the gencred credential as a SIP "user/extension" instead of as a SIP TRUNK with inbound rules.

### Real bugs found in our code while investigating

**Bug 1 (latent NaN in `<Dial timeLimit>`, `_index.js`):**
- `phoneConfig.plans.business.minutes` is the literal string `'Unlimited'` (used for display)
- `getPoolMinuteLimit` returned `'Unlimited'` (string is truthy → `||Infinity` fallback skipped)
- Then `Math.max(0, 'Unlimited' - 26)` → `NaN`, propagating into `computeDialTimeLimit` → `<Dial timeLimit="NaN">` in TwiML (visible in logs: `[Twilio] SIP dial timeLimit: NaNs (planRemaining=NaNmin, wallet=$5.00, rate=$0.15/min)`).
- Twilio fell back to its 4-hour max, so calls didn't break — but real-time billing enforcement was effectively disabled for ALL Business-plan inbound calls on Twilio numbers.
- **Fix**: New `_normalizePlanLimit()` helper normalizes `'Unlimited'`/null/undefined/non-numeric → `Infinity`. Applied to `getPoolMinuteLimit` AND `getPoolSmsLimit`. Also hardened `computeDialTimeLimit` to defend against NaN inputs (Number.isFinite guards) and treat `Infinity` plan minutes as a 4-hour cap.

**Bug 2 (silent IVR misconfiguration, `phone-config.js`):**
- User's number had `ivr.enabled=true` with `options={}`. Bot UI just said `"No options configured yet"` — looked harmless.
- Twilio webhook at `_index.js:28754` requires `options.length > 0`, so IVR was silently skipped on every call; user thought their IVR was working.
- **Fix**: `ivrMenu()` in en/fr/hi/zh now shows ⚠️ warning header `"⚠️ Enabled (incomplete)"` + explicit `"IVR will not run — callers will skip the menu and go to voicemail"` + actionable hint pointing to the `➕ Add Option` button.

### New `/sipguide` command + expanded SIP setup guide
- Added `/sipguide` bot command (registered in `setMyCommands` so it appears in Telegram's `/` autocomplete) so any user can pull up the guide without first buying a number or running `/testsip`.
- Expanded `softphoneGuide` in en/fr/zh/hi (was 657 chars EN, now 1,261–1,969 chars per locale, well within Telegram's 4096 limit) with:
  - List of recommended softphones: Linphone, Zoiper, MicroSIP, Bria Solo
  - Step-by-step softphone setup
  - **Explicit ⚠️ "Using 3CX, FreePBX, Asterisk or another PBX?" section** that names the exact symptom users hear (`"Record your message and press pound, or press star to contact the operator"` → `"transfer failed"`) and walks through configuring 3CX as a **SIP TRUNK** (not user/extension): registrar, auth mode, inbound/outbound rules.
  - References our SIP domain (`sip.speechcue.com`) and port (5060) inline.

### Tests
- `js/tests/test_pool_minute_limit_fix.js` (10 assertions, all green): Business→Infinity, Pro/Starter numeric, NaN propagation gone, Infinity uses 4h cap, finite plan + wallet sums correctly.
- `js/tests/test_sip_ux_warnings.js` (10 assertions, all green): IVR empty-options warning visible in all 4 langs, PBX/3CX TRUNK anchors present in softphoneGuide for all 4 langs, Telegram message-length limit honored.

### Files touched
- `js/_index.js` — new `_normalizePlanLimit()` helper, `getPoolMinuteLimit`/`getPoolSmsLimit` use it, `computeDialTimeLimit` hardened against NaN, new `/sipguide` command handler, `/sipguide` registered in `bot.setMyCommands`.
- `js/phone-config.js` — `ivrMenu` updated with empty-options warning in en/fr/zh/hi, `softphoneGuide` expanded with PBX/3CX trunk section in all 4 locales.
- `js/tests/test_pool_minute_limit_fix.js` (new), `js/tests/test_sip_ux_warnings.js` (new).

### How users hear about it
- `/sipguide` appears in Telegram's bot-command menu (next to `/start` and `/testsip`).
- Existing `📖 SIP Setup Guide` button on the Cloud Phone management screen now serves the expanded guide with the PBX section.
- Any user mid-IVR-config sees the new ⚠️ warning the moment they enable IVR without options.

### Deployment status
- **Local only.** Fixes are in `/app/js/`. Production Railway service `Nomadly-EMAIL-IVR` has NOT been redeployed yet — the next time Railway redeploys, the fixes will go live for @Mrdoitright53 and all other users.

## Feb 2026 — @jasonthekidd zip-upload RCA + fix: chunked upload

- **Evidence**: jason's cPanel is `cap1a612` on `cap1online360.com`. WHM account + `public_html` were created correctly at 03:05:00 (verified by successful Anti-Red `.htaccess` deploy at 03:05:13 and a small 103.6 KB PNG upload at 03:09:16). After that, **21 consecutive large-file uploads aborted mid-body**, logged as `[Panel] Upload aborted by client before multer finished`. Same symptom hit 4 other users (`smil123b`, `peakb09c`, `sech752f`, `entsf6c7`) over the prior 5 days — it's a **Railway ingress timeout on large multipart uploads**, not the `public_html` creation.
- **Root cause**: existing `/files/upload` route uses `multer.memoryStorage()` and buffers the full file before relaying to cPanel. On mobile links a >8 MB zip exceeds Railway's ~60 s per-request budget; the upstream proxy kills the socket which fires `req.on('aborted')` / `req.on('close')` → swallowed as "client cancel".
- **Fix — chunked upload**:
  - New backend route `POST /panel/files/upload-chunk` (`js/cpanel-routes.js`) accepts 5 MB chunks with `{uploadId, chunkIndex, totalChunks, fileName, dir, fileSize, chunk}`; server buffers per-session, assembles on the last chunk, forwards to cPanel via the existing `cpProxy.uploadFile`.
  - Session scoped to `cpUser::uploadId` (blocks cross-user hijack), 120 MB hard cap, 10 min TTL, 2 min janitor sweep, idempotent replay, out-of-order chunks supported.
  - `POST /panel/files/upload-chunk/cancel` frees memory explicitly.
  - Frontend `FileManager.js` auto-chunks any file > 8 MB, shows per-chunk progress (`Uploading file.zip — chunk 3/20 (15%)`).
  - Friendlier error text: old `Upload cancelled by client` → `Upload interrupted — connection closed before file was fully received. For files > 8 MB, please use chunked upload (retry and the panel will auto-chunk).`
- **Regression test** `js/tests/test_chunked_upload.js` — 14 assertions: sequential assembly, out-of-order assembly, idempotent replay, `.htaccess` rejected, missing fields → 400, cross-user session isolation, 120 MB cap → 413, cancel endpoint idempotent. All green.
- Bot boots cleanly, lint passes, prior three regression tests still green (i18n / `hasVoice` / `lastChanged`).

## Feb 2026 — "Last changed: X ago" on Manage-Number screen
- `js/phone-config.js` adds `formatRelativeTime(iso, lang)` helper producing locale-native relative strings (en/fr/zh/hi) across all 5 ranges: `just now`, minutes, hours, days, weeks.
- All 4 locale `manageNumber(...)` renderers append a subtle italic line: `🕒 Last changed: 2 mins ago` / `🕒 Dernière modif. : il y a 2 min` / `🕒 上次修改：2 分钟前` / `🕒 अंतिम बदलाव: 2 मिनट पहले`. Line is hidden on legacy records without `updatedAt`.
- `updatePhoneNumberFeature(...)` and `updatePhoneNumberField(...)` now additionally stamp `val.numbers.$.updatedAt = new Date().toISOString()` on every write — via the same **atomic positional $set** (no more read-modify-write on the entire array, closing the last race-prone helpers from Fix #4).
- Internal bookkeeping fields (`smsUsed`, `minutesUsed`, `_smsLimitNotified`, `_minLimitNotified`, `lastCallAt`, `lastSmsAt`) are excluded from the stamp so every inbound SMS / call doesn't spuriously reset "Last changed".
- Regression test `js/tests/test_last_changed_timestamp.js` — 44 assertions covering all 4 locales × 5 time ranges + null-hiding behaviour. All green.

## Feb 2026 — @Scoreboard44 "phone settings resetting" RCA + fix set
- **P0 fix** `js/_index.js:19587` — `buildManageMenu()` referenced undefined `hasVoice` (regression from the "Test My Number" button feature). Every Manage-Number open crashed silently after the 2026-04-27T12:17Z deploy. Added missing `const hasVoice = num.capabilities?.voice !== false`.
- **P1 fix** 35 sites of `const num = info?.cpActiveNumber` + primary `numbers[idx]` load — all now normalize `num.features = {}` and `num.capabilities = {...}` defaults. Prevents the Apr-19 class crash `Cannot set properties of undefined (setting 'callForwarding')` on legacy records.
- **P2 fix** `cpEnterForwardNumber` + `IVR forward-menu` handlers — E.164 auto-correction for 10-digit US inputs (→ `+1XXXXXXXXXX`) and 11-digit starting with `1` (→ `+`). Matches the silent-failure pattern where Scoreboard44 entered `19314399742` and the Telnyx validator rejected it.
- **P3 fix** Eliminated 9 racy read-modify-write sites on `phoneNumbersOf.val`: converted sub-account creds, number purchase (4 paths: wallet USD / bank NGN / crypto BlockBee / crypto DynoPay / wallet fallback), QuickIVR token cache, SIP-credential reset, and `cacheTwilioAddress` to atomic `$push` / positional `$set`. Closes the "concurrent webhook/purchase wiped my IVR/voicemail" class of bug.
- Regression test `js/tests/test_phone_settings_reset_fix.js` — 21 assertions (hasVoice, features guard count, E.164 normalization, atomic $set patterns). All green. Bot boots cleanly.
- Diagnostic scripts retained in `/app/scripts/fetch_scoreboard44_logs.py`, `fetch_env_logs.py`, `fetch_scoreboard_history.py`, `fetch_all_errors.py` for future Railway log forensics.

## Feb 2026 — `cpTxt.testMyNumber` localized into fr/zh/hi
- Previously only the EN `testMyNumber` bundle (8 template functions at `js/phone-config.js:771`) was defined; fr/zh/hi fell through the `getTxt()` proxy to EN — worked but not localized.
- Added a fully-localized `testMyNumber: {...}` block inside each of the fr, zh, hi sections of `txtI18n` in `js/phone-config.js`. All 8 keys translated: `placing`, `successDtmf`, `voicemail`, `answeredNoDtmf`, `noAnswer`, `throttled`, `inactive`, `placeFailed`. Each preserves `<code>`/`<b>` tags, emojis (📞✅⚠️❌⏳), and the `/sipguide` command refs.
- Regression test `js/tests/test_test_my_number_i18n.js` — 32 assertions (4 langs × 8 keys) + 24 "not-identical-to-EN" checks. All green.
- Node.js bot restarts cleanly; `phone-config.js` loads without syntax errors.
- Re: user's Twilio question — `js/test-my-number.js` outbound leg is Telnyx-only (uses `TELNYX_TRIAL_CALLER_ID` + Telnyx webhook events). But the call's *target* is the user's Twilio number, so every Twilio user's inbound path is already exercised end-to-end. No separate Twilio build is needed.

## Feb 2026 — Manage-Number UX upgrades (follow-on to the 3CX investigation)

### Goal
Make the IVR-broken state and "is my SIP routing actually working?" question discoverable from the main Manage-Number screen — without users needing to dig into submenus or message support.

### What's new

**1. ⚠️ "IVR enabled but incomplete" badge on the Manage-Number screen**
Until now, the warning was only visible inside the IVR submenu. Users like @Mrdoitright53 had `ivr.enabled=true` with `options={}` and never saw a problem until they opened IVR. Now `cpTxt.manageNumber()` in en/fr/zh/hi appends a prominent ⚠️ block right above the browser-call link when the broken state is detected:
- EN: "⚠️ IVR enabled but incomplete — no menu options. Callers will skip the menu and go to voicemail. Tap 🤖 IVR / Auto-attendant to add options."
- FR/ZH/HI: localized equivalents

**2. 📞 "Test My Number" one-tap button on the Manage-Number screen**
New `/app/js/test-my-number.js` module (~210 LOC, fully self-contained). When tapped:
1. Throttle check (max 5 tests per number per 24h, in-memory).
2. Places a Telnyx outbound call from `TELNYX_TRIAL_CALLER_ID` (`+18889020132`) → user's Twilio number with `answering_machine_detection: 'detect'`.
3. Webhook events for THIS call are routed to `/test-call/webhook` (registered without `/api` prefix because of the global `/api`-stripping middleware at `_index.js:25301`; external URL is still `/api/test-call/webhook` — the middleware handles the rewrite).
4. On `call.answered`: speaks "Press 1 to confirm your SIP device is working" and gathers DTMF (12s window).
5. Reports back via Telegram message based on outcome:
   - **DTMF received** → ✅ "Reached your SIP device — calls are working."
   - **AMD = 'machine'** → ⚠️ "Got voicemail / PBX answer — looks like 3CX/FreePBX is dumping the call to its own voicemail. Open /sipguide for SIP TRUNK setup, or switch to Linphone/Zoiper."
   - **Answered, no DTMF** → ⚠️ "Call answered but no key was pressed within 12s — could be PBX voicemail or you missed the prompt. See /sipguide if a PBX is involved."
   - **No answer / hangup before answered** → ❌ "No answer — make sure your softphone is registered and online. See /sipguide."
6. Hard 60s timeout finalizes the report even if events are lost.

### Wiring
- `_index.js:516` — `require('./test-my-number.js')`
- `_index.js:1820–1828` — `initTestMyNumber(app, { bot, telnyxApi, db, log, selfUrl: SELF_URL, getTxt: phoneConfig.getTxt })`
- `phone-config.js:160` — `pc.testMyNumber` button label in 4 langs
- `phone-config.js:771–784` — `cpTxt.testMyNumber.{placing, successDtmf, voicemail, answeredNoDtmf, noAnswer, throttled, inactive, placeFailed}` localization bundle (EN; FR/ZH/HI fall back to EN gracefully via the optional-chaining lookup in the module)
- `_index.js:19594–19598` — `buildManageMenu` adds the button only for `hasVoice && num.status === 'active'`
- `_index.js:20060–20067` — message handler invokes `placeTestMyNumberCall(chatId, num, lang)`

### Tests
- `js/tests/test_manage_screen_features.js` — 21 new assertions, all green:
  - 12 cases × 4 langs verifying the IVR-incomplete badge appears for broken IVR and is absent for working IVR / disabled IVR
  - 9 cases verifying the testMyNumber button label in 4 langs, the localized text bundle has all 8 keys, the voicemail message includes /sipguide CTA + 3CX/PBX wording, success/no-answer messages are properly formatted, and `placeTestCall` correctly rejects inactive numbers + uninitialized state.
- `js/tests/test_pool_minute_limit_fix.js` (10 green) and `js/tests/test_sip_ux_warnings.js` (10 green) — re-run, no regressions. **41 total assertions green.**
- Live smoke test: `curl -X POST http://localhost:5000/test-call/webhook` and via `/api/` prefix → both return 200 OK; module logs "no session for ccId=abc" gracefully.

### Files touched
- `js/_index.js` — require + init for the new module, `buildManageMenu` extension, button-tap handler
- `js/phone-config.js` — IVR-incomplete badge in `manageNumber()` for en/fr/zh/hi, `testMyNumber` button labels in 4 langs, EN `cpTxt.testMyNumber` bundle
- `js/test-my-number.js` (new, 210 LOC) — feature module, sessions, throttling, AMD/DTMF interpretation, result reporting
- `js/tests/test_manage_screen_features.js` (new, 21 assertions)

### Deployment status
- **Local only** — Railway production needs a redeploy to push to live users.
- After redeploy, @Mrdoitright53 will:
  1. See the ⚠️ IVR-incomplete badge as soon as they open `+18882437690`'s Manage screen
  2. Be able to tap `📞 Test My Number` and get a definitive yes/no answer about whether their SIP routing reaches their 3CX correctly — with /sipguide CTA baked into the failure paths.



## Feb 2026 — SIP Inbound / Outbound Audit (Twilio + Telnyx) — P0

### Scope
Full code-path audit of SIP flows across both providers as follow-on to the 3CX investigation and the Call Forwarding / IVR fixes. Goal: validate each path end-to-end and close any remaining gaps.

### Audited Flows (all verified)

**Inbound SIP — Telnyx number → user's softphone**
`handleCallInitiated` (voice-service.js:1906) → `findNumberOwner` → checks (suspended, minute limit w/ wallet overage) → if `hasSip && !hasIvr && !hasForwardAlways`: `createOutboundCall(from, sip:gencred@sip.telnyx.com)` — ring without answer so caller hears real ringback. On answer → `handleBridgeTransferAnswered` → `answerCall(original)` + `bridgeCalls`. On no-answer → `handleBridgeTransferHangup` → answer + voicemail/forward/missed fallback. Self-call guard present via `playHoldMusicAndTransfer`. ✅

**Inbound SIP — Twilio number → user's softphone**
`/twilio/voice-webhook` (_index.js:29081) → owner lookup → pool-minute check w/ overage → IVR(P0) → forward-always(P1) → `<Dial><Sip>sip:gencred@sip.speechcue.com</Sip></Dial>` with `timeLimit` + `sip-ring-result` action(P2) → no-SIP forwarding busy/no_answer(P3) → voicemail(P4) → missed(P5). Self-call guard on P3 and on IVR gather. ✅

**Outbound SIP — Telnyx number → PSTN**
`handleOutboundSipCall` (voice-service.js:2144) extracts SIP credential (URI/headers/display_name/reverse lookup/recent-test-cred cache), pre-dial blocklist + rate limits + wallet cooldown + low-balance lock + connection fee + `transferCall(destination, num.phoneNumber)` with retry on "not answered" race. Mid-call wallet monitor every 60s. ✅

**Outbound SIP — Twilio number → PSTN (via Telnyx SIP connection)**
`handleOutboundSipCall` → answer immediately (prevents Telnyx auto-route) → pre-flight sub-account token recovery → `transferCall(sip:bridgeId@twilioSipDomain, TELNYX_DEFAULT_ANI)` → `/twilio/sip-voice` bridge handler dials PSTN with `<Dial callerId=twilioNumber timeLimit=computed>`. Fallback via `_attemptTwilioDirectCall` when Telnyx leg dies. Mid-call wallet monitor. ✅

### Gaps Found & Fixed

**Bug #1 (P0) — Twilio `/twilio/sip-ring-result` fallback: missing self-call loop guard**
When the SIP device doesn't answer and user has forward-busy / forward-no_answer configured with `forwardTo === caller` (or the user's own number), Twilio would blindly dial it → loop.
- **Fix**: Added same self-call guard pattern used in `/twilio/voice-webhook` and IVR gather. Blocks + notifies user via Telegram, falls through to voicemail/missed instead of dialing.

**Bug #2 (P0) — Twilio `/twilio/sip-ring-result` fallback: missing `timeLimit` on forward dial**
The main `/twilio/voice-webhook` computes `computeDialTimeLimit('forwarding', …)` but the SIP-ring fallback created `dialOpts` without any `timeLimit`. On low-wallet users, call could run up to Twilio's 4-hour default before `voice-status` caught it → runaway billing risk.
- **Fix**: Added `computeDialTimeLimit('forwarding', { walletBalance, ratePerMinute })` and wired into `dialOpts.timeLimit`. Now matches main webhook behavior.

**Bug #3 (P1) — Twilio SIP fallback: silent wallet-insufficient skip**
If wallet < RATE, the fallback would silently skip forwarding — user would see voicemail without knowing why forwarding was bypassed.
- **Fix**: Added Telegram notification when wallet insufficient so user knows forwarding was blocked due to balance, not a bug.

### Files touched
- `js/_index.js` — `/twilio/sip-ring-result` fallback: self-call guard + `timeLimit` cap + wallet-insufficient notification.
- `js/tests/test_sip_ring_result_fallback.js` (new, 8 assertions, all green).

### Regression coverage
All pre-existing SIP tests still green:
- `test_sip_ux_warnings.js` (10/10) — IVR empty-options warning, PBX/3CX TRUNK section.
- `test_pool_minute_limit_fix.js` (10/10) — Business plan Infinity, NaN defense in `computeDialTimeLimit`.
- `test_sip_ring_result_fallback.js` (8/8) — new self-call + timeLimit + wallet-notify checks.

### Deployment status
- **Local only.** Fixes are in `/app/js/`. Production Railway `Nomadly-EMAIL-IVR` needs redeploy via "Save to Github" → Railway auto-deploy (or manual trigger).


## Feb 2026 — "📤 Test Outbound SIP" One-Tap Feature

### What shipped
New one-tap button on the Manage-Number screen that verifies the user's outbound SIP path works end-to-end WITHOUT placing a real PSTN call or charging the wallet. Companion to the existing "📞 Test My Number" (inbound test).

### Flow
1. User taps **📤 Test Outbound SIP** (only visible when `num.sipUsername` is set).
2. Bot opens a 90-second listening window keyed by `chatId + sipUsername` and asks the user to dial **any number** from their softphone (their own mobile works — safest option).
3. When the outbound call arrives at `voice-service.handleOutboundSipCall`, a hook checks if there's a matching pending test session AFTER user identification but BEFORE connection fee / PSTN transfer.
4. **On match**: call is immediately hung up (no wallet deduction, no PSTN leg, no provider minutes). User receives a success report with SIP username, provider, destination dialed, and latency.
5. **On 90s timeout**: helpful diagnostic message lists causes (softphone not registered, wrong creds, firewall, PBX misconfig) with `/sipguide` CTA.

### Why this is useful
Users like @Mrdoitright53 often had no way to verify that outbound SIP from their softphone reaches our servers with the right credentials. Previously they had to burn real minutes dialing a number and waiting for PSTN connection — now they get a definitive yes/no in under 2 minutes, zero cost.

### Throttle
5 tests per number per 24 hours (in-memory, same as Test My Number).

### Files
- `js/test-outbound-sip.js` (new, ~210 LOC) — hook-based module, session map, throttle, matchPendingTest + startTest + finalizeTimeout.
- `js/voice-service.js` — new `_testOutboundSipMatch` dep + hook in `handleOutboundSipCall` after user-identification, before connection-fee.
- `js/_index.js` — require + `initTestOutboundSip`, `testOutboundSipMatch` passed into `initVoiceService`, button in `buildManageMenu` gated on `num.sipUsername`, handler calling `startTestOutboundSip`.
- `js/phone-config.js` — button label in en/fr/zh/hi + full `testOutboundSip` text bundle (6 keys: `listening`, `success`, `timeout`, `throttled`, `inactive`, `noSipConfigured`) in each of the 4 locales.
- `js/tests/test_test_outbound_sip.js` (new, 68 assertions, all green) — exports, i18n, session lifecycle (start → match → report, start → timeout), throttle, voice-service hook placement, bot wiring.

### Verified
- Node.js bot boots cleanly: `[TestOutboundSip] initialized — hook-based (no HTTP route)`
- All 6 SIP-related test suites green: `test_test_outbound_sip` (68), `test_sip_ring_result_fallback` (8), `test_sip_ux_warnings` (10), `test_pool_minute_limit_fix` (10), `test_manage_screen_features` (21), `test_test_my_number_i18n` (32). **Total 149 assertions green, no regressions.**

### Deployment status
- **Local only.** Will go live when Railway redeploys after next "Save to Github" push.

## Feb 2026 — @Thebiggestbag22 "Delete Pages Doesn't Work" RCA + Fix

### Report
User @Thebiggestbag22 (chatId 6543817440) to AI support: *"I'm trying to delete my pages it will not let me can you fix this issue plz"* and later: *"BlueFCU upload ready I need to delete"*. When admin asked "do you get any specific error?" user answered "No" — confirming a silent failure.

### Evidence (Railway logs, 2026-04-27T21:56–22:10Z)
- "BlueFCU" is an uploaded HTML kit extracted into a **folder** (directory), not a single file.
- No HTTP error surfaced — silent no-op on delete click.

### Root Cause (3-layer bug)
1. **`js/cpanel-proxy.js:deleteFile`** used WHM API2 `Fileman::fileop op=unlink` for every delete. `unlink` only works on regular files; on directories, the cPanel API returns `result=0 / reason="not a regular file"` (or similar). WHM expects `op=killdir` for directories (recursive).
2. **`js/cpanel-routes.js:/files/delete`** always responded HTTP 200 OK with the cPanel result payload, even when `result.status === 0`. The frontend's `api()` helper only throws on non-2xx, so the error was silently swallowed.
3. **`frontend/src/components/panel/FileManager.js:handleDelete`** didn't check `result.status`, immediately called `fetchFiles(currentDir)` — user saw the folder still present with zero error message → perceived as "delete doesn't work".

### Fix
1. **`cpProxy.deleteFile(..., isDirectory = false)`** — new 6th arg; selects `op='killdir'` for directories, `op='unlink'` for files.
2. **Route `/files/delete`** — reads `isDirectory` from body, passes through; returns **HTTP 500** with descriptive error `"Delete failed: <cpanel reason>"` when `result.status !== 1`.
3. **Frontend `handleDelete(fileName, isDir = false)`** — accepts folder/file flag; confirm message now reads *"Delete this folder (and everything inside)?"* for dirs vs *"Delete this file?"* for files; sends `isDirectory: isDir` in body; shows success message on success and surfaces the real error on failure. Both desktop row + mobile card callsites updated to pass `isDir` (derived from `f.type === 'dir'`).

### Tests
- `js/tests/test_file_delete_folder_fix.js` — **22 assertions, all green**. Covers: op-selection logic, route passthrough + HTTP 500 on failure, anti-red guard preservation + order, frontend signature + callsites, old-buggy-pattern absence.
- Node.js bot restarts cleanly; `POST /api/panel/files/delete` returns 401 unauth (route registered).

### Files touched
- `js/cpanel-proxy.js` — `deleteFile` op-selection
- `js/cpanel-routes.js` — `/files/delete` route: isDirectory passthrough + HTTP 500 on failure
- `frontend/src/components/panel/FileManager.js` — `handleDelete` signature + confirm + success/error UX + both callsites pass `isDir`
- `js/tests/test_file_delete_folder_fix.js` (new, 22 assertions)
- `scripts/fetch_thebiggestbag22_logs.py` (diagnostic log fetcher)

### How @Thebiggestbag22 hears about it
After Railway redeploy, he can reopen the hosting panel → File Manager → tap the 🗑 button on the "BlueFCU" folder → sees confirm message *"Delete this folder (and everything inside)?"* → click OK → folder is deleted (via `killdir`). If any real permission/cPanel error occurs, a red banner now shows the exact cPanel reason instead of silently no-op'ing.

### Deployment status
- **Local only.** Production Railway `Nomadly-EMAIL-IVR` needs redeploy (user action: "Save to Github").

## Language/Translation Gap Audit & Fix (2026-04-29)

Cross-checked recent feature additions in `js/lang/en.js` against `fr.js`, `hi.js`, and `zh.js` to ensure feature parity for non-English Telegram users.

### What was missing & fixed
- **`user.smsManageDevices`, `user.smsAppSettings`** (button labels) — missing in fr/hi/zh → translated and added in the SMS keyboard block.
- **`t.smsAppActivationCode(chatId, plan, isSubscribed)`** — multi-line BulkSMS activation message (trial vs paid plan) → fully translated in fr/hi/zh.
- **`t.smsManageDevices`, `t.smsDevicesList(devices, chatId)`** — device-list panel string → translated in all 3.
- **`t.paymentTimeoutReminder`** & **`t.abandonedCartReminder(productName, price)`** — payment timeout / cart-abandonment nudges → translated in all 3.
- **Hindi-only**: `t.domainMissingTLD`, `t.domainTooShort`, `t.domainInvalidChars`, `t.domainStartsEndsHyphen`, `t.domainSearchTimeout(domain)` — domain-validation error strings → added (fr/zh already had them).
- **`disable_web_page_preview: true`** missing on 5 DNS keyboards (`dnsQuickActionKeyboard`, `dnsMxPriorityKeyboard`, `dnsSubdomainTargetTypeKeyboard`, `dnsCaaTagKeyboard`, `dnsSrvDefaultsKeyboard`) in fr/hi/zh → added so Telegram doesn't render link previews on DNS messages for non-English users.

### Verified
- All 4 lang files load cleanly (no syntax errors). Lint passes.
- Functional test (`translation('t.<key>', lang, …)`) returns localized strings for all newly added keys in en/fr/hi/zh.
- Deep-key audit: only "missing" keys remaining are reverse-mapping reverse keys that are intentionally localized (e.g., en `'MX Record':'MX'` vs fr `'Enregistrement MX':'MX'`) — not real gaps.
- Node service restarted; webhook + bot live.

### Note on admin `notifyGroup()` crypto-payment string
Reviewed `/app/js/_index.js:27777` and all other `notifyGroup()` call sites — they use hardcoded English by design (admin/group broadcast channels, not user-facing). Convention preserved; no refactor needed.

### Files touched
- `js/lang/fr.js`, `js/lang/hi.js`, `js/lang/zh.js`

## P1 Fix — IVR Call Forwarding Broken (@wizardchop) (2026-04-29)

### Root Cause (verified via Railway production logs)
A **missing `await`** in `js/voice-service.js` `handleVoiceWebhook()` switch caused **every inbound `call.initiated` event** to be silently dropped:

```js
// BUG: handleIvrTransferLegInitiated is `async`, returning a Promise (always truthy)
if (handleIvrTransferLegInitiated(payload)) break  // ← always breaks!
```

Because the if-condition was a non-awaited Promise, it was always truthy, so `break` ran on every call and `handleCallInitiated()` was **never called** for inbound calls. Telnyx parked the call awaiting bot instructions; the bot never answered or transferred; caller heard silence and hung up after ~10–30s. Two sister sites in the same switch had the same bug.

### Diagnostic evidence
- DB lookup: `+15162719167` IS in `phoneNumbersOf` (chatId `1167900472`, plan=business, callForwarding.mode=always, forwardTo=`+19382616936`).
- Telnyx API: 26 call events to/from this number, **`webhook_delivery.status: delivered`** for every event.
- Railway logs (dep `279ca693`, time-windowed 17:05–17:30 UTC on 2026-04-28): each `call.initiated` produced exactly three log lines (`📞 Telnyx voice webhook received`, `[Voice] Event: call.initiated`, `[Voice] PAYLOAD DUMP …`) and **nothing else** until the caller's `call.hangup` arrived seconds later. Confirmed `handleCallInitiated()` never executed.

### Fixes
1. **`js/voice-service.js`**: added `await` to three async-but-unawaited dispatcher calls:
   - `case 'call.initiated'` → `await handleIvrTransferLegInitiated(payload)`
   - `case 'call.answered'` → `await handleIvrTransferLegAnswered(payload)`
   - `case 'call.hangup'` → `await handleOutboundIvrHangup(payload)` and `await handleIvrTransferLegHangup(payload)`
2. Added structured observability so the next failure is one-glance traceable:
   - `[Voice] handleCallInitiated: ${direction} from=… to=… conn=… cc=…`
   - `[Voice] Number owner found: chatId=… plan=… sip/fwd/ivr/vm flags`
   - `[Voice] Answering call for … (hasSip=…, hasIvr=…, hasForwardAlways=…)`
   - `[Voice] answerCall accepted/returned null` (explicit instead of silent return)
   - `[Voice] handleCallAnswered: …` + features summary
   - `[Voice] ⚠️ Stale call.initiated: ${ageMs}ms old` for >5s-delayed webhooks
3. **`js/telnyx-service.js`**: added 10-second axios timeout and `[Telnyx] answerCall OK/stale/ERROR` logs to `answerCall()` so silent hangs surface immediately.

### Verified locally
- Synthetic webhook to `localhost:5000/telnyx/voice-webhook` now produces:
  `📞 Telnyx voice webhook received → [Voice] Event → PAYLOAD DUMP → ⚠️ Stale (when applicable) → handleCallInitiated → [Telnyx] answerCall ERROR/OK` — full trace as expected.
- Lint passes on both files. Node service restarted, healthy.

### Pending
- Production redeploy is required (user action: "Save to Github") for @wizardchop to retest. Bot logs will now make any further failure pinpoint-debuggable.

---

## P2 Fix — File Manager Delete UI Silent Failure (@Thebiggestbag22) (2026-04-29)

### Root cause
`/app/frontend/src/components/panel/FileManager.js` `handleDelete` used `window.confirm()`. **Native `window.confirm` is unreliable in Telegram WebApp and many mobile in-app browsers** (silently returns `false` or never opens), so taps on the Delete button looked like nothing happened.

### Fix
- Replaced the `window.confirm()` gate with a custom React modal that mirrors the existing Rename / Copy-Move modal pattern (same `fm-modal` styling, same `data-testid` conventions).
- Added states: `deleteTarget` (pending file/dir + isDir flag) and `deleting` (in-flight).
- Modal shows the file name, an extra warning when deleting a folder, Cancel + red Delete button.
- Success path now also auto-clears the success message after 4 s for consistency with other operations.
- Added test IDs: `fm-delete-modal`, `fm-delete-target-name`, `fm-delete-cancel`, `fm-delete-confirm`, `fm-delete-close`.

### Verified
- Lint passes. Frontend hot-reload picks up changes; HTTP 200 on root.
- Existing backend (`js/cpanel-routes.js` `deleteFile` + WHM fallback) untouched — only the UX confirm-step changed.

### Files touched
- `js/voice-service.js`, `js/telnyx-service.js`, `frontend/src/components/panel/FileManager.js`

## P3 Fix — Email Validation Cancel UX & Hard-Reset Bug (jinnXI session) (2026-04-29)

### Bug found via Railway log replay
User `8280668528` (jinnXI) hit two unexpected `[reset] Unrecognized message ... Resetting to main menu` events while on the Email Validation menu (`evMenu` action):
1. Typed `'50'` (likely thought EV expected a quantity) → no graceful fallback → hard reset.
2. Tapped `'❌ Cancel'` from a stale keyboard left over from the paste flow → `evMenu` only matched `t.cancel = 'Cancel'` (no emoji) → hard reset.

### Fixes
1. **`evMenu` accepts `'❌ Cancel'`** as exit (alongside `t.back` / `t.cancel` / `'🔙 Back'`).
2. **Graceful fallback for unrecognized text in `evMenu`**: instead of falling through to the global `[reset]` handler, the bot now replies "❓ I didn't catch that. Tap one of the buttons below…" and **re-renders the menu keyboard** (Upload / Paste / History / Back) — translated for en/fr/zh/hi.
3. **Cancel from `evPasteEmails` and `evUploadList` now re-renders the EV menu keyboard** instead of just sending text — so the stale `'❌ Cancel'` button in Telegram's persisted keyboard is properly replaced and users see the right buttons immediately.

### Audited the rest of the bot for the same pattern
Wrote a quick AST-style audit (245 action handlers in `_index.js`) to find any handler that:
- Accepts `t.cancel` ('Cancel') as exit, AND
- Renders `'❌ Cancel'` (emoji variant) in its UI keyboards

Only **one** other handler had the same blind spot:
- **`ebMenu`** (Email Blast) at `_index.js:11069` — also fixed to accept `'❌ Cancel'` and `t.ebCancelBtn` as exit.

### Verified
- Lint passes on `_index.js`.
- Node restarted cleanly; bot webhook live; CR-Whitelist API check passing locally.

### What was NOT changed (intentional)
- The paste flow (`evPasteEmails`) only shows `'❌ Cancel'` because the user is mid-paste — adding a Continue button would be premature. After valid emails are parsed (≥10), the bot already auto-displays the proper payment options (Free Trial / Pay USD / Pay NGN / Cancel), so the flow does complete correctly.
- The 4 handlers that show `'❌ Cancel'` but have no Cancel-handling logic at all (`ebTestEmail`, `downloadSSHKey`, `validatorSelectFormat`, `submenu2`) were verified — they're terminal handlers that return after their work; they don't need to handle Cancel.

### Files touched
- `js/_index.js` (3 handler patches: `evMenu` + fallback, `evPasteEmails` cancel keyboard, `evUploadList` cancel keyboard, `ebMenu` cancel match)


## Global UX Improvement — Contextual gentle-hint reset (2026-04-29)

### Problem
Whenever a user typed unrecognized text mid-flow (e.g., `'50'` while on EV menu, or random characters while on a sub-menu), the global `[reset]` handler would always send the **main menu**, ejecting the user from their context. Even with the Phase-1 fixes for `evMenu`/`ebMenu`, the **245 other action handlers** that fall through to global reset still dumped users to the main menu — a known cause of cart abandonment.

### Solution (`js/_index.js` global reset handler ~line 24562)
Three-tier escalation, language-aware:

1. **Tier 1 — Mid-action with no friction yet:** if `action` is set to anything other than `null` / `'none'` / `'mainMenu'` / `'menu'`, send a friendly contextual hint ("❓ I didn't catch that. Tap one of the buttons below, or type /start to see the main menu.") with **NO `reply_markup`** — Telegram preserves the user's existing keyboard so they can continue exactly where they were.
2. **Tier 2 — Repeated friction (3 hints in 60 s):** escalates to the original main-menu reset (full keyboard replacement) — handles users who are genuinely stuck.
3. **Tier 3 — Base-state users (no action / on main menu):** unchanged behavior — sends `t.what + t.welcome` with main menu (as before).

Implementation details:
- Two new module-scoped maps: `_resetHintCount` (per-user `{count, firstHintAt}`) and constants `HINT_ESCALATE_MAX = 3`, `HINT_ESCALATE_WINDOW_MS = 60000`.
- Sliding-window logic: window resets if user goes >60 s without a hint.
- After escalation, the counter is cleared so the next batch starts fresh.
- GC: maps purge entries older than 60 s when size exceeds 5,000 — bounded memory.
- Translated to en/fr/zh/hi.

### Verified
- Smoke test: action=`connectExternalDomainFound`, sent 5 unrecognized messages with 5.5 s gaps:
  - msg 1 → "Gentle hint sent (count=1)" ✅
  - msg 2 → "Gentle hint sent (count=2)" ✅
  - msg 3 → "Gentle hint sent (count=3)" ✅
  - msg 4 → "Escalating to main-menu reset (3 hints in 60s)" ✅
  - msg 5 → counter cleared, fresh start ✅
- Action=`none` (base state) → falls through to main-menu reset (unchanged) ✅
- Lint passes; bot restarts cleanly; CR-Whitelist API check passing locally.

### Files touched
- `js/_index.js` (added 2 maps + 2 constants near `_lastResetPerUser`; restructured global reset handler with 3-tier path)

### Backlog still open
- 🔴 Production CR-Whitelist Puppeteer login broken — needs ConnectReseller credential check.
- 🟠 `claief8e` AntiRed silently disabled — owner notification not sent.
- 🚀 Redeploy Railway to ship voice-service `await` fix, file-delete modal, EV cancel patches, and this gentle-hint UX upgrade.


## CI Lint Rules — Async-in-condition + Translation parity (2026-04-29)

Two new automated checks added to prevent recurrence of bugs we hit this week.

### 1. `lint:await` — flags `if (asyncFn(...))` without `await`
- **Script:** `scripts/lint_async_in_if.js` (~250 lines, AST-based via `acorn` already in tree).
- **What it does:** parses every `.js` under `js/`, builds two registries of async functions:
  - **bareNames**: from `async function foo`, `const foo = async ...`, etc.
  - **qualifiedNames**: from `obj.foo = async ...`, `const obj = { foo: async ... }`, class methods.
  Then walks every `IfStatement` / `WhileStatement` / `DoWhileStatement` / `ConditionalExpression` test, plus operands of `LogicalExpression` (`&&`, `||`), and flags any `CallExpression` whose callee resolves to an async function and is **not** wrapped in `await`.
- **Namespace-aware** to minimise false positives: `obj.foo()` only flags if `obj.foo` is in `qualifiedNames` — different namespaces are not conflated.
- **Caught** the exact pattern that broke voice forwarding for @wizardchop, plus **2 additional sister bugs** I missed in the manual fix in `voice-service.js processHangup()` — those have now been patched.
- **Verified false-positive rate** = 0 across the 156 .js files in `js/`.
- **Verified true-positive**: a sanity test that re-introduces the bug (`if (handleIvrTransferLegInitiated(payload)) break`) is correctly flagged.

### 2. `lint:lang` — Translation parity gate (en ↔ fr / hi / zh)
- **Script:** `scripts/check_lang_parity.js` (~80 lines).
- **What it does:** loads each lang file, recursively collects all keys (deep-walked through nested objects), and reports any key present in `en.js` but missing from `fr.js`/`hi.js`/`zh.js`.
- **Skip-list** for intentional reverse-mapping tables (`supportedCryptoView`, `supportedLanguages`, `planOptionsOf`, `selectFormatOf`, `vpsPlanOf`, plus DNS-record-type and CAA-tag mappings inside `t`) — these have language-specific KEYS by design (e.g., `'MX Record'` in en vs `'Enregistrement MX'` in fr). Skip-list keeps the gate strict for real keys without false-failing on these tables.
- **Verified true-positive**: removing one key from `fr.js` correctly produces a "missing 2 key(s): t.smsManageDevices, user.smsManageDevices" failure.
- **Verified true-negative**: current state passes (28 extra keys per lang are informational only).

### Wiring
- **`package.json` scripts** (use with `npm run` since project's `engines.node` blocks yarn locally):
  - `npm run lint:await` — async-in-condition check
  - `npm run lint:lang` — translation parity check
  - `npm run lint:ci` — runs both, exits non-zero on any failure
- **`.github/workflows/lint.yml`** — GitHub Actions workflow runs both checks on every push and PR to main/master. Two parallel jobs: `lint-await`, `lint-lang`.
- **`scripts/git-pre-commit.sh`** — optional local pre-commit hook (auto-runs only when `.js` or `js/lang/*.js` is staged). Install: `cp scripts/git-pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`.

### Files added/touched
- `scripts/lint_async_in_if.js` (new, AST-based, namespace-aware)
- `scripts/check_lang_parity.js` (new, deep-walk + skip-list)
- `scripts/git-pre-commit.sh` (new, optional local gate)
- `.github/workflows/lint.yml` (new, CI gate)
- `package.json` (added 3 scripts: `lint:await`, `lint:lang`, `lint:ci`)
- `js/voice-service.js` (fixed 2 additional sister bugs in `processHangup()` discovered by the new lint rule)

### `lint:await` — extended with Pattern B (floating-Promise-as-value) (2026-04-29)

The original `lint:await` only caught Pattern A — async calls directly inside conditions. Extended to also catch Pattern B: variables assigned to async results that are then used as truthy/falsy values.

**Pattern B examples now caught:**
```js
const user = fetchUser()          // Promise, not awaited
if (user) { ... }                  // ← always truthy → bug
if (!user) return                  // ← always false → bug
user ? 'a' : 'b'                    // ← always 'a' → bug
user && doThing()                  // ← always truthy → bug
```

**Safely IGNORED (no false positives on these patterns):**
- `const user = await fetchUser()` (awaited at decl)
- `const userPromise = fetchUser(); const user = await userPromise` (awaited later)
- `const p = fetchUser().then(...)` (chained)
- `const p1 = fn1(); const p2 = fn2(); await Promise.all([p1, p2])` (parallelism)
- `const p = fetchUser(); return p` (caller awaits)
- `const p = fetchUser(); void p` (explicit fire-and-forget)

**Implementation details:**
- **Scope-aware**: a variable named `user` declared in `bug1()` is independent from a `user` declared in `safe1()`. Uses a deterministic scope counter consistent across the two AST passes.
- **Misuse-only flagging**: any single use in a truthy/value context is a real bug regardless of other Promise-aware uses elsewhere — `if (promise)` is always truthy even if the same promise is awaited 5 lines later.
- **Pattern label**: `[floating-promise-as-value]` (distinct from `[no-async-in-condition]` so log triage is easy).

**Verified:**
- Synthetic fixture with 4 bug variants + 6 safe patterns: exactly 4 flagged, 0 false positives.
- Full codebase: 0 findings across 156 files (no real misuses exist after this week's fixes).
- Pattern A regression: re-introducing the voice-service `await` bug is still caught correctly.

