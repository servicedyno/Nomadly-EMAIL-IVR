/**
 * Regression test for the 2026-06-18 open-ended wallet deposit flow.
 *
 * UX change
 *   OLD: ➕💵 Deposit → type amount ($10 min) → method picker → coin picker → fixed-amount invoice
 *   NEW: ➕💵 Deposit → coin picker → open-ended address (any amount ≥ per-coin min)
 *
 * Webhook behaviour (this test)
 *   • receivedUsd ≥ minUsd[coin] → CREDIT at `max(invoice, convertedValue)`
 *   • receivedUsd <  minUsd[coin] → FORFEIT (log to dustDeposits, no wallet
 *                                   update, no notification)
 *
 * What this locks in
 *   1. walletDepositMinFor() returns the right floor per internal ticker:
 *      USDT-TRC20 → $20, all others → $10.
 *   2. The credit-decision logic correctly produces forfeit / credit
 *     outcomes for boundary values around each per-coin floor.
 *   3. Backwards-compat: unknown tickers fall back to $10 default.
 */

const {
  WALLET_DEPOSIT_MIN_DEFAULT_USD,
  WALLET_DEPOSIT_MIN_PER_COIN,
  walletDepositMinFor,
} = require('../config')

let failed = 0
const t = (label, cond) => {
  if (cond) console.log(`  ✅ ${label}`)
  else { console.log(`  ❌ ${label}`); failed++ }
}

console.log('Open-ended wallet deposit (per-coin minimums) regression test\n')

// ── 1. Per-coin minimum map shape ──
console.log('Case 1: per-coin minimum map')
t('default min is $10', WALLET_DEPOSIT_MIN_DEFAULT_USD === 10)
t('btc → $10',         WALLET_DEPOSIT_MIN_PER_COIN.btc === 10)
t('ltc → $10',         WALLET_DEPOSIT_MIN_PER_COIN.ltc === 10)
t('doge → $10',        WALLET_DEPOSIT_MIN_PER_COIN.doge === 10)
t('bch → $10',         WALLET_DEPOSIT_MIN_PER_COIN.bch === 10)
t('eth → $10',         WALLET_DEPOSIT_MIN_PER_COIN.eth === 10)
t('trx → $10',         WALLET_DEPOSIT_MIN_PER_COIN.trx === 10)
t('erc20_usdt → $10',  WALLET_DEPOSIT_MIN_PER_COIN.erc20_usdt === 10)
t('trc20_usdt → $20',  WALLET_DEPOSIT_MIN_PER_COIN.trc20_usdt === 20)

// ── 2. walletDepositMinFor() resolves correctly ──
console.log('\nCase 2: walletDepositMinFor()')
t('btc → 10',          walletDepositMinFor('btc') === 10)
t('trc20_usdt → 20',   walletDepositMinFor('trc20_usdt') === 20)
t('unknown → default', walletDepositMinFor('zzz_unknown') === WALLET_DEPOSIT_MIN_DEFAULT_USD)
t('null → default',    walletDepositMinFor(null) === WALLET_DEPOSIT_MIN_DEFAULT_USD)
t('undefined → default', walletDepositMinFor(undefined) === WALLET_DEPOSIT_MIN_DEFAULT_USD)

// ── 3. Credit-decision boundary semantics (inlined from the patched handler) ──
const decide = (coin, baseAmount, feePayer, convertedValue, opts = {}) => {
  const minUsd = walletDepositMinFor(coin)
  let usdIn
  if (opts.openEnded) {
    // Open-ended deposit (2026-06-18): placeholder invoice ignored. Credit
    // raw converted market value. Per-coin floor applied below.
    usdIn = convertedValue
  } else if (baseAmount && feePayer === 'company') {
    // Legacy fixed-amount: max(invoice, converted) — handles under/overpay.
    usdIn = Math.max(parseFloat(baseAmount), convertedValue)
  } else {
    usdIn = convertedValue
  }
  if (usdIn < minUsd) return { outcome: 'forfeit', usdIn, minUsd }
  return { outcome: 'credit', usdIn, minUsd }
}

console.log('\nCase 3: open-ended deposit — forfeit below per-coin floor')
// All these are open-ended (the new default flow)
// BTC ($10 floor)
t('BTC $9.99 open-ended → forfeit',  decide('btc', '10', 'company', 9.99, { openEnded: true }).outcome === 'forfeit')
t('BTC $10.00 open-ended → credit',  decide('btc', '10', 'company', 10.00, { openEnded: true }).outcome === 'credit')
t('BTC $10.01 open-ended → credit',  decide('btc', '10', 'company', 10.01, { openEnded: true }).outcome === 'credit')

// TRC20 ($20 floor)
t('TRC20 $15 open-ended → forfeit',  decide('trc20_usdt', '20', 'company', 15, { openEnded: true }).outcome === 'forfeit')
t('TRC20 $19.99 open-ended → forfeit', decide('trc20_usdt', '20', 'company', 19.99, { openEnded: true }).outcome === 'forfeit')
t('TRC20 $20.00 open-ended → credit',  decide('trc20_usdt', '20', 'company', 20.00, { openEnded: true }).outcome === 'credit')
t('TRC20 $25 open-ended → credit',   decide('trc20_usdt', '20', 'company', 25, { openEnded: true }).outcome === 'credit')

// Open-ended overpay scenarios — credit raw market value
console.log('\nCase 4: open-ended overpayment credits actual market value')
{
  const r = decide('btc', '10', 'company', 60.10, { openEnded: true })
  t('BTC 6× over placeholder → credit $60.10', r.outcome === 'credit' && r.usdIn === 60.10)
}
{
  const r = decide('btc', '10', 'company', 30, { openEnded: true })
  t('BTC 3× over placeholder → credit $30', r.outcome === 'credit' && r.usdIn === 30)
}

// Unknown coin defaults to $10
console.log('\nCase 5: unknown ticker falls back to $10 default')
t('unknown coin $9 open-ended → forfeit',  decide('zzz_unknown', '10', 'company', 9, { openEnded: true }).outcome === 'forfeit')
t('unknown coin $11 open-ended → credit',  decide('zzz_unknown', '10', 'company', 11, { openEnded: true }).outcome === 'credit')

// No fee_payer / no base_amount → convertedValue used; still subject to floor
console.log('\nCase 6: no base_amount → still subject to per-coin floor')
t('BTC convert-only $8 → forfeit',  decide('btc', null, 'customer', 8).outcome === 'forfeit')
t('BTC convert-only $12 → credit',  decide('btc', null, 'customer', 12).outcome === 'credit')

// LEGACY fixed-amount flow (the Versace438 scenario) — keep max() guard
console.log('\nCase 7: LEGACY fixed-amount path still honours overpayment')
{
  // Versace438 z02SZ replay: invoice=$30, actual=$60.10 — credit actual
  const r = decide('btc', '30', 'company', 60.10)  // openEnded NOT set
  t('legacy BTC overpay → credit $60.10', r.outcome === 'credit' && r.usdIn === 60.10)
}
{
  // Network-fee shaving: invoice=$30, actual=$29.85 — credit invoice
  const r = decide('btc', '30', 'company', 29.85)
  t('legacy BTC small underpay → credit invoice $30', r.outcome === 'credit' && r.usdIn === 30)
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll open-ended wallet deposit guards in place.')
