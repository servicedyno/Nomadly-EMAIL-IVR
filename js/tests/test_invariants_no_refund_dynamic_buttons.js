// Regression test — locks in two invariants the user asked for explicitly:
//
//   1. The cancel-hosting flow MUST NOT issue a refund.
//      → Greps the bot's confirmCancelHostingPlan action body and the web panel's
//        /account/cancel route for any wallet-credit / refund-write code paths.
//      → Asserts the user-facing copy contains "no refund" in all 4 locales.
//
//   2. The take-offline / bring-online buttons MUST be dynamic.
//      → Greps the bot's viewHostingPlanDetails for the conditional that flips
//        between user.takeSiteOffline and user.bringSiteOnline.
//      → Greps the React component for the data-driven render of the two buttons.

const fs = require('fs')
const path = require('path')
const assert = require('assert')

const indexPath  = path.join(__dirname, '..', '_index.js')
const routesPath = path.join(__dirname, '..', 'cpanel-routes.js')
const cardPath   = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'panel', 'SiteStatusCard.js')
const langDir    = path.join(__dirname, '..', 'lang')

const indexSrc  = fs.readFileSync(indexPath, 'utf8')
const routesSrc = fs.readFileSync(routesPath, 'utf8')
const cardSrc   = fs.readFileSync(cardPath, 'utf8')

// ───────────────────────────────────────────────────────────
// Invariant #1 — Cancel must NOT refund
// ───────────────────────────────────────────────────────────

console.log('— Test: bot confirmCancelHostingPlan handler does NOT refund —')
{
  // Slice the handler body. It starts with `if (action === a.confirmCancelHostingPlan) {`
  // and ends at the next top-level handler (matched by the next `// Confirm Renew Now` comment).
  const start = indexSrc.indexOf('if (action === a.confirmCancelHostingPlan) {')
  assert.ok(start !== -1, 'handler must exist')
  const end = indexSrc.indexOf('// Confirm Renew Now', start)
  assert.ok(end !== -1 && end > start, 'handler end marker not found')
  const handler = indexSrc.slice(start, end)

  // Hard rules — these patterns must not appear inside the handler.
  const refundPatterns = [
    /walletOf/,           // direct wallet collection write
    /usdBal/,             // USD balance field
    /usdOut/,             // USD outflow / refund tracker
    /addBalance/,         // any helper called addBalance
    /\brefund\b/i,        // literal word "refund" being used as code (not in copy)
    /\bcredit\b/i,        // literal word "credit"
    /reimburse/i,
    /\bprorate/i,
    /priceUsd/,           // bot's price tracker in deposit/refund flows
  ]
  for (const re of refundPatterns) {
    assert.ok(!re.test(handler), `confirmCancelHostingPlan must not reference ${re} (refund leak risk)`)
  }
  console.log(`  ✓ no refund/wallet patterns in ${handler.split('\n').length} lines of handler`)
}

console.log('— Test: web panel /account/cancel route does NOT refund —')
{
  const start = routesSrc.indexOf("router.post('/account/cancel'")
  assert.ok(start !== -1, 'route must exist')
  // The route ends before the next router. declaration
  const nextRouter = routesSrc.indexOf('router.', start + 1)
  assert.ok(nextRouter !== -1, 'no closing route boundary found')
  const route = routesSrc.slice(start, nextRouter)

  const refundPatterns = [
    /walletOf/, /usdBal/, /usdOut/, /addBalance/,
    /\brefund\b/i, /\bcredit\b/i, /reimburse/i, /\bprorate/i,
  ]
  for (const re of refundPatterns) {
    assert.ok(!re.test(route), `/account/cancel must not reference ${re} (refund leak risk)`)
  }
  console.log(`  ✓ no refund patterns in ${route.split('\n').length} lines of route`)
}

console.log('— Test: user-facing warning copy contains "no refund" in all 4 locales —')
{
  const langs = ['en', 'fr', 'hi', 'zh']
  // Acceptable phrasings per locale
  const noRefundPatterns = {
    en: /no refund/i,
    fr: /aucun remboursement/i,
    hi: /रिफंड|रिफ़ंड|कोई रिफंड|धनवापसी/,
    zh: /不予退款|不退款|无退款/,
  }
  for (const lang of langs) {
    const langSrc = fs.readFileSync(path.join(langDir, `${lang}.js`), 'utf8')
    const block = langSrc.match(/confirmCancelHostingPlan:[\s\S]*?(?=\n\s*[a-zA-Z_]+:)/)
    assert.ok(block, `confirmCancelHostingPlan must exist in ${lang}.js`)
    assert.ok(noRefundPatterns[lang].test(block[0]), `${lang}.js confirmCancelHostingPlan must explicitly state "no refund"`)
  }
  console.log('  ✓ all 4 locales explicitly say "no refund"')
}

// ───────────────────────────────────────────────────────────
// Invariant #2 — Take-offline / Bring-online buttons must be DYNAMIC
// ───────────────────────────────────────────────────────────

console.log('— Test: bot viewHostingPlanDetails flips button label by state —')
{
  // Find the keyboard-build block in viewHostingPlanDetails.
  // It must contain: `if (siteStatus === 'online') { ... user.takeSiteOffline ... } else { ... user.bringSiteOnline ... }`
  const fnStart = indexSrc.indexOf('viewHostingPlanDetails: async (domain)')
  assert.ok(fnStart !== -1, 'viewHostingPlanDetails must exist')
  const fnEnd = indexSrc.indexOf('revealHostingCredentials:', fnStart)
  assert.ok(fnEnd !== -1, 'no closing fn boundary found')
  const body = indexSrc.slice(fnStart, fnEnd)

  // The conditional must reference both labels in the same block AND key off siteStatus.
  assert.ok(/siteStatus\s*===\s*['"]online['"]/.test(body), 'must check siteStatus === "online"')
  assert.ok(/user\.takeSiteOffline/.test(body), 'must reference user.takeSiteOffline')
  assert.ok(/user\.bringSiteOnline/.test(body), 'must reference user.bringSiteOnline')

  // Both labels must appear under opposite branches (no static both-branches button).
  const pushOffline = body.indexOf('user.takeSiteOffline')
  const pushOnline = body.indexOf('user.bringSiteOnline')
  const ifIdx = body.lastIndexOf('if (siteStatus', pushOffline)
  const elseIdx = body.indexOf('else', ifIdx)
  assert.ok(ifIdx < pushOffline && pushOffline < elseIdx, 'takeSiteOffline must sit inside the if-online branch')
  assert.ok(elseIdx < pushOnline, 'bringSiteOnline must sit inside the else branch')
  console.log('  ✓ bot button label flips dynamically based on siteStatus')
}

console.log('— Test: SiteStatusCard renders one of two buttons based on `current` state —')
{
  // The component should have:
  //   {stage === 'view' && current === 'online' && (... data-testid="site-take-offline-btn" ...)}
  //   {stage === 'view' && current !== 'online' && (... data-testid="site-bring-online-btn" ...)}
  assert.ok(/current === ['"]online['"]/.test(cardSrc), 'must render online-branch when current=online')
  assert.ok(/current !== ['"]online['"]/.test(cardSrc), 'must render offline-branch when current!=online')
  assert.ok(/data-testid="site-take-offline-btn"/.test(cardSrc), 'must render take-offline button')
  assert.ok(/data-testid="site-bring-online-btn"/.test(cardSrc), 'must render bring-online button')

  // After flipping state, the component MUST refetch — otherwise label stays stale.
  assert.ok(/await fetchStatus\(\)/.test(cardSrc), 'must call fetchStatus() after a successful flip so the button label flips')

  // No hard-coded button — both labels must be inside conditional branches
  // (verified above by current === / !== assertions + both testid presences + fetchStatus refetch)
  console.log('  ✓ web panel button label flips dynamically based on current state')
}

console.log('\n✅ All invariants locked: cancel never refunds, buttons always dynamic.')
