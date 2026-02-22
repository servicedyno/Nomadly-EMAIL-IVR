/* global process */
require('dotenv').config()
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = require('twilio')(accountSid, authToken)

const validatePhoneTwilioV1 = async phone => {
  const res = await client.lookups.v1.phoneNumbers(phone).fetch({ type: 'carrier', fields: 'caller_name' })
  // console.log(res)
  // return res?.callerName?.caller_name
  return res
}
const validatePhoneTwilioV2 = async phone => {
  const res = await client.lookups.v2.phoneNumbers(phone).fetch({ type: 'carrier', fields: 'caller_name' })
  // console.log(res)
  // return res
  return res?.callerName?.caller_name
}
// validatePhoneTwilioV2('+64 274 533 559').then(console.log)
// validatePhoneTwilioV2('+447770510576').then(console.log)
// validatePhoneTwilioV2('+64 27 208 4274').then(console.log)
// validatePhoneTwilioV2('+44 7977 406133').then(console.log)

module.exports = { validatePhoneTwilioV1, validatePhoneTwilioV2 }
