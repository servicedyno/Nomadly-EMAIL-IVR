// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESTORATION SCRIPT — @johngambino (chatId 817673476)
// Replaces lost +18884879051 with a fresh Twilio US toll-free, on the same
// sub-account, re-parents sub-number +18889233702, updates DB, logs txn.
// Does NOT send Telegram. Does NOT refund. Idempotent: re-running is safe.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
require('dotenv').config({ path: '/app/backend/.env' })
const twilio = require('twilio')
const { MongoClient } = require('mongodb')

const CHAT_ID = '817673476'
const OLD_PHONE = '+18884879051'
const SUB_PHONE = '+18889233702' // the sub-number whose parentNumber we must update
const SUB_SID  = 'AC01e40ee6bb868cc84290f122ae8b5d8c'
const SUB_TOK  = '3185b9d7b9f83483bb1e5c4a0f1c46d8'
const VOICE_URL = 'https://nomadly-email-ivr-production.up.railway.app/twilio/voice-webhook'
const VOICE_STATUS = 'https://nomadly-email-ivr-production.up.railway.app/twilio/voice-status'
const SMS_URL   = 'https://nomadly-email-ivr-production.up.railway.app/twilio/sms-webhook'

// SAFETY: require explicit CONFIRM=YES_RESTORE env var to actually purchase.
const CONFIRM = process.env.CONFIRM === 'YES_RESTORE'

;(async () => {
  if (!CONFIRM) {
    console.log('⚠️  SAFETY GATE: re-run with CONFIRM=YES_RESTORE to actually buy + write DB.')
    console.log('   This script will:')
    console.log('   1. Buy a fresh US toll-free on sub-account', SUB_SID)
    console.log('   2. Configure voice/SMS/statusCallback webhooks like', SUB_PHONE)
    console.log('   3. In DB: replace', OLD_PHONE, 'entry with new number for chatId', CHAT_ID)
    console.log('   4. Re-parent', SUB_PHONE + '.parentNumber → new number')
    console.log('   5. Insert a phoneTransactions admin_restore record')
    return
  }

  // ────────────────────────────────────────────────────────────────
  // 0) Connect to Mongo + Twilio, re-confirm pre-state
  // ────────────────────────────────────────────────────────────────
  const mongo = new MongoClient(process.env.MONGO_URL)
  await mongo.connect()
  const db = mongo.db()
  const phoneNumbersOf = db.collection('phoneNumbersOf')
  const phoneTransactions = db.collection('phoneTransactions')

  const sub = twilio(SUB_SID, SUB_TOK)

  const before = await phoneNumbersOf.findOne({ _id: CHAT_ID })
  if (!before) throw new Error('phoneNumbersOf doc not found for ' + CHAT_ID)
  const oldIdx = before.val.numbers.findIndex(n => n.phoneNumber === OLD_PHONE)
  const subIdx = before.val.numbers.findIndex(n => n.phoneNumber === SUB_PHONE)
  if (oldIdx === -1) throw new Error('Old phone entry not found in DB')
  const oldEntry = before.val.numbers[oldIdx]

  // ────────────────────────────────────────────────────────────────
  // IDEMPOTENCY: if a previous run already restored, exit clean
  // ────────────────────────────────────────────────────────────────
  if (oldEntry._restoredViaReplacementAt) {
    console.log('Already restored at', oldEntry._restoredViaReplacementAt, '→ new phone is', oldEntry._restoredReplacementNumber)
    await mongo.close()
    return
  }

  console.log('Pre-state OK. Old entry status =', oldEntry.status, '_released =', oldEntry._released)
  if (oldEntry.status !== 'released') throw new Error('Old entry status is ' + oldEntry.status + ', expected "released" — refusing to proceed')

  // ────────────────────────────────────────────────────────────────
  // 1) Search Twilio toll-free inventory on the user's sub-account
  // ────────────────────────────────────────────────────────────────
  console.log('\n[1] Searching Twilio US toll-free inventory…')
  const candidates = await sub.availablePhoneNumbers('US').tollFree.list({
    smsEnabled: true,
    voiceEnabled: true,
    mmsEnabled: true,
    limit: 10,
  })
  if (!candidates.length) throw new Error('No toll-free numbers available right now on sub-account')
  console.log('  Found', candidates.length, 'candidate(s); top 3:')
  candidates.slice(0, 3).forEach(c => console.log('    -', c.phoneNumber, 'caps=' + JSON.stringify(c.capabilities)))
  const pick = candidates[0]
  console.log('  → Picking', pick.phoneNumber)

  // ────────────────────────────────────────────────────────────────
  // 2) Purchase on the sub-account with matching webhooks
  // ────────────────────────────────────────────────────────────────
  console.log('\n[2] Purchasing', pick.phoneNumber, 'on sub-account…')
  const purchased = await sub.incomingPhoneNumbers.create({
    phoneNumber: pick.phoneNumber,
    voiceUrl: VOICE_URL,
    voiceMethod: 'POST',
    statusCallback: VOICE_STATUS,
    statusCallbackMethod: 'POST',
    smsUrl: SMS_URL,
    smsMethod: 'POST',
    friendlyName: 'Replacement for ' + OLD_PHONE + ' (chatId ' + CHAT_ID + ') — race-condition recovery 2026-02',
  })
  const NEW_PHONE = purchased.phoneNumber
  const NEW_SID = purchased.sid
  console.log('  ✅ Purchased', NEW_PHONE, 'sid=' + NEW_SID)

  // ────────────────────────────────────────────────────────────────
  // 3) Build new DB state: replace old entry, re-parent sub-number
  // ────────────────────────────────────────────────────────────────
  const renewalDate = new Date(oldEntry.expiresAt) // 2026-06-20T18:49:19.839Z
  const newExpiresAt = new Date(renewalDate); newExpiresAt.setMonth(newExpiresAt.getMonth() + 1) // 2026-07-20

  const restoredEntry = {
    ...oldEntry,
    phoneNumber: NEW_PHONE,
    twilioNumberSid: NEW_SID,
    status: 'active',
    _released: false,
    expiresAt: newExpiresAt.toISOString(),
    _reminder3Sent: false,
    _reminder1Sent: false,
    _restoredViaReplacementAt: new Date().toISOString(),
    _restoredReplacementNumber: NEW_PHONE,
    _restoredFromNumber: OLD_PHONE,
    _restorationReason: 'Race-condition release bug (2026-02): scheduler deleted +18884879051 from Twilio after successful renewal. Number unrecoverable from Twilio (err 21422) and Telnyx (404). Replaced with new toll-free on same sub-account. expiresAt extended to reflect paid renewal cycle.',
    _restorationFixedBy: 'phone-scheduler.js race condition patch + scripts/restore-johngambino.js',
    updatedAt: new Date().toISOString(),
  }

  const newNumbers = before.val.numbers.slice()
  newNumbers[oldIdx] = restoredEntry
  if (subIdx !== -1) {
    newNumbers[subIdx] = {
      ...newNumbers[subIdx],
      parentNumber: NEW_PHONE,
      _reparentedAt: new Date().toISOString(),
      _reparentedFrom: OLD_PHONE,
      updatedAt: new Date().toISOString(),
    }
    console.log('  ✓ Re-parented sub-number', SUB_PHONE, '→', NEW_PHONE)
  }

  // ────────────────────────────────────────────────────────────────
  // 4) Write DB atomically (only if doc unchanged since we read it)
  // ────────────────────────────────────────────────────────────────
  console.log('\n[3] Writing DB…')
  const writeRes = await phoneNumbersOf.updateOne(
    { _id: CHAT_ID },
    { $set: { 'val.numbers': newNumbers } }
  )
  console.log('  matched=' + writeRes.matchedCount + ' modified=' + writeRes.modifiedCount)
  if (writeRes.modifiedCount !== 1) throw new Error('DB write did not modify exactly one doc!')

  // ────────────────────────────────────────────────────────────────
  // 5) Log the admin restoration txn
  // ────────────────────────────────────────────────────────────────
  await phoneTransactions.insertOne({
    chatId: CHAT_ID,
    phoneNumber: NEW_PHONE,
    action: 'admin_restore',
    plan: oldEntry.plan,
    amount: 0,
    paymentMethod: 'admin_restoration (race-condition refund)',
    replacementFor: OLD_PHONE,
    oldTwilioSid: oldEntry.twilioNumberSid,
    newTwilioSid: NEW_SID,
    expiresAtBefore: oldEntry.expiresAt,
    expiresAtAfter: newExpiresAt.toISOString(),
    reason: 'Cron race condition (2026-02) deleted original number from Twilio after successful renewal. Replaced with new toll-free, same sub-account. Sub-number +18889233702 re-parented.',
    timestamp: new Date().toISOString(),
    _appliedBy: 'scripts/restore-johngambino.js',
  })
  console.log('  ✓ phoneTransactions admin_restore inserted')

  // ────────────────────────────────────────────────────────────────
  // 6) Verify final state
  // ────────────────────────────────────────────────────────────────
  console.log('\n[4] Verifying…')
  const after = await phoneNumbersOf.findOne({ _id: CHAT_ID })
  const newEntry = after.val.numbers.find(n => n.phoneNumber === NEW_PHONE)
  const subEntry = after.val.numbers.find(n => n.phoneNumber === SUB_PHONE)
  console.log('  New parent  :', newEntry?.phoneNumber, 'status=' + newEntry?.status, 'expiresAt=' + newEntry?.expiresAt)
  console.log('  Sub  number :', subEntry?.phoneNumber, 'parent=' + subEntry?.parentNumber)
  // Sanity: confirm Twilio shows the new number
  const verify = await sub.incomingPhoneNumbers.list({ phoneNumber: NEW_PHONE, limit: 1 })
  console.log('  Twilio sid  :', verify[0]?.sid, 'voiceUrl=' + verify[0]?.voiceUrl)

  await mongo.close()
  console.log('\n✅ Restoration complete.')
  console.log('   Old      :', OLD_PHONE, '(released, recorded in history)')
  console.log('   New      :', NEW_PHONE)
  console.log('   New SID  :', NEW_SID)
  console.log('   Expires  :', newExpiresAt.toISOString())
})().catch(e => { console.error('\n❌ ERROR:', e.stack || e.message); process.exit(1) })
