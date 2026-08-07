// READ-ONLY: locate @Topgass1's cloud number + its Twilio sub-account, and the forwarding target.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const twilio = require('twilio')

;(async()=>{
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const coll = db.collection('phoneNumbersOf')

  // Find any doc whose numbers reference the caller (+3197006532350) or forward to +31626742533
  const targets = ['3197006532350', '31626742533', '626742533']
  const q = { $or: targets.flatMap(t => ([
    { 'val.numbers.phoneNumber': { $regex: t } },
    { 'val.numbers.forwardingNumber': { $regex: t } },
    { 'val.numbers.forwarding': { $regex: t } },
  ])) }
  const docs = await coll.find(q).limit(10).toArray()
  console.log('Matched phoneNumbersOf docs:', docs.length)

  const subSids = new Set()
  for (const d of docs) {
    const nums = (d.val && d.val.numbers) || []
    console.log('\nchatId(_id):', d._id, '| numbers:', nums.length)
    for (const n of nums) {
      const relevant = targets.some(t =>
        String(n.phoneNumber||'').includes(t) ||
        String(n.forwardingNumber||'').includes(t) ||
        String(n.forwarding||'').includes(t) ||
        JSON.stringify(n).includes(t))
      if (!relevant) continue
      const sid = n.twilioSubAccountSid || (d.val && d.val.twilioSubAccountSid)
      if (sid) subSids.add(sid)
      console.log('   number:', n.phoneNumber,
        '| provider:', n.provider,
        '| fwd:', n.forwardingNumber || n.forwarding || '(none)',
        '| fwdEnabled:', n.forwardingEnabled,
        '| subSid:', sid ? sid.slice(0,10)+'...' : '(none)')
    }
  }

  // Check NL dialing permissions on each involved sub-account
  const mainSid = process.env.TWILIO_ACCOUNT_SID, authToken = process.env.TWILIO_AUTH_TOKEN
  const master = twilio(mainSid, authToken)
  for (const sid of subSids) {
    try {
      // fetch sub-account auth token via master, then query its dialing perms
      const sub = await master.api.accounts(sid).fetch()
      const subClient = twilio(sid, sub.authToken)
      const nl = await subClient.voice.v1.dialingPermissions.countries('NL').fetch()
      console.log(`\n=== SUB-ACCOUNT ${sid} (${sub.status}) NL dialing perms ===`)
      console.log('  lowRiskNumbersEnabled:', nl.lowRiskNumbersEnabled)
      console.log('  highRiskSpecialNumbersEnabled:', nl.highRiskSpecialNumbersEnabled)
      console.log('  highRiskTollfraudNumbersEnabled:', nl.highRiskTollfraudNumbersEnabled)
    } catch(e) {
      console.log(`\nSUB ${sid} perms err:`, e.status, e.message)
    }
  }

  await client.close()
  process.exit(0)
})().catch(e=>{ console.log('FATAL', e.message); process.exit(1) })
