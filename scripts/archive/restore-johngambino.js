/**
 * RESTORE @johngambino's Pro plan for Cloud IVR
 *
 * - User: chatId 817673476
 * - Number: +18884879051 on Twilio sub-account AC01e40ee6bb868cc84290f122ae8b5d8c
 * - Plan: pro ($15/mo, 1 month from today)
 * - Wallet: NOT debited (admin restoration)
 * - SIP: fresh credentials created on Telnyx + Twilio, mirroring purchase flow
 *
 * Modes:
 *   node scripts/restore-johngambino.js               # dry-run (default, no writes)
 *   node scripts/restore-johngambino.js --write       # execute everything
 *
 * Idempotent — if phoneNumbersOf.817673476 already exists with the number, aborts.
 */

require('dotenv').config()
const { MongoClient } = require('mongodb')
const twilio = require('twilio')
const axios = require('axios')

const CHAT_ID = '817673476'
const TARGET_NUMBER = '+18884879051'
const TWILIO_SUB_SID = 'AC01e40ee6bb868cc84290f122ae8b5d8c'
const TWILIO_NUMBER_SID = 'PN9e2d59c7d2013af0e307e6b0f2603365'
const PLAN_KEY = 'pro'
const PLAN_PRICE = 15
const WRITE_MODE = process.argv.includes('--write')

const phoneConfig = require('../js/phone-config.js')

async function fetchRailwayEnv() {
  const TOKEN = process.env.RAILWAY_PROJECT_TOKEN
  const PID = process.env.RAILWAY_PROJECT_ID
  const EID = process.env.RAILWAY_ENVIRONMENT_ID
  const SID = process.env.RAILWAY_SERVICE_ID
  const body = JSON.stringify({
    query: `query { variables(projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}") }`,
  })
  const res = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    body,
  })
  const data = await res.json()
  return data?.data?.variables || {}
}

async function createTelnyxSipCredential(apiKey, connectionId, username, password) {
  try {
    const res = await axios.post(
      'https://api.telnyx.com/v2/telephony_credentials',
      { connection_id: connectionId, sip_username: username, sip_password: password },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    )
    return res.data?.data || null
  } catch (e) {
    return { _error: e.response?.data || e.message }
  }
}

;(async () => {
  console.log('═'.repeat(72))
  console.log(`  RESTORE @johngambino — chatId ${CHAT_ID} — ${WRITE_MODE ? '🔴 WRITE MODE' : '🟢 DRY RUN'}`)
  console.log('═'.repeat(72))

  // ── Step 1: Fetch prod env ──
  console.log('\n[1/9] Fetching prod env from Railway...')
  const env = await fetchRailwayEnv()
  const required = ['MONGO_URL', 'DB_NAME', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TELNYX_API_KEY', 'TELNYX_SIP_CONNECTION_ID']
  const missing = required.filter(k => !env[k])
  if (missing.length) {
    console.error(`  ❌ Missing required env vars on Railway: ${missing.join(', ')}`)
    process.exit(1)
  }
  const SIP_DOMAIN = env.SIP_DOMAIN || 'sip.speechcue.com'
  console.log(`  ✅ MONGO_URL host=${env.MONGO_URL.split('@')[1]?.split('/')[0]}, DB=${env.DB_NAME}`)
  console.log(`  ✅ TWILIO_ACCOUNT_SID=${env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`)
  console.log(`  ✅ TELNYX_API_KEY=${env.TELNYX_API_KEY.substring(0, 8)}..., SIP_CONNECTION_ID=${env.TELNYX_SIP_CONNECTION_ID}`)
  console.log(`  ✅ SIP_DOMAIN=${SIP_DOMAIN}`)

  // ── Step 2: Connect to Mongo & re-verify pre-conditions ──
  console.log('\n[2/9] Connecting to prod Mongo & re-verifying pre-conditions...')
  const mongo = new MongoClient(env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db(env.DB_NAME)

  const nameDoc = await db.collection('nameOf').findOne({ _id: CHAT_ID })
  if (nameDoc?.val !== 'johngambino') {
    console.error(`  ❌ nameOf.${CHAT_ID} = ${JSON.stringify(nameDoc?.val)} (expected "johngambino"). Aborting.`)
    await mongo.close(); process.exit(1)
  }
  console.log(`  ✅ nameOf.${CHAT_ID} = "johngambino"`)

  const existingPN = await db.collection('phoneNumbersOf').findOne({ _id: CHAT_ID })
  if (existingPN) {
    const hasNumber = (existingPN.val?.numbers || []).some(n => n.phoneNumber === TARGET_NUMBER)
    if (hasNumber) {
      console.error(`  ❌ phoneNumbersOf.${CHAT_ID} ALREADY contains ${TARGET_NUMBER}. Aborting (idempotency check).`)
      console.error(`     Existing entry:`, JSON.stringify((existingPN.val?.numbers || []).find(n => n.phoneNumber === TARGET_NUMBER), null, 2))
      await mongo.close(); process.exit(1)
    }
    console.log(`  ⚠️  phoneNumbersOf.${CHAT_ID} exists with ${(existingPN.val?.numbers || []).length} number(s) but not ${TARGET_NUMBER} — will append.`)
  } else {
    console.log(`  ✅ phoneNumbersOf.${CHAT_ID} does NOT exist — will create fresh doc.`)
  }

  // ── Step 3: Verify Twilio sub-account + number ──
  console.log('\n[3/9] Verifying Twilio sub-account + number...')
  const mainTw = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  const sub = await mainTw.api.v2010.accounts(TWILIO_SUB_SID).fetch()
  if (sub.status !== 'active') {
    console.error(`  ❌ Sub-account ${TWILIO_SUB_SID} status=${sub.status}. Aborting.`)
    await mongo.close(); process.exit(1)
  }
  console.log(`  ✅ Sub-account active: ${sub.sid} ("${sub.friendlyName}")`)
  const subToken = sub.authToken
  const subTw = twilio(TWILIO_SUB_SID, subToken)
  const num = await subTw.incomingPhoneNumbers(TWILIO_NUMBER_SID).fetch()
  if (num.phoneNumber !== TARGET_NUMBER) {
    console.error(`  ❌ Number SID ${TWILIO_NUMBER_SID} resolves to ${num.phoneNumber}, not ${TARGET_NUMBER}. Aborting.`)
    await mongo.close(); process.exit(1)
  }
  console.log(`  ✅ Number ${TARGET_NUMBER} present on sub-account, SID=${num.sid}`)

  // ── Step 4: Discover Twilio main credential list ──
  console.log('\n[4/9] Discovering Twilio main credential list...')
  const credLists = await mainTw.sip.credentialLists.list({ limit: 20 })
  const credList = credLists.find(cl => cl.friendlyName?.includes('Speechcue'))
              || credLists.find(cl => cl.friendlyName?.includes('Nomadly'))
  if (!credList) {
    console.error(`  ❌ No Speechcue/Nomadly credential list on main account. Aborting.`)
    await mongo.close(); process.exit(1)
  }
  console.log(`  ✅ Credential list: ${credList.sid} ("${credList.friendlyName}")`)

  // ── Step 5: Generate seed creds ──
  console.log('\n[5/9] Generating seed SIP credentials...')
  const seedUser = phoneConfig.generateSipUsername()
  const seedPass = phoneConfig.generateSipPassword()
  console.log(`  seed username: ${seedUser}`)
  console.log(`  seed password: ${seedPass.substring(0, 6)}***${seedPass.slice(-3)} (${seedPass.length} chars)`)

  // ── Step 6: Create Telnyx SIP credential ──
  console.log('\n[6/9] Creating Telnyx SIP credential...')
  let telnyxSipUsername = null, telnyxSipPassword = null, telnyxCredentialId = null
  if (WRITE_MODE) {
    const telnyxCred = await createTelnyxSipCredential(env.TELNYX_API_KEY, env.TELNYX_SIP_CONNECTION_ID, seedUser, seedPass)
    if (!telnyxCred || telnyxCred._error) {
      console.error(`  ❌ Telnyx credential creation failed:`, telnyxCred?._error)
      await mongo.close(); process.exit(1)
    }
    telnyxSipUsername = telnyxCred.sip_username
    telnyxSipPassword = telnyxCred.sip_password || seedPass
    telnyxCredentialId = telnyxCred.id
    console.log(`  ✅ Telnyx cred created: id=${telnyxCredentialId}, sip_username=${telnyxSipUsername}`)
  } else {
    console.log(`  🟡 DRY RUN — would call POST https://api.telnyx.com/v2/telephony_credentials`)
    console.log(`         body: {connection_id: ${env.TELNYX_SIP_CONNECTION_ID}, sip_username: ${seedUser}, sip_password: ***}`)
    telnyxSipUsername = `<would-be-assigned-by-telnyx>`
    telnyxSipPassword = seedPass
    telnyxCredentialId = `<would-be-assigned-by-telnyx>`
  }

  // ── Step 7: Create Twilio SIP credential ──
  console.log('\n[7/9] Creating Twilio SIP credential...')
  if (WRITE_MODE) {
    try {
      const twCred = await mainTw.sip.credentialLists(credList.sid).credentials.create({
        username: seedUser,
        password: seedPass,
      })
      console.log(`  ✅ Twilio cred created: ${twCred.sid} (username=${twCred.username})`)
    } catch (e) {
      // If the username already exists (collision), that's OK for our purposes — Telnyx is primary
      console.error(`  ⚠️  Twilio credential creation failed (non-fatal): ${e.message}`)
    }
  } else {
    console.log(`  🟡 DRY RUN — would create credential on list ${credList.sid} with username=${seedUser}`)
  }

  // ── Step 8: Build numberDoc & full doc ──
  console.log('\n[8/9] Building numberDoc...')
  const sipUsername = telnyxSipUsername  // Telnyx username is the primary (sip.speechcue.com domain)
  const sipPassword = telnyxSipPassword
  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + 1)
  const now = new Date()

  const numberDoc = {
    phoneNumber: TARGET_NUMBER,
    telnyxOrderId: null,
    twilioNumberSid: TWILIO_NUMBER_SID,
    twilioSubAccountSid: TWILIO_SUB_SID,
    provider: 'twilio',
    country: 'US',
    countryName: 'United States',
    type: 'tollfree',
    plan: PLAN_KEY,
    planPrice: PLAN_PRICE,
    purchaseDate: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    autoRenew: true,
    status: 'active',
    sipUsername,
    sipPassword,
    telnyxSipUsername,
    telnyxSipPassword,
    telnyxCredentialId,
    sipDomain: SIP_DOMAIN,
    messagingProfileId: null,
    connectionId: null,
    addressSid: null,
    numberSurcharge: 0,
    smsUsed: 0,
    minutesUsed: 0,
    capabilities: { voice: true, sms: true, fax: false, mms: true },
    features: {
      sms: true,
      callForwarding: { enabled: false, mode: 'disabled', forwardTo: null, ringTimeout: 25 },
      voicemail: { enabled: false, greetingType: 'default', customGreetingUrl: null, forwardToTelegram: true, forwardToEmail: null, ringTimeout: 25 },
      smsForwarding: { toTelegram: true, toEmail: null, webhookUrl: null },
      recording: false,
    },
    _restoredAt: now.toISOString(),
    _restorationNote: 'Manual restoration of Pro plan — wallet debit skipped per admin request',
  }

  console.log('\n  numberDoc to be written:')
  console.log('  ' + JSON.stringify(numberDoc, null, 2).split('\n').join('\n  '))

  // Compute the final phoneNumbersOf doc
  let finalDoc
  if (existingPN) {
    finalDoc = { ...existingPN.val }
    if (!finalDoc.twilioSubAccountSid) finalDoc.twilioSubAccountSid = TWILIO_SUB_SID
    if (!finalDoc.twilioSubAccountToken) finalDoc.twilioSubAccountToken = subToken
    finalDoc.numbers = [...(finalDoc.numbers || []), numberDoc]
  } else {
    finalDoc = {
      twilioSubAccountSid: TWILIO_SUB_SID,
      twilioSubAccountToken: subToken,
      numbers: [numberDoc],
    }
  }

  const txnDoc = {
    chatId: CHAT_ID,
    phoneNumber: TARGET_NUMBER,
    action: 'purchase',
    plan: PLAN_KEY,
    amount: PLAN_PRICE,
    paymentMethod: 'wallet (restoration — no debit)',
    timestamp: now.toISOString(),
    _restoration: true,
    _restoredBy: 'admin via emergent agent',
  }
  console.log('\n  phoneTransactions doc to be inserted:')
  console.log('  ' + JSON.stringify(txnDoc, null, 2).split('\n').join('\n  '))

  // ── Step 9: Write or dry-run summary ──
  console.log('\n[9/9] Writing to MongoDB...')
  if (WRITE_MODE) {
    await db.collection('phoneNumbersOf').replaceOne(
      { _id: CHAT_ID },
      { _id: CHAT_ID, val: finalDoc },
      { upsert: true },
    )
    await db.collection('phoneTransactions').insertOne(txnDoc)
    console.log(`  ✅ Wrote phoneNumbersOf.${CHAT_ID}`)
    console.log(`  ✅ Inserted phoneTransactions record`)

    // Verify by reading back
    const readback = await db.collection('phoneNumbersOf').findOne({ _id: CHAT_ID })
    const restoredNum = (readback.val?.numbers || []).find(n => n.phoneNumber === TARGET_NUMBER)
    if (!restoredNum) {
      console.error(`  ❌ READBACK FAILED — number not found in numbers[]`)
      process.exit(1)
    }
    console.log(`  ✅ Readback confirmed — plan=${restoredNum.plan}, status=${restoredNum.status}, expiresAt=${restoredNum.expiresAt}`)
    console.log(`  ✅ SIP creds in doc: sipUsername=${restoredNum.sipUsername}, telnyxCredentialId=${restoredNum.telnyxCredentialId}`)
  } else {
    console.log(`  🟡 DRY RUN — no writes performed.`)
    console.log(`  Re-run with --write to execute.`)
  }

  await mongo.close()
  console.log('\n' + '═'.repeat(72))
  console.log(`  ${WRITE_MODE ? '✅ RESTORATION COMPLETE' : '🟢 DRY RUN COMPLETE — re-run with --write to execute'}`)
  console.log('═'.repeat(72))
})().catch(err => {
  console.error('\n❌ FATAL:', err.message)
  console.error(err.stack)
  process.exit(2)
})
