/**
 * Regression test for:
 *   1. Renew Now / Auto-Renew controls moved off the Hosting Plan view
 *      into a dedicated "💳 My Plan / Billing" top-level menu entry.
 *   2. Gold plan upgrade copy now stacks each premium-only feature with
 *      "✨ Gold-exclusive" highlights (priority support, unlimited
 *      bandwidth, wildcard SSL, visitor captcha).
 *
 * Run: `node js/tests/test_billing_menu_and_gold_copy.js`
 *      (exit 0 = pass, non-zero = fail)
 */

/* eslint-disable no-console */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

let failed = 0
const check = (name, fn) => {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${e.message}`)
  }
}

console.log('Billing-menu split + Gold-exclusive copy tests')

// ── 1. Lang labels exist in every supported locale ────────────────────────────
const LOCALES = ['en', 'fr', 'zh', 'hi']
for (const lang of LOCALES) {
  // Lang files use ESM-ish const exports via module.exports — load raw text
  // because some files don't expose `user` directly via require().
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'lang', `${lang}.js`),
    'utf8'
  )
  check(`${lang}: defines user.billingMenu`, () => {
    assert.ok(/billingMenu:\s*['"]/m.test(src), 'billingMenu label missing')
  })
  check(`${lang}: defines user.backToBillingMenu`, () => {
    assert.ok(
      /backToBillingMenu:\s*['"]/m.test(src),
      'backToBillingMenu label missing'
    )
  })
}

// ── 2. _index.js wiring ───────────────────────────────────────────────────────
const indexSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

check('_index.js: action constant a.billingMenu registered', () => {
  assert.ok(/billingMenu:\s*'billingMenu'/.test(indexSrc))
})

check('_index.js: goto.billingMenu function defined', () => {
  assert.ok(/billingMenu:\s*async\s*\(\)\s*=>/m.test(indexSrc))
})

check('_index.js: top-level entry routes user.billingMenu → goto.billingMenu', () => {
  assert.ok(
    /if\s*\(message\s*===\s*user\.billingMenu\)[\s\S]{0,200}goto\.billingMenu\(\)/m.test(
      indexSrc
    )
  )
})

check('_index.js: action handler exists for a.billingMenu', () => {
  assert.ok(/if\s*\(action\s*===\s*a\.billingMenu\)/m.test(indexSrc))
})

check('_index.js: per-domain Renew button parser present', () => {
  assert.ok(/\^🔄 Renew Now — \(\.\+\)\$/.test(indexSrc))
})

check('_index.js: per-domain Toggle Auto-Renew button parser present', () => {
  assert.ok(/\^🔁 Toggle Auto-Renew — \(\.\+\)\$/.test(indexSrc))
})

check('_index.js: hosting submenu surfaces billingMenu next to myHostingPlans', () => {
  assert.ok(
    /\[user\.myHostingPlans,\s*user\.billingMenu\]/.test(indexSrc),
    'submenu3 still shows the old single-button row'
  )
})

check('_index.js: viewHostingPlanDetails no longer renders Renew Now button', () => {
  // The renew & toggle buttons must NOT appear in the buttons array of the plan view.
  // They were originally at: const buttons = [[user.revealCredentials], [user.renewHostingPlan]]
  assert.ok(
    !/const buttons = \[\[user\.revealCredentials\],\s*\[user\.renewHostingPlan\]\]/.test(
      indexSrc
    ),
    'old button row still present in viewHostingPlanDetails'
  )
})

check('_index.js: viewHostingPlanDetails no longer renders Toggle Auto-Renew button', () => {
  assert.ok(
    !/if\s*\(!isWeekly\)\s*buttons\.push\(\[user\.toggleAutoRenew\]\)/.test(indexSrc),
    'old toggleAutoRenew button push still present'
  )
})

check('_index.js: in-plan view nudges users toward the new Billing menu', () => {
  assert.ok(
    /To renew or toggle Auto-Renew, open <b>💳 My Plan \/ Billing<\/b>/.test(
      indexSrc
    ),
    'help line referencing the billing menu missing from plan view'
  )
})

check('_index.js: billingFlow flag wired into confirmRenewNow exit paths', () => {
  // Both the cancel branch and the success branch must respect the flag.
  assert.ok(/if\s*\(info\?\.billingFlow\)/.test(indexSrc))
  assert.ok(/saveInfo\('billingFlow',\s*false\)/.test(indexSrc))
})

// ── 3. Gold plan copy includes "✨ Gold-exclusive" callouts ────────────────────
const plansSrc = fs.readFileSync(
  path.join(__dirname, '..', 'hosting', 'plans.js'),
  'utf8'
)

check('plans.js: Gold bandwidth flagged Gold-exclusive', () => {
  assert.ok(/Unlimited bandwidth\s*✨\s*Gold-exclusive/.test(plansSrc))
})

check('plans.js: Gold SSL flagged Gold-exclusive (Wildcard)', () => {
  assert.ok(/Wildcard SSL\s*✨\s*Gold-exclusive/.test(plansSrc))
})

check('plans.js: Gold support flagged Gold-exclusive (Priority Support)', () => {
  assert.ok(/Priority support\s*✨\s*Gold-exclusive/.test(plansSrc))
})

check('plans.js: Gold visitor captcha flagged Gold-exclusive', () => {
  assert.ok(/Visitor Captcha[^\n]*✨\s*Gold-exclusive/.test(plansSrc))
})

const { generatePlanText } =
  require('../hosting/plans')

check('plans.js: generatePlanText renders all 4 Gold-exclusive lines for Gold tier', () => {
  // hostingType isn't really used by plans() — pass anything truthy.
  const text = generatePlanText('cpanel', 'goldenCpanel')
  for (const needle of [
    'Unlimited bandwidth ✨ Gold-exclusive',
    'Wildcard SSL ✨ Gold-exclusive',
    'Priority support ✨ Gold-exclusive',
    'Visitor Captcha toggle ON/OFF per domain ✨ Gold-exclusive',
  ]) {
    assert.ok(
      text.includes(needle),
      `Gold tier missing exclusive callout: "${needle}"`
    )
  }
})

check('plans.js: Premium tiers do NOT carry "✨ Gold-exclusive" callouts', () => {
  for (const planKey of ['premiumWeekly', 'premiumCpanel']) {
    const text = generatePlanText('cpanel', planKey)
    assert.ok(
      !/✨\s*Gold-exclusive/.test(text),
      `${planKey} text leaked the Gold-exclusive callout`
    )
  }
})

check('_index.js: Gold upgrade modal shows ✨ Gold-exclusive lines', () => {
  // The upgrade options array now carries explicit Gold-exclusive feature lines.
  assert.ok(/Unlimited bandwidth ✨ Gold-exclusive/.test(indexSrc))
  assert.ok(/Wildcard SSL ✨ Gold-exclusive/.test(indexSrc))
  assert.ok(/Priority support ✨ Gold-exclusive/.test(indexSrc))
})

if (failed) {
  console.log(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log('\nAll billing-menu + Gold-copy regression tests passed')
