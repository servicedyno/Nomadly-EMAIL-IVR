// Read-only Twilio diagnostic: check status of +18884879051 on the user's sub-account
require('dotenv').config({ path: '/app/backend/.env' })
const twilio = require('twilio')

const MAIN_SID = process.env.TWILIO_ACCOUNT_SID
const MAIN_TOK = process.env.TWILIO_AUTH_TOKEN
const SUB_SID  = 'AC01e40ee6bb868cc84290f122ae8b5d8c'
const SUB_TOK  = '3185b9d7b9f83483bb1e5c4a0f1c46d8'
const PHONE    = '+18884879051'

;(async () => {
  console.log('Main SID:', MAIN_SID?.slice(0, 6) + '...')
  console.log('Sub  SID:', SUB_SID)

  const sub = twilio(SUB_SID, SUB_TOK)

  // 1) Does the sub-account still own this number?
  console.log('\n[1] Search sub-account incomingPhoneNumbers for', PHONE)
  try {
    const owned = await sub.incomingPhoneNumbers.list({ phoneNumber: PHONE, limit: 5 })
    console.log('  Found:', owned.length)
    owned.forEach(n => console.log('   - sid=' + n.sid + ' status=' + n.status + ' voiceUrl=' + n.voiceUrl))
  } catch (e) { console.log('  ERR:', e.message) }

  // 2) Is the number purchasable from Twilio toll-free pool right now?
  console.log('\n[2] Check toll-free availability on sub-account')
  try {
    // Twilio specific-number search
    const avail = await sub.availablePhoneNumbers('US').tollFree.list({ contains: PHONE, limit: 5 })
    console.log('  Available now:', avail.length)
    avail.forEach(n => console.log('   - phoneNumber=' + n.phoneNumber + ' capabilities=' + JSON.stringify(n.capabilities)))
  } catch (e) { console.log('  ERR:', e.message) }

  // 3) Check the main account too, in case it ended up there
  console.log('\n[3] Main account ownership check')
  try {
    const main = twilio(MAIN_SID, MAIN_TOK)
    const owned = await main.incomingPhoneNumbers.list({ phoneNumber: PHONE, limit: 5 })
    console.log('  Found on main:', owned.length)
    owned.forEach(n => console.log('   - sid=' + n.sid + ' accountSid=' + n.accountSid + ' status=' + n.status))
  } catch (e) { console.log('  ERR:', e.message) }

  // 4) Existing healthy number for webhook URL reference
  console.log('\n[4] Reference webhook config from +18889233702 (still active)')
  try {
    const ref = await sub.incomingPhoneNumbers.list({ phoneNumber: '+18889233702', limit: 1 })
    if (ref.length) {
      const n = ref[0]
      console.log('  voiceUrl       :', n.voiceUrl)
      console.log('  voiceMethod    :', n.voiceMethod)
      console.log('  voiceFallback  :', n.voiceFallbackUrl)
      console.log('  statusCallback :', n.statusCallback)
      console.log('  smsUrl         :', n.smsUrl)
      console.log('  smsMethod      :', n.smsMethod)
      console.log('  smsFallback    :', n.smsFallbackUrl)
      console.log('  trunkSid       :', n.trunkSid)
      console.log('  voiceApplicationSid:', n.voiceApplicationSid)
      console.log('  smsApplicationSid  :', n.smsApplicationSid)
    } else {
      console.log('  REF NUMBER NOT FOUND on sub-account')
    }
  } catch (e) { console.log('  ERR:', e.message) }
})().catch(e => { console.error(e); process.exit(1) })
