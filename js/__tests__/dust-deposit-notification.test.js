/**
 * Regression test for the 2026-06-18 dust-deposit user-notification.
 *
 * Verifies:
 *   1. dustDepositNotice() is exported as a function in all 4 languages.
 *   2. Message body contains the received USD, the per-coin minimum, the
 *      coin name, and a clear "contact support" pointer.
 *   3. The message renders cleanly for typical edge values (1c, integer,
 *      large dust just below the floor).
 *
 * NOTE: end-to-end wiring (forfeit path → sendMessage → DB userNotified
 * flag) is exercised live in /app/js/scripts/forensic_*; this unit test
 * keeps the message-content guarantees in place across translations.
 */

const fs = require('fs')
const path = require('path')

let failed = 0
const t = (label, cond) => {
  if (cond) console.log(`  ✅ ${label}`)
  else { console.log(`  ❌ ${label}`); failed++ }
}

const langs = ['en', 'fr', 'zh', 'hi']
const tickers = ['BTC', 'USDT (TRC20)', 'LTC']

console.log('Dust-deposit user-notification regression test\n')

for (const langCode of langs) {
  console.log(`Case ${langCode}: dustDepositNotice() exists + renders`)
  const langModulePath = path.join(__dirname, '..', 'lang', `${langCode}.js`)
  t(`${langCode} module file exists`, fs.existsSync(langModulePath))

  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(langModulePath)
  const tt = mod?.[langCode]?.t || mod?.t
  t(`${langCode}.t exists`, !!tt)
  t(`${langCode}.t.dustDepositNotice is a function`, typeof tt?.dustDepositNotice === 'function')

  if (typeof tt?.dustDepositNotice === 'function') {
    for (const ticker of tickers) {
      // Boundary values
      const cases = [
        { receivedUsd: 0.01, minUsd: 10, label: '$0.01 dust' },
        { receivedUsd: 5, minUsd: 10, label: '$5 dust' },
        { receivedUsd: 9.99, minUsd: 10, label: '$9.99 (just below $10)' },
        { receivedUsd: 15, minUsd: 20, label: '$15 dust (TRC20 case)' },
      ]
      for (const c of cases) {
        const msg = tt.dustDepositNotice(c.receivedUsd, c.minUsd, ticker)
        t(`${langCode}/${ticker}/${c.label} → string`, typeof msg === 'string' && msg.length > 0)
        // Must contain numeric values
        t(`${langCode}/${ticker}/${c.label} → mentions received USD`, msg.includes(c.receivedUsd.toFixed(2)))
        t(`${langCode}/${ticker}/${c.label} → mentions min USD`, msg.includes(String(c.minUsd)))
        t(`${langCode}/${ticker}/${c.label} → mentions ticker`, msg.includes(ticker))
        // Must direct to support
        t(`${langCode}/${ticker}/${c.label} → mentions Support`, /support/i.test(msg))
      }
    }
  }
  console.log('')
}

if (failed) {
  console.error(`${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('All dust-deposit notification strings are wired and informative.')
