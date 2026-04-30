// test_payment_audit_sweep.js
// Source-level regression for the Apr-30-2026 payment-audit-trail sweep.
// Guarantees that the fixed webhook paths all call logTransaction().
//
// Flow-by-flow audit findings captured at the bottom so future agents can
// pick up the partial work. All fixed paths are asserted here; documented
// gaps are listed in the PRD for follow-up.

const assert = require('assert')
const fs = require('fs')
const path = require('path')

let passed = 0, failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++ }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++ }
}

const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

// Helper — extract the body of a handler registered with app.get/post(path, …)
function handlerBody (pathLiteral) {
  const re = new RegExp(`app\\.(?:get|post)\\s*\\(\\s*'${pathLiteral.replace(/\//g, '\\/')}'[\\s\\S]*?^\\}\\)`, 'm')
  const m = idxSrc.match(re)
  return m ? m[0] : ''
}

console.log('\n=== Payment audit-trail sweep (Apr-30-2026) ===\n')

// ── Fix 1: BlockBee `/crypto-wallet` top-up now calls logTransaction ──
t('/crypto-wallet logs to transactions collection', () => {
  const body = handlerBody('/crypto-wallet')
  assert.ok(body.length > 0, 'handler body not found')
  assert.ok(body.includes('logTransaction(db, {'),
    '/crypto-wallet must call logTransaction(db, …)')
  assert.ok(/type:\s*'wallet-topup'/.test(body),
    'must log with type: wallet-topup')
  assert.ok(/psp:\s*'blockbee'/.test(body),
    'metadata must include psp: blockbee so BlockBee rows are distinguishable')
})

t('/crypto-wallet logTransaction has safe try/catch', () => {
  const body = handlerBody('/crypto-wallet')
  const slice = body.split('logTransaction(db, {')[1] || ''
  assert.ok(/} catch \(txErr\)/.test(slice),
    'logTransaction must be wrapped in try/catch with log() fallback')
})

// ── Fix 2: BlockBee `/crypto-pay-plan` subscription ──
t('/crypto-pay-plan logs to transactions collection', () => {
  const body = handlerBody('/crypto-pay-plan')
  assert.ok(body.length > 0, 'handler body not found')
  assert.ok(body.includes('logTransaction(db, {'),
    '/crypto-pay-plan must call logTransaction(db, …)')
  assert.ok(/type:\s*'plan-subscription'/.test(body),
    'must log with type: plan-subscription')
  assert.ok(/psp:\s*'blockbee'/.test(body))
})

// ── Fix 3: BlockBee `/crypto-pay-domain` ──
t('/crypto-pay-domain logs to transactions collection', () => {
  const body = handlerBody('/crypto-pay-domain')
  assert.ok(body.length > 0, 'handler body not found')
  assert.ok(body.includes('logTransaction(db, {'),
    '/crypto-pay-domain must call logTransaction(db, …)')
  assert.ok(/type:\s*'domain'/.test(body),
    'must log with type: domain')
  assert.ok(/psp:\s*'blockbee'/.test(body))
})

t('/crypto-pay-domain uses actualPrice when registrar fallback saved money', () => {
  const body = handlerBody('/crypto-pay-domain')
  assert.ok(body.includes('updatedInfo?.actualPrice || cheaperPrice || price'),
    'amount must prefer the ACTUAL price paid (after fallback savings) over the quoted price, or the audit trail misrepresents real spend')
})

// ── Fix 4: VPS transaction type typo ──
t('VPS upgrade-plan type is spelled correctly', () => {
  assert.ok(!idxSrc.includes("'upgarde-plan'"),
    'the "upgarde-plan" typo must be fixed — no occurrences allowed')
  assert.ok(idxSrc.includes("'upgrade-plan'"),
    'correct spelling "upgrade-plan" must be used')
})

// ── Regression guard: DynoPay wallet logTransaction still present ──
t('/dynopay/crypto-wallet logTransaction parity maintained', () => {
  const body = handlerBody('/dynopay/crypto-wallet')
  assert.ok(body.includes('logTransaction(db, {'),
    'DynoPay wallet top-up must continue to call logTransaction — parity with BlockBee path')
})

// ── Regression guard: phone upgrade audit row still inserted ──
t('applyPhonePlanUpgrade still inserts phoneTransactions upgrade row', () => {
  assert.ok(/phoneTransactions\.insertOne\([\s\S]*?action: 'upgrade'/.test(idxSrc),
    'phoneTransactions upgrade row insertion must remain (previous fix)')
})

// ── DOCUMENTED GAPS (not fixed in this sweep — tracked here so follow-up work can see them) ──
const DOCUMENTED_GAPS = [
  '/crypto-pay-hosting (BlockBee hosting buy — hostingTransactions yes, transactions no)',
  '/crypto-pay-vps (BlockBee VPS — vpsTransactions yes but blob shape; no transactions)',
  '/crypto-pay-upgrade-vps (BlockBee VPS upgrade — same blob shape)',
  '/crypto-pay-digital-product (BlockBee digital product — no transactions)',
  '/crypto-pay-virtual-card (BlockBee virtual card — no transactions)',
  '/crypto-pay-leads (BlockBee leads — no transactions)',
  '/dynopay/crypto-pay-plan (DynoPay plan subscription — no transactions)',
  '/dynopay/crypto-pay-domain (DynoPay domain — no transactions)',
  '/dynopay/crypto-pay-hosting (DynoPay hosting — no transactions)',
  '/dynopay/crypto-pay-vps (DynoPay VPS — no transactions)',
  '/dynopay/crypto-pay-upgrade-vps (DynoPay VPS upgrade — no transactions)',
  '/dynopay/crypto-pay-phone (DynoPay phone — phoneTransactions yes, transactions no)',
  '/dynopay/crypto-pay-digital-product (DynoPay digital product — no transactions)',
  '/dynopay/crypto-pay-virtual-card (DynoPay virtual card — no transactions)',
  '/dynopay/crypto-pay-leads (DynoPay leads — no transactions)',
  'VPS transaction shape — insert(vpsTransactions, chatId, "bank", blob) has no top-level amount/paymentMethod/type',
]

t('Documented gaps count is finite and listed', () => {
  // Smoke check — if you add a fix, remove it from this list.
  assert.ok(DOCUMENTED_GAPS.length >= 1 && DOCUMENTED_GAPS.length <= 25,
    `Unexpected gap count (${DOCUMENTED_GAPS.length}); update this list when batch-fixing.`)
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
console.log(`ℹ️  Documented gaps still to close in follow-up batch: ${DOCUMENTED_GAPS.length}`)
DOCUMENTED_GAPS.forEach((g, i) => console.log(`   ${i + 1}. ${g}`))
process.exit(failed === 0 ? 0 : 1)
