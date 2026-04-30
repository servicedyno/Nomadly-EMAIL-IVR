// test_plan_picker_ivr_clarity.js
// Regression tests for the production-anomaly fixes (Apr 30, 2026 audit):
//   1. Default phone-plan prices in phone-config.js now match current public
//      pricing ($50/$75/$120) instead of the legacy dev defaults ($5/$15/$30).
//      Prevents grandfathered wrong prices when env vars are missing.
//   2. Plan picker (selectPlan) surfaces an explicit "🎙 IVR / SIP softphone"
//      row per plan + a footer warning, so Starter buyers can no longer be
//      surprised that IVR requires Pro+ (root cause of @fuckthisapp incident).
//   3. Manage screen (manageNumber) labels sub-numbers as "Sub-number — $X/mo
//      (under Pro plan)" instead of the misleading "Plan: Pro ($25/mo)".

// Make sure no stale env from another shell leaks in
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

console.log('\n=== Plan picker IVR clarity + price defaults + sub-number label ===\n')

// ── Fix 1: defaults now match current public pricing ──
t('Default Starter price falls back to $50, not $5', () => {
  const en = pc.getTxt('en')
  const txt = en.selectPlan('+18005551234')
  assert(txt.includes('Starter — $50/mo'), `expected $50 default, got: ${txt.slice(0,300)}`)
  assert(!txt.includes('Starter — $5/mo'), 'must not still show legacy $5 default')
})

t('Default Pro price falls back to $75, not $15', () => {
  const en = pc.getTxt('en')
  const txt = en.selectPlan('+18005551234')
  assert(txt.includes('Pro — $75/mo'), 'expected $75 default')
  assert(!txt.includes('Pro — $15/mo'), 'must not still show legacy $15 default')
})

t('Default Business price falls back to $120, not $30', () => {
  const en = pc.getTxt('en')
  const txt = en.selectPlan('+18005551234')
  assert(txt.includes('Business — $120/mo'), 'expected $120 default')
  assert(!txt.includes('Business — $30/mo'), 'must not still show legacy $30 default')
})

// ── Fix 2: IVR clarity in selectPlan (all 4 langs) ──
t('EN selectPlan shows Starter IVR=No badge', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(/Starter — \$50\/mo[\s\S]*?IVR \/ SIP softphone:.*❌/.test(txt),
    'expected ❌ IVR badge after Starter row')
})

t('EN selectPlan shows Pro IVR=Yes badge', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(/Pro — \$75\/mo[\s\S]*?IVR \/ SIP softphone:.*✅[\s\S]*?Quick IVR/.test(txt),
    'expected ✅ IVR badge mentioning Quick IVR for Pro')
})

t('EN selectPlan shows Business IVR=Yes badge', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(/Business — \$120\/mo[\s\S]*?IVR \/ SIP softphone:.*✅[\s\S]*?Auto-Attendant/.test(txt),
    'expected ✅ IVR badge mentioning Auto-Attendant for Business')
})

t('EN selectPlan footer warns Starter has no IVR', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(txt.includes('Starter does <b>not</b> include IVR'),
    'expected explicit footer warning that Starter has no IVR')
})

t('FR selectPlan also has IVR rows + footer warning', () => {
  const txt = pc.getTxt('fr').selectPlan('+18005551234')
  assert(txt.includes('IVR / SIP :</b> ❌'), 'FR Starter should show ❌')
  assert(txt.includes('IVR / SIP :</b> ✅'), 'FR Pro/Business should show ✅')
  assert(/Starter n'inclut\s*<b>pas<\/b>\s*l'IVR/.test(txt), 'FR footer should warn')
})

t('ZH selectPlan also has IVR rows + footer warning', () => {
  const txt = pc.getTxt('zh').selectPlan('+18005551234')
  assert(txt.includes('IVR / SIP：</b> ❌'), 'ZH Starter should show ❌')
  assert(txt.includes('IVR / SIP：</b> ✅'), 'ZH Pro/Business should show ✅')
  assert(/入门版<b>不<\/b>包含IVR/.test(txt), 'ZH footer should warn')
})

t('HI selectPlan also has IVR rows + footer warning', () => {
  const txt = pc.getTxt('hi').selectPlan('+18005551234')
  assert(txt.includes('IVR / SIP:</b> ❌'), 'HI Starter should show ❌')
  assert(txt.includes('IVR / SIP:</b> ✅'), 'HI Pro/Business should show ✅')
  assert(/स्टार्टर में IVR शामिल\s*<b>नहीं<\/b>\s*है/.test(txt), 'HI footer should warn')
})

// ── Fix 3: sub-number labelling on Manage screen ──
const subNumberFixture = {
  phoneNumber: '+18889233702', isSubNumber: true, parentNumber: '+18884879051',
  status: 'active', plan: 'pro', planPrice: 25,
  capabilities: { voice: true, sms: true }, features: { sms: true },
  smsUsed: 0, minutesUsed: 0,
}
const primaryFixture = {
  phoneNumber: '+18777000068', isSubNumber: false,
  status: 'active', plan: 'starter', planPrice: 50,
  capabilities: { voice: true, sms: true }, features: { sms: true },
  smsUsed: 0, minutesUsed: 0,
}

t('EN Manage: sub-number labelled "Sub-number — $25/mo (under Pro plan)"', () => {
  const out = pc.getTxt('en').manageNumber(subNumberFixture, 0, 0, [])
  assert(out.includes('Sub-number — $25/mo (under Pro plan)'),
    `expected new sub-number label, got:\n${out.slice(0, 300)}`)
  assert(!out.includes('Plan: Pro ($25/mo)'),
    'must NOT show misleading "Plan: Pro ($25/mo)"')
})

t('EN Manage: primary number still shows "Plan: Starter ($50/mo)"', () => {
  const out = pc.getTxt('en').manageNumber(primaryFixture, 0, 3, [])
  assert(out.includes('Plan: Starter ($50/mo)'),
    'primary number rendering must remain unchanged')
})

t('FR Manage: sub-number says "Numéro ajouté — $25/mois (sous le forfait Pro)"', () => {
  const out = pc.getTxt('fr').manageNumber(subNumberFixture, 0, 0, [])
  assert(out.includes('Numéro ajouté — $25/mois (sous le forfait Pro)'),
    `expected FR sub-number label, got:\n${out.slice(0, 300)}`)
  assert(!out.includes('Forfait : Pro ($25/mois)'),
    'must NOT show misleading "Forfait : Pro ($25/mois)" for sub-numbers')
})

t('ZH Manage: sub-number says "附加号码 — $25/月（在 Pro 套餐下）"', () => {
  const out = pc.getTxt('zh').manageNumber(subNumberFixture, 0, 0, [])
  assert(out.includes('附加号码 — $25/月（在 Pro 套餐下）'),
    `expected ZH sub-number label, got:\n${out.slice(0, 300)}`)
  assert(!out.includes('套餐：Pro（$25/月）'),
    'must NOT show misleading "套餐：Pro（$25/月）" for sub-numbers')
})

t('HI Manage: sub-number says "अतिरिक्त नंबर — $25/माह (Pro प्लान के तहत)"', () => {
  const out = pc.getTxt('hi').manageNumber(subNumberFixture, 0, 0, [])
  assert(out.includes('अतिरिक्त नंबर — $25/माह (Pro प्लान के तहत)'),
    `expected HI sub-number label, got:\n${out.slice(0, 300)}`)
  assert(!out.includes('प्लान: Pro ($25/माह)'),
    'must NOT show misleading "प्लान: Pro ($25/माह)" for sub-numbers')
})

// ── Order summary final-confirmation IVR warning ──
t('EN orderSummary for Starter shows IVR warning before payment', () => {
  const out = pc.getTxt('en').orderSummary(
    '+18005551234', 'US',
    { name: 'Starter', sms: 50, minutes: 100 }, 50)
  assert(out.includes('Starter does <b>not</b> include IVR'),
    `expected IVR warning on Starter order summary, got:\n${out}`)
})

t('EN orderSummary for Pro does NOT show IVR warning', () => {
  const out = pc.getTxt('en').orderSummary(
    '+18005551234', 'US',
    { name: 'Pro', sms: 200, minutes: 500 }, 75)
  assert(!out.includes('does <b>not</b> include IVR'),
    'Pro must not show the Starter-only warning')
})

t('FR orderSummary for Starter shows IVR warning', () => {
  const out = pc.getTxt('fr').orderSummary(
    '+18005551234', 'US',
    { name: 'Starter', sms: 50, minutes: 100, features: [] }, 50)
  assert(out.includes("Starter n'inclut <b>pas</b> l'IVR"),
    'FR Starter order summary should warn about IVR')
})

t('ZH orderSummary for Starter shows IVR warning', () => {
  const out = pc.getTxt('zh').orderSummary(
    '+18005551234', 'US',
    { name: 'Starter', sms: 50, minutes: 100, features: [] }, 50)
  assert(out.includes('入门版<b>不</b>包含IVR'),
    'ZH Starter order summary should warn about IVR')
})

t('HI orderSummary for Starter shows IVR warning', () => {
  const out = pc.getTxt('hi').orderSummary(
    '+18005551234', 'US',
    { name: 'Starter', sms: 50, minutes: 100, features: [] }, 50)
  assert(out.includes('स्टार्टर में IVR') && out.includes('शामिल <b>नहीं</b>'),
    'HI Starter order summary should warn about IVR')
})

// ── 14-day upgrade-credit badge (Apr 30 enhancement) ──
t('EN selectPlan shows 14-day upgrade-credit badge on Starter row', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(/Starter — \$50\/mo[\s\S]*?14-day upgrade credit[\s\S]*?25% off Pro\/Business/.test(txt),
    'expected 14-day credit badge under Starter row')
})

t('EN selectPlan shows 14-day upgrade-credit badge on Pro row (→ Business)', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  assert(/Pro — \$75\/mo[\s\S]*?14-day upgrade credit[\s\S]*?25% off Business/.test(txt),
    'expected 14-day credit badge under Pro row, mentioning Business as the upgrade target')
})

t('EN selectPlan: Business (top tier) does NOT show the badge', () => {
  const txt = pc.getTxt('en').selectPlan('+18005551234')
  // Business row segment ends at the start of the footer "<i>💳 Outbound..."
  const businessSegment = txt.split('Business — $120/mo')[1]?.split('<i>💳 Outbound')[0] || ''
  assert(!businessSegment.includes('14-day upgrade credit'),
    'Business is the top tier; no upgrade target so no badge')
})

t('FR selectPlan shows the credit badge on Starter and Pro rows', () => {
  const txt = pc.getTxt('fr').selectPlan('+18005551234')
  assert(txt.includes('Crédit de surclassement 14 jours'),
    'FR badge string must appear')
  assert((txt.match(/Crédit de surclassement 14 jours/g) || []).length === 2,
    'FR badge must appear exactly twice (Starter + Pro)')
})

t('ZH selectPlan shows the credit badge on Starter and Pro rows', () => {
  const txt = pc.getTxt('zh').selectPlan('+18005551234')
  assert((txt.match(/14天升级抵扣/g) || []).length === 2,
    'ZH badge must appear exactly twice (Starter + Pro)')
})

t('HI selectPlan shows the credit badge on Starter and Pro rows', () => {
  const txt = pc.getTxt('hi').selectPlan('+18005551234')
  assert((txt.match(/14-दिन अपग्रेड क्रेडिट/g) || []).length === 2,
    'HI badge must appear exactly twice (Starter + Pro)')
})

// ── Env override still wins ──
t('Env override beats default (regression: PHONE_STARTER_PRICE=99 honoured)', () => {
  // re-require freshly with env set
  process.env.PHONE_STARTER_PRICE = '99'
  delete require.cache[require.resolve('../phone-config.js')]
  const pc2 = require('../phone-config.js')
  const txt = pc2.getTxt('en').selectPlan('+18005551234')
  assert(txt.includes('Starter — $99/mo'), 'env override must win')
  // restore for other tests
  delete process.env.PHONE_STARTER_PRICE
  delete require.cache[require.resolve('../phone-config.js')]
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
