/**
 * Hosting checkout UX (2026-06) — verification suite.
 *
 * Covers the 5 approved usability changes to the Anti-Red hosting purchase flow:
 *   1. Plan menu shows prices + comparison card (⭐ Most popular)
 *   2. "Buy" screen removed — domain options + owned domains inline on plan screen
 *   3. Email step: no confirm screen, Back button, 1-tap reuse of last email
 *   4. Invoice shows wallet balance; "👛 Pay $X from Wallet" (no Yes/No) or "💵 Deposit $short"
 *   5. Domain taken → tappable priced alternatives
 *
 * RUNTIME — require hosting-checkout-ux.js and assert real output.
 * SOURCE  — regex guards on _index.js handler code (cannot be required without booting).
 *
 * Run:  node js/tests/test_hosting_checkout_ux_2026-06.js
 */
const fs = require('fs')
const path = require('path')
const JS = path.join(__dirname, '..')
const src = f => fs.readFileSync(path.join(JS, f), 'utf8')
const hcx = require('../hosting-checkout-ux.js')

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(t) { console.log(`\n── ${t} ──`) }

const user = {
  registerANewDomain: '🌐 Register a New Domain', useMyDomain: '📂 Use My Domain', connectExternalDomain: '🔗 Connect External Domain',
  viewPremiumWeekly: '⚡ View Premium Weekly', viewPremiumCpanel: '🔷 View Premium HostPanel', viewGoldenCpanel: '👑 View Golden HostPanel',
  backToHostingPlans: '⬅️ Back To Hosting Plans', buyPremiumWeekly: '🛒 Buy Premium Anti-Red (1-Week)',
}
const flat = rows => rows.flat()

// ════════════════════════════════════════════════════════════════════
section('#1 Plan menu comparison card')
{
  for (const lang of ['en', 'fr', 'zh', 'hi']) {
    const txt = hcx.planMenuText(lang, { weekly: 45, premium: 120, golden: 200, trialOn: true })
    check(`[${lang}] shows all three prices`, txt.includes('$45') && txt.includes('$120') && txt.includes('$200'))
    check(`[${lang}] marks a most-popular plan`, /⭐/.test(txt))
    check(`[${lang}] includes free-trial row when trialOn`, txt.includes('.sbs'))
  }
  const noTrial = hcx.planMenuText('en', { weekly: 45, premium: 120, golden: 200, trialOn: false })
  check('trial row hidden when trialOn=false', !noTrial.includes('Free Trial'))
  check('en card mentions durations 7 days + 30 days', noTrial.includes('7 days') && noTrial.includes('30 days'))
}

// ════════════════════════════════════════════════════════════════════
section('#2 Plan screen — Buy screen folded in, owned domains inline')
{
  check('planKeyOfName: Golden → goldenCpanel', hcx.planKeyOfName('Golden Anti-Red HostPanel (1-Month)') === 'goldenCpanel')
  check('planKeyOfName: Premium 1-Month → premiumCpanel', hcx.planKeyOfName('Premium Anti-Red HostPanel (1-Month)') === 'premiumCpanel')
  check('planKeyOfName: Weekly → premiumWeekly', hcx.planKeyOfName('Premium Anti-Red (1-Week)') === 'premiumWeekly')
  check('planKeyOfName: unknown → null', hcx.planKeyOfName('Freedom Plan') === null && hcx.planKeyOfName(null) === null)

  const none = hcx.planDetailRows({ user, planKey: 'premiumWeekly', ownedDomains: [] })
  check('no owned → Register first, no Buy button', none[0][0] === user.registerANewDomain && !flat(none).includes(user.buyPremiumWeekly))
  check('no owned → "Use My Domain" omitted (would only say "no domains")', !flat(none).includes(user.useMyDomain))
  check('no owned → Connect External present', flat(none).includes(user.connectExternalDomain))
  check('weekly → view-other buttons are Premium + Golden', none.some(r => r[0] === user.viewPremiumCpanel && r[1] === user.viewGoldenCpanel))
  check('Back is the last row', none[none.length - 1][0] === user.backToHostingPlans)

  const two = hcx.planDetailRows({ user, planKey: 'goldenCpanel', ownedDomains: ['a.com', 'b.net'] })
  check('2 owned → both listed inline as 📂 rows', flat(two).includes('📂 a.com') && flat(two).includes('📂 b.net'))
  check('2 owned → no extra Use My Domain button', !flat(two).includes(user.useMyDomain))
  check('golden → view-other buttons are Weekly + Premium', two.some(r => r[0] === user.viewPremiumWeekly && r[1] === user.viewPremiumCpanel))

  const five = hcx.planDetailRows({ user, planKey: 'premiumCpanel', ownedDomains: ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'] })
  const inline = flat(five).filter(x => /^📂 [a-z]\.com$/.test(x))
  check(`>3 owned → capped at ${hcx.MAX_INLINE_OWNED} inline + Use My Domain for the rest`, inline.length === hcx.MAX_INLINE_OWNED && flat(five).includes(user.useMyDomain))

  check('parseOwnedDomainTap: "📂 example.com" → example.com', hcx.parseOwnedDomainTap('📂 example.com') === 'example.com')
  check('parseOwnedDomainTap: "📂 Sub.Example.co.uk" lowercased', hcx.parseOwnedDomainTap('📂 Sub.Example.co.uk') === 'sub.example.co.uk')
  check('parseOwnedDomainTap: "📂 Use My Domain" → null', hcx.parseOwnedDomainTap('📂 Use My Domain') === null)
  check('parseOwnedDomainTap: fr/zh labels → null', hcx.parseOwnedDomainTap('📂 Utiliser Mon Domaine') === null && hcx.parseOwnedDomainTap('📂 使用我的域名') === null)
  check('chooseDomainLine differs with/without owned domains', hcx.chooseDomainLine('en', 0) !== hcx.chooseDomainLine('en', 2))
  check('isDomainLike accepts real hostnames', hcx.isDomainLike('my-site.co.uk') && hcx.isDomainLike('Example.COM'))
  check('isDomainLike rejects emoji/space/no-TLD input', !hcx.isDomainLike('📂 simowned.com') && !hcx.isDomainLike('my site.com') && !hcx.isDomainLike('localhost') && !hcx.isDomainLike(''))
  check('connectExternalDomain input validated with isDomainLike', /if \(!hcx\.isDomainLike\(modifiedDomain\)\) \{/.test(src('_index.js')))
}

// ════════════════════════════════════════════════════════════════════
section('#3 Email step — Back + 1-tap last email, no confirm screen')
{
  const withLast = hcx.emailRows({ lang: 'en', skipLabel: 'Skip (no email)', lastEmail: 'me@x.com' })
  check('rows: Use last → Skip → Back', withLast.length === 3 && withLast[0][0] === '✅ Use me@x.com' && withLast[1][0] === 'Skip (no email)' && withLast[2][0] === '↩️ Back')
  const noLast = hcx.emailRows({ lang: 'fr', skipLabel: 'Ignorer', lastEmail: null })
  check('no last email → Skip + Back only', noLast.length === 2 && noLast[1][0] === '↩️ Back')
  for (const lang of ['en', 'fr', 'zh', 'hi']) {
    const label = hcx.emailRows({ lang, skipLabel: 'Skip', lastEmail: 'a.b+c@dom.io' })[0][0]
    check(`[${lang}] parseUseEmailTap round-trips "${label}"`, hcx.parseUseEmailTap(label) === 'a.b+c@dom.io')
  }
  check('parseUseEmailTap: "✅ Yes" → null', hcx.parseUseEmailTap('✅ Yes') === null)
  check('parseUseEmailTap: typed email (no ✅) → null (falls through to typed path)', hcx.parseUseEmailTap('me@x.com') === null)
}

// ════════════════════════════════════════════════════════════════════
section('#4 Invoice — wallet balance, 1-tap Pay / Deposit')
{
  const payIn = { crypto: 'Crypto', bank: 'Bank ₦aira + Card🏦💳', wallet: '👛 Wallet' }
  const covers = hcx.invoiceRows({ lang: 'en', payIn, applyCouponLabel: '🎟️ Apply Coupon', couponApplied: false, usdBal: 100, walletPrice: 57.5 })
  check('balance covers → first button is Pay $57.50 from Wallet', covers[0][0] === '👛 Pay $57.50 from Wallet')
  check('crypto + bank on one row, coupon row present, Back last', covers[1].length === 2 && covers[2][0] === '🎟️ Apply Coupon' && covers[covers.length - 1][0] === '↩️ Back')
  check('legacy "👛 Wallet" button no longer shown', !flat(covers).includes('👛 Wallet'))

  const short = hcx.invoiceRows({ lang: 'en', payIn, applyCouponLabel: '🎟️ Apply Coupon', couponApplied: true, usdBal: 20, walletPrice: 57.5 })
  check('insufficient → first button is 💵 Deposit $38 (ceil of shortfall)', short[0][0] === '💵 Deposit $38')
  check('couponApplied → no Apply Coupon row', !flat(short).includes('🎟️ Apply Coupon'))
  check('deposit button matches the global balance-wall regex', /^💵 Deposit \$(\d+(?:\.\d+)?)$/.test(short[0][0]))
  check('shortfall below $10 → deposit floor $10', hcx.invoiceRows({ lang: 'en', payIn, couponApplied: true, usdBal: 55, walletPrice: 57.5 })[0][0] === '💵 Deposit $10')

  const hiddenBank = hcx.invoiceRows({ lang: 'en', payIn: { crypto: 'Crypto', wallet: '👛 Wallet' }, couponApplied: true, usdBal: 100, walletPrice: 10 })
  check('HIDE_BANK_PAYMENT → only Crypto in the methods row', hiddenBank[1].length === 1 && hiddenBank[1][0] === 'Crypto')

  for (const lang of ['en', 'fr', 'zh', 'hi']) {
    const label = hcx.strings(lang).payWallet(57.5)
    check(`[${lang}] parseWalletPayTap("${label}") → 57.5`, hcx.parseWalletPayTap(label) === 57.5)
  }
  check('parseWalletPayTap("👛 Wallet") → null (legacy path preserved)', hcx.parseWalletPayTap('👛 Wallet') === null)
  check('parseDepositTap("💵 Deposit $38") → 38', hcx.parseDepositTap('💵 Deposit $38') === 38)
  check('parseDepositTap("💵 Deposit $4") floors to 10', hcx.parseDepositTap('💵 Deposit $4') === 10)
  check('parseDepositTap("💵 Deposit Funds") → null', hcx.parseDepositTap('💵 Deposit Funds') === null)

  const okLine = hcx.walletSummary({ lang: 'en', usdBal: 100, walletPrice: 57.5 })
  check('summary (covers) shows balance and "covers"', okLine.includes('$100.00') && /covers/.test(okLine))
  const shortLine = hcx.walletSummary({ lang: 'en', usdBal: 20, walletPrice: 57.5 })
  check('summary (short) shows exact shortfall $37.50', shortLine.includes('$37.50 short'))
  const loy = hcx.walletSummary({ lang: 'en', usdBal: 100, walletPrice: 54.63, loyaltyInfo: { discount: 2.87, tier: { badge: '🥈', name: 'Silver', discount: 0.05 } } })
  check('summary appends loyalty line with tier + % + discounted amount', loy.includes('🥈') && loy.includes('5%') && loy.includes('$54.63'))
}

// ════════════════════════════════════════════════════════════════════
section('#5 Domain-not-available alternatives')
{
  check('baseNameOf("https://www.My-Brand.com/x") → my-brand', hcx.baseNameOf('https://www.My-Brand.com/x') === 'my-brand')
  check('baseNameOf("brand") (no TLD) → brand', hcx.baseNameOf('brand') === 'brand')
  check('baseNameOf("x") too short → null', hcx.baseNameOf('x') === null)
  check('baseNameOf("bad name.com") → null', hcx.baseNameOf('bad name.com') === null)
  const rows = hcx.altRows([{ domain: 'brand.net', price: 12.5 }, { domain: 'brand.org', price: 14 }, { domain: 'brand.xyz', price: 3 }, { domain: 'brand.sbs', price: 2 }, { domain: 'brand.io', price: 40 }])
  check(`altRows capped at ${hcx.MAX_ALTS}`, rows.length === hcx.MAX_ALTS)
  check('alt button format "🌐 brand.net — $12.5"', rows[0][0] === '🌐 brand.net — $12.5')
  const ranked = hcx.altRows([{ domain: 'b.de', price: 30 }, { domain: 'b.fr', price: 30 }, { domain: 'b.xyz', price: 30 }, { domain: 'b.sbs', price: 30 }, { domain: 'b.net', price: 35 }])
  check('ccTLDs ranked after hosting-friendly TLDs (net, xyz, sbs before de/fr)', ranked.map(r => r[0]).join('|') === '🌐 b.net — $35|🌐 b.xyz — $30|🌐 b.sbs — $30|🌐 b.de — $30')
  check('parseAltDomainTap round-trips', hcx.parseAltDomainTap(rows[0][0]) === 'brand.net')
  check('parseAltDomainTap("🌐 Register a New Domain") → null', hcx.parseAltDomainTap('🌐 Register a New Domain') === null)
  check('parseAltDomainTap on a typed domain → null', hcx.parseAltDomainTap('brand.net') === null)
}

// ════════════════════════════════════════════════════════════════════
section('SOURCE guards — _index.js wiring')
{
  const s = src('_index.js')
  check('module required', /const hcx = require\('\.\/hosting-checkout-ux\.js'\)/.test(s))
  check('submenu3 renders the comparison card (planMenuText) instead of t.selectPlan', /submenu3: async \(\) => \{[\s\S]{0,600}hcx\.planMenuText\(lang/.test(s) && !/let planMsg = t\.selectPlan/.test(s))
  check('selectPlan builds rows via planDetailRows + owned domains', /selectPlan: async \(plan\) => \{[\s\S]{0,1800}getHostableOwnedDomains\(\)[\s\S]{0,200}hcx\.planDetailRows\(/.test(s))
  check('selectPlan resets stale order flags (moved from Buy screen)', /selectPlan: async \(plan\) => \{[\s\S]{0,900}saveInfo\('website_name', null\)/.test(s))
  check('buyPlan is now an alias to selectPlan', /buyPlan: async \(plan\) => goto\.selectPlan\(plan \|\| currentPlanAction\(\)\)/.test(s))
  check('no hardcoded goto.buyPlan(a.premiumWeekly) fallbacks remain (Golden no longer downgraded on Back)', !/goto\.buyPlan\(a\.premiumWeekly\)/.test(s))
  check('getHostableOwnedDomains excludes domains already on an active plan', /getHostableOwnedDomains = async[\s\S]{0,400}cpanelAccounts\.find\(\{ domain: \{ \$in: owned \}, deleted: \{ \$ne: true \} \}/.test(s))
  check('selectOwnedDomain goto exists, stamps domain + continue_domain_last_state', /selectOwnedDomain: async \(domain\) => \{[\s\S]{0,900}saveInfo\('domain', domain\)[\s\S]{0,400}saveInfo\('continue_domain_last_state', 'useMyDomain'\)/.test(s))
  check('plan states route "📂 domain" taps to selectOwnedDomain', /\[a\.premiumWeekly, a\.premiumCpanel, a\.goldenCpanel\]\.includes\(action\)\) \{\s*const ownedTap = hcx\.parseOwnedDomainTap\(message\)\s*if \(ownedTap\) return goto\.selectOwnedDomain\(ownedTap\)/.test(s))
  check('useMyDomain list tap reuses selectOwnedDomain', /if \(domains\.includes\(message\)\) return goto\.selectOwnedDomain\(message\)/.test(s))

  check('enterYourEmail keyboard uses emailRows (Back + last email)', /enterYourEmail: async \(\) => \{[\s\S]{0,900}hcx\.emailRows\(\{ lang, skipLabel: t\.skipEmail, lastEmail \}\)/.test(s))
  const emailHandler = s.slice(s.indexOf('if (action === a.enterYourEmail) {'), s.indexOf('if (action === a.confirmEmailBeforeProceeding) {'))
  check('email handler no longer routes to the confirm screen', emailHandler.length > 0 && !/goto\.confirmEmailBeforeProceeding\(/.test(emailHandler))
  check('email handler saves lastOrderEmail then goes straight to proceedWithEmail', /saveInfo\('lastOrderEmail', email\)\s*return goto\.proceedWithEmail\(/.test(emailHandler))
  check('email Back routes to connectExternalDomainFound when that was the origin', /last === 'connectExternalDomain'\) return goto\.connectExternalDomainFound\(/.test(emailHandler))
  check('connectExternalDomainFound continue stamps continue_domain_last_state', /saveInfo\('continue_domain_last_state', 'connectExternalDomain'\)/.test(s))

  // ── Unified checkout layer (all pay screens) ──
  check('checkoutOrder() is the single price source (mirrors walletOk reads)', /const checkoutOrder = \(rawStep\) => \{[\s\S]{0,2600}case 'phone-pay': return \{ step, total: n\(info\?\.cpPrice\)[\s\S]{0,800}case 'digital-product-pay': return \{ step, total: n\(info\?\.dpPrice\)[\s\S]{0,1200}case 'leads-pay'/.test(s))
  check('loyalty only for steps whose walletOk honours price/newPrice/totalPrice', /CHECKOUT_LOYALTY_STEPS = \(\) => new Set\(\['plan-pay', 'domain-pay', 'hosting-pay', 'leads-pay', a\.redSelectProvider\]\)/.test(s))
  check('applyCheckoutLoyaltyOnce is identity-guarded (no compounding on same price)', /applyCheckoutLoyaltyOnce = async \(rawStep\) => \{[\s\S]{0,700}if \(la && la\.step === step && Number\(la\.to\) === current\) return/.test(s))
  check('applyCheckoutLoyaltyOnce uses totalPrice for hosting, price otherwise', /loyaltyBaseKey = step => \(normalizeCheckoutStep\(step\) === 'hosting-pay' \? 'totalPrice' : 'price'\)/.test(s))
  check('checkoutScreen restores transient loyalty mutation before rendering', /checkoutScreen = async \(step, text, \{[^\n]*\} = \{\}\) => \{\s*await restoreLoyaltyMutation\(\)/.test(s))
  check('checkoutWalletView saves a resumable session keyed by the walletOk step when short', /checkoutWalletView = async \(rawStep\) => \{[\s\S]{0,1200}if \(total > 0 && usdBal < walletPrice\) \{[\s\S]{0,300}saveResumableSession\(db, chatId, \{ flowType: _resumeFlowType\(walletOkKey\), step: walletOkKey/.test(s))
  check('runCheckoutTap: deposit → startCheckoutDeposit, wallet → loyalty once → walletOk[key]', /runCheckoutTap = async \(rawStep, tap\) => \{[\s\S]{0,300}if \(tap\.type === 'deposit'\) return startCheckoutDeposit\(walletOkKey, tap\.amount\)[\s\S]{0,300}await applyCheckoutLoyaltyOnce\(step\)[\s\S]{0,300}return handler\(u\.usd\)/.test(s))
  check('startCheckoutDeposit pre-fills amount and jumps to method picker', /startCheckoutDeposit = async \(walletOkKey, amount\) => \{[\s\S]{0,400}saveInfo\('depositAmountUsd', amount\)[\s\S]{0,200}goto\[a\.depositMethodSelect\]\(\)/.test(s))
  check('legacy walletSelectCurrency shows exactly what walletOk charges (checkoutOrder total)', /await applyCheckoutLoyaltyOnce\(step\)\s*\n\s*\/\/ USD-only wallet[\s\S]{0,300}const finalPrice = checkoutOrder\(step\)\.total/.test(s))
  check('walletSelectCurrencyConfirm (resume path) uses checkoutOrder total', /const p = checkoutOrder\(info\?\.lastStep\)\.total/.test(s))
  check('Order Resume re-applies loyalty before the confirm screen', /await clearResumableSession\(db, chatId\)\s*\n[^\n]*\n\s*await applyCheckoutLoyaltyOnce\(session\.step\)\s*return goto\.walletSelectCurrencyConfirm\(\)/.test(s))
  check('no k.pay screens remain except the wallet-only red-coupon flow', (s.match(/, k\.pay\)/g) || []).length === 1 && /t\.redNewPrice\(price, newPrice\), k\.pay\)/.test(s))

  // Every pay screen renders through checkoutScreen and handles the 1-tap buttons
  const screens = [
    ['domain-pay', "if (action === 'domain-pay') {", "if (action === 'bank-pay-domain') {", /checkoutScreen\('domain-pay', \(\) => \{[\s\S]{0,300}\}, \{ couponLabel: btn\.applyCoupon \}\)/],
    ['hosting-pay', "if (action === 'hosting-pay') {", "if (action === 'hosting-apply-coupon') {", /checkoutScreen\('hosting-pay', \(\) => bcHeader\(/],
    ['phone-pay', "if (action === 'phone-pay') {", "if (action === 'bank-pay-phone') {", /checkoutScreen\('phone-pay', \(\) => cpOrderSummaryText\(\) \+ [^\n]*couponLabel: pc\.applyCoupon, backLabel: pc\.back/],
    ['digital-product-pay', "if (action === a.digitalProductPay) {", "if (action === 'bank-pay-digital-product') {", /checkoutScreen\('digital-product-pay', \(\) => t\.dpPaymentPrompt\([^\n]*extraRows: \[\['💬 Ask Question'\]\]/],
    ['virtual-card-pay', "if (action === a.virtualCardPay) {", "if (action === 'bank-pay-virtual-card') {", /checkoutScreen\('virtual-card-pay', \(\) => \{[\s\S]{0,300}t\.vcOrderSummary\(amount, fee, total\)/],
    ['vps-plan-pay', "if (action === 'vps-plan-pay') {", "if (action === 'bank-pay-vps') {", /checkoutScreen\('vps-plan-pay', vp\.askPaymentMethod\)/],
    ['vps-upgrade-plan-pay', "if (action === 'vps-upgrade-plan-pay') {", "if (action === 'bank-pay-vps-upgrade') {", /checkoutScreen\('vps-upgrade-plan-pay', vp\.askPaymentMethod\)/],
    ['plan-pay', "if (action === 'plan-pay') {", "if (action === 'bank-pay-plan') {", /checkoutScreen\('plan-pay', \(\) => \{[\s\S]{0,300}t\.planNewPrice\(plan, price, newPrice\) : t\.planPrice\(plan, price\)/],
    ['leads-pay', "if (action === 'leads-pay') {", "if (action === 'bank-pay-leads') {", /checkoutScreen\('leads-pay', \(\) => \{/],
  ]
  for (const [step, from, to, gotoRe] of screens) {
    const block = s.slice(s.indexOf(from), s.indexOf(to))
    check(`[${step}] goto renders via checkoutScreen`, gotoRe.test(s))
    check(`[${step}] handler routes 1-tap buttons via runCheckoutTap`, new RegExp(`parseCheckoutTap\\(message\\)\\s*if \\(\\w+\\) return runCheckoutTap\\('${step}', \\w+\\)`).test(block))
    check(`[${step}] legacy "👛 Wallet" tap still handled`, /payOption === payIn\.wallet/.test(block))
  }
  const bundleBlock = s.slice(s.indexOf('if (action === a.bundleConfirm) {'), s.indexOf('// Coupon apply within bundle flow'))
  check('[bundleConfirm] Purchase Bundle → wallet-only checkoutScreen (no crypto/bank handlers exist)', /checkoutScreen\('bundleConfirm', bundlePayText\(bundle\.name, finalPrice\), \{ walletOnly: true \}\)/.test(bundleBlock))
  check('[bundleConfirm] 1-tap buttons routed via runCheckoutTap', /if \(bundleTap && info\?\.bundlePrice\) return runCheckoutTap\('bundleConfirm', bundleTap\)/.test(bundleBlock))
  check('[bundleConfirm] stale loyaltyDiscount no longer subtracted from bundle price', !/finalPrice - info\.loyaltyDiscount/.test(bundleBlock))
  check('[bundleMenu] selecting a bundle resets bundlePrice/coupon for a fresh order', /saveInfo\('selectedBundle', selectedId\)\s*\n[^\n]*\n\s*await saveInfo\('bundlePrice', bundle\.finalPrice\)[\s\S]{0,200}saveInfo\('couponApplied', false\)/.test(s))
  // Cloud IVR end-to-end
  check('[Cloud IVR] number selection lands directly on phone-pay (summary + payment on one screen)', /await saveInfo\('cpNumberSurcharge', surcharge\)\s*\n[\s\S]{0,120}return goto\['phone-pay'\]\(\)/.test(s))
  check('[Cloud IVR] number selection resets cpPriceBase/coupon for a fresh order', /saveInfo\('cpPrice', totalPrice\)\s*await saveInfo\('cpPriceBase', null\)[\s\S]{0,120}saveInfo\('couponApplied', false\)/.test(s))
  check('[Cloud IVR] coupon handler exists (codes were previously silently ignored)', /if \(action === a\.askCoupon \+ 'cpOrderSummary'\) \{[\s\S]{0,900}saveInfo\('cpPriceBase', base\)\s*await saveInfo\('cpPrice', newPrice\)/.test(s))
  check('[Cloud IVR] phone-pay handler accepts coupon button + Back → plan selection', /if \(message === pc\.applyCoupon \|\| message === btn\.applyCoupon\) return goto\.askCoupon\('cpOrderSummary'\)/.test(s))
  check('[Cloud IVR] legacy cpOrderSummary screen forwards to phone-pay', /if \(action === a\.cpOrderSummary\) \{[\s\S]{0,900}return goto\['phone-pay'\]\(\)\s*\}/.test(s))
  check('[Cloud IVR] plan-upgrade keyboard uses 1-tap pay/deposit (both render sites)', (s.match(/k\.of\(cpUpgradePayRows\(chargeAmount, walletBal, /g) || []).length === 2)
  check('[Cloud IVR] plan-upgrade wallet handler accepts 1-tap label + deposit tap', /if \(payOption === payIn\.wallet \|\| hcx\.parseWalletPayTap\(message\) !== null\) \{/.test(s) && /const upgDep = hcx\.parseDepositTap\(message\)\s*if \(upgDep !== null\) return startCheckoutDeposit\(null, upgDep\)/.test(s))
  check('_showBalanceWall labels leads/validation/bundle resumes', /step === a\.buyLeadsSelectFormat\) label = 'Phone Leads'/.test(s) && /step === 'bundleConfirm'\) label = info\?\.bundleName/.test(s))
  check('coupon screen clears the 30s payment lock before re-rendering invoice', /if \(action === 'hosting-apply-coupon'\) \{\s*\/\/[^\n]*\n\s*await saveInfo\('processingPayment', false\)/.test(s))

  check('registerNewDomain handler suggests alternatives when taken', /if \(action === a\.registerNewDomain\) \{[\s\S]{0,900}if \(!altTap\) await suggestHostingDomainAlternatives\(query\)/.test(s))
  check('suggestHostingDomainAlternatives uses checkAlternativeTLDs with a timeout race', /suggestHostingDomainAlternatives = async \(query\) => \{[\s\S]{0,700}Promise\.race\(\[\s*domainService\.checkAlternativeTLDs\(baseName, db\)/.test(s))
  check('CRUMBS gained email + pay breadcrumbs in all 4 locales', (s.match(/email: '[^']+', pay: '[^']+' \}/g) || []).length === 4)

  check('domain search resets loyalty markers so a fresh order never inherits a discount', /saveInfo\('loyaltyDiscount', null\)\s*await saveInfo\('preLoyaltyPrice', null\)\s*return goto\.askDomainToUseWithShortener\(\)/.test(s))
}

console.log(`\n${'═'.repeat(60)}\n  ${pass} passed, ${fail} failed`)
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log('  • ' + f)) }
process.exit(fail ? 1 : 0)
