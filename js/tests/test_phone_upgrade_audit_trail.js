// test_phone_upgrade_audit_trail.js
// Regression test for the Apr-30-2026 audit-trail gap fix:
// `applyPhonePlanUpgrade` now writes a full-fidelity row to phoneTransactions
// on every upgrade (wallet / bank / crypto / dynopay-crypto), capturing the
// actual charge + credit breakdown — not just the plan's sticker price.
//
// This test is mostly a source-level regression check since applyPhonePlanUpgrade
// lives inside the _index.js closure and can't be required in isolation
// without booting the whole bot. We assert the shape of the insertOne call
// and that all 4 call sites pass upgradeData through.

const assert = require('assert')
const fs = require('fs')
const path = require('path')

let passed = 0, failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++ }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++ }
}

const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

console.log('\n=== Phone upgrade audit-trail — phoneTransactions.insertOne ===\n')

// Isolate just the applyPhonePlanUpgrade function body for focused assertions
const fnStart = idxSrc.indexOf('async function applyPhonePlanUpgrade(')
const fnEnd = idxSrc.indexOf('async function updatePhoneNumberFeature', fnStart)
const fnBody = idxSrc.slice(fnStart, fnEnd)

t('applyPhonePlanUpgrade signature accepts upgradeData', () => {
  assert.ok(/async function applyPhonePlanUpgrade\(chatId, num, newPlan, newPrice, lang, paymentMethod, upgradeData\)/.test(fnBody),
    'upgradeData must be the 7th parameter')
})

t('Captures oldPlan and oldPrice before mutation', () => {
  assert.ok(fnBody.includes('const oldPlan = num.plan'),
    'must snapshot oldPlan BEFORE calling updatePhoneNumberField')
  assert.ok(fnBody.includes('const oldPrice = num.planPrice'),
    'must snapshot oldPrice BEFORE calling updatePhoneNumberField')
  // order matters — snapshot MUST come before the mutation
  const snapIdx = fnBody.indexOf('const oldPlan = num.plan')
  const mutIdx = fnBody.indexOf("updatePhoneNumberField(phoneNumbersOf, chatId, num.phoneNumber, 'plan', newPlan)")
  assert.ok(snapIdx > 0 && snapIdx < mutIdx,
    'oldPlan snapshot must come BEFORE the plan mutation')
})

t('Extracts chargeAmount / credit / eligibleForCredit from upgradeData with safe defaults', () => {
  assert.ok(fnBody.includes('Number.isFinite(upgradeData?.chargeAmount) ? upgradeData.chargeAmount : newPrice'),
    'chargeAmount must fall back to newPrice if upgradeData is missing')
  assert.ok(fnBody.includes('Number.isFinite(upgradeData?.credit) ? upgradeData.credit : 0'),
    'credit must fall back to 0')
  assert.ok(fnBody.includes('upgradeData?.eligibleForCredit === true'),
    'eligibleForCredit must strictly compare to true')
})

t('Inserts an "upgrade" row into phoneTransactions', () => {
  assert.ok(/await phoneTransactions\.insertOne\(\{[\s\S]*?action: 'upgrade'/.test(fnBody),
    'must call phoneTransactions.insertOne with action:upgrade')
})

t('Upgrade row includes all audit fields', () => {
  const insertBlock = fnBody.split('phoneTransactions.insertOne(')[1]?.split('})')[0] || ''
  for (const field of [
    'chatId', 'phoneNumber', "action: 'upgrade'",
    'oldPlan', 'newPlan', 'oldPrice', 'newPrice',
    'amount:', 'credit:', 'eligibleForCredit',
    'paymentMethod', 'timestamp:',
  ]) {
    assert.ok(insertBlock.includes(field),
      `phoneTransactions.insertOne must include "${field}" — got:\n${insertBlock.slice(0, 400)}`)
  }
})

t('amount and credit are stored as strings with .toFixed(2) for consistent audit format', () => {
  assert.ok(fnBody.includes('amount: chargeAmount.toFixed(2)'),
    'amount must be chargeAmount.toFixed(2) so reconciliation always has 2-decimal strings')
  assert.ok(fnBody.includes('credit: credit.toFixed(2)'),
    'credit must be credit.toFixed(2)')
})

t('insertOne is wrapped in try/catch so DB failure does not break user flow', () => {
  // A DB failure here must not strand the user in a half-upgraded state — the
  // plan mutation has already succeeded, the payment has cleared, so we log
  // and continue.
  const insertSection = fnBody.split('phoneTransactions.insertOne')[1] || ''
  assert.ok(/} catch \(e\)[\s\S]*?log\(/.test(insertSection),
    'insertOne must be wrapped in a try/catch with log() fallback')
})

t('log line now includes the ACTUAL charge, not the sticker price', () => {
  // The old line was `$${newPrice}` — ambiguous for credited upgrades.
  // New line uses chargeAmount.toFixed(2) and mentions credit when applied.
  assert.ok(fnBody.includes('charged $${chargeAmount.toFixed(2)}'),
    'log line must show chargeAmount, not just newPrice')
  assert.ok(fnBody.includes("oldPlan}→${newPlan}"),
    'log line must include oldPlan→newPlan transition')
})

t('notifyGroup admin message includes charge + credit breakdown', () => {
  assert.ok(fnBody.includes('Charged: <b>$${chargeAmount.toFixed(2)}</b>'),
    'admin notification must show actual charged amount')
  assert.ok(fnBody.includes("credit > 0 ? ` (credit -$${credit.toFixed(2)})"),
    'admin notification must disclose credit when applied')
})

// ── All 4 call sites pass upgradeData through ──
t('Wallet call site passes upgradeData', () => {
  assert.ok(idxSrc.includes(
    "await applyPhonePlanUpgrade(chatId, num, upgNewPlan, newPrice, info?.userLanguage, 'wallet', upgradeData)"
  ), 'wallet upgrade call must pass upgradeData')
})

t('Bank Transfer call site passes upgradeData', () => {
  assert.ok(idxSrc.includes(
    "await applyPhonePlanUpgrade(chatId, num, upgradeData.newPlan, upgradeData.newPrice, lang, '🏦 Bank Transfer', upgradeData)"
  ), 'bank upgrade call must pass upgradeData')
})

t('Both crypto call sites pass upgradeData (not just the first)', () => {
  const matches = (idxSrc.match(/await applyPhonePlanUpgrade\(chatId, num, upgradeData\.newPlan, upgradeData\.newPrice, lang, `🪙 Crypto \(\$\{coin\}\)`, upgradeData\)/g) || [])
  assert.strictEqual(matches.length, 2,
    `expected 2 crypto call sites passing upgradeData, found ${matches.length}`)
})

t('Zero call sites still use the old 6-arg signature without upgradeData', () => {
  // If anyone ever re-introduces a 6-arg call, this catches it.
  const lines = idxSrc.split('\n')
  for (const line of lines) {
    if (!line.includes('await applyPhonePlanUpgrade(')) continue
    // Each valid call site now has 7 comma-separated args between the parens
    // (the trailing ) closes the call). Count commas at top level — crude
    // but sufficient since we control all four sources.
    const inner = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'))
    // Count top-level commas (not inside nested parens)
    let depth = 0, commas = 0
    for (const ch of inner) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ',' && depth === 0) commas++
    }
    assert.strictEqual(commas, 6,
      `call site has ${commas+1} args; expected 7 (upgradeData missing?):\n  ${line.trim()}`)
  }
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
