#!/usr/bin/env node
// Edge-case fix: an outbound SIP credential that repeatedly fails user identification keeps generating
// BILLABLE inbound SIP legs (Telnyx bills the leg + Call Control fee) plus a 250-credential reverse
// lookup, with NO user to charge. After 3 consecutive failures we hard-block it (10 min) so the leak
// stops. This test drives the real handler and proves: (1) failures 1-3 still run the lookup+hangup,
// (2) from failure 4 the credential is blocked → instant hangup, NO reverse lookup (leak stopped),
// (3) each failure is recorded to unidentifiedCallLeaks for operator visibility.
process.env.TELNYX_SIP_CONNECTION_ID = 'conn-test'
process.env.TELNYX_DEFAULT_ANI = '+18889999999'

let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }
const ORPHAN = 'gencredORPHAN'
const DEST = '+14155550123'

// Reverse-lookup counter (proves the leak/lookup is stopped once blocked)
const txmod = require('../telnyx-service.js')
let listCalls = 0
txmod.listSIPCredentials = async () => { listCalls++; return [] }

// unidentifiedCallLeaks recorder
const leaks = []
const db = {
  collection: (name) => ({
    collectionName: name,
    findOne: async () => null,
    insertOne: async (doc) => { if (name === 'unidentifiedCallLeaks') leaks.push(doc); return {} },
    updateOne: async () => ({}), deleteOne: async () => ({}), deleteMany: async () => ({}),
    find: () => ({ toArray: async () => [] }),
  }),
}
const telnyx = { hangup: 0, reject: 0, transfer: 0 }
const vs = require('../voice-service.js')
vs.initVoiceService({
  bot: { sendMessage: async () => true },
  // No owner for ANY credential → identification always fails
  phoneNumbersOf: { collectionName: 'phoneNumbersOf', find: () => ({ toArray: async () => [] }), findOne: async () => null, updateOne: async () => ({}), s: { db } },
  phoneLogs: { insertOne: async () => {} },
  telnyxApi: {
    answerCall: async () => true,
    hangupCall: async () => { telnyx.hangup++; return true },
    rejectCall: async () => { telnyx.reject++; return true },
    transferCall: async () => { telnyx.transfer++; return {} },
    speakOnCall: async () => true, listNumbers: async () => [],
  },
  telnyxResources: {}, translation: (k) => `T:${k}`, ivrAnalytics: {},
  walletOf: { collectionName: 'walletOf', findOne: async () => ({ _id: 'x', usdIn: 100, usdOut: 0 }), findOneAndUpdate: async () => ({}), updateOne: async () => ({}), s: { db } },
  payments: null, nanoid: () => 'n', selfUrl: 'http://localhost:5000',
})

const initiate = (cc) => vs.handleVoiceWebhook({ body: { data: { event_type: 'call.initiated', payload: {
  direction: 'outgoing', from: ORPHAN, to: DEST, call_control_id: cc, connection_id: 'conn-test',
  call_leg_id: cc + '-leg', from_sip_uri: `${ORPHAN}@sip.telnyx.com`,
} } } }, { sendStatus: () => {} })

;(async () => {
  vs._clearUnidentifiedFailure(ORPHAN)
  // Failures 1-3: identification fails → each reaches the failure branch (billable leg) → hangup + leak record
  for (let i = 1; i <= 3; i++) { await initiate('cc' + i); await new Promise(r => setTimeout(r, 400)) }
  ok(telnyx.hangup === 3, `failures 1-3 each hung up the billable leg (${telnyx.hangup})`)
  ok(leaks.length === 3, `failures 1-3 each recorded a cost-leak event (${leaks.length})`)
  ok(vs._isUnidentifiedBlocked(ORPHAN) === true, 'credential is BLOCKED after 3 consecutive failures')
  ok(leaks[2].blocked === true, 'the 3rd leak record is flagged blocked=true')

  // Failure 4+: now blocked → instant hangup BEFORE identification → NO failure-branch work, NO reverse lookup
  const listBefore = listCalls, hangupBefore = telnyx.hangup, leaksBefore = leaks.length
  await initiate('cc4'); await new Promise(r => setTimeout(r, 300))
  await initiate('cc5'); await new Promise(r => setTimeout(r, 300))
  ok(telnyx.hangup === hangupBefore + 2, `blocked calls still hung up instantly (${telnyx.hangup})`)
  ok(leaks.length === leaksBefore, `blocked calls short-circuit BEFORE identification — no extra work/leak rows (still ${leaks.length})`)
  ok(listCalls === listBefore, `blocked calls never trigger a reverse lookup (listSIPCredentials still ${listCalls})`)
  ok(telnyx.transfer === 0, `no PSTN transfer ever created for unidentified calls (${telnyx.transfer})`)

  // Self-heal: clearing (e.g. after success or 10-min expiry) unblocks
  vs._clearUnidentifiedFailure(ORPHAN)
  ok(vs._isUnidentifiedBlocked(ORPHAN) === false, 'block clears on success/expiry (self-heals transient failures)')

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED — unidentified-credential cost leak stopped, no false PSTN legs')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
