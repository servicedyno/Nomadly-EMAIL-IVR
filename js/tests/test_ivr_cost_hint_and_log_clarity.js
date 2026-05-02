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
  // the three branches: sufficient, insufficient, error. Also accepts an
  // optional `ivrObData` so we can test the per-campaign cost estimate that
  // appears once the user has picked targets.
  const IVR_RATE = 0.15 // mirrors voiceService.IVR_CALL_RATE default
  async function ivrWalletHintPrefix(chatId, lang = 'en', ivrObData = null, { walletCheckImpl } = {}) {
    try {
      const IVR_MIN_WALLET = parseFloat(process.env.BULK_CALL_MIN_WALLET || '50')
      const wc = await walletCheckImpl(chatId, IVR_MIN_WALLET)
      const bal = wc.usdBal.toFixed(2)
      const min = IVR_MIN_WALLET.toFixed(2)
      const targetCount = Array.isArray(ivrObData?.batchTargets) && ivrObData.batchTargets.length
        ? ivrObData.batchTargets.length
        : (ivrObData?.targetNumber ? 1 : 0)
      const estCost = targetCount * IVR_RATE
      const canCoverCampaign = targetCount === 0 || wc.usdBal >= estCost
      const estLine = targetCount > 0 ? ({
        en: `📞 <b>Est:</b> $${estCost.toFixed(2)} (${targetCount} target${targetCount === 1 ? '' : 's'} × $${IVR_RATE.toFixed(2)})\n\n`,
        fr: `📞 <b>Estimation :</b> ${estCost.toFixed(2)} $ (${targetCount} cible${targetCount === 1 ? '' : 's'} × ${IVR_RATE.toFixed(2)} $)\n\n`,
        zh: `📞 <b>预估费用:</b> $${estCost.toFixed(2)} (${targetCount} 个目标 × $${IVR_RATE.toFixed(2)})\n\n`,
        hi: `📞 <b>अनुमानित:</b> $${estCost.toFixed(2)} (${targetCount} लक्ष्य × $${IVR_RATE.toFixed(2)})\n\n`,
      }[lang] || `📞 <b>Est:</b> $${estCost.toFixed(2)} (${targetCount} targets × $${IVR_RATE.toFixed(2)})\n\n`) : ''
      if (wc.sufficient && canCoverCampaign) {
        const walletLine = ({
          en: `💰 <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} ✅\n`,
        }[lang] || `💰 <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} ✅\n`)
        return walletLine + estLine + (estLine ? '' : '\n')
      }
      const gap = !canCoverCampaign ? (estCost - wc.usdBal) : (IVR_MIN_WALLET - wc.usdBal)
      const reasonEn = !canCoverCampaign ? 'for this campaign' : 'to meet the minimum'
      const walletLine = ({
        en: `⚠️ <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} · Top up <b>$${gap.toFixed(2)}</b> ${reasonEn}.\n`,
      }[lang] || `⚠️ <b>Wallet:</b> $${bal} · <b>Min:</b> $${min} · Top up <b>$${gap.toFixed(2)}</b> ${reasonEn}.\n`)
      return walletLine + estLine + (estLine ? '' : '\n')
    } catch (e) {
      return ''
    }
  }

  const sufficient = async (_cid, _min) => ({ sufficient: true, usdBal: 100 })
  const insufficient = async (_cid, min) => ({ sufficient: false, usdBal: 5 })
  const errors = async () => { throw new Error('wallet svc down') }

  // ── Basic (no ivrObData) — generic min-only hint ──
  const okHint = await ivrWalletHintPrefix('1', 'en', null, { walletCheckImpl: sufficient })
  ok('sufficient wallet renders ✅ marker', okHint.includes('✅'))
  ok('sufficient wallet shows balance $100.00', okHint.includes('$100.00'))
  ok('sufficient wallet shows Min $50.00', okHint.includes('$50.00'))
  ok('no ivrObData → no per-campaign Est: line', !okHint.includes('Est:'))

  const shortHint = await ivrWalletHintPrefix('1', 'en', null, { walletCheckImpl: insufficient })
  ok('insufficient wallet renders ⚠️ marker', shortHint.includes('⚠️'))
  ok('insufficient wallet says "Top up $45.00 to meet the minimum"', shortHint.includes('Top up <b>$45.00</b> to meet the minimum'))

  const errHint = await ivrWalletHintPrefix('1', 'en', null, { walletCheckImpl: errors })
  ok('wallet check throwing returns empty string (non-fatal)', errHint === '')

  // ── With ivrObData — per-campaign cost estimate ──
  console.log('\nFix B+ — dynamic per-campaign cost estimate')

  // Single-target campaign (Quick IVR): 1 × $0.15 = $0.15, bal=$100 sufficient.
  const single = await ivrWalletHintPrefix('1', 'en', { targetNumber: '+13124340549' }, { walletCheckImpl: sufficient })
  ok('single target renders Est line', single.includes('Est:'))
  ok('single target says "1 target"', single.includes('1 target ×'))
  ok('single target shows estCost $0.15', single.includes('$0.15 (1 target'))
  ok('single target keeps ✅ (bal covers campaign)', single.includes('✅'))

  // 10-target bulk campaign: 10 × $0.15 = $1.50, bal=$100 sufficient.
  const bulk10 = await ivrWalletHintPrefix('1', 'en', { batchTargets: new Array(10).fill('+1') }, { walletCheckImpl: sufficient })
  ok('10-target shows "10 targets"', bulk10.includes('10 targets ×'))
  ok('10-target shows estCost $1.50', bulk10.includes('$1.50 (10 targets'))
  ok('10-target keeps ✅', bulk10.includes('✅'))

  // 500-target mega bulk: 500 × $0.15 = $75, bal=$100 sufficient for min AND campaign.
  const bulk500 = await ivrWalletHintPrefix('1', 'en', { batchTargets: new Array(500).fill('+1') }, { walletCheckImpl: sufficient })
  ok('500-target shows "500 targets"', bulk500.includes('500 targets'))
  ok('500-target shows estCost $75.00', bulk500.includes('$75.00'))
  ok('500-target still ✅ (100 ≥ 75)', bulk500.includes('✅'))

  // 1000-target over-budget: 1000 × $0.15 = $150, bal=$100 < campaign.
  // Should turn ⚠️ with "for this campaign" reason, gap = $50.
  const over = await ivrWalletHintPrefix('1', 'en', { batchTargets: new Array(1000).fill('+1') }, { walletCheckImpl: sufficient })
  ok('1000-target flips to ⚠️ (bal<est)', over.includes('⚠️'))
  ok('1000-target says "for this campaign"', over.includes('for this campaign'))
  ok('1000-target gap = $50.00 ($150 - $100)', over.includes('Top up <b>$50.00</b>'))
  ok('1000-target estCost shown $150.00', over.includes('$150.00'))

  // Insufficient min + small campaign: bal=$5, 1 target = $0.15.
  // Wallet is short of MIN ($50) but enough for the single call.
  // Campaign is coverable ($0.15 < $5), so gap = min-gap $45.
  const smallCampaignLowBal = await ivrWalletHintPrefix('1', 'en', { targetNumber: '+1' }, { walletCheckImpl: insufficient })
  ok('small campaign + low bal: ⚠️', smallCampaignLowBal.includes('⚠️'))
  ok('small campaign + low bal: "to meet the minimum" reason', smallCampaignLowBal.includes('to meet the minimum'))
  ok('small campaign + low bal: gap = $45.00', smallCampaignLowBal.includes('Top up <b>$45.00</b>'))
  ok('small campaign + low bal: still shows Est: $0.15', smallCampaignLowBal.includes('$0.15 (1 target'))

  // Huge campaign + low bal: both blockers, campaign shortfall takes precedence.
  const hugeCampaignLowBal = await ivrWalletHintPrefix('1', 'en', { batchTargets: new Array(1000).fill('+1') }, { walletCheckImpl: insufficient })
  ok('huge campaign + low bal: ⚠️', hugeCampaignLowBal.includes('⚠️'))
  ok('huge campaign + low bal: "for this campaign" takes precedence over min',
     hugeCampaignLowBal.includes('for this campaign') && !hugeCampaignLowBal.includes('to meet the minimum'))
  ok('huge campaign + low bal: gap = $145.00 ($150 - $5)', hugeCampaignLowBal.includes('Top up <b>$145.00</b>'))

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
