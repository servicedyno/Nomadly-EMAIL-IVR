// Refresh @johngambino sub-account token from Twilio source-of-truth (main account),
// compare to DB, and update if rotated. Read-only by default.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const twilioService = require('/app/js/twilio-service.js')

const CHAT_ID = '817673476'
const SUB_SID = 'AC01e40ee6bb868cc84290f122ae8b5d8c'
const CONFIRM = process.env.CONFIRM === 'YES_UPDATE_TOKEN'

;(async () => {
  // Pull current from Twilio (always source of truth)
  console.log('[1] Fetching current sub-account auth token from Twilio…')
  const live = await twilioService.getSubAccount(SUB_SID)
  if (live.error) throw new Error('Twilio fetch failed: ' + live.error)
  console.log('  status      :', live.status)
  console.log('  friendlyName:', live.friendlyName)
  console.log('  live token  :', live.authToken)

  // Pull what we have in DB
  const mongo = new MongoClient(process.env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db()
  const col = db.collection('phoneNumbersOf')
  const doc = await col.findOne({ _id: CHAT_ID })
  const dbToken = doc?.val?.twilioSubAccountToken
  console.log('\n[2] DB token   :', dbToken)

  const numberTokens = (doc?.val?.numbers || []).map(n => ({ phone: n.phoneNumber, token: n.twilioSubAccountToken }))
  console.log('  Per-number tokens:')
  numberTokens.forEach(t => console.log('   -', t.phone, '→', t.token))

  if (dbToken === live.authToken) {
    console.log('\n✅ Token MATCHES live Twilio — no update needed.')
  } else {
    console.log('\n⚠️  Token MISMATCH — Twilio token has been rotated since DB write.')
    if (!CONFIRM) {
      console.log('   Re-run with CONFIRM=YES_UPDATE_TOKEN to write live token into DB.')
    } else {
      const newNumbers = (doc.val.numbers || []).map(n =>
        n.twilioSubAccountSid === SUB_SID
          ? { ...n, twilioSubAccountToken: live.authToken, _subTokenRefreshedAt: new Date().toISOString() }
          : n
      )
      const res = await col.updateOne(
        { _id: CHAT_ID },
        { $set: {
          'val.twilioSubAccountToken': live.authToken,
          'val._twilioSubTokenRefreshedAt': new Date().toISOString(),
          'val.numbers': newNumbers,
        } }
      )
      console.log('   ✓ DB updated:', res.modifiedCount, 'doc(s).')
    }
  }

  // Also test that the live token actually works for an API call against the sub-account
  console.log('\n[3] Smoke-test live token via incomingPhoneNumbers.list on the sub-account')
  const twilio = require('twilio')
  const sub = twilio(SUB_SID, live.authToken)
  try {
    const owned = await sub.incomingPhoneNumbers.list({ limit: 10 })
    console.log('  ✅ Authenticated. Sub-account owns', owned.length, 'incoming number(s):')
    owned.forEach(n => console.log('   -', n.phoneNumber, 'sid=' + n.sid, 'voiceUrl=' + n.voiceUrl))
  } catch (e) {
    console.log('  ❌ Auth failed with live token:', e.message)
  }

  await mongo.close()
})().catch(e => { console.error(e); process.exit(1) })
