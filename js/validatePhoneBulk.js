/*global process */
const { log } = require('console')
const { customAlphabet } = require('nanoid')
const { getRandom, sleep } = require('./utils')
const validatePhoneAlcazar = require('./validatePhoneAlcazar')
const validatePhoneSignalwire = require('./validatePhoneSignalwire')
const validatePhoneNpl = require('./validatePhoneNpl')
const validatePhoneNeutrino = require('./validatePhoneNeutrino')
const { lookupCnam } = require('./cnam-service')
const { translation } = require('./translation')
// const { validatePhoneTwilioV2 } = require('./validatePhoneTwilio')
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const part1 = customAlphabet('23456789', 1)
const part2 = customAlphabet('0123456789', 6)
const _part2 = customAlphabet('0123456789', 7)

// config
const parallelApiCalls = 5
const waitAfterParallelApiCalls = 1 * 1000 // 1 second

const showProgressEveryXTime = 60 // 30 iterations = 1 minute
const phoneGenTimeout = 10 * 60 * 60 * 1000 // 2 hour // 1 hr = 2000 hits almost
const phoneGenStopAtNoXHits = 250 // 250 Hits with 0 phone number found then break the loop

// ── Real Person Name Filter ──
// US state abbreviations for city/state pattern detection
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MO','MS','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY','DC','PR','VI','GU','AS','MP'
])

// Known non-person identifiers
const REJECT_EXACT = new Set([
  'WIRELESS CALLER', 'UNKNOWN', 'UNAVAILABLE', 'NONE', 'NOT FOUND', 'NO NAME',
  'PRIVATE', 'PRIVATE CALLER', 'BLOCKED', 'RESTRICTED', 'ANONYMOUS',
  'TOLL FREE', 'TOLL FREE CALL', 'TOLLFREE', 'OUT OF AREA',
  'PROBABLY FRAUD', 'SPAM', 'SCAM', 'SCAM LIKELY', 'FRAUD', 'TELEMARKETER',
  'V', 'N/A', '-', '', 'CALLER', 'WIRELESS', 'LANDLINE', 'VOIP'
])

// Known carrier/company substrings (partial match)
const REJECT_CONTAINS = [
  'WIRELESS CALL', 'TOLL FREE', 'CALLER ID', 'CELL PHONE',
  'VERIZON', 'T-MOBILE', 'TMOBILE', 'AT&T', 'ATT ', 'SPRINT', 'SPECTRUM',
  'COMCAST', 'XFINITY', 'CRICKET', 'METRO PCS', 'METROPCS', 'BOOST MOBILE',
  'TRACFONE', 'STRAIGHT TALK', 'VONAGE', 'MAGICJACK', 'GOOGLE VOICE',
  'BANDWIDTH', 'LEVEL 3', 'LEVEL3', 'WINDSTREAM', 'FRONTIER', 'CENTURYLINK',
  'LUMEN', 'CORELOGIC', 'COSTAR', 'HOME CARE', 'IPHONE', 'ANDROID',
  'COLOPLAST', 'SAIA LTL', 'RAIDER NATION'
]

/**
 * Determines if a CNAM result is a real person's name vs carrier/location/junk data.
 * Returns true only for entries that look like actual human names.
 */
const isRealPersonName = (name) => {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim().toUpperCase()
  if (trimmed.length < 3) return false

  // Reject exact matches
  if (REJECT_EXACT.has(trimmed)) return false

  // Reject if contains known carrier/company substrings
  for (const kw of REJECT_CONTAINS) {
    if (trimmed.includes(kw)) return false
  }

  // Reject city/state pattern: "WORD(S) XX" where XX is a US state
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    if (US_STATES.has(lastPart) && lastPart.length === 2) {
      // Check that the preceding parts look like a city name (all caps, no mixed case)
      // This catches "LOS ANGELES CA", "MINNEAPOLIS MN", "SAN FRANCSCO CA", etc.
      // But allows "JAMES CA" (could be a name) if it has only 2 parts with a short first part
      // Real names with 2-letter "state" last names exist but are extremely rare
      // We only reject if the "city" part is >= 3 words or matches known city patterns
      if (parts.length >= 3) return false // "LOS ANGELES CA" = 3 parts, always reject
      // 2-part: "GARDENA CA" vs "JAMES CA" — reject if last is a state and first part > 4 chars
      // (most city names are > 4 chars; most first names are <= 8 chars but this is a heuristic)
      // Actually, let's reject all 2-part "WORD STATE" patterns since city names dominate
      return false
    }
  }

  // Reject if it's all digits or has mostly digits
  const alphaCount = (trimmed.match(/[A-Z]/g) || []).length
  if (alphaCount < 2) return false

  // Reject masked/placeholder names (e.g., "XXXX XXXX", "AAAA BBBB")
  const lettersOnly = trimmed.replace(/[^A-Z]/g, '')
  if (lettersOnly.length >= 4 && new Set(lettersOnly).size <= 2) return false

  // Reject single-word entries that are too short or look like abbreviations
  if (parts.length === 1 && trimmed.length < 4) return false

  // Pass: looks like a real person name
  return true
}

// core
const duplicate = {}
const areaCodeCount = {}
let first = 0

const validateNumber = async (carrier, countryCode, areaCode, cnam) => {
  const part = ['61', '44'].includes(countryCode) ? _part2 : part2
  // validatePhoneNpl can improved to multiple queries in one go, alcazar is already optimized
  const validatePhone = countryCode === '1' ? validatePhoneAlcazar : validatePhoneNpl
  const phone = countryCode + areaCode + part1() + part()

  if (first < parallelApiCalls) {
    log('Phone', phone)
    first++
  }

  if (duplicate[phone]) return log(`Duplicate ${phone}`)
  duplicate[phone] = true

  // neutrino for countries not US
  if (countryCode !== '1') {
    const res0 = await validatePhoneNeutrino(phone)
    if (!res0) return res0
  }

  const res1 = await validatePhone(carrier, phone)
  // log(phone, res1)
  if (!res1) return res1

  if (!cnam) {
    return [...res1]
  }

  // Use unified CNAM service (Telnyx → Multitel → SignalWire + cache)
  // Falls back to legacy SignalWire-only lookup if cnam-service not initialized
  try {
    const name = await lookupCnam(phone)
    return [...res1, name || 'Not Found']
  } catch (e) {
    // Fallback to legacy SignalWire direct lookup
    return [...res1, await validatePhoneSignalwire(phone)]
  }
}

const validateNumbersParallel = async (carrier, length, countryCode, areaCode, cnam) => {
  const promises = Array.from({ length }, () => validateNumber(carrier, countryCode, areaCode, cnam))
  try {
    const results = (await Promise.all(promises)).filter(r => r)

    const fullAc = '+' + countryCode + areaCode + ' ' + carrier
    const a = areaCodeCount[fullAc]
    const totalHits = (a?.totalHits || 0) + length
    const goodHits = (a?.goodHits || 0) + results.length
    const percentage = Number((goodHits / totalHits) * 100).toFixed() + '% Good Hits'
    areaCodeCount[fullAc] = { totalHits, goodHits, percentage }

    return results
  } catch (error) {
    console.error('validateNumbersParallel error', error?.message)
    return []
  }
}

const validateBulkNumbers = async (carrier, phonesToGenerate, countryCode, areaCodes, cnam, bot, chatId, lang, requireRealName = false) => {
  log({ phonesToGenerate, countryCode, areaCodes, cnam, requireRealName }, '\n')

  let i = 0
  const res = []
  let realNameCount = 0
  let elapsedTime = 0
  let noHitCount = 0
  const startTime = new Date()
  const t = translation('t', lang)

  // When requireRealName is true, we keep going until we have enough leads with real person names
  const targetCount = phonesToGenerate
  const isComplete = () => requireRealName && cnam ? realNameCount >= targetCount : res.length >= targetCount

  for (i = 0; !isComplete(); i++) {
    // Gen Phone Numbers and Verify
    const areaCode = areaCodes[getRandom(areaCodes.length)]
    const r = await Promise.all([
      sleep(waitAfterParallelApiCalls),
      validateNumbersParallel(carrier, parallelApiCalls, countryCode, areaCode, cnam),
    ])
    if (r[1]) {
      res.push(...r[1])
      // Count entries with real person names
      if (requireRealName && cnam) {
        for (const entry of r[1]) {
          if (entry[3] && isRealPersonName(entry[3])) {
            realNameCount++
          }
        }
      }
    }

    // Publish Progress
    const currentProgress = requireRealName && cnam ? realNameCount : (res.length > targetCount ? targetCount : res.length)
    const progress = t.buyLeadsProgress(currentProgress, targetCount)

    if (i % showProgressEveryXTime === 0) {
      bot && bot.sendMessage(chatId, progress)
      log(progress)
    }

    // Timeout Checks
    elapsedTime = new Date() - startTime
    if (elapsedTime > phoneGenTimeout) {
      bot && bot.sendMessage(chatId, t.phoneGenTimeout)
      bot &&
        bot.sendMessage(
          TELEGRAM_ADMIN_CHAT_ID,
          `${t.phoneGenTimeout} ElapsedTime ${elapsedTime / 1000} sec, ${JSON.stringify(areaCodeCount, 0, 2)}`,
        )
      return log({ phonesToGenerate, countryCode, areaCodes, cnam }, t.phoneGenTimeout, res)
    }
    noHitCount = !r[1] || r[1].length === 0 ? noHitCount + parallelApiCalls : 0
    log({ noHitCount, realNameCount, totalGenerated: res.length })
    if (noHitCount > phoneGenStopAtNoXHits) {
      bot && bot.sendMessage(chatId, t.phoneGenNoGoodHits)
      bot &&
        bot.sendMessage(
          TELEGRAM_ADMIN_CHAT_ID,
          `${t.phoneGenNoGoodHits} ElapsedTime ${elapsedTime / 1000} sec, ${JSON.stringify(areaCodeCount, 0, 2)}`,
        )
      return log({ phonesToGenerate, countryCode, areaCodes, cnam }, t.phoneGenNoGoodHits, res)
    }
  }

  log(
    'elapsedTime',
    elapsedTime / 1000,
    'seconds, total tries',
    i * parallelApiCalls,
    'got',
    res.length,
    'mobile numbers',
    requireRealName ? `(${realNameCount} with real names)` : '',
    '\nareaCodeCount',
    areaCodeCount,
  )
  return res
}

//
// validateBulkNumbers('T-mobile', 1, '1', ['310'], false).then(log) // US
// validateBulkNumbers('Mixed Carriers', 1, '1', ['310'], false).then(log) // US
// validateBulkNumbers('Mixed Carriers', 10, '1', ['416'], false).then(log) // Canada
// validateBulkNumbers('Mixed Carriers', 1, '61', ['4']).then(log) // Australia
// validateBulkNumbers('Mixed Carriers', 20, '44', ['71', '72', '73', '74', '75', '77', '78', '79']).then(log) // UK
// validateBulkNumbers('Mixed Carriers', 1, '64', ['23', '24', '25', '26']).then(log) // New Zealand

module.exports = { validateBulkNumbers, isRealPersonName }
