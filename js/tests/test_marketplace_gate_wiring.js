/**
 * Static-source guard: confirms the marketplace paywall gate is wired into
 * the right places. Will fail if a future refactor accidentally removes the
 * gate.
 */
'use strict'

const fs = require('fs')

const INDEX = fs.readFileSync('/app/js/_index.js', 'utf8')
const SVC = fs.readFileSync('/app/js/marketplace-service.js', 'utf8')
const ENV = fs.readFileSync('/app/backend/.env', 'utf8')

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

console.log('\n=== Marketplace access-fee gate wiring ===')

// 1) env var present
it('backend/.env has MARKETPLACE_ACCESS_FEE_USD', /MARKETPLACE_ACCESS_FEE_USD\s*=\s*"?\d+"?/.test(ENV))

// 2) marketplace-service.js exports + reads
it('marketplace-service exports MARKETPLACE_ACCESS_FEE_USD', SVC.includes('MARKETPLACE_ACCESS_FEE_USD,'))
it('marketplace-service exports hasMarketplaceAccess', SVC.includes('hasMarketplaceAccess,'))
it('marketplace-service exports grantMarketplaceAccess', SVC.includes('grantMarketplaceAccess,'))
it('marketplace-service exports revokeMarketplaceAccess', SVC.includes('revokeMarketplaceAccess,'))
it('marketplace-service reads from process.env.MARKETPLACE_ACCESS_FEE_USD',
  SVC.includes('process.env.MARKETPLACE_ACCESS_FEE_USD'))
it('marketplace-service has marketplaceAccess collection',
  SVC.includes("db.collection('marketplaceAccess')"))
it('marketplace-service admin bypass references TELEGRAM_ADMIN_CHAT_ID',
  SVC.includes('TELEGRAM_ADMIN_CHAT_ID'))

// 3) goto.marketplace() has paywall gate before mpHome
const gotoIdx = INDEX.indexOf('marketplace: async () => {')
it('goto.marketplace exists', gotoIdx > 0)
const gotoSlice = INDEX.slice(gotoIdx, gotoIdx + 2500)
it('goto.marketplace calls hasMarketplaceAccess BEFORE mpHome',
  /hasMarketplaceAccess/.test(gotoSlice) &&
  gotoSlice.indexOf('hasMarketplaceAccess') < gotoSlice.indexOf("'action', a.mpHome"))
it('goto.marketplace renders mpPaywall when no access',
  gotoSlice.includes('mpPaywall(fee, usdBal)') ||
  gotoSlice.includes('t.mpPaywall(fee, usdBal)'))

// 4) MP callback handler has gate + pay_access action
const mpCb = INDEX.match(/!chatId \|\| !data\.startsWith\('mp:'\)[\s\S]{0,8000}/)
it('MP callback handler exists', !!mpCb)
const cbBody = mpCb ? mpCb[0] : ''
it('MP callback gates non-pay actions through hasMarketplaceAccess',
  cbBody.includes("action !== 'pay_access'") && cbBody.includes('hasMarketplaceAccess'))
it('MP callback handles action === "pay_access"',
  cbBody.includes("if (action === 'pay_access')"))
it('MP callback uses smartWalletDeduct for the access charge',
  cbBody.includes("smartWalletDeduct(walletOf, chatId, fee"))
it('MP callback grants access via grantMarketplaceAccess after deduction',
  cbBody.includes('grantMarketplaceAccess(chatId'))
it('MP callback writes a payments-ledger row for audit',
  cbBody.includes("Marketplace,AccessFee"))
it('MP callback notifies admin/group on purchase',
  cbBody.includes('Marketplace Access Purchased'))
it('MP callback handles pay_access_cancel',
  cbBody.includes("action === 'pay_access_cancel'"))

// 5) Translation keys present in all 4 locales
for (const lang of ['en', 'fr', 'hi', 'zh']) {
  const langFile = fs.readFileSync(`/app/js/lang/${lang}.js`, 'utf8')
  it(`[${lang}] mpPaywall(fee, balance) key present`, /mpPaywall\s*:\s*\(/.test(langFile))
  it(`[${lang}] mpPaywallPayBtn key present`, /mpPaywallPayBtn\s*:/.test(langFile))
  it(`[${lang}] mpPaywallSuccess key present`, /mpPaywallSuccess\s*:/.test(langFile))
  it(`[${lang}] mpPaywallInsufficient key present`, /mpPaywallInsufficient\s*:/.test(langFile))
}

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
process.exit(fail === 0 ? 0 : 1)
