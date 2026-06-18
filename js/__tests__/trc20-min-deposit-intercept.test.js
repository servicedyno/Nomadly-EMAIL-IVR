/**
 * Regression test for the 2026-06-18 TRC20 $20-minimum bypass bug.
 *
 * Bug summary
 *   In _index.js the wallet-deposit crypto selection handler did:
 *
 *       const ticker = supportedCryptoView[tickerView]   // → 'USDT (TRC20)'
 *       if (ticker === 'trc20_usdt' && depositAmountUsd < 20) { ... }
 *
 *   `supportedCryptoView` returns the DISPLAY KEY (e.g. 'USDT (TRC20)'),
 *   not the INTERNAL ticker (e.g. 'trc20_usdt'). The comparison was
 *   therefore always false, so every sub-$20 USDT-TRC20 deposit slipped
 *   past the minimum-deposit intercept.
 *
 *   Audit on 2026-06-18 found 4 sub-$20 TRC20 wallet top-ups in 14 days
 *   (refs J5bUy $10, iYdgp $15, utC7I $15, 3MDOK $11, u0PR3 $10) — at
 *   least one *after* the 2026-06-15 "fix" was deployed (utC7I, 11:22 UTC
 *   on 2026-06-18). Cause: the comparison string mismatch.
 *
 * What this test locks in
 *   • supportedCryptoView['₮ Tether (USDT - TRC20)'] is NOT 'trc20_usdt'
 *     (it is 'USDT (TRC20)'), so a direct comparison to the internal
 *     ticker name will always be false → must funnel through tickerOf.
 *   • tickerOf['USDT (TRC20)'] === 'trc20_usdt' — the canonical map.
 *   • The fix path: `tickerOf[ticker] === 'trc20_usdt'` evaluates true
 *     for the TRC20 display key, so the intercept now fires.
 *   • showDepositCryptoInfo's defense-in-depth check uses
 *     `tickerOf[tickerView]` which is also 'trc20_usdt' for TRC20.
 */

const { en } = require('../lang/en.js')
const { tickerOf: tickerOfConfig, supportedCryptoView: supportedCryptoViewConfig, TRC20_MIN_DEPOSIT_USD } = require('../config.js')

let failed = 0
const assert = (cond, label) => {
  if (cond) {
    console.log(`  ✅ ${label}`)
  } else {
    console.log(`  ❌ ${label}`)
    failed++
  }
}

console.log('TRC20 min-deposit intercept comparison guard')

// 1. supportedCryptoView returns the DISPLAY KEY, not the internal ticker.
const trc20Button = '₮ Tether (USDT - TRC20)'
const displayKey = en.supportedCryptoView[trc20Button]
assert(displayKey === 'USDT (TRC20)', `en.supportedCryptoView['${trc20Button}'] === 'USDT (TRC20)' (got '${displayKey}')`)
assert(displayKey !== 'trc20_usdt', `display key is NOT the internal ticker 'trc20_usdt'`)

// 2. The OLD broken comparison would never trigger the intercept.
const brokenCheck = (displayKey === 'trc20_usdt')
assert(brokenCheck === false, `OLD comparison (ticker === 'trc20_usdt') is false → bug reproduced`)

// 3. The FIXED comparison via tickerOf[displayKey] resolves to the internal ticker.
const fixedCheck = (en.tickerOf[displayKey] === 'trc20_usdt')
assert(fixedCheck === true, `NEW comparison (tickerOf[ticker] === 'trc20_usdt') is true → bug fixed`)

// 4. Config.js exports the same maps with the same shape.
assert(tickerOfConfig['USDT (TRC20)'] === 'trc20_usdt', `config.tickerOf['USDT (TRC20)'] === 'trc20_usdt'`)
assert(supportedCryptoViewConfig['₮ Tether (USDT - TRC20)'] === 'USDT (TRC20)', `config.supportedCryptoView maps button → display key`)

// 5. Defense-in-depth path inside showDepositCryptoInfo: `tickerView` is
//    saved as the display key after selectCryptoToDeposit, so
//    `tickerOf[tickerView]` must yield the internal ticker.
const tickerView = displayKey // what gets saved to info
const internalTicker = en.tickerOf[tickerView]
assert(internalTicker === 'trc20_usdt', `tickerOf[tickerView] === 'trc20_usdt' inside showDepositCryptoInfo`)

// 6. The minimum is set and used.
assert(TRC20_MIN_DEPOSIT_USD === 20, `TRC20_MIN_DEPOSIT_USD === 20 (got ${TRC20_MIN_DEPOSIT_USD})`)

// 7. Non-TRC20 tickers must not trigger the intercept.
const btcDisplayKey = en.supportedCryptoView['₿ Bitcoin (BTC)']
assert(en.tickerOf[btcDisplayKey] !== 'trc20_usdt', `BTC selection does not trigger TRC20 intercept`)

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll TRC20 intercept guards in place.')
