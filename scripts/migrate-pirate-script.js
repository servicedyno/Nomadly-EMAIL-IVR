/**
 * Migration script: Create new Twilio sub-account for @pirate_script
 * Old sub-account ACc5889c54b04c6505f1509325122fa7f1 is blocked
 * Preserve: minutesUsed=371, smsUsed=0, plan=pro, call forwarding config
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')
const twilioService = require('/app/js/twilio-service')
const telnyxApi = require('/app/js/telnyx-service')
const phoneConfig = require('/app/js/phone-config')

const CHAT_ID = 1005284399
const OLD_NUMBER = '+18669834855'
const SELF_URL = process.env.SELF_URL || process.env.SELF_URL_PROD
const MONGO_URL = process.env.MONGO_URL

async function migrate() {
  const client = await MongoClient.connect(MONGO_URL)
  const db = client.db('test')
  const phoneNumbersOf = db.collection('phoneNumbersOf')

  // 1. Load current data
  const userData = await phoneNumbersOf.findOne({ _id: CHAT_ID })
  const numbers = userData?.val?.numbers || userData?.numbers || []
  const oldEntry = numbers.find(n => n.phoneNumber === OLD_NUMBER)
  if (!oldEntry) { console.error('Number not found in DB'); process.exit(1) }
  
  console.log('=== Current Entry ===')
  console.log(`Number: ${oldEntry.phoneNumber}`)
  console.log(`Plan: ${oldEntry.plan} ($${oldEntry.planPrice}/mo)`)
  console.log(`Minutes: ${oldEntry.minutesUsed} used`)
  console.log(`SMS: ${oldEntry.smsUsed} used`)
  console.log(`Old Sub-Account: ${oldEntry.twilioSubAccountSid}`)
  console.log(`Expires: ${oldEntry.expiresAt}`)
  console.log(`Call Forwarding: ${JSON.stringify(oldEntry.features?.callForwarding)}`)
  console.log()

  // 2. Create NEW Twilio sub-account
  console.log('>>> Creating new Twilio sub-account...')
  const newSub = await twilioService.createSubAccount(`Nomadly-${CHAT_ID}-pirate_script-v2`)
  if (newSub.error) { console.error('Failed to create sub-account:', newSub.error); process.exit(1) }
  console.log(`New Sub-Account SID: ${newSub.accountSid}`)
  console.log(`New Sub-Account Token: ${newSub.authToken}`)
  console.log()

  // 3. Try to buy the SAME number on main account
  console.log(`>>> Trying to purchase ${OLD_NUMBER} on main account...`)
  let buyResult = await twilioService.buyNumber(OLD_NUMBER, null, null, SELF_URL)
  let finalNumber = OLD_NUMBER
  
  if (buyResult.error) {
    console.log(`Could not buy ${OLD_NUMBER}: ${buyResult.error}`)
    console.log('>>> Searching for new US toll-free number...')
    const available = await twilioService.searchNumbers('US', 'toll_free', 5)
    if (available.length === 0) { console.error('No toll-free numbers available'); process.exit(1) }
    finalNumber = available[0].phone_number
    console.log(`>>> Purchasing new number: ${finalNumber} (${available[0].friendly_name})`)
    buyResult = await twilioService.buyNumber(finalNumber, null, null, SELF_URL)
    if (buyResult.error) { console.error('Failed to buy number:', buyResult.error); process.exit(1) }
  }
  
  console.log(`Purchased: ${buyResult.phoneNumber} (SID: ${buyResult.sid})`)
  console.log()

  // 4. Transfer number to new sub-account
  console.log('>>> Transferring number to new sub-account...')
  const transfer = await twilioService.transferNumberToSubAccount(buyResult.sid, newSub.accountSid)
  if (transfer.error) {
    console.log(`Transfer warning: ${transfer.error} (number stays on main, continuing...)`)
  } else {
    console.log('Transfer successful')
    // Update webhooks on sub-account
    await twilioService.updateSubAccountNumberWebhooks(newSub.accountSid, buyResult.sid, SELF_URL)
    console.log('Webhooks updated on sub-account')
  }
  console.log()

  // 5. Create Telnyx SIP credential for new number
  const sipUser = phoneConfig.generateSipUsername()
  const sipPass = phoneConfig.generateSipPassword()
  let telnyxSipUsername = null, telnyxSipPassword = null, telnyxCredentialId = null
  
  const TELNYX_SIP_CONN_ID = process.env.TELNYX_SIP_CONNECTION_ID
  if (TELNYX_SIP_CONN_ID) {
    console.log('>>> Creating Telnyx SIP credential...')
    const telnyxCred = await telnyxApi.createSIPCredential(TELNYX_SIP_CONN_ID, sipUser, sipPass)
    if (telnyxCred?.sip_username) {
      telnyxSipUsername = telnyxCred.sip_username
      telnyxSipPassword = telnyxCred.sip_password || sipPass
      telnyxCredentialId = telnyxCred.id || null
      console.log(`Telnyx SIP: ${telnyxSipUsername} (ID: ${telnyxCredentialId})`)
    }
  }
  console.log()

  // 6. Update DB — preserve minutesUsed, smsUsed, features, etc.
  const updatedEntry = {
    ...oldEntry,
    phoneNumber: finalNumber,
    twilioNumberSid: buyResult.sid,
    twilioSubAccountSid: newSub.accountSid,
    twilioSubAccountToken: newSub.authToken,
    sipUsername: sipUser,
    sipPassword: sipPass,
    telnyxSipUsername: telnyxSipUsername || oldEntry.telnyxSipUsername,
    telnyxSipPassword: telnyxSipPassword || oldEntry.telnyxSipPassword,
    telnyxCredentialId: telnyxCredentialId || oldEntry.telnyxCredentialId,
    // Preserve: minutesUsed, smsUsed, features (callForwarding, voicemail, etc.)
    minutesUsed: oldEntry.minutesUsed,  // Keep at 371
    smsUsed: oldEntry.smsUsed,          // Keep at 0
  }

  // Update the numbers array
  const updatedNumbers = numbers.map(n => n.phoneNumber === OLD_NUMBER ? updatedEntry : n)
  
  // Also update top-level sub-account refs
  const updatePayload = userData?.val 
    ? { val: { ...userData.val, numbers: updatedNumbers, twilioSubAccountSid: newSub.accountSid, twilioSubAccountToken: newSub.authToken } }
    : { numbers: updatedNumbers, twilioSubAccountSid: newSub.accountSid, twilioSubAccountToken: newSub.authToken }
  
  await phoneNumbersOf.updateOne({ _id: CHAT_ID }, { $set: updatePayload })

  console.log('=== MIGRATION COMPLETE ===')
  console.log(`User: @pirate_script (${CHAT_ID})`)
  console.log(`Number: ${finalNumber}${finalNumber !== OLD_NUMBER ? ` (changed from ${OLD_NUMBER})` : ' (same number recovered!)'}`)
  console.log(`New Sub-Account: ${newSub.accountSid}`)
  console.log(`SIP: ${sipUser} / ${sipPass}`)
  console.log(`Telnyx SIP: ${telnyxSipUsername}`)
  console.log(`Minutes preserved: ${oldEntry.minutesUsed} used`)
  console.log(`SMS preserved: ${oldEntry.smsUsed} used`)
  console.log(`Call Forwarding: ${oldEntry.features?.callForwarding?.enabled ? 'preserved → ' + oldEntry.features?.callForwarding?.forwardTo : 'not enabled'}`)

  await client.close()
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1) })
