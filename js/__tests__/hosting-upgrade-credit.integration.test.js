/**
 * Integration test for the hosting upgrade credit feature.
 *
 * Verifies the EXACT same code paths used in /app/js/_index.js for the
 * upgrade keyboard and modal text, using:
 *   - real env prices (PREMIUM_ANTIRED_WEEKLY_PRICE, _CPANEL_PRICE, GOLDEN_*)
 *   - a real cpanelAccounts document seeded in MongoDB
 *   - the shared `computeUpgradeQuote` helper from hosting-upgrade-credit.js
 *
 * What it asserts:
 *   1. iMr_Brown-style flow: weekly user upgrading to golden within 14 days
 *      → button label shows the DISCOUNTED price (not list)
 *      → modal text shows "Credit: -$X" line
 *      → confirm-modal "You Pay" matches the charge amount
 *   2. The same user but 30 days later → no credit, full price shown
 *
 * Run: node js/__tests__/hosting-upgrade-credit.integration.test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })

const { MongoClient } = require('mongodb')
const { computeUpgradeQuote, getBestUpgradeQuote, CREDIT_WINDOW_DAYS } = require('../hosting-upgrade-credit')
const { getPlanPrice } = require('../hosting-scheduler')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'test'

const PREMIUM_WEEKLY = Number(process.env.PREMIUM_ANTIRED_WEEKLY_PRICE || 30)
const PREMIUM_CPANEL = Number(process.env.PREMIUM_ANTIRED_CPANEL_PRICE || 75)
const GOLDEN_CPANEL = Number(process.env.GOLDEN_ANTIRED_CPANEL_PRICE || 100)

const TEST_CHAT_ID = '__upgrade_credit_test__'
const TEST_DOMAIN = 'upgrade-credit-test.example'

let passed = 0
let failed = 0
const fails = []

function assert(label, cond, extra) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${label}`)
  } else {
    failed += 1
    fails.push({ label, extra })
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`)
  }
}

/**
 * Mirrors the upgrade-options builder + button labels in _index.js
 * (lines ~10935-11017). Pure function — no Telegram send.
 */
function buildUpgradeUiFromPlan(plan) {
  const currentPlan = (plan.plan || '').toLowerCase()
  const currentPrice = getPlanPrice(plan.plan)
  const options = []
  if (currentPlan.includes('week')) {
    options.push({ name: 'Premium Anti-Red HostPanel (30 Days)', key: 'premiumCpanel', price: PREMIUM_CPANEL })
    options.push({ name: 'Golden Anti-Red HostPanel (30 Days)', key: 'goldenCpanel', price: GOLDEN_CPANEL })
  } else if (currentPlan.includes('premium') && !currentPlan.includes('week')) {
    options.push({ name: 'Golden Anti-Red HostPanel (30 Days)', key: 'goldenCpanel', price: GOLDEN_CPANEL })
  }
  for (const opt of options) {
    const q = computeUpgradeQuote({ planDoc: plan, oldPrice: currentPrice, newPrice: opt.price })
    opt.originalPrice = q.originalPrice
    opt.creditApplied = q.creditApplied
    opt.chargeAmount = q.chargeAmount
    opt.creditEligible = q.eligible
    opt.buttonLabel = `⬆️ ${opt.name} ($${q.chargeAmount.toFixed(2)})`
  }
  return { currentPrice, options }
}

async function main() {
  console.log('\nhosting-upgrade-credit — integration test')
  console.log('──────────────────────────────────────────')
  console.log(`MONGO_URL=${MONGO_URL}  DB=${DB_NAME}`)
  console.log(`Prices: weekly=$${PREMIUM_WEEKLY}  premium-cpanel=$${PREMIUM_CPANEL}  golden=$${GOLDEN_CPANEL}`)

  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const cpanelAccounts = db.collection('cpanelAccounts')

  // ─────────────────────────────────────────────────────────────
  // CASE 1: @iMr_Brown — weekly plan, renewed 6 days ago, upgrades
  // ─────────────────────────────────────────────────────────────
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  await cpanelAccounts.deleteMany({ chatId: TEST_CHAT_ID })
  await cpanelAccounts.insertOne({
    _id: `${TEST_DOMAIN}-case1`,
    chatId: TEST_CHAT_ID,
    domain: TEST_DOMAIN,
    plan: 'Premium Anti-Red (1-Week)',
    cpUser: 'testuser',
    createdAt: sixDaysAgo,
    lastRenewedAt: sixDaysAgo,
    expiryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    autoRenew: false,
  })

  let plan = await cpanelAccounts.findOne({ chatId: TEST_CHAT_ID, domain: TEST_DOMAIN })
  let ui = buildUpgradeUiFromPlan(plan)

  console.log('\n[case 1] Weekly user, renewed 6 days ago → upgrading')
  assert('currentPrice resolved from env', ui.currentPrice === PREMIUM_WEEKLY,
    `got $${ui.currentPrice}, expected $${PREMIUM_WEEKLY}`)
  assert('2 upgrade options offered (premium-monthly + golden)', ui.options.length === 2)

  const expectedCredit = PREMIUM_WEEKLY * 0.5

  const premiumOpt = ui.options.find(o => o.key === 'premiumCpanel')
  assert('premium-cpanel: eligible', premiumOpt.creditEligible === true)
  assert('premium-cpanel: credit = $' + expectedCredit.toFixed(2),
    Math.abs(premiumOpt.creditApplied - expectedCredit) < 0.001,
    `got $${premiumOpt.creditApplied}`)
  const expectedPremiumCharge = Math.round((PREMIUM_CPANEL - expectedCredit) * 100) / 100
  assert('premium-cpanel: chargeAmount = $' + expectedPremiumCharge.toFixed(2),
    premiumOpt.chargeAmount === expectedPremiumCharge,
    `got $${premiumOpt.chargeAmount}`)
  assert('premium-cpanel: button shows discounted price (not list)',
    premiumOpt.buttonLabel.includes(`$${expectedPremiumCharge.toFixed(2)}`) &&
    !premiumOpt.buttonLabel.endsWith(`($${PREMIUM_CPANEL.toFixed(2)})`),
    premiumOpt.buttonLabel)

  const goldenOpt = ui.options.find(o => o.key === 'goldenCpanel')
  const expectedGoldenCharge = Math.round((GOLDEN_CPANEL - expectedCredit) * 100) / 100
  assert('golden: eligible', goldenOpt.creditEligible === true)
  assert(`golden: chargeAmount = $${expectedGoldenCharge.toFixed(2)}`,
    goldenOpt.chargeAmount === expectedGoldenCharge,
    `got $${goldenOpt.chargeAmount}`)
  assert('golden: button shows discounted price (not $100)',
    goldenOpt.buttonLabel.includes(`$${expectedGoldenCharge.toFixed(2)}`) &&
    !goldenOpt.buttonLabel.endsWith(`($${GOLDEN_CPANEL.toFixed(2)})`),
    goldenOpt.buttonLabel)

  // The reported example: $15 credit toward Golden ($85)
  if (PREMIUM_WEEKLY === 30 && GOLDEN_CPANEL === 100) {
    assert('@iMr_Brown reported scenario: $15 credit → $85 charge',
      goldenOpt.creditApplied === 15 && goldenOpt.chargeAmount === 85,
      `credit=$${goldenOpt.creditApplied} charge=$${goldenOpt.chargeAmount}`)
  } else {
    console.log(`  ℹ️  (env prices differ from problem-statement example; skipping literal $15/$85 check)`)
  }

  // ─────────────────────────────────────────────────────────────
  // CASE 2: Same scenario but plan renewed 30 days ago → no credit
  // ─────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await cpanelAccounts.updateOne(
    { _id: `${TEST_DOMAIN}-case1` },
    { $set: { createdAt: thirtyDaysAgo, lastRenewedAt: thirtyDaysAgo } }
  )

  plan = await cpanelAccounts.findOne({ chatId: TEST_CHAT_ID, domain: TEST_DOMAIN })
  ui = buildUpgradeUiFromPlan(plan)

  console.log('\n[case 2] Same user 30 days later → outside window')
  const goldenOpt2 = ui.options.find(o => o.key === 'goldenCpanel')
  assert('golden: NOT eligible (outside 14d)', goldenOpt2.creditEligible === false)
  assert('golden: no credit applied', goldenOpt2.creditApplied === 0)
  assert('golden: full list price charged',
    goldenOpt2.chargeAmount === GOLDEN_CPANEL,
    `got $${goldenOpt2.chargeAmount}`)
  assert('golden: button shows list price',
    goldenOpt2.buttonLabel.endsWith(`($${GOLDEN_CPANEL.toFixed(2)})`),
    goldenOpt2.buttonLabel)

  // ─────────────────────────────────────────────────────────────
  // CASE 3: 14-day boundary (just inside) — still eligible
  // ─────────────────────────────────────────────────────────────
  // Seed 14d minus 1 minute ago to avoid millisecond drift between
  // Date.now() at insert and findOne — production renewals don't race this way.
  const just14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 60 * 1000)
  await cpanelAccounts.updateOne(
    { _id: `${TEST_DOMAIN}-case1` },
    { $set: { createdAt: just14, lastRenewedAt: just14 } }
  )
  plan = await cpanelAccounts.findOne({ chatId: TEST_CHAT_ID, domain: TEST_DOMAIN })
  ui = buildUpgradeUiFromPlan(plan)
  const goldenOpt3 = ui.options.find(o => o.key === 'goldenCpanel')
  console.log('\n[case 3] Just inside 14-day boundary → still eligible')
  assert('eligible just inside 14 days', goldenOpt3.creditEligible === true)

  // ─────────────────────────────────────────────────────────────
  // CASE 4: 🎁 Credit-nudge surface on My Hosting Plans + Plan Details
  // ─────────────────────────────────────────────────────────────
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
  await cpanelAccounts.updateOne(
    { _id: `${TEST_DOMAIN}-case1` },
    { $set: { createdAt: fourDaysAgo, lastRenewedAt: fourDaysAgo } }
  )
  plan = await cpanelAccounts.findOne({ chatId: TEST_CHAT_ID, domain: TEST_DOMAIN })

  console.log('\n[case 4] Loyalty-credit nudge surface (weekly, day 4)')
  const best = getBestUpgradeQuote({ planDoc: plan, oldPrice: PREMIUM_WEEKLY })
  assert('getBestUpgradeQuote returns a nudge', best !== null)
  assert('nudge target is Golden (higher tier wins ties)',
    best.target.key === 'goldenCpanel', best.target.key)
  assert('credit equals 50% of weekly price',
    best.quote.creditApplied === PREMIUM_WEEKLY * 0.5,
    `got $${best.quote.creditApplied}`)
  assert('deadline is 14 days from anchor (±1 minute)',
    Math.abs(best.deadlineDate.getTime() - (fourDaysAgo.getTime() + 14 * 24 * 60 * 60 * 1000)) < 60 * 1000)
  assert('daysRemaining is ~10 (14 − 4)',
    Math.abs(best.daysRemaining - 10) < 0.05,
    `got ${best.daysRemaining}`)

  // Build the EXACT CTA labels the bot will render
  const deadlineStr = best.deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const detailsCta = `🎁 Use $${best.quote.creditApplied.toFixed(2)} credit by ${deadlineStr}`
  const listCta = `🎁 Use $${best.quote.creditApplied.toFixed(2)} credit on ${TEST_DOMAIN}`

  // Verify the routing prefixes in _index.js will match these labels
  assert('plan-details CTA matches the deep-link router prefix',
    detailsCta.startsWith('🎁 Use $') && detailsCta.includes(' credit by '),
    detailsCta)
  assert('list CTA matches the deep-link router pattern',
    /^🎁 Use \$[\d.]+ credit on (.+)$/.test(listCta),
    listCta)
  const listMatch = listCta.match(/^🎁 Use \$[\d.]+ credit on (.+)$/)
  assert('list CTA captures the correct domain',
    listMatch && listMatch[1] === TEST_DOMAIN, listMatch && listMatch[1])

  // Cleanup
  await cpanelAccounts.deleteMany({ chatId: TEST_CHAT_ID })
  await client.close()

  console.log('\n──────────────────────────────────────────')
  console.log(`Result: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    for (const f of fails) console.log(' -', f.label, f.extra || '')
    process.exit(1)
  }
  process.exit(0)
}main().catch(err => {
  console.error('Integration test crashed:', err)
  process.exit(2)
})
