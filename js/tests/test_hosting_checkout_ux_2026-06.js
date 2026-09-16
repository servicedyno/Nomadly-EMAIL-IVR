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

  check('hosting-pay goto reads wallet balance + renders walletSummary/invoiceRows', /'hosting-pay': async \(\) => \{[\s\S]{0,2600}getBalance\(walletOf, chatId\)[\s\S]{0,1400}hcx\.walletSummary\([\s\S]{0,300}hcx\.invoiceRows\(/.test(s))
  check('hosting-pay goto saves a resumable session when balance is short', /'hosting-pay': async \(\) => \{[\s\S]{0,2600}if \(usdBal < walletPrice\) \{[\s\S]{0,200}saveResumableSession\(db, chatId, \{[\s\S]{0,120}step: 'hosting-pay'/.test(s))
  const payHandler = s.slice(s.indexOf("if (action === 'hosting-pay') {"), s.indexOf("if (action === 'hosting-apply-coupon') {"))
  check('Pay-from-Wallet tap charges via walletOk[hosting-pay] (no Yes/No screen)', /parseWalletPayTap\(message\)[\s\S]{0,400}applyHostingLoyaltyOnce\(\)\s*return walletOk\['hosting-pay'\]\(u\.usd\)/.test(payHandler))
  check('Deposit tap inside hosting-pay pre-fills amount and jumps to method picker', /parseDepositTap\(message\)[\s\S]{0,500}saveInfo\('depositAmountUsd', depTap\)[\s\S]{0,200}goto\[a\.depositMethodSelect\]\(\)/.test(payHandler))
  check('legacy "👛 Wallet" tap still handled (stale keyboards)', /payOption === payIn\.wallet/.test(payHandler))
  check('applyHostingLoyaltyOnce guards on preLoyaltyPrice (no compounding)', /applyHostingLoyaltyOnce = async \(\) => \{\s*if \(info\?\.loyaltyDiscount > 0 && info\?\.preLoyaltyPrice\) return/.test(s))
  check('walletSelectCurrency skips loyalty for hosting when already applied', /_hostingLoyaltyDone = step === 'hosting-pay' && info\?\.loyaltyDiscount > 0 && info\?\.preLoyaltyPrice/.test(s))
  check('proceedWithEmail resets loyalty markers for a fresh order', /saveInfo\("duration"[^\n]*\n[\s\S]{0,200}saveInfo\('loyaltyDiscount', null\)\s*saveInfo\('preLoyaltyPrice', null\)/.test(s))
  check('walletSelectCurrency shows totalPrice (not domain price) for hosting', /else if \(step === 'hosting-pay'\) \{[^\n]*\n[^\n]*\n\s*finalPrice = info\?\.couponApplied \? info\?\.newPrice : \(info\?\.totalPrice \|\| 0\)/.test(s))
  check('walletSelectCurrencyConfirm shows totalPrice for hosting (resume path)', /lastStep === 'hosting-pay' \? \(totalPrice \|\| 0\)/.test(s))
  check('coupon screen clears the 30s payment lock before re-rendering invoice', /if \(action === 'hosting-apply-coupon'\) \{\s*\/\/[^\n]*\n\s*await saveInfo\('processingPayment', false\)/.test(s))

  check('registerNewDomain handler suggests alternatives when taken', /if \(action === a\.registerNewDomain\) \{[\s\S]{0,900}if \(!altTap\) await suggestHostingDomainAlternatives\(query\)/.test(s))
  check('suggestHostingDomainAlternatives uses checkAlternativeTLDs with a timeout race', /suggestHostingDomainAlternatives = async \(query\) => \{[\s\S]{0,700}Promise\.race\(\[\s*domainService\.checkAlternativeTLDs\(baseName, db\)/.test(s))
  check('CRUMBS gained email + pay breadcrumbs in all 4 locales', (s.match(/email: '[^']+', pay: '[^']+' \}/g) || []).length === 4)
}

console.log(`\n${'═'.repeat(60)}\n  ${pass} passed, ${fail} failed`)
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log('  • ' + f)) }
process.exit(fail ? 1 : 0)
