# Coupon "expired" complaint (@Grrt2231) — root cause + deferred-burn fix — 2026-07-26

## Complaint
Prod user @Grrt2231 (chatId 8868602470): "coupon code wasn't working and says expire".

## Diagnosis (from Railway logs, deployment d25621b5)
- 20:14:25 applied daily coupon `NMD10VEQH5U` (10%) on interac.live → `[DailyCoupon] NMD10VEQH5U used by 8868602470` — **burned immediately at apply-time**.
- Purchase did NOT complete ("Domain name is invalid").
- 20:45:42 re-applied same code → "⚠️ already used today".
- User read the generic `couponInvalid` msg ("❌ Invalid: Code expired…") → complained → rated support BAD.

## Root cause (systemic)
In all ~11 coupon apply-sites, `markCouponUsed()`/`markWelcomeCouponUsed()` ran the moment a coupon
was APPLIED, not when the order was PAID. Any failed/abandoned/cancelled purchase permanently
burned the user's once-per-day (daily) / one-time (welcome) coupon. Affected every product.

## Immediate remediation (done)
Removed 8868602470 from `dailyCoupons` today-doc `codes.NMD10VEQH5U.usedBy` → user can use it again
(daily coupon expires at UTC midnight). Safe/reversible single-field write.

## Systemic fix (user approved option "a": defer burn to payment completion)
Coupons are now stored as PENDING at apply-time and burned ONLY on successful payment completion.
- `js/_index.js`:
  - New `redeemPendingCoupon(chatId)` helper (after resolveCoupon ~L1112): reads
    `pendingCouponCode`/`pendingCouponType` from state, burns daily→`dailyCouponSystem.markCouponUsed`
    / welcome→`userConversion.markWelcomeCouponUsed`, then `$unset`s the pending fields.
  - All 9 apply-sites (8 identical via replace_all + 1 bundle `|| coupon`): replaced the two
    immediate `markCouponUsed`/`markWelcomeCouponUsed` calls with
    `saveInfo('pendingCouponCode', couponResult.code)` + `saveInfo('pendingCouponType', couponResult.type)`.
  - Wired `cartRecovery = initCartAbandonment(bot, db, state, redeemPendingCoupon)` (L2984).
- `js/cart-abandonment.js`: `initCartAbandonment(bot, db, stateCol, onPaymentCompleted)` — calls
  `await onPaymentCompleted(cid)` inside `recordPaymentCompleted` (THE universal payment-completion
  signal, ~35 call sites across all products).
- `js/daily-coupons.js`: `markCouponUsed` uses `$addToSet` (idempotent) instead of `$push`.

Why recordPaymentCompleted: it's the single chokepoint fired on every successful purchase (wallet +
crypto + bank), called BEFORE provisioning/state-cleanup, so pending coupon fields are still present.

## Verification
- Static: 0 remaining apply-time markUsed; 9 pending-storage sites; helper+wiring present; node -c OK; clean boot.
- Integration test `js/tests/test_deferred_coupon_burn.js` (real daily-coupons module + throwaway test
  code, cleaned up) → PASS: applyValid, **reapplyAfterFailWorks** (the fix), burnedOnCompletion,
  pendingClearedAfterRedeem, singleUsePreserved, idempotentNoDup.

## Known residual edge (minor, accepted)
If a user applies a coupon, ABANDONS that purchase, then completes a DIFFERENT purchase the same day
WITHOUT re-applying, the stale pending coupon burns on that later completion. Rare; strictly better
than the old always-burn-on-apply. Could later clear pending at coupon-skip sites if needed.

## Not changed (offered, user only approved "a")
The `couponInvalid` message still says "Code expired, not applicable, or incorrect" (conflates
already-used vs expired vs invalid). Offer stands to split these for clarity.
