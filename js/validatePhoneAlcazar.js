/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')
const { alcazar } = require('./config')

const API_ALCAZAR = process.env.API_ALCAZAR
const apiUrl = 'http://api.east.alcazarnetworks.com/api/2.2/lrn'

// Track API key health — log error at most once per hour to avoid spam
// while still re-surfacing the issue on long-lived processes (Railway pods
// can stay up for days). Previous behavior of "once per process lifetime"
// caused the @onlicpe regression to be silently lost in the log stream.
let alcazarKeyErrorLastLoggedAt = 0
const ALCAZAR_KEY_ERROR_LOG_TTL_MS = 60 * 60 * 1000  // 1 hour

const validatePhoneAlcazar = async (carrier, phone) => {
  // Validate US phone number format: must be exactly 11 digits starting with 1
  const cleanPhone = String(phone).replace(/[^0-9]/g, '')
  if (cleanPhone.length !== 11 || !cleanPhone.startsWith('1')) {
    return null // silently skip malformed numbers
  }

  const url = `${apiUrl}?tn=${cleanPhone}&extended=true&output=json&&key=${API_ALCAZAR}`

  const d1 = new Date()
  const res = await axios.get(url)
  const d2 = new Date()

  // Detect invalid API key or non-JSON response
  if (typeof res.data === 'string') {
    const now = Date.now()
    if (now - alcazarKeyErrorLastLoggedAt > ALCAZAR_KEY_ERROR_LOG_TTL_MS) {
      alcazarKeyErrorLastLoggedAt = now
      log(`[Alcazar] ❌ API ERROR — response is not JSON: "${(res.data || '').substring(0, 100)}". Check API_ALCAZAR key!`)
    }
    return null
  }

  // Detect explicit error field in JSON response
  if (res.data?.error || res.data?.Error) {
    const now = Date.now()
    if (now - alcazarKeyErrorLastLoggedAt > ALCAZAR_KEY_ERROR_LOG_TTL_MS) {
      alcazarKeyErrorLastLoggedAt = now
      log(`[Alcazar] ❌ API returned error: ${res.data.error || res.data.Error}`)
    }
    return null
  }

  const lec = res?.data?.LEC
  const isMobile = res?.data?.LINETYPE === 'WIRELESS'

  const filter = carrier === 'Mixed Carriers' ? true : alcazar[carrier].some(c => lec?.includes(c))
  isMobile && log('Alcazar', phone, lec)

  // Reset error throttle on successful response with valid data so the very
  // next failure (if any) is logged immediately rather than waiting for TTL.
  if (res.data?.LINETYPE) alcazarKeyErrorLastLoggedAt = 0

  const result = isMobile && filter ? [`+${phone}`, lec, `Sec: ${(d2 - d1) / 1000}`] : null
  return result
}

// validatePhoneAlcazar('Mixed Carriers','18622039173') // US / Canada
// validatePhoneAlcazar('61385479556') // does not work for Australia, New Zealand, UK

module.exports = validatePhoneAlcazar
