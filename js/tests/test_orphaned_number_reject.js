// Unit test for the orphaned-number inbound handler fix (#3).
// Mocks Telnyx API + an empty phoneNumbersOf so the number resolves as orphaned.
// Asserts: reject() is used (NOT answer/speak), and admin alerts are throttled per number.
process.env.TELEGRAM_ADMIN_CHAT_ID = '999999'
process.env.TELNYX_SIP_CONNECTION_ID = 'sip-conn-not-used'

const vs = require('../voice-service.js')

const calls = { reject: 0, answer: 0, speak: 0, hangup: 0 }
const adminMsgs = []

const telnyxApi = {
  rejectCall: async () => { calls.reject++; return true },
  answerCall: async () => { calls.answer++; return true },
  speakOnCall: async () => { calls.speak++; return true },
  hangupCall: async () => { calls.hangup++; return true },
}

vs.initVoiceService({
  bot: { sendMessage: async (chatId, msg) => { adminMsgs.push({ chatId, msg }); return true } },
  phoneNumbersOf: { find: () => ({ toArray: async () => [] }) }, // no owners → orphaned
  phoneLogs: { insertOne: async () => {} },
  telnyxApi,
  telnyxResources: {},
  translation: (key, lang, to, from) => `ALERT ${key} ${to} ${from}`,
  ivrAnalytics: {},
  walletOf: { findOne: async () => null },
  payments: {},
  nanoid: () => 'x',
})

function evt(to, cc) {
  return {
    body: { data: { event_type: 'call.initiated', payload: { direction: 'incoming', from: '+19079219688', to, call_control_id: cc, connection_id: 'random-conn', call_leg_id: 'leg-' + cc } } },
  }
}
const res = { sendStatus: () => {} }

;(async () => {
  await vs.handleVoiceWebhook(evt('+13513540093', 'cc1'), res)
  await vs.handleVoiceWebhook(evt('+13513540093', 'cc2'), res) // same number → alert throttled
  await vs.handleVoiceWebhook(evt('+15550001111', 'cc3'), res) // different number → alert allowed

  console.log('telnyx calls:', JSON.stringify(calls))
  console.log('admin alerts sent:', adminMsgs.length, adminMsgs.map(m => m.msg))

  const pass =
    calls.reject === 3 &&        // all 3 orphaned calls rejected
    calls.answer === 0 &&        // never answered (no 90102)
    calls.speak === 0 &&         // never spoke (no 90034)
    adminMsgs.length === 2       // 1 per distinct number (2nd call to same number throttled)

  console.log(pass ? '\nRESULT: PASS ✅' : '\nRESULT: FAIL ❌')
  process.exit(pass ? 0 : 1)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
