// test_ai_support_phase1.js
// Phase 1 of the AI Support upgrade — language polish + escalation hardening.
//
// Covers:
//   ✅ L1  extractActionButtons returns ZH and HI buttons (was EN/FR only)
//   ✅ L7  needsEscalation soft branch recognizes FR/ZH/HI navigation verbs
//   ✅ S6  max_tokens raised from 500 → 1200 (main) and 400 → 800 (marketplace)
//   ✅ S12 critical-keyword admin escalation is deduped per session
//
// Static-source check + functional check on pure exports.

const fs = require('fs')
const path = require('path')
const assert = require('assert')

// Set _aiChatHistory db proxy so initAiSupport doesn't crash if we touch it
// — but for these tests we only call PURE functions exported from ai-support.
const ai = require('../ai-support.js')
const src = fs.readFileSync(path.join(__dirname, '..', 'ai-support.js'), 'utf8')

let passed = 0, failed = 0
const t = (name, fn) => {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}\n     ${e.message}`)
    failed++
  }
}

console.log('\n=== AI Support — Phase 1 (language polish + dedup) ===\n')

// L1 — extractActionButtons covers all 4 languages
t('L1: extractActionButtons returns ZH button for ZH response', () => {
  const out = ai.extractActionButtons('请前往 钱包 进行充值', 'zh')
  assert(out.length > 0, 'expected at least 1 button for ZH wallet keyword')
  assert(out.includes('👛 我的钱包'), `expected ZH wallet button, got: ${JSON.stringify(out)}`)
})

t('L1: extractActionButtons returns HI button for HI response', () => {
  const out = ai.extractActionButtons('अपने वॉलेट में जमा करें', 'hi')
  assert(out.includes('👛 मेरा वॉलेट'), `expected HI wallet button, got: ${JSON.stringify(out)}`)
})

t('L1: extractActionButtons returns FR button for FR response (regression)', () => {
  const out = ai.extractActionButtons('Allez dans votre portefeuille pour déposer', 'fr')
  assert(out.includes('👛 Portefeuille'), `expected FR wallet button, got: ${JSON.stringify(out)}`)
})

t('L1: extractActionButtons returns EN button for EN (regression)', () => {
  const out = ai.extractActionButtons('Go to your wallet to deposit funds', 'en')
  assert(out.includes('👛 Wallet'), `expected EN wallet button, got: ${JSON.stringify(out)}`)
})

t('L1: ZH map — domain keyword maps correctly', () => {
  const out = ai.extractActionButtons('域名 注册流程', 'zh')
  assert(out.includes('🌐 防弹域名'), `expected ZH domain button, got: ${JSON.stringify(out)}`)
})

t('L1: HI map — VPS keyword maps correctly', () => {
  const out = ai.extractActionButtons('vps सर्वर बनाने के लिए', 'hi')
  assert(out.includes('🖥️ VPS/RDP'), `expected HI VPS button, got: ${JSON.stringify(out)}`)
})

// L7 — soft escalation branch recognizes FR/ZH/HI navigation verbs
t('L7: soft "broken" + FR navigation answer (cliquez) → no escalation', () => {
  const escalate = ai.needsEscalation('this is broken', 'fr', 'Cliquez sur Wallet → Dépôt')
  assert.strictEqual(escalate, false, 'FR navigation answer should suppress soft escalation')
})

t('L7: soft "error" + ZH navigation answer (点击) → no escalation', () => {
  const escalate = ai.needsEscalation('I have an error', 'zh', '请点击 钱包 → 充值')
  assert.strictEqual(escalate, false, 'ZH 点击 should suppress soft escalation')
})

t('L7: soft "not working" + HI navigation answer (टैप) → no escalation', () => {
  const escalate = ai.needsEscalation('not working', 'hi', 'वॉलेट पर टैप करें')
  assert.strictEqual(escalate, false, 'HI टैप should suppress soft escalation')
})

t('L7: soft "broken" with no nav verb → still escalates', () => {
  const escalate = ai.needsEscalation('this is broken', 'en', 'Sorry to hear that.')
  assert.strictEqual(escalate, true, 'no nav verb should fall through to escalation')
})

// S6 — max_tokens
t('S6: main getAiResponse uses max_tokens 1200 (was 500)', () => {
  // Find the main `gpt-4.1-mini` block (the one inside the retry, after MAX_RETRIES loop)
  const idx = src.indexOf("model: 'gpt-4.1-mini'")
  assert(idx > 0, 'main gpt-4.1-mini block must exist')
  // Check tokens within 200 chars after the model line
  const chunk = src.slice(idx, idx + 400)
  assert(/max_tokens:\s*1200/.test(chunk), `expected max_tokens: 1200 near main model, got chunk:\n${chunk.slice(0, 200)}`)
})

t('S6: getMarketplaceAiResponse uses max_tokens 800 (was 400)', () => {
  const idx = src.indexOf('getMarketplaceAiResponse')
  assert(idx > 0, 'getMarketplaceAiResponse must exist')
  const chunk = src.slice(idx, idx + 1500)
  assert(/max_tokens:\s*800/.test(chunk), 'expected max_tokens: 800 in marketplace path')
})

// S12 — critical-keyword escalation dedup
t('S12: refund keyword escalates first time per session', () => {
  const e1 = ai.needsEscalation('I want a refund please', 'en', null, 9999001)
  assert.strictEqual(e1, true, 'first refund mention should escalate')
})

t('S12: same refund keyword does NOT escalate second time in same session', () => {
  const e1 = ai.needsEscalation('I want a refund please', 'en', null, 9999002)
  assert.strictEqual(e1, true, 'first should escalate')
  const e2 = ai.needsEscalation('refund my money now', 'en', null, 9999002)
  assert.strictEqual(e2, false, 'second refund mention same session should be deduped')
})

t('S12: different critical keyword in same session escalates again', () => {
  const e1 = ai.needsEscalation('I want a refund', 'en', null, 9999003)
  assert.strictEqual(e1, true, 'refund: first escalation')
  const e2 = ai.needsEscalation('this is a scam', 'en', null, 9999003)
  assert.strictEqual(e2, true, 'scam (different keyword) should escalate')
})

t('S12: clearHistory resets dedup so next session starts clean', async () => {
  ai.needsEscalation('refund please', 'en', null, 9999004)
  await ai.clearHistory(9999004)
  const e2 = ai.needsEscalation('refund please', 'en', null, 9999004)
  assert.strictEqual(e2, true, 'after clearHistory, refund should escalate again')
})

t('S12: backward-compat — calling without chatId still escalates every time', () => {
  const e1 = ai.needsEscalation('I want a refund', 'en', null)
  assert.strictEqual(e1, true)
  const e2 = ai.needsEscalation('refund please', 'en', null)
  assert.strictEqual(e2, true, 'without chatId, no dedup (legacy callers preserved)')
})

// L2/L3 — Marketplace AI prompt + context
t('L2: MP_HELPER_PROMPT includes language-aware button labels', () => {
  // The marketplace prompt should mention button labels in EN/FR/ZH/HI
  assert(src.includes('LANGUAGE-AWARE BUTTON LABELS'), 'marketplace prompt should include language table')
  assert(src.includes('🏪 Marché') && src.includes('🏪 市场') && src.includes('🏪 मार्केटप्लेस'),
    'marketplace prompt should list Marketplace label in FR/ZH/HI')
})

t('L3: getMarketplaceContext function exists and is called by MP AI', () => {
  assert(/async function getMarketplaceContext\(/.test(src), 'getMarketplaceContext must be defined')
  assert(/getMarketplaceContext\(chatId\)/.test(src), 'getMarketplaceContext must be called from MP AI')
  // Context must include wallet, listings, conversations
  const ctxIdx = src.indexOf('async function getMarketplaceContext')
  const ctxBlock = src.slice(ctxIdx, ctxIdx + 2000)
  assert(/walletOf/.test(ctxBlock), 'MP context should fetch wallet')
  assert(/marketplaceProducts/.test(ctxBlock), 'MP context should fetch active listings')
  assert(/marketplaceConversations/.test(ctxBlock), 'MP context should fetch conversations')
})

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
process.exit(failed === 0 ? 0 : 1)
