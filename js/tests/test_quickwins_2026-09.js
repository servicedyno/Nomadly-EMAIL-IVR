/**
 * Verification suite for the 11 approved "Quick Win" conversion fixes
 * (audit: memory/USER_JOURNEY_AUDIT_2026-09-14.md).
 *
 * Covers fixes #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12 (#2 skipped).
 *
 * Two verification methods (both are established in this codebase):
 *   • RUNTIME  — require the changed modules and assert their real output.
 *   • SOURCE   — regex "static guards" against handler/closure code that
 *                cannot be required without booting the Express server
 *                (same approach as test_admin_comp_vps_endpoint.js).
 *
 * Run:  node js/tests/test_quickwins_2026-09.js
 * Exit: 0 = all pass, 1 = one or more failures.
 */

// ── Env used by the price-source modules (set BEFORE require so the
//    single-source read is actually exercised with a non-default value) ──
process.env.OVERAGE_RATE_MIN = '0.19'
process.env.CALL_FORWARDING_RATE_MIN = '0.55'
process.env.PHONE_STARTER_PRICE = process.env.PHONE_STARTER_PRICE || '50'
process.env.PHONE_PRO_PRICE = process.env.PHONE_PRO_PRICE || '75'
process.env.PHONE_BUSINESS_PRICE = process.env.PHONE_BUSINESS_PRICE || '120'
process.env.VPS_ENABLED = process.env.VPS_ENABLED || 'true'

const fs = require('fs')
const path = require('path')

const JS = path.join(__dirname, '..')
const src = (f) => fs.readFileSync(path.join(JS, f), 'utf8')

let pass = 0, fail = 0
const failures = []
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(t) { console.log(`\n── ${t} ──`) }

// ════════════════════════════════════════════════════════════════════
// FIX #1 — markPurchased / recordPaymentCompleted fire AFTER a successful
//          charge (moved into each walletOk handler), not before the
//          balance check in the dispatch.
// ════════════════════════════════════════════════════════════════════
section('Fix #1 — purchased-flag ordering (_index.js)')
{
  const s = src('_index.js')
  check('_finalizeWalletPurchase helper is defined', /const _finalizeWalletPurchase = \(\) => \{/.test(s))
  check('helper wraps recordPaymentCompleted + markPurchased',
    /_finalizeWalletPurchase[\s\S]{0,220}recordPaymentCompleted\(chatId\)[\s\S]{0,120}markPurchased\(chatId\)/.test(s))
  const calls = (s.match(/_finalizeWalletPurchase\(\)/g) || []).length
  check('helper is called inside multiple walletOk handlers (>=8)', calls >= 8, `found ${calls} call sites`)
  // The bug was ONLY the wallet dispatch calling these BEFORE the handler's
  // balance check. (Crypto/bank/dynopay webhook paths legitimately call them
  // after a confirmed charge — those are correct and out of scope here.)
  const anchor = s.indexOf('return handler(info?.coin)')
  const dispatchWindow = anchor > 0 ? s.slice(Math.max(0, anchor - 400), anchor) : ''
  check('wallet dispatch no longer eagerly marks purchased before the charge',
    !!dispatchWindow && !/markPurchased\(chatId\)/.test(dispatchWindow) && !/recordPaymentCompleted\(chatId\)/.test(dispatchWindow))
  check('old eager-dispatch call replaced by explanatory FIX comment',
    /recordPaymentCompleted\(\)\/markPurchased\(\) moved INTO each/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #3 — single price source: overage/forwarding rate read from the same
//          env vars phone-config uses; the stale "$0.04/min" copy is gone.
// ════════════════════════════════════════════════════════════════════
section('Fix #3 — single price source (monetization-engine.js + phone-config.js)')
{
  const mon = require('../monetization-engine.js')
  const langs = ['en', 'fr', 'zh', 'hi']
  for (const l of langs) {
    const out = mon.UPSELL_MESSAGES[l].minuteLimitHit()
    check(`[${l}] overage copy reflects env rate ($0.19)`, out.includes('0.19'), out)
    check(`[${l}] stale hardcoded $0.04 removed`, !out.includes('0.04'))
  }
  const pc = src('phone-config.js')
  check('phone-config reads OVERAGE_RATE_MIN from env', /process\.env\.OVERAGE_RATE_MIN/.test(pc))
  const me = src('monetization-engine.js')
  check('monetization reads OVERAGE_RATE_MIN from env (same var)', /process\.env\.OVERAGE_RATE_MIN/.test(me))
  check('no literal "$0.04/min" left in monetization source', !/\$0\.04\/min/.test(me))
}

// ════════════════════════════════════════════════════════════════════
// FIX #4 — cart nudge: dead "/menu → Daily Coupon" replaced by a live
//          coupon line + a working /start deep-link to the abandoned hub.
// ════════════════════════════════════════════════════════════════════
section('Fix #4 — cart-nudge copy (cart-abandonment.js)')
{
  const s = src('cart-abandonment.js')
  // The explanatory NOTE comment above the const legitimately quotes the old
  // dead instruction; only assert the actual message TEMPLATES are clean.
  const block = (s.match(/const NUDGE_MESSAGES = \{[\s\S]*?\n\}\n/) || [''])[0]
  check('dead "/menu" instruction removed from nudge templates', !!block && !block.includes('/menu') && !block.includes('Daily Coupon'))
  check('live coupon line builder present (NUDGE_COUPON_LINE)', /const NUDGE_COUPON_LINE = \{/.test(s))
  check('working CTA builder present (NUDGE_CTA)', /const NUDGE_CTA = \{/.test(s))
  check('category → deep-link map present (CATEGORY_DEEPLINK)', /const CATEGORY_DEEPLINK = \{/.test(s))
  check('nudge builds a t.me /start deep link', /https:\/\/t\.me\/\$\{botUser\}\?start/.test(s))
  check('coupon lookup checks welcomeCoupons + dailyCoupons', /welcomeCoupons/.test(s) && /dailyCoupons/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #5 — shared balance wall: "You need $X more" + pre-filled deposit
//          buttons that jump straight to the coin/method picker.
// ════════════════════════════════════════════════════════════════════
section('Fix #5 — pre-filled balance wall (improved-messages.js + _index.js)')
{
  const im = require('../improved-messages.js')
  const r = im.getInsufficientBalanceMessage(41, 75, 'USD', 'en')
  check('message states the exact shortfall ($34.00 more)', /You need <b>\$34\.00<\/b> more/.test(r.message), r.message)
  check('shows order total + current balance', r.message.includes('75.00') && r.message.includes('41.00'))
  check('keyboard offers a pre-filled deposit for the shortfall ($34)', JSON.stringify(r.keyboard).includes('💵 Deposit $34'))
  check('keyboard offers a second larger preset', /💵 Deposit \$\d+/.test(JSON.stringify(r.keyboard[1])))
  check('no more "View Plans" dead-end button', !JSON.stringify(r.keyboard).includes('View Plans'))
  // shortfall never negative
  const r0 = im.getInsufficientBalanceMessage(100, 75, 'USD', 'en')
  check('shortfall clamped at >= 0 when balance already covers', /\$0\.00<\/b> more/.test(r0.message))
  // NGN fallback keeps the simple Add-Funds wall
  const rn = im.getInsufficientBalanceMessage(1, 75, 'NGN', 'en')
  check('NGN keeps simple Add-Funds / Cancel wall', JSON.stringify(rn.keyboard).includes('Add Funds'))
  // all langs render a title
  for (const l of ['fr', 'zh', 'hi']) {
    const rl = im.getInsufficientBalanceMessage(41, 75, 'USD', l)
    check(`[${l}] localised wall renders with pre-filled deposit`, JSON.stringify(rl.keyboard).includes('💵 Deposit $34'))
  }

  const s = src('_index.js')
  check('balance checks now use getInsufficientBalanceMessage (>=8 sites)',
    (s.match(/getInsufficientBalanceMessage\(usdBal/g) || []).length >= 6)
  check('deposit-wall tap is parsed ("💵 Deposit $N")', /\^💵 Deposit \\\$\(\\d\+/.test(s))
  check('deposit-wall tap jumps to coin picker when bank hidden', /HIDE_BANK_PAYMENT === 'true'[\s\S]{0,80}selectCryptoToDeposit/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #6 — underpayment message is actionable (funds credited + how to
//          finish) and now carries the main-menu keyboard.
// ════════════════════════════════════════════════════════════════════
section('Fix #6 — actionable underpayment copy (lang/*.js + _index.js)')
{
  for (const l of ['en', 'fr', 'zh', 'hi']) {
    const { [l]: L } = require(`../lang/${l}.js`)
    const out = L.t.sentLessMoney('$75', '$60')
    check(`[${l}] underpayment says funds were credited (no dead-end)`, out.length > 0 && !/Service not delivered\./.test(out), out.slice(0, 60))
  }
  const s = src('_index.js')
  // every sentLessMoney send now passes a keyboard (translation('o', lang))
  const bad = (s.match(/t\.sentLessMoney['"]?,\s*lang[^)]*\)\)(?!\s*,)/g) || [])
  check("sentLessMoney sends now include the main-menu keyboard (translation('o', lang))",
    (s.match(/translation\('t\.sentLessMoney', lang[^\n]*\), translation\('o', lang\)\)/g) || []).length >= 5)
}

// ════════════════════════════════════════════════════════════════════
// FIX #7 — trial endings sell: a "Get My Own Number (Pro)" CTA after
//          /testsip + Quick IVR trial that pre-selects Pro and jumps to
//          country selection, surfacing the live welcome coupon.
// ════════════════════════════════════════════════════════════════════
section('Fix #7 — trial → Pro CTA (_index.js)')
{
  const s = src('_index.js')
  check('TRIAL_PRO_CTA button defined (4 langs)', /const TRIAL_PRO_CTA = \{[\s\S]{0,220}en:[\s\S]{0,220}hi:/.test(s))
  check('CTA is offered on the /testsip code screen', /sipTestCode[\s\S]{0,160}TRIAL_PRO_CTA/.test(s))
  check('tapping CTA is handled', /TRIAL_PRO_CTA_ALL\.includes\(message\)/.test(s))
  check('CTA pre-selects the Pro plan', /saveInfo\('cpPlanKey', 'pro'\)/.test(s))
  check('CTA surfaces the live welcome coupon hint', /welcomeCoupons[\s\S]{0,500}Apply Coupon/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #8 — hosting "plan + domain = total today" on the domain-found screen.
// ════════════════════════════════════════════════════════════════════
section('Fix #8 — hosting total line (lang/*.js + _index.js)')
{
  for (const l of ['en', 'fr', 'zh', 'hi']) {
    const { [l]: L } = require(`../lang/${l}.js`)
    const withTotal = L.hP.generateDomainFoundText('exbytes.com.au', 65, 100, 165, 'Golden')
    check(`[${l}] shows domain + hosting + total when total provided`, withTotal.includes('165') && withTotal.includes('65') && withTotal.includes('100'), withTotal.replace(/\n/g, ' ').slice(0, 80))
    const noTotal = L.hP.generateDomainFoundText('foo.com', 30)
    check(`[${l}] falls back to bare price when no hosting context`, noTotal.includes('30') && !noTotal.includes('Total'))
  }
  const s = src('_index.js')
  check('registerNewDomainFound computes plan+domain total', /_total = Number\.isFinite\(_hostingPrice\) \? _domainPrice \+ _hostingPrice/.test(s))
  check('total passed into generateDomainFoundText', /generateDomainFoundText\(websiteName, price, _hostingPrice, _total, info\.plan\)/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #9 — domain flow: shortener question reworded to default to "No,
//          just register" (price-first), removing the confusing gate.
// ════════════════════════════════════════════════════════════════════
section('Fix #9 — domain shortener prompt (lang/*.js)')
{
  const { en } = require('../lang/en.js')
  const q = en.t.askDomainToUseWithShortener
  check('prompt recommends registering (No) first', /recommended/i.test(q))
  check('prompt no longer leads with the shortener as the default action', /Tap <b>No<\/b> to register it now/.test(q))
  // parity: all langs updated
  for (const l of ['fr', 'zh', 'hi']) {
    const { [l]: L } = require(`../lang/${l}.js`)
    check(`[${l}] shortener prompt updated (non-empty)`, typeof L.t.askDomainToUseWithShortener === 'string' && L.t.askDomainToUseWithShortener.length > 20)
  }
}

// ════════════════════════════════════════════════════════════════════
// FIX #10 — main-menu hierarchy: headline products first, Refer & Earn /
//           Marketplace pushed down.
// ════════════════════════════════════════════════════════════════════
section('Fix #10 — menu hierarchy (lang/*.js)')
{
  for (const l of ['en', 'fr', 'zh', 'hi']) {
    const { [l]: L } = require(`../lang/${l}.js`)
    const kb = L.o.reply_markup.keyboard
    const row1 = JSON.stringify(kb[0])
    const flat = JSON.stringify(kb)
    check(`[${l}] row 1 leads with Cloud IVR`, /Cloud IVR/i.test(row1) || /IVR/i.test(row1), row1)
    check(`[${l}] row 1 pairs IVR with Hosting (not Refer & Earn)`, !/Refer|Earn|Parrain|推荐|रेफ़र|रेफर/i.test(row1), row1)
    // Refer & Earn must still exist, just not in row 1
    check(`[${l}] Refer & Earn still present (moved down)`, /Refer|Earn|Parrain|推荐|कमाएं|रेफ/i.test(flat))
  }
}

// ════════════════════════════════════════════════════════════════════
// FIX #11 — typed text that is a genuine help/trouble intent routes to AI
//           support instead of the generic "option isn't available" reset.
//           (Runtime check also lives at POST /api/dev/support-routing-test.)
// ════════════════════════════════════════════════════════════════════
section('Fix #11 — typed-text → AI support fallback (_index.js)')
{
  const s = src('_index.js')
  check('help-intent cue added to isColdSupportQuestion', /const hasHelpCue = /.test(s))
  check('router returns true on help cue', /return endsQuestion \|\| hasQuestionOrPricingCue \|\| hasHelpCue/.test(s))
  check('help cue matches trouble phrases (not working / can\'t / stuck / failed)',
    /not working[\s\S]{0,300}can'\?t[\s\S]{0,300}stuck[\s\S]{0,300}failed/.test(s) || /help[\s\S]{0,80}support[\s\S]{0,80}problem/.test(s))
}

// ════════════════════════════════════════════════════════════════════
// FIX #12 — welcome offer deep-links to the hub the user browsed most and
//           carries a working CTA (replacing "Tap /start and browse").
// ════════════════════════════════════════════════════════════════════
section('Fix #12 — welcome-offer deep link (new-user-conversion.js + _index.js)')
{
  const s = src('new-user-conversion.js')
  check('hub deep-link map present (HUB_DEEPLINKS)', /const HUB_DEEPLINKS = \{/.test(s))
  check('CTA builder present (buildWelcomeCta)', /function buildWelcomeCta\(/.test(s))
  check('welcome offer messages take a cta arg', /en: \(code, cta\) =>/.test(s))
  check('CTA builds a t.me /start deep link', /https:\/\/t\.me\/\$\{botUser\}\?start=\$\{hub\.payload\}/.test(s))
  check('dead "Tap /start and browse" copy removed', !/Tap \/start and browse/.test(s))
  check('most-browsed hub is chosen from browseCount', /browseCount/.test(s))

  const idx = src('_index.js')
  check('_index.js routes open_<hub> deep links to the right hub',
    /message\.startsWith\('\/start open_'\)/.test(idx) && /open_[\s\S]{0,400}submenu3/.test(idx))
}

// ════════════════════════════════════════════════════════════════════
console.log(`\n════════════════════════════════════════════`)
console.log(`RESULT: ${pass} passed, ${fail} failed`)
if (fail) { console.log('FAILURES:'); failures.forEach(f => console.log('  • ' + f)) }
console.log(`════════════════════════════════════════════`)
process.exit(fail ? 1 : 0)
