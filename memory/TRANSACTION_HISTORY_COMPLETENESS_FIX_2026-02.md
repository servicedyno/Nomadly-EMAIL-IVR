# Fix — Transaction-history completeness bug (2026-02)

## The bug (identified during @leprechaun00 audit)
When a user paid for a product directly with crypto (not via "fund wallet") and the product fulfilment failed, the bot:
1. Credited the refund back to `walletOf` (`atomicIncrement … 'usdIn'`)
2. Sent the user a notification
3. **Did not insert a `transactions` row** for the original payment or the refund

Result: the bot's "Order History" view (`/order-history`, fed by `transactions` collection) missed the entire crypto-payment event. The wallet ledger and the transactions UI drifted out of sync.

Concretely for `@leprechaun00`:
- Paid $65 USDT-ERC20 at 03:14:22Z for `coinspotsupport.com.au` (audit logged in `payments._id=zW0nH`)
- Domain registration failed (the original OP code 374 bug)
- $65 was credited to wallet `usdIn` (silent)
- **No `transactions` row was ever written** for this $65 round-trip
- His Order History showed only 5 rows; wallet showed $5 balance — but the source of one $65 in/out cycle was invisible to him.

## Root cause
`/dynopay/crypto-pay-domain` (and the matching `/crypto-pay-domain` BlockBee handler) only called `auditCryptoTx()` on the SUCCESS path, never on:
- the FAILURE-and-refund branch
- the over-payment excess-credit branch
- the under-payment auto-credit branch
- the cheaper-registrar SAVINGS-credit branch

Each of those four code paths mutated `walletOf` but left no row in `transactions`. Same pattern existed in the BlockBee twin handler.

## Fix
1. **`/app/js/_index.js` — `/dynopay/crypto-pay-domain` handler** (~line 32835):
   - On under-payment auto-credit → `logTransaction(type=domain-underpayment-credit, status=completed)`
   - On over-payment excess credit → `logTransaction(type=domain-overpayment-credit, status=completed)`
   - On failure & refund → `logTransaction(type=domain-refund, status=refunded)` with full metadata (coin, value, ref, paymentId, reason, error)
   - On cheaper-registrar savings credit → `logTransaction(type=domain-savings-credit, status=completed)`
2. **`/app/js/_index.js` — `/crypto-pay-domain` (BlockBee) handler** (~line 32035): identical 4-branch patch for parity.
3. **`/app/js/order-history.js`** — UI improvements:
   - Added type labels for all new credit/refund variants in EN/FR/ZH/HI.
   - Introduced `isRefundOrCredit(t)` predicate covering `*-refund`, `*-overpayment-credit`, `*-underpayment-credit`, `*-savings-credit`, `wallet-topup`, `welcome-bonus`, `admin-credit`, `admin-refund-pending`, plus status `refunded` and `failed`.
   - `totalSpent` and `thisMonthTotal` now exclude refunds/credits — so the headline "Total Lifetime" stat is no longer inflated by refunded amounts.
   - Per-row amount is prefixed with `+` (credit) or `−` (spend) so direction is unambiguous.
4. **Backfill** — `/app/scripts/backfill_leprechaun_refund_tx.js`: inserted the missing `domain-refund $65` row for @leprechaun00 at `2026-06-16T03:14:22Z` with the original payment metadata (idempotent — re-runnable).
5. **Unit test** — `/app/js/tests/test_order_history_totals.js`: 19 assertions across the classification predicate + reconciliation of @leprechaun00's full 6-row history → `totalSpent=$95` (correct).

## Verification
- ✅ Bot restarts cleanly; no new lint errors (98 pre-existing errors in `_index.js` unchanged).
- ✅ Unit test passes 19/19, zero network calls.
- ✅ Backfill ran successfully — @leprechaun00 now has 6 transactions:
  ```
  03:07:36  welcome-bonus    +$5   completed
  03:14:22  domain-refund   +$65   refunded     ← backfilled (missing before)
  09:16:21  domain          −$30   completed    coinspotsupport.org
  09:52:58  wallet-topup    +$14   completed    BTC
  10:00:24  wallet-topup    +$16   completed    ETH
  11:12:54  domain          −$65   completed    coinspotsupport.com.au
  ```
  Reconciles to wallet ($100 in, $95 out, $5 balance). Total spent = $95 (only real purchases).

## Action required from you
**Save to GitHub** to ship the `_index.js` + `order-history.js` patches to Railway. The backfill row is already inserted directly in production MongoDB (no deploy needed for that part).

## Known follow-ups (not covered in this round)
The same gap pattern exists in these handlers — they were NOT patched here to keep scope tight, but the fix is mechanical (copy/paste the same 4 `logTransaction` calls):
- `/dynopay/crypto-pay-hosting`
- `/dynopay/crypto-pay-phone` + `/dynopay/crypto-pay-phone-upgrade`
- `/dynopay/crypto-pay-vps` + `/dynopay/crypto-pay-upgrade-vps`
- `/dynopay/crypto-pay-leads`
- `/dynopay/crypto-pay-plan`
- `/dynopay/crypto-pay-digital-product`
- `/dynopay/crypto-pay-virtual-card`
- All matching `/crypto-pay-*` BlockBee twins

Also unlogged: partial-lead refunds via `atomicIncrement(walletOf, ..., 'usdIn', refundAmount)` at ~10 sites (search: `Partial refund` in `_index.js`). These should also write `leads-partial-refund` rows.

## Files touched
- `/app/js/_index.js` — 2 handler blocks patched
- `/app/js/order-history.js` — predicate, labels, totals, signed display
- `/app/js/tests/test_order_history_totals.js` — new
- `/app/scripts/backfill_leprechaun_refund_tx.js` — new (one-shot, idempotent)
- `/app/memory/TRANSACTION_HISTORY_COMPLETENESS_FIX_2026-02.md` — this doc
