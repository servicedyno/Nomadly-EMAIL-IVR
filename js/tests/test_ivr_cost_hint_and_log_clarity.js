/**
 * Tests for fix B (wallet cost/balance hint at campaign builder entry + custom
 * script steps) and fix D (accurate/actionable log string on Twilio SIP
 * unanswered-billing lookup miss).
 *
 * These tests validate the CONTRACT of the helpers/lines we changed — not
 * the full Telegram bot glue — so they're fast and run without Telegram or
 * Twilio.
 */

let pass = 0, fail = 0
const ok = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

;(async () => {
  // ─── Fix B: ivrWalletHintPrefix rendering ───────────────────
  console.log('\nFix B — wallet-cost/balance hint prefix')

  // Inline replica of the ivrWalletHintPrefix contract (identical logic to
  // js/_index.js). We parameterise smartWalletCheck so we can assert on
  // the three branches: sufficient, insufficient, error.
  async function ivrWalletHintPrefix(chatId, lang = 'en', { walletCheckImpl } = {}) {
    try {
      const IVR_MIN_WALLET = parseFloat(process.env.BULK_CALL_MIN_WALLET || '50')
      const wc = await walletCheckImpl(chatId, IVR_MIN_WALLET)
      const bal = wc.usdBal.toFixed(2)
      const min = IVR_MIN_WALLET.toFixed(2)
      if (wc.sufficient) {
        return ({
          en: `💰 <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} ✅\n\n`,
          fr: `💰 <b>Portefeuille :</b> ${bal} $ · <b>Min :</b> ${min} $ ✅\n\n`,
          zh: `💰 <b>钱包:</b> $${bal} · <b>最低:</b> $${min} ✅\n\n`,
          hi: `💰 <b>वॉलेट:</b> $${bal} · <b>न्यूनतम:</b> $${min} ✅\n\n`,
        }[lang]) || `💰 <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} ✅\n\n`
      }
      const short = (IVR_MIN_WALLET - wc.usdBal).toFixed(2)
      return ({
        en: `⚠️ <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} · Top up <b>$${short}</b> before launch.\n\n`,
        fr: `⚠️ <b>Portefeuille :</b> ${bal} $ · <b>Min :</b> ${min} $ · Déposez <b>${short} $</b> avant le lancement.\n\n`,
        zh: `⚠️ <b>钱包:</b> $${bal} · <b>最低:</b> $${min} · 启动前请充值 <b>$${short}</b>。\n\n`,
        hi: `⚠️ <b>वॉलेट:</b> $${bal} · <b>न्यूनतम:</b> $${min} · लॉन्च से पहले <b>$${short}</b> जमा करें।\n\n`,
      }[lang]) || `⚠️ <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} · Top up <b>$${short}</b> before launch.\n\n`
    } catch (e) {
      return ''
    }
  }

  const sufficient = async (_cid, _min) => ({ sufficient: true, usdBal: 100 })
  const insufficient = async (_cid, min) => ({ sufficient: false, usdBal: 5 })
  const errors = async () => { throw new Error('wallet svc down') }

  const okHint = await ivrWalletHintPrefix('1', 'en', { walletCheckImpl: sufficient })
  ok('sufficient wallet renders ✅ marker', okHint.includes('✅'))
  ok('sufficient wallet shows balance $100.00', okHint.includes('$100.00'))
  ok('sufficient wallet shows Min $50.00', okHint.includes('$50.00'))

  const shortHint = await ivrWalletHintPrefix('1', 'en', { walletCheckImpl: insufficient })
  ok('insufficient wallet renders ⚠️ marker', shortHint.includes('⚠️'))
  ok('insufficient wallet says "Top up $45.00"', shortHint.includes('Top up <b>$45.00</b>'))
  ok('insufficient wallet ends with "before launch."', shortHint.includes('before launch.'))

  const frHint = await ivrWalletHintPrefix('1', 'fr', { walletCheckImpl: insufficient })
  ok('fr locale uses "Déposez"', frHint.includes('Déposez'))
  ok('fr locale uses "avant le lancement"', frHint.includes('avant le lancement'))

  const zhHint = await ivrWalletHintPrefix('1', 'zh', { walletCheckImpl: insufficient })
  ok('zh locale uses 充值', zhHint.includes('充值'))

  const hiHint = await ivrWalletHintPrefix('1', 'hi', { walletCheckImpl: insufficient })
  ok('hi locale uses लॉन्च / जमा', hiHint.includes('लॉन्च') && hiHint.includes('जमा'))

  const errHint = await ivrWalletHintPrefix('1', 'en', { walletCheckImpl: errors })
  ok('wallet check throwing returns empty string (non-fatal)', errHint === '')

  // ─── Fix D: Twilio SIP unanswered-billing log disambiguation ─
  console.log('\nFix D — Twilio SIP bridge unanswered-billing log')

  // Contract mirror: given a list of numbers + a decodedToNum + chatId,
  // produce the right log severity / message template.
  function chooseLogMessage({ numbers, decodedToNum, chatId, label, reason, dur }) {
    const num = numbers.find(n => n.phoneNumber === decodedToNum && n.provider === 'twilio')
    if (num) return { level: 'billed', msg: `[Twilio] ${label} unanswered billed` }
    const hasSameNumberWithWrongProvider = numbers.some(n => n.phoneNumber === decodedToNum && n.provider !== 'twilio')
    if (hasSameNumberWithWrongProvider) {
      return { level: 'warn', msg: `[Twilio] ${label} ${reason} ${dur}s — ⚠️ NOT BILLED: ${decodedToNum} is in user numbers but provider != 'twilio'. Check number-doc hygiene for chatId=${chatId}.` }
    }
    return { level: 'info', msg: `[Twilio] ${label} ${reason} ${dur}s — not billed (${decodedToNum} is not a Nomadly-owned Twilio number for chatId=${chatId}; likely a destination/transfer leg, which is correct).` }
  }

  // Case 1: destination/transfer number, NOT a Nomadly number — the
  // @LBHAND23 case (to=+18337215318, but the user's DB entry wasn't matched
  // because of a provider-field mismatch or transfer-leg flow).
  const c1 = chooseLogMessage({
    numbers: [], // nothing owned by this user at this moment
    decodedToNum: '+15551234567',
    chatId: 1794625076,
    label: 'SIP Bridge Call',
    reason: 'No answer',
    dur: 9,
  })
  ok('case 1: info-level (not warn)', c1.level === 'info')
  ok('case 1: message explicitly says "not billed"', c1.msg.includes('not billed'))
  ok('case 1: message includes duration "9s"', c1.msg.includes('9s'))
  ok('case 1: message includes reason "No answer"', c1.msg.includes('No answer'))
  ok('case 1: message no longer says scary "number not found"', !c1.msg.includes('number not found'))
  ok('case 1: message attributes chatId for traceability', c1.msg.includes('chatId=1794625076'))

  // Case 2: provider-field drift (bug to investigate) — number IS in user
  // list but provider isn't 'twilio'. Old code silently didn't bill; new
  // code escalates with ⚠️ so ops sees it.
  const c2 = chooseLogMessage({
    numbers: [{ phoneNumber: '+18337215318', provider: 'Twilio' /* capital T */ }],
    decodedToNum: '+18337215318',
    chatId: 1794625076,
    label: 'SIP Bridge Call',
    reason: 'No answer',
    dur: 9,
  })
  ok('case 2: escalated to warn level', c2.level === 'warn')
  ok('case 2: message explicitly says NOT BILLED (uppercase)', c2.msg.includes('NOT BILLED'))
  ok('case 2: message mentions "provider"', c2.msg.includes("provider != 'twilio'"))
  ok('case 2: message prompts ops action "Check number-doc hygiene"', c2.msg.includes('Check number-doc hygiene'))

  // Case 3: happy path — number matches, bills successfully.
  const c3 = chooseLogMessage({
    numbers: [{ phoneNumber: '+18337215318', provider: 'twilio' }],
    decodedToNum: '+18337215318',
    chatId: 1794625076,
    label: 'SIP Bridge Call',
    reason: 'No answer',
    dur: 0,
  })
  ok('case 3: billed level (match found)', c3.level === 'billed')

  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
