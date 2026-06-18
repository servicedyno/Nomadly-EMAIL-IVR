# TRC20 $20 Minimum-Deposit Bypass — Root Cause & Fix

**Date:** 2026-06-18
**Severity:** P0 (active revenue leak — sub-dust TRC20 deposits silently accepted)
**Found-by:** Operator noticed user `1960615421` (HHR2009) deposited $15 USDT-TRC20 on 2026-06-18 11:22 UTC despite the $20 floor.

## Bug

`/app/js/_index.js` line 19973 (pre-fix) compared the wrong string:

```js
const tickerView = message                          // '₮ Tether (USDT - TRC20)'
const ticker = supportedCryptoView[tickerView]      // 'USDT (TRC20)'
if (ticker === 'trc20_usdt' && depositAmountUsd < 20) { ... }   // ❌ never true
```

`supportedCryptoView[...]` returns the **display key** (`'USDT (TRC20)'`), not the **internal ticker** (`'trc20_usdt'`). The conditional was always false → the intercept never fired → every sub-$20 TRC20 wallet top-up went through.

## Evidence

Last 14d audit (`audit_trc20_under_20.js`):

| Ref | chatId | Amount | When |
|---|---|---|---|
| utC7I | 1960615421 | $15 | 2026-06-18 11:22 (**after** "fix") |
| J5bUy | 1960615421 | $10 | 2026-06-13 14:58 |
| iYdgp | 1960615421 | $15 | 2026-06-13 14:45 |
| 3MDOK | 6773929524 | $11 | 2026-04-24 17:36 |
| u0PR3 | 7080940684 | $10 | 2026-05-11 04:38 |

## Fix (1) — comparison

Compare against the **internal** ticker via the canonical `tickerOf` map:

```js
if (tickerOf[ticker] === 'trc20_usdt' && depositAmountUsd < 20) {
  return goto[a.confirmTrc20MinDeposit]()
}
```

## Fix (2) — defense in depth

Added the same guard at the top of `showDepositCryptoInfo` (the address-generation gate). Any future shortcut (deep link, admin command, quick-deposit button, webhook resume) that reaches that function directly with TRC20 + sub-$20 is now routed to the correction screen instead of minting an address.

## Regression test

`/app/js/__tests__/trc20-min-deposit-intercept.test.js` (9 assertions). Run via:

```bash
node /app/js/__tests__/trc20-min-deposit-intercept.test.js
```

## Files Changed

- `/app/js/_index.js` — lines 8336–8348 (defense-in-depth) and 19975–19995 (primary fix).
- `/app/js/__tests__/trc20-min-deposit-intercept.test.js` — new.
- `/app/js/scripts/audit_trc20_under_20.js` — forensic helper (read-only).

## Verified

- ESLint clean.
- Node syntax check passes.
- Test passes (9/9).
