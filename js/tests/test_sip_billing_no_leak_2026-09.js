#!/usr/bin/env node
// Billing integrity after the D1 PSTN-leg-skip fix: prove NO leak and NO double-bill.
// Ground truth = walletLedger inserts (every real charge writes exactly one ledger row).
// Simulates the real auto-routed SIP outbound flow: A-leg initiated → B-leg initiated (marked, skipped)
// → A-leg hangup → duplicate A-leg hangup → B-leg hangup.
process.env.TELNYX_SIP_CONNECTION_ID = 'conn-test'
process.env.TELNYX_DEFAULT_ANI = '+18889999999'
process.env.CALL_CONNECTION_FEE = '0.03'

let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }
const b64 = s => Buffer.from(s).toString('base64')
const CHAT = '6587790422'
const ANI = '+18883304418'
const DEST = '+14155550123'
const SIPUSER = 'gencredCHEM'

// ── In-memory wallet + ledger (ground truth) ──
const ledger = []
const walletDoc = { _id: CHAT, usdIn: 100, usdOut: 0 }
const ledgerColl = {
  collectionName: 'walletLedger',
  findOne: async (q) => ledger.find(r => (q.callRef ? r.callRef === q.callRef : true) && (q.chatId ? r.chatId === q.chatId : true)) || null,
  insertOne: async (doc) => {
    if (doc.callRef && ledger.some(r => r.callRef === doc.callRef && r.chatId === doc.chatId)) {
      const e = new Error('dup'); e.code = 11000; throw e
    }
    ledger.push(doc); return { insertedId: doc._id }
  },
}
const genericColl = (name) => ({
  collectionName: name,
  findOne: async () => null, insertOne: async () => ({}), updateOne: async () => ({}),
  deleteOne: async () => ({}), deleteMany: async () => ({}), find: () => ({ toArray: async () => [], sort: () => ({ limit: () => ({ toArray: async () => [] }), toArray: async () => [] }) }),
})
const db = { collection: (name) => name === 'walletLedger' ? ledgerColl : genericColl(name) }
const walletOf = {
  collectionName: 'walletOf',
  s: { db },
  findOne: async (q) => (q._id === CHAT ? { ...walletDoc } : null),
  findOneAndUpdate: async (filter, update) => {
    const amt = update.$inc.usdOut
    const bal = (walletDoc.usdIn || 0) - (walletDoc.usdOut || 0)
    if (bal >= amt) { walletDoc.usdOut = +(walletDoc.usdOut + amt).toFixed(4); return { ...walletDoc } }
    return null
  },
  updateOne: async (filter, update) => { if (update.$inc?.usdOut != null) walletDoc.usdOut = +(walletDoc.usdOut + update.$inc.usdOut).toFixed(4); return {} },
}

const num = { phoneNumber: ANI, provider: 'telnyx', status: 'active', plan: 'pro', telnyxSipUsername: SIPUSER, sipUsername: SIPUSER, features: {} }
const phoneDoc = { _id: CHAT, val: { numbers: [num] } }

const telnyx = { transfer: 0, transferBodies: [], hangup: 0, answer: 0 }
const vs = require('../voice-service.js')
vs.initVoiceService({
  bot: { sendMessage: async () => true },
  phoneNumbersOf: {
    collectionName: 'phoneNumbersOf',
    find: () => ({ toArray: async () => [phoneDoc] }),
    findOne: async () => phoneDoc, updateOne: async () => ({}), s: { db },
  },
  phoneLogs: { insertOne: async () => {} },
  telnyxApi: {
    answerCall: async () => { telnyx.answer++; return true },
    hangupCall: async () => { telnyx.hangup++; return true },
    transferCall: async (cc, to, from, opts = {}) => { telnyx.transfer++; telnyx.transferBodies.push(opts); return {} },
    rejectCall: async () => true, speakOnCall: async () => true, listNumbers: async () => [],
  },
  telnyxResources: {},
  translation: (k) => `T:${k}`,
  ivrAnalytics: {},
  walletOf,
  payments: null,
  nanoid: () => 'nid' + Math.random().toString(36).slice(2, 8),
  selfUrl: 'http://localhost:5000',
})

const sum = (type) => ledger.filter(r => r.type === type).reduce((a, r) => a + r.amount, 0)
const count = (type) => ledger.filter(r => r.type === type).length
const webhook = (payload) => vs.handleVoiceWebhook({ body: { data: { event_type: payload._evt, payload } } }, { sendStatus: () => {} })

;(async () => {
  // ── 1. A-leg call.initiated → identify user, charge 1 connection fee, transfer (tagged) ──
  await webhook({ _evt: 'call.initiated', direction: 'outgoing', from: SIPUSER, to: DEST, call_control_id: 'ccA', connection_id: 'conn-test', call_leg_id: 'legA', from_sip_uri: `${SIPUSER}@sip.telnyx.com` })
  await new Promise(r => setTimeout(r, 500))
  ok(count('connection_fee') === 1, `A-leg: exactly 1 connection fee (${count('connection_fee')})`)
  ok(Math.abs(sum('connection_fee') - (-0.03)) < 1e-9, `A-leg: connection fee = -$0.03 (${sum('connection_fee')})`)
  ok(telnyx.transfer === 1, `A-leg: transferCall called once (${telnyx.transfer})`)
  ok(telnyx.transferBodies[0]?.targetLegClientState === vs.PSTN_LEG_STATE, `A-leg: transfer tags target leg with marker (${telnyx.transferBodies[0]?.targetLegClientState})`)

  // ── 2. B-leg call.initiated (marked) → MUST be skipped: no 2nd connection fee, no 2nd transfer ──
  const feeBefore = count('connection_fee'); const transferBefore = telnyx.transfer
  await webhook({ _evt: 'call.initiated', direction: 'outgoing', from: ANI, to: DEST, call_control_id: 'ccB', connection_id: 'conn-test', call_leg_id: 'legB', client_state: b64(vs.PSTN_LEG_STATE) })
  await new Promise(r => setTimeout(r, 400))
  ok(count('connection_fee') === feeBefore, `B-leg skipped: NO second connection fee (still ${count('connection_fee')})`)
  ok(telnyx.transfer === transferBefore, `B-leg skipped: NO second transfer (still ${telnyx.transfer})`)

  // ── 3. A-leg hangup (65s → 2 min) → exactly 1 outbound_call bill ──
  await webhook({ _evt: 'call.hangup', direction: 'outgoing', from: ANI, to: DEST, call_control_id: 'ccA', connection_id: 'conn-test', duration_secs: 65, hangup_cause: 'normal_clearing', hangup_source: 'callee' })
  await new Promise(r => setTimeout(r, 400))
  ok(count('outbound_call') === 1, `hangup: exactly 1 outbound_call bill (${count('outbound_call')})`)
  ok(Math.abs(sum('outbound_call') - (-0.30)) < 1e-9, `hangup: billed 2 min × $0.15 = -$0.30 (${sum('outbound_call')})`)

  // ── 4. Duplicate A-leg hangup webhook → idempotent, NO double bill ──
  await webhook({ _evt: 'call.hangup', direction: 'outgoing', from: ANI, to: DEST, call_control_id: 'ccA', connection_id: 'conn-test', duration_secs: 65, hangup_cause: 'normal_clearing', hangup_source: 'callee' })
  await new Promise(r => setTimeout(r, 300))
  ok(count('outbound_call') === 1, `duplicate hangup: still exactly 1 outbound_call (idempotent) (${count('outbound_call')})`)

  // ── 5. B-leg hangup (marked/untracked) → no bill ──
  const rowsBefore = ledger.length
  await webhook({ _evt: 'call.hangup', direction: 'outgoing', from: ANI, to: DEST, call_control_id: 'ccB', connection_id: 'conn-test', duration_secs: 65, hangup_cause: 'originator_cancel', hangup_source: 'caller', client_state: b64(vs.PSTN_LEG_STATE) })
  await new Promise(r => setTimeout(r, 300))
  ok(ledger.length === rowsBefore, `B-leg hangup: untracked, no extra ledger row (${ledger.length} vs ${rowsBefore})`)

  // ── 6. Grand total: exactly connection fee + 1 call = $0.33, wallet usdOut matches ledger ──
  const totalCharged = -(sum('connection_fee') + sum('outbound_call'))
  ok(Math.abs(totalCharged - 0.33) < 1e-9, `total charged = $0.33 (conn $0.03 + call $0.30) (${totalCharged.toFixed(4)})`)
  ok(Math.abs(walletDoc.usdOut - 0.33) < 1e-9, `wallet usdOut reconciles to ledger = $0.33 (${walletDoc.usdOut})`)
  ok(ledger.length === 2, `exactly 2 ledger rows total — no leak, no double (${ledger.length})`)

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED — billing correct, no leak, no double-charge')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
