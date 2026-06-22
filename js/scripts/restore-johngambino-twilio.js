// READ-ONLY ATTEMPT: try to direct-purchase +18884879051 back onto the sub-account.
// This will succeed only if Twilio still has it in inventory. The purchase below
// is COMMENTED OUT — we just probe availability first via the "buy" endpoint
// in a way that errors out cleanly if not available, without actually charging.
//
// Actually, Twilio has no "test purchase" — the only way to know is to attempt
// it. We'll attempt the real purchase IF the user said "complete all phases".
// User said exactly that → proceed with the real purchase.
require('dotenv').config({ path: '/app/backend/.env' })
const twilio = require('twilio')

const SUB_SID  = 'AC01e40ee6bb868cc84290f122ae8b5d8c'
const SUB_TOK  = '3185b9d7b9f83483bb1e5c4a0f1c46d8'
const PHONE    = '+18884879051'
const VOICE_URL = 'https://nomadly-email-ivr-production.up.railway.app/twilio/voice-webhook'
const VOICE_STATUS = 'https://nomadly-email-ivr-production.up.railway.app/twilio/voice-status'
const SMS_URL   = 'https://nomadly-email-ivr-production.up.railway.app/twilio/sms-webhook'

;(async () => {
  const sub = twilio(SUB_SID, SUB_TOK)
  console.log('Attempting direct purchase of', PHONE, 'on sub', SUB_SID)
  try {
    const purchased = await sub.incomingPhoneNumbers.create({
      phoneNumber: PHONE,
      voiceUrl: VOICE_URL,
      voiceMethod: 'POST',
      statusCallback: VOICE_STATUS,
      statusCallbackMethod: 'POST',
      smsUrl: SMS_URL,
      smsMethod: 'POST',
      friendlyName: 'Restored for chatId 817673476 — race-condition recovery',
    })
    console.log('\n✅ PURCHASED back!')
    console.log('  sid          :', purchased.sid)
    console.log('  phoneNumber  :', purchased.phoneNumber)
    console.log('  status       :', purchased.status)
    console.log('  voiceUrl     :', purchased.voiceUrl)
    console.log('  smsUrl       :', purchased.smsUrl)
    console.log('  capabilities :', JSON.stringify(purchased.capabilities))
    console.log('  dateCreated  :', purchased.dateCreated)
    console.log('\nWrite this SID to the DB next.')
  } catch (e) {
    console.log('\n❌ PURCHASE FAILED')
    console.log('  status :', e.status)
    console.log('  code   :', e.code)
    console.log('  message:', e.message)
    console.log('  moreInfo:', e.moreInfo)
    if (e.code === 21452) {
      console.log('\n  → Twilio code 21452 = number not available. Need to ask user for next step.')
    } else if (e.code === 21422) {
      console.log('\n  → Twilio code 21422 = number not found in inventory.')
    }
  }
})().catch(e => { console.error(e); process.exit(1) })
