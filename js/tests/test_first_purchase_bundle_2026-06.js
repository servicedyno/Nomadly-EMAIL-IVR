/**
 * Verification for audit fix #19 — a first-purchase "Starter Bundle" priced to
 * match a single deposit preset ($50), so a first deposit = first purchase with
 * no leftover.
 *
 * Run: node js/tests/test_first_purchase_bundle_2026-06.js  (exit 0 = pass)
 */
const fs = require('fs')
const path = require('path')
const m = require('../monetization-engine.js')
const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let pass = 0, fail = 0
const failures = []
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('── Fix #19 — first-purchase Starter Bundle ──')

const DEPOSIT_PRESETS = [20, 50, 100, 200]
const b = m.getFirstPurchaseBundle('en')
check('getFirstPurchaseBundle returns a featured bundle', !!b && b.firstPurchase === true)
check('flat bundle price matches a deposit preset exactly', b && DEPOSIT_PRESETS.includes(b.finalPrice), b && `finalPrice=${b.finalPrice}`)
check('flatPrice overrides the % discount (final < regular)', b && b.finalPrice < b.totalBase && b.discountAmount === b.totalBase - b.finalPrice)
check('discountPercent is derived from the flat price', b && b.discountPercent === Math.round(b.discountAmount / b.totalBase * 100))

const all = m.getAllBundles('en')
check('featured bundle is listed FIRST', all[0] && all[0].firstPurchase === true, all[0] && all[0].id)
check('other bundles still use % discounts (regression)', all.some(x => !x.firstPurchase && x.finalPrice === x.totalBase - Math.round(x.totalBase * x.discountPercent / 100)))

const card = m.formatBundleCard(b, 'en')
check('bundle card carries the "PERFECT FIRST ORDER" badge', /PERFECT FIRST ORDER/.test(card))
check('bundle card says a single deposit covers it exactly', /deposit<\/b> covers this exactly|deposit\b[\s\S]{0,40}covers/.test(card))

const menu = m.formatBundleMenu('en')
check('bundle menu tags the featured bundle ("start here")', /start here/.test(menu))

// localisation smoke
for (const l of ['fr', 'zh', 'hi']) {
  const bl = m.getFirstPurchaseBundle(l)
  check(`[${l}] featured bundle localised`, bl && bl.name && bl.name.length > 3 && bl.finalPrice === 50)
}

// reachability: the deep-link router opens the bundle menu for ?start=open_bundle
check('deep-link router opens the bundle menu for open_bundle', /bundle: async \(\) => \{[\s\S]{0,400}formatBundleMenu/.test(idxSrc))

console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
if (fail) { console.log('FAILURES:'); failures.forEach(f => console.log('  • ' + f)) }
process.exit(fail ? 1 : 0)
