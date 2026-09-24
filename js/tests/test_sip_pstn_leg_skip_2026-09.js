#!/usr/bin/env node
// D1 fix: the outbound PSTN leg created by our Telnyx `transfer` must NOT re-enter the SIP routing
// pipeline (no 250-credential reverse lookup, no wrong-user resolution, no re-transfer). We tag the
// new leg with target_leg_client_state and skip it in handleCallInitiated (plus a short-TTL guard).
process.env.TELNYX_SIP_CONNECTION_ID = process.env.TELNYX_SIP_CONNECTION_ID || 'conn-test'
process.env.TELNYX_DEFAULT_ANI = '+18889999999'

let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }
const b64 = s => Buffer.from(s).toString('base64')

// ── 1. telnyx-service.transferCall maps targetLegClientState → base64 target_leg_client_state ──
const axios = require('axios')
const posts = []
const origPost = axios.post
axios.post = async (url, body) => { posts.push({ url, body }); return { data: { data: { call_control_id: 'newleg' } } } }
const tx = require('../telnyx-service.js')
;(async () => {
  await tx.transferCall('ccA', '+14155550100', '+18883304418', { targetLegClientState: 'nomadly_pstn_leg' })
  const tbody = posts[0]?.body || {}
  ok(posts.length === 1 && /\/actions\/transfer$/.test(posts[0].url), 'transferCall POSTed to /actions/transfer')
  ok(tbody.target_leg_client_state === b64('nomadly_pstn_leg'), `target_leg_client_state is base64 of marker (${tbody.target_leg_client_state})`)
  ok(tbody.from === '+18883304418' && tbody.to === '+14155550100', 'transfer keeps per-call ANI + destination')
  // no targetLegClientState → field omitted
  posts.length = 0
  await tx.transferCall('ccB', '+14155550100', '+18883304418')
  ok(posts[0] && posts[0].body.target_leg_client_state === undefined, 'no marker option → target_leg_client_state omitted (no regression)')
  axios.post = origPost

  // ── 2. _isSelfPstnLeg / _markSelfPstnLeg logic ──
  const vs = require('../voice-service.js')
  ok(vs.PSTN_LEG_STATE === 'nomadly_pstn_leg', 'PSTN_LEG_STATE marker value')
  ok(vs._isSelfPstnLeg({ client_state: b64(vs.PSTN_LEG_STATE) }) === true, 'client_state marker → self PSTN leg')
  ok(vs._isSelfPstnLeg({ client_state: b64('something_else') }) === false, 'other client_state → not self leg')
  ok(vs._isSelfPstnLeg({ client_state: null, connection_id: 'c1', to: '+14155550100', from: '+18883304418' }) === false, 'no marker + no guard → not self leg')
  vs._markSelfPstnLeg('c1', '+14155550100', '+18883304418')
  ok(vs._isSelfPstnLeg({ connection_id: 'c1', to: '+14155550100', from: '+18883304418' }) === true, 'guard hit → self leg (backup signal)')
  ok(vs._isSelfPstnLeg({ connection_id: 'c1', to: '+14155550100', from: '+18883304418' }) === false, 'guard is single-use (deleted after hit)')

  // ── 3. handleVoiceWebhook: marked B-leg is skipped; unmarked leg still processed ──
  const txmod = require('../telnyx-service.js')
  let listCalls = 0
  txmod.listSIPCredentials = async () => { listCalls++; return [] }
  const telnyx = { answer: 0, hangup: 0, transfer: 0 }
  let walletDeducts = 0
  vs.initVoiceService({
    bot: { sendMessage: async () => true },
    phoneNumbersOf: { find: () => ({ toArray: async () => [] }), findOne: async () => null, updateOne: async () => ({}) },
    phoneLogs: { insertOne: async () => {} },
    telnyxApi: {
      answerCall: async () => { telnyx.answer++; return true },
      hangupCall: async () => { telnyx.hangup++; return true },
      transferCall: async () => { telnyx.transfer++; return {} },
      rejectCall: async () => true, speakOnCall: async () => true, listNumbers: async () => [],
    },
    telnyxResources: {},
    translation: (k) => `T:${k}`,
    ivrAnalytics: {},
    walletOf: { findOne: async () => ({ _id: 'x', usdIn: 50, usdOut: 0 }), findOneAndUpdate: async () => { walletDeducts++; return { usdIn: 50, usdOut: 0.03 } }, updateOne: async () => { walletDeducts++; return {} }, s: {} },
    payments: {},
    nanoid: () => 'n',
    selfUrl: 'http://localhost:5000',
  })

  const legPayload = (extra) => ({ body: { data: { event_type: 'call.initiated', payload: {
    direction: 'outgoing', from: '+18883304418', to: '+14155550100', call_control_id: 'cc-bleg',
    connection_id: process.env.TELNYX_SIP_CONNECTION_ID, call_leg_id: 'leg-b', ...extra,
  } } } })

  // marked leg → skipped: no reverse lookup, no transfer, no answer, no wallet deduction
  listCalls = 0; telnyx.transfer = 0; telnyx.answer = 0; walletDeducts = 0
  await vs.handleVoiceWebhook(legPayload({ client_state: b64(vs.PSTN_LEG_STATE) }), { sendStatus: () => {} })
  await new Promise(r => setTimeout(r, 400))
  ok(listCalls === 0, `marked PSTN leg → NO 250-credential reverse lookup (listSIPCredentials calls=${listCalls})`)
  ok(telnyx.transfer === 0, `marked PSTN leg → no re-transfer (${telnyx.transfer})`)
  ok(telnyx.answer === 0, `marked PSTN leg → no answer (${telnyx.answer})`)
  ok(walletDeducts === 0, `marked PSTN leg → no wallet charge (${walletDeducts})`)

  // unmarked leg (no client_state, no guard) → NOT skipped → reverse lookup runs (proves skip is marker-driven)
  listCalls = 0
  await vs.handleVoiceWebhook(legPayload({ client_state: null }), { sendStatus: () => {} })
  await new Promise(r => setTimeout(r, 600))
  ok(listCalls >= 1, `unmarked leg → reverse lookup DID run (listSIPCredentials calls=${listCalls}) — skip is specific to our own legs`)

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
