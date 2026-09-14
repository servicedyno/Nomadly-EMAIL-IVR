# Nomadly Telegram Bot — End-to-End User Journey Audit & Conversion Recommendations

## Objective
Audit the complete Nomadly bot experience as a new user lives it — from the first `/start` to first payment and beyond — and return a prioritized set of recommendations that shorten the path to a first purchase and reduce drop-off.

## Deliverable
One written report (saved under `/app/memory/` and summarized in chat) containing:

1. **Journey map** — every stage a user passes through, the taps required, and where value, price and payment first become visible.
2. **Pain-point register** — each friction point with severity (Blocker / Major / Minor), which stage it hits, and why it costs conversions.
3. **Recommendations** — ranked by expected impact on first-purchase conversion vs. effort, split into:
   - *Quick wins* (copy, button order, defaults — shippable in hours)
   - *Structural* (flow redesign, pricing/packaging, lifecycle messaging)
4. **Suggested 30-day sequence** — what to change first, second, third.

This pass is **analysis only**. Nothing in the bot is changed. Implementation happens as a follow-up once you pick which recommendations to act on.

## Scope — journeys covered

| # | Stage | What is examined |
|---|-------|------------------|
| 1 | Discovery → `/start` | Entry via promos, channel, referral links; first message the user sees |
| 2 | First run | Language pick, Terms acceptance, welcome gift, guided intro, arrival at main menu — how many messages/steps before the user can do anything |
| 3 | Free value | `/testsip` free call, 5 free short links, BulkSMS trial, email-validation trial — is free value discoverable, and does it lead anywhere |
| 4 | Browse | Main menu → each product hub (Cloud IVR, Anti-Red Hosting, Domains, Digital Products, VPS/RDP, Phone Leads, Marketplace, Virtual Card, Bundles) — clarity, pricing visibility, taps to a price |
| 5 | Purchase | Plan/number selection → coupon → order summary → payment method → crypto / bank / wallet → confirmation |
| 6 | Wallet & payments | Deposit minimums, exact-amount crypto, under/over-payment handling, TRC20 floor, insufficient-balance dead ends |
| 7 | Post-purchase | Activation message, setup guidance (SIP/softphone), upsells, renewals, auto-renew, expiry warnings |
| 8 | Lifecycle messaging | Welcome offer, browse follow-up, cart-abandonment nudge, twice-daily promos, win-back, daily coupons, opt-out — frequency and coherence |
| 9 | Support | AI support, "Ask Question", escalation to a human, dead-end typed input |
| 10 | Localization | French / Chinese / Hindi parity with English on the above |

Cloud IVR gets the deepest treatment (it is the bot's headline product), but every service on the main menu is covered.

## Method
- Walk every user-facing screen in the order a real user encounters it, counting taps to (a) understand the offer, (b) see a price, (c) reach payment, (d) get the product.
- Cross-check against the three earlier production-log analyses already on file so previously fixed items are excluded and still-open ones are re-weighted.
- Pull a **fresh, read-only** sample of recent production logs to quantify drop-off (Back/Cancel frequency, `/testsip` → purchase, deposit started → deposit completed). No writes, no messages sent, the sandbox stays on its isolated local database.
- Limitations: real user accounts and the live production bot cannot be driven from here; findings rest on the exact screens/copy users receive plus production logs.

## Preliminary findings (from the walkthrough so far — to be validated and expanded in the report)

**Trust & consistency (likely Blockers)**
- Prices and quotas differ between surfaces users see back-to-back: e.g. Pro plan minutes shown as 400 in the plan picker but 500 in promos; Business shown as 600 min / 300 SMS vs "Unlimited / 1000 SMS"; domains "from $30/yr" in the bot vs "from $3" in promos; overage quoted at $0.15/min in one place and $0.04/min in another.
- Post-purchase "recommended add-ons" reference products/prices that don't exist in the catalog ($4.99 hosting, $2.99 email, $5.99 SMS).
- "X users bought this week" social-proof numbers are generated, not measured.

**Onboarding (Major)**
- Several welcome systems overlap (welcome gift, guided 3-choice intro, service-list intro, Terms, language) — a new user receives multiple stacked messages before reaching the menu; "Skip Intro" was among the most-pressed buttons in prior logs.
- Main menu presents ~17 buttons across ~10 rows with no hierarchy or "start here"; prior logs show heavy window-shopping and Back/Cancel as the 2nd most common action.
- The best free hook (`/testsip`) is a typed command, not a visible button, and ends without a next step.

**Cloud IVR purchase path (Major)**
- ~9–11 steps from hub to activation; price is visible early but the plan picker repeats the "Starter does NOT include IVR" warning three times — the product is called *Cloud IVR* yet its entry plan has no IVR, which forces disclaimers instead of a clean ladder.
- Required minimums appear late: $50 wallet floor for Bulk IVR surfaces only at launch after a 6-step form; forwarding asks for a $25 top-up after setup.

**Wallet & payments (Major)**
- Wallet screen shows only a balance and a Deposit button — no "what $X gets you", no quick amounts, no bonus visible; prior logs show instant abandonment here.
- Crypto checkout demands an exact coin amount; under-payment credits the wallet but does not complete the order, leaving the user to re-purchase manually.
- Deposit minimum $10, but TRC20 needs $20 and several services effectively need $25–$50 — the first deposit prompt doesn't say so.

**Lifecycle messaging (Major)**
- A new non-buyer can receive a welcome offer (2 h), a browse follow-up (2 h), a cart nudge (45 min), and two daily promos with two sales footers each — in the first 24 h. Prior logs recorded hundreds of "bot blocked" responses to promos.

**Navigation & help (Minor–Major)**
- Unknown typed text yields "That option isn't available" rather than routing to help/AI support; "Ask Question" exists only on Digital Products.
- Non-English copy is shorter and omits details present in English on several screens.

## How recommendations will be prioritized
Each recommendation gets an impact estimate (which stage's drop-off it attacks and how many users hit that stage) and an effort estimate. Ranking = impact ÷ effort, with trust-breaking issues (wrong prices, invented numbers) treated as P0 regardless of effort because they undermine every other fix.

## Assumptions (push back on any of these)
- **Analysis first, build second.** The report returns recommendations; no bot changes are made in this pass.
- **"Convert quickly" = first paid action within the first session or first 24 hours**, with wallet top-up counted as a conversion milestone.
- **Whole-bot coverage, Cloud IVR deepest.**
- **Fresh production logs will be sampled read-only** to put numbers on drop-off. If you'd rather keep this strictly to the screens/copy and existing reports, say so.
- Report written in English.

## Out of scope
- Code or copy changes, database edits, sending any messages to users, touching production configuration.
