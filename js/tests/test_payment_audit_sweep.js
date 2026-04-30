// test_payment_audit_sweep.js (Phase 2 — superseded the Phase 1 file)
// Source-level regression verifying that EVERY crypto payment webhook handler
// writes an audit row to the universal `transactions` collection.
//
// Strategy: extract each handler's body from _index.js, then assert it contains
// either an inline logTransaction() call (Phase 1 fixes) or an auditCryptoTx()
// helper call (Phase 2 fixes). Both formats end up in `transactions`.

const assert = require('assert')
const fs = require('fs')
const path = require('path')

let passed = 0, failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++ }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++ }
}

const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')
const lines = idxSrc.split('\n')

// Extracts the body of the handler registered at `app.get|post('<path>', ...)`
// from the start of the line until the next `app.get|post(` or `schedule.` or
// `async function ` at column 0 (crude but consistent with the way this file
// is structured).
function handlerBody (pathLiteral) {
  const startIdx = lines.findIndex(l => new RegExp(`app\\.(?:get|post)\\s*\\(\\s*'${pathLiteral.replace(/\//g, '\\/')}'`).test(l))
  if (startIdx < 0) return ''
  let depth = 0, inside = false
  for (let i = startIdx; i < Math.min(startIdx + 600, lines.length); i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; inside = true }
      else if (ch === '}') { depth-- }
    }
    if (inside && depth === 0) return lines.slice(startIdx, i + 1).join('\n')
  }
  return ''
}

console.log('\n=== Payment audit-trail sweep — Phase 2 complete ===\n')

// ── The helper function itself ──
t('auditCryptoTx() helper is defined', () => {
  assert.ok(/async function auditCryptoTx\s*\(chatId, type, amount, metadata, psp\)/.test(idxSrc),
    'auditCryptoTx helper must be defined with 5 params')
  assert.ok(idxSrc.includes("transactionId: generateTransactionId(),") &&
            idxSrc.includes("status: 'completed'") &&
            idxSrc.includes("metadata: { ...(metadata || {}), psp }"),
    'helper must insert a fully-formed transactions row with psp tag')
  assert.ok(/} catch \(txErr\)[\s\S]*?\[Audit\] Failed to log/.test(idxSrc),
    'helper must be non-blocking — DB failure logs but does not throw')
})

// ── All 20 crypto webhook handlers (10 BlockBee + 10 DynoPay) ──
const BLOCKBEE_PATHS = [
  '/crypto-pay-plan',
  '/crypto-pay-domain',
  '/crypto-pay-hosting',
  '/crypto-pay-phone',
  '/crypto-pay-vps',
  '/crypto-pay-upgrade-vps',
  '/crypto-pay-digital-product',
  '/crypto-pay-virtual-card',
  '/crypto-pay-leads',
  '/crypto-wallet',
]
const DYNOPAY_PATHS = [
  '/dynopay/crypto-pay-plan',
  '/dynopay/crypto-pay-domain',
  '/dynopay/crypto-pay-hosting',
  '/dynopay/crypto-pay-phone',
  '/dynopay/crypto-pay-vps',
  '/dynopay/crypto-pay-upgrade-vps',
  '/dynopay/crypto-pay-digital-product',
  '/dynopay/crypto-pay-virtual-card',
  '/dynopay/crypto-pay-leads',
  '/dynopay/crypto-wallet',
]

for (const p of BLOCKBEE_PATHS) {
  t(`${p} logs to transactions (BlockBee)`, () => {
    const body = handlerBody(p)
    assert.ok(body.length > 0, `handler body for ${p} not found`)
    const hasAudit = /auditCryptoTx\s*\(/.test(body) || /logTransaction\s*\(db, \{/.test(body)
    assert.ok(hasAudit, `${p} must call auditCryptoTx() or logTransaction()`)
    // BlockBee paths must tag psp: 'blockbee' somewhere
    const hasBlockBeeTag = /'blockbee'/.test(body)
    assert.ok(hasBlockBeeTag, `${p} must tag psp: 'blockbee' in its audit metadata`)
  })
}

for (const p of DYNOPAY_PATHS) {
  t(`${p} logs to transactions (DynoPay)`, () => {
    const body = handlerBody(p)
    assert.ok(body.length > 0, `handler body for ${p} not found`)
    const hasAudit = /auditCryptoTx\s*\(/.test(body) || /logTransaction\s*\(db, \{/.test(body)
    assert.ok(hasAudit, `${p} must call auditCryptoTx() or logTransaction()`)
    const hasDynoPayTag = /'dynopay'/.test(body)
    assert.ok(hasDynoPayTag, `${p} must tag psp: 'dynopay' in its audit metadata`)
  })
}

// ── Regression guards ──
t('VPS upgrade-plan type spelling correct (no "upgarde-plan")', () => {
  assert.ok(!idxSrc.includes("'upgarde-plan'"), 'typo must be fixed')
  assert.ok(idxSrc.includes("'upgrade-plan'"), 'correct spelling present')
})

t('applyPhonePlanUpgrade still inserts phoneTransactions upgrade row (previous fix)', () => {
  assert.ok(/phoneTransactions\.insertOne\([\s\S]*?action: 'upgrade'/.test(idxSrc),
    'phone upgrade audit trail must still work')
})

t('/crypto-pay-domain uses actualPrice when registrar fallback saved money', () => {
  const body = handlerBody('/crypto-pay-domain')
  assert.ok(body.includes("updatedInfo?.actualPrice || cheaperPrice || price"),
    'amount must prefer the actual price paid after fallback — audit must reflect real spend')
})

t('/dynopay/crypto-pay-domain uses actualPrice when registrar fallback saved money', () => {
  const body = handlerBody('/dynopay/crypto-pay-domain')
  assert.ok(body.includes("updatedInfo?.actualPrice || cheaperPrice || price"),
    'DynoPay domain must also use actualPrice for audit fidelity')
})

t('Phone purchase handlers log BOTH phoneTransactions AND transactions (dual-ledger)', () => {
  const blockbee = handlerBody('/crypto-pay-phone')
  const dynopay = handlerBody('/dynopay/crypto-pay-phone')
  for (const [p, body] of [['/crypto-pay-phone', blockbee], ['/dynopay/crypto-pay-phone', dynopay]]) {
    assert.ok(/phoneTransactions\.insertOne/.test(body), `${p} must still insert phoneTransactions`)
    assert.ok(/auditCryptoTx\s*\(chatId, 'phone-number'/.test(body), `${p} must also call auditCryptoTx`)
  }
})

t('auditCryptoTx uses correct "type" taxonomy per product', () => {
  const typeByPath = {
    '/crypto-pay-plan': 'plan-subscription',
    '/crypto-pay-domain': 'domain',
    '/crypto-pay-hosting': 'hosting',
    '/crypto-pay-phone': 'phone-number',
    '/crypto-pay-vps': 'vps',
    '/crypto-pay-digital-product': 'digital-product',
    '/crypto-pay-virtual-card': 'virtual-card',
    '/crypto-wallet': 'wallet-topup',
    '/dynopay/crypto-pay-plan': 'plan-subscription',
    '/dynopay/crypto-pay-domain': 'domain',
    '/dynopay/crypto-pay-hosting': 'hosting',
    '/dynopay/crypto-pay-phone': 'phone-number',
    '/dynopay/crypto-pay-vps': 'vps',
    '/dynopay/crypto-pay-digital-product': 'digital-product',
    '/dynopay/crypto-pay-virtual-card': 'virtual-card',
    '/dynopay/crypto-wallet': 'wallet-topup',
  }
  for (const [p, type] of Object.entries(typeByPath)) {
    const body = handlerBody(p)
    const hasType = body.includes(`'${type}'`)
    assert.ok(hasType, `${p} must use the canonical type '${type}' for the audit row`)
  }
})

// ── VPS upgrade paths use branching type (plan vs disk) ──
t('VPS upgrade paths use ternary type (plan vs disk)', () => {
  for (const p of ['/crypto-pay-upgrade-vps', '/dynopay/crypto-pay-upgrade-vps']) {
    const body = handlerBody(p)
    assert.ok(/vpsDetails\.upgradeType === 'plan' \? 'vps-upgrade-plan' : 'vps-upgrade-disk'/.test(body),
      `${p} must branch audit type based on vpsDetails.upgradeType`)
  }
})

// ── Leads vs validation branching ──
t('Leads paths branch between "validation" and "leads" types', () => {
  for (const p of ['/crypto-pay-leads', '/dynopay/crypto-pay-leads']) {
    const body = handlerBody(p)
    assert.ok(/isValidator \? 'validation' : 'leads'/.test(body),
      `${p} must branch audit type between validation and leads`)
  }
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
console.log(`ℹ️  Phase 2 done: all 20 crypto webhook paths now log to transactions`)
process.exit(failed === 0 ? 0 : 1)
