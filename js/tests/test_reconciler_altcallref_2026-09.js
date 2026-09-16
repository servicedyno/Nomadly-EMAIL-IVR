#!/usr/bin/env node
// Reconciler regression (prod audit 2026-09-16, F3):
//  - bridge rows carry altCallRef (Telnyx leg) and reconcile as already-billed when that leg charged
//  - fetchTwilioLegDuration falls back to the MASTER account when the sub-account has no children
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const recon = require('../call-billing-reconciler.js')
const twilioService = require('../twilio-service.js')

let fails = 0
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++ }
const ts = Date.now()
const P = `RECONALT_${ts}_`

;(async () => {
  const client = await MongoClient.connect(process.env.MONGO_URL)
  const db = client.db(process.env.DB_NAME)
  recon.init({ db, logger: () => {} })
  const pending = db.collection('pendingCallBills'), ledger = db.collection('walletLedger')
  const old = new Date(ts - 20 * 60 * 1000)
  try {
    // Row A: bridge, Telnyx leg billed under altCallRef → reconciled, settledVia other_leg
    await recon.recordPendingBill({ callRef: `${P}twA`, altCallRef: `${P}telnyxA`, chatId: '777000001', phoneNumber: '+18005550001', destination: '+14155550001', callType: 'Twilio_SIP_Bridge', provider: 'twilio', subAccountSid: null })
    await pending.updateOne({ _id: `${P}twA` }, { $set: { createdAt: old } })
    await ledger.insertOne({ _id: `${P}ledA`, chatId: '777000001', callRef: `${P}telnyxA`, amount: -0.30, type: 'outbound_call', timestamp: new Date() })
    const rowA = await pending.findOne({ _id: `${P}twA` })
    ok(rowA?.altCallRef === `${P}telnyxA` && rowA?.subAccountSid === null, 'recordPendingBill persists altCallRef + null subAccountSid')

    // Row B: forward billed by webhook under its own callRef → reconciled via webhook
    await recon.recordPendingBill({ callRef: `${P}twB`, chatId: '777000002', phoneNumber: '+18005550002', destination: '+14155550002', callType: 'Twilio_Forwarding', provider: 'twilio' })
    await pending.updateOne({ _id: `${P}twB` }, { $set: { createdAt: old } })
    await ledger.insertOne({ _id: `${P}ledB`, chatId: '777000002', callRef: `${P}twB`, amount: -0.15, type: 'outbound_call', timestamp: new Date() })

    // Row C: bridge, NO ledger on either leg, no Twilio client in test → indeterminate → needs_review (NOT billed)
    const realGetClient = twilioService.getClient
    twilioService.getClient = () => null
    await recon.recordPendingBill({ callRef: `${P}twC`, altCallRef: `${P}telnyxC`, chatId: '777000003', phoneNumber: '+18005550003', destination: '+14155550003', callType: 'Twilio_SIP_Bridge', provider: 'twilio', subAccountSid: null })
    await pending.updateOne({ _id: `${P}twC` }, { $set: { createdAt: old } })

    const r = await recon.sweepPendingBills({ dryRun: false, graceMinutes: 5, maxAgeHours: 72, callRefPrefix: P })
    twilioService.getClient = realGetClient
    ok(r.scanned === 3, `scanned 3 rows (${r.scanned})`)
    ok(r.reconciledByWebhook === 2, `2 rows reconciled as already billed (${r.reconciledByWebhook})`)
    ok(r.settled === 0 && r.needsReview === 1, `bridge row without any ledger → needs_review, not auto-billed (settled=${r.settled}, needsReview=${r.needsReview})`)
    const a = await pending.findOne({ _id: `${P}twA` }), b = await pending.findOne({ _id: `${P}twB` }), c = await pending.findOne({ _id: `${P}twC` })
    ok(a?.status === 'settled' && a?.settledVia === 'other_leg', `bridge row settled via other_leg (${a?.status}/${a?.settledVia})`)
    ok(b?.status === 'settled' && b?.settledVia === 'webhook', `forward row settled via webhook (${b?.status}/${b?.settledVia})`)
    ok(c?.status === 'needs_review', `unbilled bridge row → needs_review (${c?.status})`)

    // fetchTwilioLegDuration: sub-account empty → master fallback
    const calls = []
    twilioService.getClient = () => ({
      calls: { list: async (q) => { calls.push('master'); return [{ status: 'completed', duration: '95' }] } },
      api: { v2010: { accounts: () => ({ calls: { list: async () => { calls.push('sub'); return [] } } }) } },
    })
    const legs = await recon.fetchTwilioLegDuration('CAparent', 'ACsub')
    twilioService.getClient = realGetClient
    ok(legs?.connected === true && legs.seconds === 95 && calls.join(',') === 'sub,master', `master-account fallback finds bridge child leg (${JSON.stringify(legs)}; lookups=${calls.join(',')})`)
  } finally {
    await pending.deleteMany({ _id: { $regex: `^${P}` } })
    await ledger.deleteMany({ _id: { $regex: `^${P}` } })
    await client.close()
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
