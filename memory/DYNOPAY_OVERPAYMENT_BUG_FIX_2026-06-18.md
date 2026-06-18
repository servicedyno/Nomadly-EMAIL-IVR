# DynoPay Overpayment Under-Credit Bug — Root Cause, Fix, and Refund

**Date:** 2026-06-18
**Severity:** P0 (money silently kept by the house on every overpaid crypto wallet deposit)
**Reported-by:** User @Versace438 (chatId 7191777173) — *"I loaded 60 only gave me 30"*
**Verified-by:** Operator-supplied DynoPay portal screenshot — confirms $60.10 actually received

---

## The Bug

`/app/js/_index.js` /dynopay/crypto-wallet webhook handler, lines 33963–33976 (pre-fix):

```js
const baseAmount = req.body.base_amount
const feePayer = req.body.fee_payer
if (baseAmount && feePayer === 'company') {
  usdIn = parseFloat(baseAmount)      // ← invoice USD (what we told user to send)
} else {
  usdIn = await convert(value, ticker, 'usd')  // ← actual market value of what was received
}
```

`base_amount` is the **invoiced** USD (the amount the customer was told to send), **NOT** the actual USD value of what DynoPay received. When the customer overpays (sends more crypto than invoiced), the bot credits only the invoice and silently swallows the excess.

The original guard was added to protect *under*-payments (network fees shaving a few cents off the converted amount). It did its job for that case, but the symmetric overpayment case was never considered.

---

## Customer Impact (Versace438 / z02SZ)

| Field | Value |
|---|---|
| Incoming TX | `01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1` |
| Settlement TX | `776667a0520f95dd59efff5285d00201933c1ceeebc79fc54056d543e86c0349` |
| DynoPay payment_id | `2fd3c05b-0654-48b1-a201-f165e587dcb8` |
| Invoice | $30 (0.0004662 BTC) |
| Actually paid | 0.00093443 BTC = **$60.10** (per DynoPay portal) |
| Bot credited | $30 ❌ |
| Owed to user | **$30.10** |

---

## Refund Applied

Script: `/app/js/scripts/refund_versace438_z02sz.js`

```
Wallet BEFORE: usdIn=$60   usdOut=$60   balance=$0
Wallet AFTER : usdIn=$90.1 usdOut=$60   balance=$30.10
```

**Audit row:**
- `transactions._id`: `TXN-20260618-N5D91`
- `transactions.type`: `wallet-correction`
- `transactions.amount`: 30.10
- `transactions.status`: `completed`
- `transactions.description`: *"Under-credit refund: DynoPay confirmed $60.10 received for z02SZ, bot credited only $30 (base_amount bug)"*
- Full provenance in `transactions.metadata`: originalDepositRef, originalDepositTxn, dynopayPaymentId, onchainTxHash, settlementTxHash, actualPaidUsd=60.10, botCreditedUsd=30.00, underCreditUsd=30.10, appliedBy=support-audit-2026-06-18.
- Mirror row inserted into `walletLedger` for parallel-audit collections.

**Notification**: The dev-pod script deliberately does NOT send a Telegram message — production bot is on Railway, dev pod must not double-send. Operator should notify the user via the open support session (escalation `EKjiu`) with the timeline below.

### Suggested message to @Versace438

> Hi @Versace438 — your $60 deposit dispute is resolved.
>
> Forensic confirmation: you sent 0.00093443 BTC, which DynoPay recorded as $60.10 USD received. Our wallet system credited only $30 due to a bug in how we read the gateway's payload. The missing **$30.10 has been refunded to your wallet** (transaction ID `TXN-20260618-N5D91`). Your current balance is **$30.10**.
>
> Sorry for the confusion. The bug is fixed — future overpayments will be credited at their full market value.

---

## Code Fix

Same file, same lines (post-fix):

```js
const baseAmount = req.body.base_amount
const feePayer = req.body.fee_payer
const convertedValue = await convert(value, ticker, 'usd')
let usdIn

if (baseAmount && feePayer === 'company') {
  const invoice = parseFloat(baseAmount)
  // Credit the higher of invoice vs. actual converted market value:
  //   • underpaid (gas fee shaved value) → invoice (legacy protection)
  //   • overpaid (customer sent extra)   → actual market value (fixes this bug)
  usdIn = Math.max(invoice, convertedValue)
} else {
  usdIn = convertedValue
}
```

Logs distinguish the three cases (`OVERPAYMENT`, `underpayment`, normal) so operators can monitor for drift between DynoPay invoices and actual market value going forward.

---

## Regression Test

`/app/js/__tests__/dynopay-overpayment-credit.test.js` — **11 assertions** covering:

1. 2× overpayment → credit actual (not invoice) ✅
2. Underpayment → credit invoice (legacy protection preserved) ✅
3. Exact match → credit invoice ✅
4. fee_payer != 'company' → falls back to converted ✅
5. base_amount missing → falls back to converted ✅
6. Numeric base_amount type-coerced ✅
7. 5× overpayment → credit actual ✅
8. Exact replay of Versace438 / z02SZ payload → would now credit $60.10 ✅

Run: `node /app/js/__tests__/dynopay-overpayment-credit.test.js` (passes 11/11).

---

## Files

| File | Change |
|---|---|
| `/app/js/_index.js` | Webhook handler `/dynopay/crypto-wallet` credit-decision block rewritten (lines ~33963–34000) |
| `/app/js/__tests__/dynopay-overpayment-credit.test.js` | new — 11 assertions |
| `/app/js/scripts/refund_versace438_z02sz.js` | one-shot refund (already executed; safe to re-run is idempotent only if amount changes — re-running would double-credit) |

---

## Verified

- ESLint: clean.
- 11/11 regression assertions pass.
- Bot syntax check loads cleanly.
- Live wallet credit applied; balance went $0 → $30.10.
- Audit transaction (`TXN-20260618-N5D91`) visible in `transactions` collection with full provenance.

---

## Important Follow-Up

The drKee deposit (0.00031227 BTC, credited $20) **may also have been under-credited** if it was an overpayment too. The DynoPay portal payload for `payment_id a2b3a5a8-c103-4d63-bf89-8df4e5c1aadd` should be checked:
- If invoice was $20 and actual receipt was higher → owed difference to user.
- If invoice was $20 and actual receipt was ~$20 → no further action.

Operator: when convenient, paste drKee's DynoPay portal data and we'll reconcile in one query.

---

## Historical Audit (P2 follow-up)

Because the bug was in the credit path since at least 2026-04 (rough estimate of when `base_amount` logic was added), **other users may have been under-credited on overpayments**. A retrospective audit query:

```js
// Pull all wallet-topups paid via DynoPay, fetch the DynoPay portal payload
// for each payment_id, flag any where `actual_amount_usd > base_amount_usd * 1.05`.
```

Would be a one-time sweep — Versace438 may not be the only victim. Recommend running once you have a DynoPay-portal export.
