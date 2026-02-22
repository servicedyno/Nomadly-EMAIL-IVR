/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const { npl } = require('./config')

const validatePhoneNpl = async (carrier, phone) => {
  const request_url = `https://api.numberportabilitylookup.com/npl?user=${process.env.NUMBER_PROBABLITY_API_ID}&pass=${process.env.NUMBER_PROBABLITY_API_PASS}&msisdn=${phone}&format=json`
  const d1 = new Date()
  const res = await axios.get(request_url)
  const d2 = new Date()
  // console.log(res?.data)
  // return res?.data?.[0]?.numbertype === 'MOBILE' ? `+${phone} // ${res?.data?.[0]?.carrier} // ` : null
  // landline reachable: 'not_sms_capable', 'true'

  const rec = res?.data?.[0]
  const lec = rec?.operatorname

  let isMobile =
    rec?.reachable === 'true' || rec?.mobile === 'true' || rec?.validnumber === 'true' || rec?.numbertype === 'MOBILE'

  if (!isMobile) return null

  const filter = carrier === 'Mixed Carriers' ? true : npl[carrier].some(c => lec?.includes(c))
  isMobile && log('Npl', phone, lec)

  // return res?.data numbertype

  return isMobile && filter ? [`+${phone}`, lec, `Sec: ${(d2 - d1) / 1000}`] : null
}
// const init = async () => {
//   await validatePhoneNpl('Mixed Carriers','+17134800000') // US
//   await validatePhoneNpl('Mixed Carriers',' +14185200000') // Canada
//  validatePhoneNpl('Mixed Carriers','+6444900000') // New Zealand
// validatePhoneNpl('Mixed Carriers', '+64 27 411 1909').then(console.log) // New Zealand Mobile

// validatePhoneNpl('Mixed Carriers', '+61433589141').then(console.log) // Australia Mobile
//   await validatePhoneNpl('Mixed Carriers','+61732900300') // Australia Landline
//   await validatePhoneNpl('Mixed Carriers','+61111000000') // Australia Invalid

// validatePhoneNpl('Mixed Carriers', '442075661195').then(console.log) // UK Landline
// validatePhoneNpl('Mixed Carriers', '447920496583').then(console.log) // UK Mobile

//  validatePhoneNpl('Mixed Carriers','+14039030274') // US Mobile
//  validatePhoneNpl('Mixed Carriers','+16478365790') // US Mobile
// }
// init()
module.exports = validatePhoneNpl
