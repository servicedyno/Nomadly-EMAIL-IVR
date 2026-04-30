// test_one_tap_upgrade.js
// Regression tests for the one-tap Starter→Pro / Pro→Business upgrade flow
// shipped after the Apr-30-2026 production audit.
//
// Covers:
//   1. computeUpgradeQuote — 25% credit ONLY if current plan ≤14 days old
//      (matches the user-stated rule).
//   2. nextUpgradePlan — Starter→Pro, Pro→Business, Business→null,
//      sub-numbers→null, unavailable next-tier→null.
//   3. New button labels (upgradeToPro/upgradeToBusiness) exist in EN/FR/ZH/HI.
//   4. computeUpgradeQuote handles edge cases (missing purchaseDate, sub-numbers).
//   5. Quote keys are stable (used by both the Manage-screen button-label and
//      the upgrade-preview confirmation screen — they MUST agree).

// Make sure stale env doesn't leak in
delete process.env.PHONE_STARTER_PRICE
delete process.env.PHONE_PRO_PRICE
delete process.env.PHONE_BUSINESS_PRICE

const assert = require('assert')
const pc = require('../phone-config.js')

let passed = 0, failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++ }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++ }
}

const isoNDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

console.log('\n=== One-tap plan upgrade + 14-day credit gate ===\n')

// ── Constants surface ──
t('PLAN_UPGRADE_CREDIT_AGE_DAYS exposed and equals 14', () => {
  assert.strictEqual(pc.PLAN_UPGRADE_CREDIT_AGE_DAYS, 14)
})
t('PLAN_UPGRADE_CREDIT_PCT exposed and equals 0.25', () => {
  assert.strictEqual(pc.PLAN_UPGRADE_CREDIT_PCT, 0.25)
})

// ── computeUpgradeQuote — credit-eligibility window ──
t('Starter→Pro purchased 0 days ago — credit applied (12.50)', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(0) }, 'pro')
  assert.strictEqual(q.eligibleForCredit, true)
  assert.strictEqual(q.credit, 12.5)
  assert.strictEqual(q.chargeAmount, 62.5)
  assert.strictEqual(q.oldPrice, 50)
  assert.strictEqual(q.newPrice, 75)
})

t('Starter→Pro purchased 13 days ago — still credit-eligible', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(13) }, 'pro')
  assert.strictEqual(q.eligibleForCredit, true)
  assert.strictEqual(q.credit, 12.5)
  assert.strictEqual(q.chargeAmount, 62.5)
})

t('Starter→Pro purchased exactly 14 days ago — credit-eligible (boundary)', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(14) }, 'pro')
  assert.strictEqual(q.eligibleForCredit, true,
    'day 14 must still qualify (≤14)')
})

t('Starter→Pro purchased 15 days ago — credit DENIED, full price', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(15) }, 'pro')
  assert.strictEqual(q.eligibleForCredit, false)
  assert.strictEqual(q.credit, 0)
  assert.strictEqual(q.chargeAmount, 75, 'must charge full $75 — no credit')
})

t('Starter→Pro purchased 90 days ago — no credit', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(90) }, 'pro')
  assert.strictEqual(q.eligibleForCredit, false)
  assert.strictEqual(q.credit, 0)
  assert.strictEqual(q.chargeAmount, 75)
})

// ── Pro→Business symmetry — same rule, NEW! ──
t('Pro→Business purchased 5 days ago — 25% credit ($18.75)', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'pro', planPrice: 75, purchaseDate: isoNDaysAgo(5) }, 'business')
  assert.strictEqual(q.eligibleForCredit, true)
  assert.strictEqual(q.credit, 18.75)
  assert.strictEqual(q.chargeAmount, 101.25)
  assert.strictEqual(q.oldPrice, 75)
  assert.strictEqual(q.newPrice, 120)
})

t('Pro→Business purchased 30 days ago — NO credit, full $120', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'pro', planPrice: 75, purchaseDate: isoNDaysAgo(30) }, 'business')
  assert.strictEqual(q.eligibleForCredit, false)
  assert.strictEqual(q.credit, 0)
  assert.strictEqual(q.chargeAmount, 120)
})

// ── Edge cases ──
t('Missing purchaseDate → ineligible (defensive default)', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50 }, 'pro')
  assert.strictEqual(q.eligibleForCredit, false)
  assert.strictEqual(q.credit, 0)
  assert.strictEqual(q.chargeAmount, 75)
  assert.strictEqual(q.ageDays, Infinity)
})

t('Invalid purchaseDate string → ineligible', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: 'garbage' }, 'pro')
  assert.strictEqual(q.eligibleForCredit, false)
  assert.strictEqual(q.credit, 0)
})

t('Unknown new plan → returns null', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(5) }, 'enterprise')
  assert.strictEqual(q, null)
})

t('Unknown current plan → returns null', () => {
  const q = pc.computeUpgradeQuote(
    { plan: 'free', planPrice: 0, purchaseDate: isoNDaysAgo(5) }, 'pro')
  assert.strictEqual(q, null)
})

t('Null number → returns null', () => {
  assert.strictEqual(pc.computeUpgradeQuote(null, 'pro'), null)
})

// ── nextUpgradePlan ──
t('nextUpgradePlan: Starter → pro', () => {
  assert.strictEqual(pc.nextUpgradePlan({ plan: 'starter' }), 'pro')
})

t('nextUpgradePlan: Pro → business', () => {
  assert.strictEqual(pc.nextUpgradePlan({ plan: 'pro' }), 'business')
})

t('nextUpgradePlan: Business → null (top tier)', () => {
  assert.strictEqual(pc.nextUpgradePlan({ plan: 'business' }), null)
})

t('nextUpgradePlan: sub-number → null (sub-numbers ride parent plan)', () => {
  assert.strictEqual(pc.nextUpgradePlan({ plan: 'starter', isSubNumber: true }), null)
})

t('nextUpgradePlan: null → null', () => {
  assert.strictEqual(pc.nextUpgradePlan(null), null)
})

// ── Button labels exist in all 4 locales ──
t('EN buttons: upgradeToPro and upgradeToBusiness are present', () => {
  const btn = pc.getBtn('en')
  assert(btn.upgradeToPro && btn.upgradeToPro.includes('Pro'),
    `expected EN upgradeToPro, got ${btn.upgradeToPro}`)
  assert(btn.upgradeToBusiness && btn.upgradeToBusiness.includes('Business'),
    `expected EN upgradeToBusiness, got ${btn.upgradeToBusiness}`)
})

t('FR buttons: upgrade labels are localized', () => {
  const btn = pc.getBtn('fr')
  assert(btn.upgradeToPro && /Pro/i.test(btn.upgradeToPro))
  assert(btn.upgradeToBusiness && /Business/i.test(btn.upgradeToBusiness))
})

t('ZH buttons: upgrade labels are localized to Chinese', () => {
  const btn = pc.getBtn('zh')
  assert(btn.upgradeToPro && btn.upgradeToPro.includes('专业版'))
  assert(btn.upgradeToBusiness && btn.upgradeToBusiness.includes('商务版'))
})

t('HI buttons: upgrade labels are localized to Hindi', () => {
  const btn = pc.getBtn('hi')
  assert(btn.upgradeToPro && btn.upgradeToPro.includes('प्रो'))
  assert(btn.upgradeToBusiness && btn.upgradeToBusiness.includes('बिज़नेस'))
})

// ── Quote keys are STABLE (button label + preview screen must agree on chargeAmount) ──
t('chargeAmount is consistent for the same input across calls', () => {
  const num = { plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(5) }
  const q1 = pc.computeUpgradeQuote(num, 'pro')
  const q2 = pc.computeUpgradeQuote(num, 'pro')
  assert.strictEqual(q1.chargeAmount, q2.chargeAmount,
    'two calls with same input must produce same charge — button label and preview screen rely on this')
})

t('Pre-existing test (Apr-30 audit): @fuckthisapp scenario — Starter purchased today, upgrade to Pro = $62.50', () => {
  // Real prod data: Starter $50, purchased same day → 0 days old → eligible
  const q = pc.computeUpgradeQuote({
    plan: 'starter', planPrice: 50, purchaseDate: isoNDaysAgo(0),
  }, 'pro')
  assert.strictEqual(q.eligibleForCredit, true)
  assert.strictEqual(q.chargeAmount, 62.5,
    '@fuckthisapp paid $50 for Starter today; one-tap upgrade to Pro must show $62.50 (= $75 - 25% of $50)')
})

// ── Source-level checks: phone-config exports surface ──
t('Source: nextUpgradePlan exported', () => {
  assert.strictEqual(typeof pc.nextUpgradePlan, 'function')
})
t('Source: computeUpgradeQuote exported', () => {
  assert.strictEqual(typeof pc.computeUpgradeQuote, 'function')
})

// ── Source-level: _index.js wires the buttons + handler + helper ──
const fs = require('fs')
const path = require('path')
const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

t('_index.js: buildManageMenu pushes the one-tap upgrade row', () => {
  assert(idxSrc.includes('phoneConfig.nextUpgradePlan(num)'),
    'buildManageMenu must call nextUpgradePlan to know if a one-tap row is appropriate')
  assert(idxSrc.includes('phoneConfig.computeUpgradeQuote(num, _nextUp)'),
    'buildManageMenu must call computeUpgradeQuote to label the button with the live price')
})

t('_index.js: cpManageNumber handler routes upgrade buttons to the helper', () => {
  assert(idxSrc.includes('message.startsWith(pc.upgradeToPro)'),
    'must catch upgradeToPro button (matched by prefix because of the live $X.XX suffix)')
  assert(idxSrc.includes('message.startsWith(pc.upgradeToBusiness)'),
    'must catch upgradeToBusiness button')
  assert(idxSrc.includes('processChangePlanSelection(chatId, num, _targetPlan'),
    'must dispatch into the shared upgrade-preview helper')
})

t('_index.js: cpChangePlan upgrade-preview also uses computeUpgradeQuote', () => {
  // Ensures the legacy "Renew → Change Plan → Upgrade" path AND the one-tap
  // path produce the same numbers.
  const cpRange = idxSrc.split('action === a.cpChangePlan')[1] || ''
  assert(cpRange.includes('phoneConfig.computeUpgradeQuote(num, newPlan)'),
    'cpChangePlan handler must compute the quote via the shared helper')
})

t('_index.js: processChangePlanSelection uses 14-day-aware quote', () => {
  const helperBlock = idxSrc.split('async function processChangePlanSelection')[1] || ''
  assert(helperBlock.split('async function ')[0].includes('phoneConfig.computeUpgradeQuote'),
    'helper must use computeUpgradeQuote so the rule applies in both flows')
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
