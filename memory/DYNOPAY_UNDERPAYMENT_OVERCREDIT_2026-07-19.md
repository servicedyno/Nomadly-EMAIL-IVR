# DynoPay Wallet UNDERPAYMENT Over-Credit Bug — RCA & Fix

**Date:** 2026-07-19
**Severity:** P0 (revenue leak — house credits far more than the user paid)
**Reported-by:** Operator — *"@spirits_of_the_ancesters deposited 17 TRX and got $100 credited"*
**Verified-by:** Production MongoDB forensic trace + testing agent (18 node assertions + 7 HTTP scenarios)

---

## The Incident

User **Spirits_Of_The_Ancesters** (chatId `7898648919`), ref `6dwYg`:

| Field | Value |
|---|---|
| Coin sent | 17.720549 TRX |
| DynoPay `exchange_rate` | 0.33 |
| Actual USD value | ≈ **$5.85** |
| Invoice (`base_amount`) | $100 |
| `fee_payer` | company |
| Webhook | `payment.confirmed`, payment_id `944fe2a8-4590-4f56-8ca1-10ab3bed0c60` |
| Bot credited | **$100** ❌ (transaction `TXN-20260719-5FC10`) |
| Over-credit | **$94.15** |

## Root Cause

`/app/js/_index.js` POST `/dynopay/crypto-wallet` credit block:

```js
usdIn = conversionOk ? Math.max(invoice, convertedValue) : invoice
```

`Math.max(invoice, convertedValue)` was introduced to fix the Versace438 **overpayment** under-credit
(2026-06-18). But it also means: on ANY underpayment, `Math.max` returns the invoice — so a user who
pays 6% of the invoice is still credited 100%. The "underpayment legacy protection" was only ever meant
for network-fee shaving (a few %), not massive shortfalls.

## Retrospective Sweep (365-day forensic window — `dynopayWebhooks`)

`scripts/sweep_undercredit_overpay.py` flagged 4 incidents (actual < 90% of invoice):

| Ref | Handler | Coin | Sent | Invoice | Credited | Over-credit |
|---|---|---|---|---|---|---|
| 6dwYg | crypto-wallet | TRX | $5.85 | $100 | $100 | $94.15 |
| 3R9ly | crypto-pay-hosting | USDT-TRC20 | $58.94 | $105 | $105 | $46.06 |
| sAoKK | crypto-pay-marketplace-access | USDT-TRC20 | $4.23 | $50 | (service) | $45.77 |
| N4b0q | crypto-wallet | BTC | $5.00 | $10 | (service) | $5.00 |

Total flagged ≈ **$190.98** (only since forensic capture began 2026-06-18; older incidents not captured).

Note: the product handlers (`crypto-pay-hosting`, `crypto-pay-marketplace-access`, `crypto-pay-plan`, …)
use a **different** code path — `usdIn = parseFloat(base_amount)` — which defeats their own
`if (usdNeed < price)` guard (they compare the invoice to price, never the actual received value).
**Those are NOT fixed in this run** (they need a behavioural decision: reject vs credit-and-refund).

## Fix (wallet handler only, this run)

- **NEW `/app/js/crypto-credit.js`** — pure `computeDepositCreditUsd({invoiceUsd, convertedValue, feePayer, underpayTolerance=0.90})` → `{creditUsd, mode}`:
  - `actual >= invoice` → credit **ACTUAL** (`overpayment`; Versace438 preserved)
  - `invoice*0.90 <= actual < invoice` → credit **INVOICE** (`minor-underpayment`; fee-shave goodwill)
  - `actual < invoice*0.90` → credit **ACTUAL** (`major-underpayment`; **THE FIX**)
  - conversion NaN + valid invoice → credit **INVOICE** (`invoice-fallback-noconvert`; ciroovblzz NaN guard preserved)
  - nothing usable → `blocked-no-data` (admin notify, no credit)
- **`/app/js/_index.js`** POST `/dynopay/crypto-wallet` — replaced the `Math.max` block with the helper; `major-underpayment` also fires an admin `notifyGroup`. Final `Number.isFinite(usdIn) && usdIn>0` guard kept.
- **DEV-ONLY** POST `/dev/credit-preview` (404 in production, read-only, NO DB writes) — lets the HTTP test harness verify the logic without touching real wallets.
- **NEW test** `/app/js/__tests__/dynopay-underpayment-credit.test.js` — 18 assertions, all pass via `node`.

### Tolerance rationale (0.90)
Prod ratio analysis of 74 confirmed deposits: legit payments cluster in `[0.98, 1.02]`; one legitimate
fee-shave at `0.958` (BTC $45.04 of $47); all exploit cases `<= 0.561`. 0.90 cleanly separates goodwill
fee-shaves from abuse.

## Verified
- `node js/__tests__/dynopay-underpayment-credit.test.js` → 18/18.
- Testing agent: 7/7 HTTP scenarios via `/api/dev/credit-preview`, nodejs healthy, no new errors.
- NO production wallet was written during verification.

## Open Follow-Ups (need operator decision)
1. **Product handlers** — ✅ DONE 2026-07-19. computeDepositCreditUsd() wired into ALL 11 DynoPay
   product handlers (crypto-pay-plan/-domain/-hosting/-phone/-phone-upgrade/-leads/-vps/-upgrade-vps/
   -digital-product/-marketplace-access/-virtual-card). Each derives usdIn from ACTUAL received value
   so the existing `usdIn < price` / `usdIn < fee` guards reject under-paid orders. Verified by testing
   agent: 18/18 node assertions + 6/6 HTTP scenarios, service healthy.
2. **Spirits wallet correction**: ✅ DONE 2026-07-19 — Twilio number +18885117144 RELEASED (API 404,
   0 numbers left on subaccount), IVR "pro" plan cancelled (status=released, autoRenew=false), 2
   bulkCallCampaigns cancelled, wallet zeroed ($34.58 → $0, usdIn=usdOut=75.42). Audit:
   walletAudit + transactions TXN-REMEDIATE-9NW71 + phoneTransactions. Script:
   /app/js/scripts/remediate_spirits.js.
3. **Pre-forensic sweep (DONE 2026-07-19)** — /app/scripts/sweep_payments_pre_forensic.py scanned all
   244 crypto `payments` rows (2026-04-19 .. 2026-07-19) using USDT stablecoin ground-truth + CoinGecko
   daily historical prices for volatile coins. Result: only **1 borderline pre-forensic case** —
   ref jv9Lk (2026-04-26, @Pacelolx / 6395648769): 53.99 USDT credited $60 (ratio 0.90, $6.01 over),
   almost certainly a legit TRC20 fee-shave, NOT an exploit. **No volatile-coin (BTC/ETH/LTC/DOGE/TRX)
   over-credits before 2026-06-18.** Conclusion: the exploit is concentrated in the post-2026-06-24
   "amount-first flow" window (the 4 forensic cases: 6dwYg, 3R9ly, sAoKK, N4b0q). No mass historical leak.

## Operational note
The master Twilio token in the env was stale (HTTP 401) and was rotated to a working value on 2026-07-19
(TWILIO_AUTH_TOKEN=f498e4c4…) so the number release could authenticate.

## Reversals of exploited product grants (DONE 2026-07-19)
Script: /app/js/scripts/reverse_underpaid_products.js
- **3R9ly hosting** (chatId 8011229362 rubixeleniyan): paid $58.94 for a $105 "Premium Anti-Red
  HostPanel (1-Month)" → cPanel account **evit8c7c / evitelesspost.com**. Action: **SUSPENDED on WHM**
  (whm.suspendAccount → true; read-back suspended=1, suspendreason set). DB cpanelAccounts marked
  status=suspended, autoRenewable=false, cancelledForFraud=true. Suspended (NOT terminated) — reversible;
  operator can /removeacct to delete data if desired. The user's other 2 cPanel accounts
  (evene479 07-02, stre80fc 07-08) were UNRELATED purchases, left untouched.
- **sAoKK marketplace access** (chatId 8980682151 billy58712): paid $4.23 for the $50 one-time access.
  Action: **REVOKED** (marketplaceAccess doc deleted; verified null).
- **N4b0q** (BTC wallet $5/$10): a wallet top-up, not a product/access — no grant to reverse; small $5
  wallet over-credit left as-is (flag for operator if clawback desired).
Audit: walletAudit rows (fraud_hosting_suspend, fraud_marketplace_revoke).

## Instant admin underpayment alert (DONE 2026-07-19)
`notifyUnderpayment()` in /app/js/_index.js — ADMIN-ONLY Telegram alert (to TELEGRAM_ADMIN_CHAT_ID
only, never the public notify groups). Fires whenever computeDepositCreditUsd() returns mode
'major-underpayment' (actual < 90% of invoice). Wired into all 11 DynoPay product handlers + the wallet
handler (replaced the wallet's old broadcast notifyGroup alert). computeDepositCreditUsd() now echoes
its inputs (invoiceUsd/convertedValue/feePayer/tolerance) so the alert carries full context
(user, service, received vs invoice, % paid, shortfall). Message logs as "[Underpayment] admin alert:".
Dev-only endpoints (404 in prod): /api/dev/credit-preview adds `wouldAlertAdmin`;
/api/dev/underpayment-alert-test exercises the real send path. Verified by testing agent: 27/27
assertions (18 node + 5 trigger-logic + 2 real-send + 2 health); alert fires ONLY for <90%, never for
exact/overpay/minor fee-shave.

## Backend hardening (DONE 2026-07-19) — verified 5/5 by testing agent
1. **Two-source valuation** — new `resolveCryptoCreditUsd(req, ctx)` in /app/js/_index.js values received
   crypto via DynoPay's own settlement rate (`amount × exchange_rate` when `base_currency==='USD'`,
   authoritative) with BlockBee `convert()` as fallback + >25% divergence warning. Removes the single-
   source dependency where a flaky BlockBee response pushed credits onto the full-invoice fallback.
   Helper `dynopayActualUsd(body)` returns null for non-USD base. Wired into all 11 product handlers +
   the wallet handler.
2. **Persistent + atomic webhook idempotency** — replaced the in-memory `processedDynopayPayments` Set
   with Mongo collection `dynopayProcessed` (unique `_id`=payment_id, 30-day TTL index). authDyno now
   atomically CLAIMS the payment_id (insert-if-absent) BEFORE crediting; duplicates & concurrent fires
   hit duplicate-key 11000 → ignored. Survives pod restarts; fixes false "missed payment" alerts on
   redelivery and the concurrent-double-credit race.
3. **De-duplication** — the 11 near-identical product-handler credit blocks now call the single
   resolveCryptoCreditUsd() helper (removes the copy-paste that let the original bug spread).
Dev-only verification endpoints (404 in prod): /api/dev/resolve-credit-preview, /api/dev/idempotency-test.


## Legitimate-payment regression VERIFIED end-to-end (2026 — post-fix)
Operator asked to confirm normal/legit deposits still process "just like before the fix".
Verified via a self-contained harness (`/app/js/scripts/e2e_legit_wallet_credit.js`) — 8/8 pass:
- **Exact** 10 USDT-TRC20 = $10 vs $10 invoice → credited **$10** (mode overpayment/equal).
- **Overpayment** 12 USDT = $12 vs $8 invoice → credited **$12** actual (Versace438 preserved).
- **Minor fee-shave** 9.6 USDT = $9.60 vs $10 invoice (96%) → credited **$10** invoice (goodwill).
- **Idempotency** replay of the same payment_id → **no double-credit** (dynopayProcessed 11000 gate).
- Cumulative wallet balance exact ($32); **DB left pristine** (0 residual docs — independent re-scan).
Harness pushes real `payment.confirmed` webhooks through the REAL authDyno + /dynopay/crypto-wallet
handler against a synthetic non-numeric chatId `E2E-<ts>` (no real user), then deletes every artifact
(walletOf, state, transactions, funnelEvents, userConversion, depositFunnel, cryptoDepositAddresses,
payments, dynopayProcessed, dynopayWebhooks). Also ran: node regression 18/18; dev-endpoint legit
scenarios (exact/overpay/fee-shave) all correct with wouldAlertAdmin=false.

### Dev-pod safety hardening applied during this run
`notifyGroup()` in `js/_index.js` now only prunes the shared `notifyGroups` registry when
`BOT_ENVIRONMENT==='production'`. RATIONALE: the dev pod runs a DIFFERENT bot token
(`config-setup.js` → TELEGRAM_BOT_TOKEN_DEV) that is NOT a member of the production notify groups,
so a "chat not found"/"not a member" send failure would previously have DELETED the real production
groups from the shared DB. Verified both prod groups (Lockbay Market, Bagging The Bag) stayed intact
after the e2e run.
