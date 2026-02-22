/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const neutrino_headers = {
  'User-ID': process.env.NEUTRINO_ID,
  'API-Key': process.env.NEUTRINO_KEY,
}
const neutrinoApiUrl = 'https://neutrinoapi.net/phone-validate'
const validatePhoneNeutrino = async number => {
  const res = await axios.post(neutrinoApiUrl, { number }, { headers: neutrino_headers })
  // console.log(res.data)
  // return res.data.valid
  const ret = res?.data?.['is-mobile'] === true ? true : null
  ret && log('Neutrino is mobile', number)
  return ret
}
// const init = async () => {
// await validatePhoneNeutrino(' +17134800000') // US
// await validatePhoneNeutrino(' +14185200000') // Canada
//
// validatePhoneNeutrino('+64 27 411 1909').then(console.log) // New Zealand Mobile
// await validatePhoneNeutrino('+64 9 432 7980') // New Zealand Landline
// await validatePhoneNeutrino('+64 0 000 7980') // New Zealand Invalid
//
// validatePhoneNeutrino('+44 20 7830 0000').then(console.log) // UK
// validatePhoneNeutrino('+44 07 1513 0673') // UK
//
// validatePhoneNeutrino('+61433589141') // Australia Mobile
// await validatePhoneNeutrino('+61732900300') // Australia Landline
// await validatePhoneNeutrino('+61111000000') // Australia Invalid
// }
// init()

module.exports = validatePhoneNeutrino
