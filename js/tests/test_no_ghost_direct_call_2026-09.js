#!/usr/bin/env node
// F4 (prod audit 2026-09-16): no "Twilio direct call" ghost fallback when the SIP bridge cannot be set up.
// Behavioural: outbound SIP call on a Twilio-provider number whose Telnyx transfer returns null must NOT
// create any Twilio call, must hang up the Telnyx leg, drop the bridge and notify the user once.
process.env.TELNYX_SIP_CONNECTION_ID = process.env.TELNYX_SIP_CONNECTION_ID || 'conn-test'
process.env.TELNYX_DEFAULT_ANI = '+18889999999'
const fs = require('fs'), path = require('path')
const Module = require('module')

let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }

// Any attempt to build a Twilio REST client inside voice-service = ghost call path still alive
let twilioClientBuilt = 0
const realLoad = Module._load
Module._load = function (req, parent, ...rest) {
  if (req === 'twilio' && parent?.filename?.endsWith('voice-service.js')) { twilioClientBuilt++ }
  return realLoad.call(this, req, parent, ...rest)
}

const src = fs.readFileSync(path.join(__dirname, '..', 'voice-service.js'), 'utf8')
ok(!src.includes('_attemptTwilioDirectCall'), 'voice-service.js: _attemptTwilioDirectCall removed')
ok((src.match(/_abandonBridge\(\{/g) || []).length >= 4, 'all 4 bridge-failure sites route through _abandonBridge')
const twBranch = src.slice(src.indexOf("if (num.provider === 'twilio') {"), src.indexOf('// Unknown provider — reject gracefully'))
ok(!twBranch.includes('calls.create('), 'Twilio-bridge outbound branch places no calls.create()')

const vs = require('../voice-service.js')
const sent = [], telnyx = { answer: 0, hangup: 0, transfer: 0 }
const num = { phoneNumber: '+18005550199', provider: 'twilio', status: 'active', plan: 'business', telnyxSipUsername: 'gencredTEST', features: {} }
vs.initVoiceService({
  bot: { sendMessage: async (chatId, msg) => { sent.push({ chatId, msg }); return true } },
  phoneNumbersOf: { find: () => ({ toArray: async () => [{ _id: 'F4TEST', val: { numbers: [num] } }] }), findOne: async () => ({ _id: 'F4TEST', val: { numbers: [num] } }), updateOne: async () => ({}) },
  phoneLogs: { insertOne: async () => {} },
  telnyxApi: {
    answerCall: async () => { telnyx.answer++; return true },
    hangupCall: async () => { telnyx.hangup++; return true },
    transferCall: async () => { telnyx.transfer++; return null },   // ← the failure under test
    rejectCall: async () => true, speakOnCall: async () => true, listNumbers: async () => [],
  },
  telnyxResources: {},
  translation: (key) => key === 'vs.outboundCallFailedRouting' ? 'ROUTING_FAILED' : `T:${key}`,
  ivrAnalytics: {},
  walletOf: { findOne: async () => ({ _id: 'F4TEST', usdIn: 50, usdOut: 0 }), findOneAndUpdate: async () => ({ usdIn: 50, usdOut: 0.03 }), updateOne: async () => ({}), s: {} },
  payments: {},
  nanoid: () => 'f4',
  twilioSipDomainName: 'test.sip.twilio.com',
  selfUrl: 'http://localhost:5000',
  twilioService: { getSubAccount: async () => ({ authToken: 'x' }) },
})

const evt = {
  body: { data: { event_type: 'call.initiated', payload: {
    direction: 'outgoing', from: 'gencredTEST', to: '+14155550100', call_control_id: 'cc-f4', connection_id: process.env.TELNYX_SIP_CONNECTION_ID, call_leg_id: 'leg-f4',
    client_state: null,
  } } },
}

;(async () => {
  await vs.handleVoiceWebhook(evt, { sendStatus: () => {} })
  await new Promise(r => setTimeout(r, 1200))
  ok(telnyx.transfer === 1, `Telnyx transfer attempted once (${telnyx.transfer})`)
  ok(twilioClientBuilt === 0, `no Twilio REST client built for a fallback call (${twilioClientBuilt})`)
  ok(telnyx.hangup >= 1, `Telnyx leg hung up after transfer failure (${telnyx.hangup})`)
  const routingMsgs = sent.filter(m => m.msg === 'ROUTING_FAILED')
  ok(routingMsgs.length === 1, `user notified exactly once about routing failure (${routingMsgs.length})`)
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
