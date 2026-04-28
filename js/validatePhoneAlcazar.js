/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const { alcazar } = require('./config')

const API_ALCAZAR = process.env.API_ALCAZAR
const apiUrl = 'http://api.east.alcazarnetworks.com/api/2.2/lrn'

// Track API key health — log error only once to avoid spam
let alcazarKeyErrorLogged = false

const validatePhoneAlcazar = async (carrier, phone) => {
  const url = `${apiUrl}?tn=${phone}&extended=true&output=json&&key=${API_ALCAZAR}`

  const d1 = new Date()
  const res = await axios.get(url)
  const d2 = new Date()

  // Detect invalid API key or non-JSON response
  if (typeof res.data === 'string') {
    if (!alcazarKeyErrorLogged) {
      alcazarKeyErrorLogged = true
      log(`[Alcazar] ❌ API ERROR — response is not JSON: "${(res.data || '').substring(0, 100)}". Check API_ALCAZAR key!`)
    }
    return null
  }

  // Detect explicit error field in JSON response
  if (res.data?.error || res.data?.Error) {
    if (!alcazarKeyErrorLogged) {
      alcazarKeyErrorLogged = true
      log(`[Alcazar] ❌ API returned error: ${res.data.error || res.data.Error}`)
    }
    return null
  }

  const lec = res?.data?.LEC
  const isMobile = res?.data?.LINETYPE === 'WIRELESS'

  const filter = carrier === 'Mixed Carriers' ? true : alcazar[carrier].some(c => lec?.includes(c))
  isMobile && log('Alcazar', phone, lec)

  // Reset error flag on successful response with valid data
  if (res.data?.LINETYPE) alcazarKeyErrorLogged = false

  const result = isMobile && filter ? [`+${phone}`, lec, `Sec: ${(d2 - d1) / 1000}`] : null
  return result
}

// validatePhoneAlcazar('Mixed Carriers','18622039173') // US / Canada
// validatePhoneAlcazar('61385479556') // does not work for Australia, New Zealand, UK

module.exports = validatePhoneAlcazar
