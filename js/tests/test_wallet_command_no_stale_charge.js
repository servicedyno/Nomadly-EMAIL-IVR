/**
 * Regression test — 2026-07-01 @Hostbay_support VPS auto-deployment incident
 *
 * Root cause: a fuzzy "wallet" keyword matcher routed a synthetic /wallet
 * message (fired by the marketplace paywall "Top up wallet" button via
 * bot.processUpdate) into goto.walletSelectCurrency() — a PAYMENT CONFIRMATION
 * step that read a stale info.vpsDetails from an abandoned VPS cart. The
 * "Yes" tap that followed then deducted $18 and deployed a DigitalOcean VPS
 * the user never intended to buy. See _index.js:9158 SAFETY GUARD comment.
 *
 * This test is a static source-code guard so a future refactor cannot re-open
 * the exact same hole. It checks:
 *   1) The fuzzy "wallet" matcher (30317-ish) routes to the wallet MENU
 *      (goto[user.wallet]) — NOT to goto[a.walletSelectCurrency] (payment).
 *   2) goto.walletSelectCurrency() opens with a LEGIT_ENTRY_ACTIONS guard
 *      that rejects entry from any non-payment-picker action.
 *   3) The wallet_topup_quick callback resets state.action to 'none' before
 *      firing bot.processUpdate — so any stale payment picker cannot catch
 *      the synthesised wallet-menu tap.
 *   4) The wallet_topup_quick callback fires the wallet BUTTON text (not
 *      the string "/wallet") so the fuzzy matcher never trips again.
 */
'use strict'

const fs = require('fs')

const INDEX = fs.readFileSync('/app/js/_index.js', 'utf8')

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

console.log('\n=== 2026-07-01 stale-VPS-cart via /wallet regression ===')

// 1) Fuzzy "wallet" matcher must NOT route to walletSelectCurrency
const fuzzyBlock = INDEX.match(/msgLower\.includes\('my wallet'\)[\s\S]{0,1200}/)
it('Fuzzy "wallet" matcher block exists', !!fuzzyBlock)
if (fuzzyBlock) {
  // Strip // comments so we only check the executable code path.
  const src = fuzzyBlock[0].replace(/\/\/[^\n]*/g, '')
  it('Fuzzy "wallet" matcher routes to goto[user.wallet] (wallet MENU)',
    src.includes('goto[user.wallet]'),
    'Expected the fuzzy matcher to open the wallet MENU')
  it('Fuzzy "wallet" matcher does NOT route to goto[a.walletSelectCurrency]',
    !src.includes('goto[a.walletSelectCurrency]'),
    'Regression: routing to walletSelectCurrency re-opens the stale-cart hole')
}

// 2) goto.walletSelectCurrency() must open with the safety guard
const wscIdx = INDEX.indexOf('walletSelectCurrency: async (plan = false) => {')
it('goto.walletSelectCurrency() exists', wscIdx > 0)
if (wscIdx > 0) {
  // Large slice so the whole function body is covered.
  const wscBody = INDEX.slice(wscIdx, wscIdx + 6500)
  it('walletSelectCurrency has 2026-07-01 SAFETY GUARD comment',
    wscBody.includes('2026-07-01 SAFETY GUARD'))
  it('walletSelectCurrency defines _LEGIT_ENTRY_ACTIONS set',
    wscBody.includes('_LEGIT_ENTRY_ACTIONS'))
  it('walletSelectCurrency guard includes vps-plan-pay',
    wscBody.match(/_LEGIT_ENTRY_ACTIONS[\s\S]{0,400}'vps-plan-pay'/))
  it('walletSelectCurrency guard includes hosting-pay',
    wscBody.match(/_LEGIT_ENTRY_ACTIONS[\s\S]{0,400}'hosting-pay'/))
  it('walletSelectCurrency guard includes domain-pay',
    wscBody.match(/_LEGIT_ENTRY_ACTIONS[\s\S]{0,400}'domain-pay'/))
  it('walletSelectCurrency guard aborts to wallet MENU when action is not legit',
    wscBody.match(/_LEGIT_ENTRY_ACTIONS\.has\(action\)[\s\S]{0,400}goto\[user\.wallet\]/))
  // Guard must run BEFORE the loyalty / saveInfo('coin', ...) mutations
  const guardIdx = wscBody.indexOf('_LEGIT_ENTRY_ACTIONS')
  const coinIdx = wscBody.indexOf("saveInfo('coin'")
  it('Guard runs BEFORE the "saveInfo(coin, u.usd)" mutation',
    guardIdx > 0 && coinIdx > 0 && guardIdx < coinIdx,
    `guardIdx=${guardIdx}, coinIdx=${coinIdx}`)
}

// 3) wallet_topup_quick handler must clear stale action + use wallet button text
const wtqIdx = INDEX.indexOf("data === 'wallet_topup_quick'")
it('wallet_topup_quick callback handler exists', wtqIdx > 0)
if (wtqIdx > 0) {
  const wtqBody = INDEX.slice(wtqIdx, wtqIdx + 2500)
  it('wallet_topup_quick clears stale action to \'none\' before processUpdate',
    wtqBody.match(/set\(\s*state\s*,\s*chatId\s*,\s*['"]action['"]\s*,\s*['"]none['"]\s*\)[\s\S]{0,900}bot\.processUpdate/))
  it('wallet_topup_quick does NOT fire "/wallet" synthetic text',
    !wtqBody.includes("text: '/wallet'"),
    'Regression: firing "/wallet" hits the fuzzy matcher — use the button text instead')
  it('wallet_topup_quick references a wallet-button label map',
    wtqBody.includes('_walletLabels') || wtqBody.includes('👛 Wallet'))
  it('wallet_topup_quick fires the button text (not a slash command)',
    wtqBody.match(/text:\s*_walletBtn/) ||
    wtqBody.match(/text:\s*['"]👛/))
}

// 4) Callers of goto.walletSelectCurrency() must all be inside legit
//    payment-picker contexts (payOption === payIn.wallet). This is a soft
//    check — count callers and confirm none reference the fuzzy matcher key.
const wscCallers = [...INDEX.matchAll(/goto\.walletSelectCurrency\(/g)]
it('goto.walletSelectCurrency has ≥1 legitimate caller', wscCallers.length >= 1)
// The fuzzy-match line MUST NOT be among the callers (strip comments so the
// SAFETY-FIX explanatory comment mentioning the OLD path does not false-fail).
const INDEX_NO_COMMENTS = INDEX
  .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
  .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1') // line comments (avoid URL/regex confusion)
const fuzzyCallerCount = (INDEX_NO_COMMENTS.match(/msgLower\.includes\('wallet'\)[\s\S]{0,300}goto\[a\.walletSelectCurrency\]/g) || []).length
it('No caller routes fuzzy "wallet" match to walletSelectCurrency',
  fuzzyCallerCount === 0,
  'Regression: bringing back the fuzzy → walletSelectCurrency route re-opens the hole')

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`)
process.exit(fail === 0 ? 0 : 1)
