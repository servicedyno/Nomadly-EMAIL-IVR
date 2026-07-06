/* global process */
require('dotenv').config()
const { PinpointClient, PhoneNumberValidateCommand } = require('@aws-sdk/client-pinpoint')

const client = new PinpointClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const validatePhoneAws = async phone => {
  const command = new PhoneNumberValidateCommand({
    NumberValidateRequest: {
      PhoneNumber: phone,
    },
  })
  const res = await client.send(command)

  if (!res || typeof res !== 'object') {
    throw new Error('Invalid AWS API response')
  }

  return res

  // return res?.NumberValidateResponse?.PhoneType !== 'INVALID'
  // return res?.NumberValidateResponse?.PhoneType === 'MOBILE'
}
// validatePhoneAws('+18623752767') //.then(console.log)
module.exports = validatePhoneAws
