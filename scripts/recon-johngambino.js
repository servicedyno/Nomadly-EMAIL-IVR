/**
 * READ-ONLY recon for restoring @johngambino's Pro plan.
 * No writes. Just inspects production state.
 */
require('dotenv').config()
const { MongoClient } = require('mongodb')
const twilio = require('twilio')

const CHAT_ID = '817673476'  // @johngambino per test_result.md
const TARGET_NUMBER = '+18884879051'

async function fetchProdMongoUrl() {
  const TOKEN = process.env.RAILWAY_PROJECT_TOKEN
  const PID = process.env.RAILWAY_PROJECT_ID
  const EID = process.env.RAILWAY_ENVIRONMENT_ID
  const SID = process.env.RAILWAY_SERVICE_ID
  const body = JSON.stringify({
    query: `query { variables(projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}") }`
  })
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    body,
  })
  const data = await res.json()
  const v = data?.data?.variables || {}
  return { mongoUrl: v.MONGO_URL, dbName: v.DB_NAME, twilioSid: v.TWILIO_ACCOUNT_SID, twilioToken: v.TWILIO_AUTH_TOKEN }
}

;(async () => {
  console.log('━'.repeat(70))
  console.log('  RECON: @johngambino Pro plan restoration — production')
  console.log('━'.repeat(70))

  const { mongoUrl, dbName, twilioSid: prodTwilioSid, twilioToken: prodTwilioToken } = await fetchProdMongoUrl()
  console.log(`Prod DB: ${dbName} (${mongoUrl ? mongoUrl.split('@')[1]?.split('/')[0] : 'NO URL'})`)
  console.log(`Prod Twilio main: ${prodTwilioSid ? prodTwilioSid.substring(0, 10) + '...' : 'NOT SET'}`)

  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db(dbName)

  // 1. Identify user
  console.log('\n── 1. nameOf ──')
  const name = await db.collection('nameOf').findOne({ _id: CHAT_ID })
  console.log(`name = ${JSON.stringify(name?.val)}`)

  console.log('\n── 1b. usernameOf ──')
  const uname = await db.collection('usernameOf').findOne({ _id: CHAT_ID })
  console.log(`username = ${JSON.stringify(uname?.val)}`)

  // 2. Check current phoneNumbersOf
  console.log('\n── 2. phoneNumbersOf (FULL doc) ──')
  const pn = await db.collection('phoneNumbersOf').findOne({ _id: CHAT_ID })
  if (!pn) {
    console.log('  ⚠️  NO phoneNumbersOf doc exists for this user')
  } else {
    const v = pn.val || {}
    console.log(`  twilioSubAccountSid:    ${v.twilioSubAccountSid || '(none)'}`)
    console.log(`  twilioSubAccountToken:  ${v.twilioSubAccountToken ? v.twilioSubAccountToken.substring(0, 8) + '...' : '(none)'}`)
    console.log(`  twilioAddresses:        ${JSON.stringify(v.twilioAddresses || {})}`)
    console.log(`  numbers (count):        ${(v.numbers || []).length}`)
    ;(v.numbers || []).forEach((n, i) => {
      console.log(`    [${i}] ${n.phoneNumber} | plan=${n.plan} | price=$${n.planPrice} | status=${n.status} | provider=${n.provider} | expires=${n.expiresAt}`)
      console.log(`        twilioNumberSid=${n.twilioNumberSid} sipUser=${n.sipUsername}`)
    })
  }

  // 3. Check planOf / planEndingTime (legacy global plan tracking)
  console.log('\n── 3. planOf / planEndingTime (legacy) ──')
  console.log(`planOf:           ${JSON.stringify((await db.collection('planOf').findOne({ _id: CHAT_ID }))?.val)}`)
  console.log(`planEndingTime:   ${JSON.stringify((await db.collection('planEndingTime').findOne({ _id: CHAT_ID }))?.val)}`)

  // 4. Wallet
  console.log('\n── 4. walletOf ──')
  const wallet = await db.collection('walletOf').findOne({ _id: CHAT_ID })
  if (wallet) {
    const w = wallet.val || {}
    console.log(`  usdIn:  ${w.usdIn || 0}`)
    console.log(`  usdOut: ${w.usdOut || 0}`)
    console.log(`  bal:    $${((w.usdIn || 0) - (w.usdOut || 0)).toFixed(2)}`)
  } else {
    console.log('  (no wallet doc)')
  }

  // 5. phoneTransactions for this chatId
  console.log('\n── 5. phoneTransactions (last 10) ──')
  const txns = await db.collection('phoneTransactions')
    .find({ chatId: CHAT_ID }).sort({ timestamp: -1 }).limit(10).toArray()
  txns.forEach(t => console.log(`  ${t.timestamp} | ${t.action} | ${t.phoneNumber} | plan=${t.plan} | $${t.amount} | via ${t.paymentMethod}`))
  if (!txns.length) console.log('  (no records)')

  // 6. Phone logs for the target number (any historic activity?)
  console.log('\n── 6. phoneLogs sample for target number (last 5) ──')
  const logs = await db.collection('phoneLogs')
    .find({ $or: [{ from: TARGET_NUMBER }, { to: TARGET_NUMBER }] })
    .sort({ timestamp: -1 }).limit(5).toArray()
  logs.forEach(l => console.log(`  ${l.timestamp} | ${l.type || l.action} | from=${l.from} to=${l.to}`))
  if (!logs.length) console.log('  (no logs)')

  // 7. Twilio API: look up sub-account + number SID using PROD Twilio creds
  if (prodTwilioSid && prodTwilioToken) {
    console.log('\n── 7. Twilio API (prod creds) ──')
    const main = twilio(prodTwilioSid, prodTwilioToken)

    // Find sub-account by friendly name pattern
    let subAcc = null
    try {
      const subs = await main.api.v2010.accounts.list({ friendlyName: undefined, limit: 200 })
      const matches = subs.filter(s => s.friendlyName && s.friendlyName.includes(CHAT_ID))
      console.log(`  sub-accounts matching "${CHAT_ID}" in friendlyName: ${matches.length}`)
      matches.forEach(s => console.log(`    SID=${s.sid} status=${s.status} friendlyName="${s.friendlyName}" dateCreated=${s.dateCreated}`))
      // Pick the active one
      subAcc = matches.find(s => s.status === 'active') || matches[0]
    } catch (e) {
      console.log(`  ⚠️  Could not list sub-accounts: ${e.message}`)
    }

    if (subAcc) {
      console.log(`  >>> using sub-account ${subAcc.sid}`)
      // Need the auth token — we can fetch it via the main account's view
      try {
        const subFull = await main.api.v2010.accounts(subAcc.sid).fetch()
        console.log(`  sub authToken (first 8): ${subFull.authToken?.substring(0, 8)}...`)
        const subClient = twilio(subAcc.sid, subFull.authToken)
        // List incoming numbers
        const nums = await subClient.incomingPhoneNumbers.list({ limit: 100 })
        console.log(`  incoming numbers on sub: ${nums.length}`)
        nums.forEach(n => console.log(`    ${n.phoneNumber} | sid=${n.sid} | friendlyName="${n.friendlyName}" | smsUrl=${n.smsUrl?.substring(0, 50)}`))
        const target = nums.find(n => n.phoneNumber === TARGET_NUMBER)
        if (target) {
          console.log(`  ✅ FOUND ${TARGET_NUMBER} on this sub-account: SID=${target.sid}`)
          console.log(`     voiceUrl=${target.voiceUrl}`)
          console.log(`     statusCallback=${target.statusCallback}`)
          console.log(`     smsUrl=${target.smsUrl}`)
          console.log(`     capabilities=${JSON.stringify(target.capabilities)}`)
        } else {
          console.log(`  ⚠️  ${TARGET_NUMBER} NOT on sub-account ${subAcc.sid}`)
        }

        // List existing SIP credentials so we don't have to create new ones if they exist
        try {
          const credLists = await subClient.sip.credentialLists.list({ limit: 50 })
          console.log(`  sip credential lists: ${credLists.length}`)
          for (const cl of credLists) {
            const creds = await subClient.sip.credentialLists(cl.sid).credentials.list({ limit: 50 })
            console.log(`    list ${cl.sid} (${cl.friendlyName}): ${creds.length} creds`)
            creds.forEach(c => console.log(`      username=${c.username}`))
          }
        } catch (e) { console.log(`  sip cred list err: ${e.message}`) }
      } catch (e) { console.log(`  sub-account fetch err: ${e.message}`) }
    } else {
      console.log(`  ⚠️  No Twilio sub-account contains "${CHAT_ID}" in friendlyName`)
      // Fallback: search for the number on the main account
      try {
        const mainNums = await main.incomingPhoneNumbers.list({ phoneNumber: TARGET_NUMBER, limit: 5 })
        console.log(`  main account search for ${TARGET_NUMBER}: ${mainNums.length} matches`)
        mainNums.forEach(n => console.log(`    sid=${n.sid} on account ${n.accountSid}`))
      } catch (e) { console.log(`  main account search err: ${e.message}`) }
    }
  }

  await client.close()
  console.log('\n' + '━'.repeat(70))
  console.log('  RECON COMPLETE — NO WRITES PERFORMED')
  console.log('━'.repeat(70))
})().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
