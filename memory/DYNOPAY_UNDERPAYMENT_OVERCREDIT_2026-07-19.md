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
1. **Product handlers** (`crypto-pay-hosting`/`-marketplace-access`/`-plan`/`-vps`/…): apply the same
   actual-value logic so the `usdNeed < price` underpayment guard actually works. ~10 handlers.
2. **Spirits wallet correction**: credited $100, actual $5.85. Wallet is usdIn=110/usdOut=75.42
   (balance $34.58). Clawback of $94.15 would push negative — business call for the operator.
3. **Pre-forensic sweep**: incidents before 2026-06-18 aren't in `dynopayWebhooks`; a `payments`-collection
   sweep could estimate older losses.
