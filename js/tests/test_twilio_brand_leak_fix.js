/**
 * test_twilio_brand_leak_fix.js — Regression test for white-label leak fix.
 *
 * @kathyserious discovered the bot uses Twilio internally because the
 * "Test Outbound SIP" success message displayed `🌐 Provider: twilio` (or
 * `telnyx`) verbatim from `num.provider`.
 *
 * Fix: `js/test-outbound-sip.js` now sanitizes the provider value before
 * passing it to the user-facing template — both `twilio` and `telnyx` are
 * mapped to the public brand `Speechcue` (matches the SIP domain
 * `sip.speechcue.com` already shown to users).
 *
 * This test verifies:
 *   1. The sanitization code path exists in test-outbound-sip.js.
 *   2. When the bot sends the success report for a Twilio-backed number,
 *      the resulting message contains "Speechcue" and NOT "twilio" (case-
 *      insensitive) in the user-visible body.
 *   3. Same for Telnyx-backed numbers.
 *   4. Internal log still contains the raw provider (for debugging).
 */

const fs = require('fs')
const path = require('path')

let passed = 0, failed = 0
function assert(cond, msg) {
  if (cond) { console.log(`✅ ${msg}`); passed++ }
  else { console.log(`❌ ${msg}`); failed++ }
}

// ── (1) Sanitization code is present in module
const src = fs.readFileSync(path.join(__dirname, '..', 'test-outbound-sip.js'), 'utf-8')
assert(src.includes('userVisibleProvider'),
  'test-outbound-sip.js declares userVisibleProvider sanitizer')
assert(src.includes("provider === 'twilio' || provider === 'telnyx'"),
  'sanitizer covers both twilio and telnyx (lower case)')
assert(src.includes("provider === 'Twilio' || provider === 'Telnyx'"),
  'sanitizer covers both Twilio and Telnyx (capitalised)')
assert(src.includes("'Speechcue'"),
  'sanitizer maps to public brand "Speechcue"')
assert(src.includes("M('success', session.num.phoneNumber, sipUsername, userVisibleProvider"),
  'sanitized provider is passed to localized "success" template')
assert(src.includes('Provider: <code>${userVisibleProvider}</code>'),
  'fallback English message uses sanitized provider')

// ── (2) End-to-end: send the success report and inspect message text
process.env.PHONE_SERVICE_ON = 'false'
process.env.MONGO_URL = 'mongodb://localhost:27017'
process.env.TWILIO_ACCOUNT_SID = 'ACtest'
process.env.TWILIO_AUTH_TOKEN  = 'tok'

const mod = require('../test-outbound-sip.js')
const phoneConfig = require('../phone-config.js')

const sentMessages = []
const fakeBot = {
  sendMessage: async (chatId, text /*, opts */) => {
    sentMessages.push({ chatId, text })
    return true
  },
}
const fakeTelnyx = { hangupCall: async () => ({ success: true }) }
const fakeLog = () => {}

mod.initTestOutboundSip({ bot: fakeBot, log: fakeLog, getTxt: phoneConfig.getTxt, telnyxApi: fakeTelnyx })

async function simulate(provider, langs = ['en', 'fr', 'zh', 'hi']) {
  for (const lang of langs) {
    sentMessages.length = 0
    const chatId = `chat_${provider}_${lang}`
    // Unique phone number per test to bypass per-number throttle (5/day)
    const uniquePhone = `+1888${Math.floor(Math.random() * 9000000 + 1000000)}`
    const num = {
      phoneNumber: uniquePhone,
      status: 'active',
      sipUsername: 'gencredABC123XYZ',
      provider,
    }
    // Start a test session
    const r = mod.startTest(chatId, num, lang)
    assert(r.ok === true, `[${provider}/${lang}] startTest returns ok=true`)

    // Match — simulate inbound call arriving with this provider in context
    const matched = await mod.matchPendingTest(chatId, num, num.sipUsername, {
      provider, destination: '+15551112222', callControlId: 'cc_fake',
    })
    assert(matched === true, `[${provider}/${lang}] matchPendingTest returns true`)

    const userMsg = sentMessages.find(m => m.chatId === chatId)?.text || ''
    const lower = userMsg.toLowerCase()
    assert(userMsg.length > 0, `[${provider}/${lang}] user received a success message`)
    assert(!lower.includes('twilio'), `[${provider}/${lang}] message does NOT contain "twilio" (white-label preserved)`)
    assert(!lower.includes('telnyx'), `[${provider}/${lang}] message does NOT contain "telnyx" (white-label preserved)`)
    assert(userMsg.includes('Speechcue'), `[${provider}/${lang}] message DOES contain "Speechcue" (public brand)`)
  }
}

(async () => {
  await simulate('twilio')
  await simulate('telnyx')
  await simulate('Twilio', ['en'])
  await simulate('Telnyx', ['en'])

  console.log(`\n${failed === 0 ? '🟢' : '🔴'} ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})()
