/* global require, module */
/**
 * Address auto-parser — heuristic fallback for users who send
 * an address as free-form text instead of the strict
 *   "Street, City, Postal Code, Country"
 * 4-comma format expected by twilioService.createAddress.
 *
 * The country code is ALWAYS known from `info.cpCountryCode`
 * (selected when the user picked the phone-number country),
 * so the 4th comma part is never actually used by the caller.
 * That means we only need to confidently extract:
 *   • street      (line / "house+street")
 *   • city
 *   • postalCode  (country-specific format)
 *   • region      (state/province — optional, only some carriers care)
 *
 * Strategy:
 *   1. Normalise: replace newlines / pipe / semi-colon with commas
 *   2. Split into tokens, trim
 *   3. Pull the postal code out via a country-specific regex
 *      (search every token from the back forward).
 *   4. Strip state/region codes (AU: VIC|NSW|…, US: 50 codes, etc.)
 *      from the token that held the postcode → that gives us a clean city
 *   5. Whatever is left becomes the street (joined with ", " if multiple).
 *
 * Returns either:
 *   { ok: true,  street, city, region, postalCode, country, confidence: 'high'|'medium' }
 *   { ok: false, reason }
 */

// ── Country-specific postal-code regexes ──
const POSTAL_REGEX = {
  US: /\b\d{5}(?:-\d{4})?\b/,
  CA: /\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i,
  GB: /\b(GIR ?0AA|[A-PR-UWYZ]([0-9]{1,2}|([A-HK-Y][0-9]([0-9]|[ABEHMNPRV-Y])?)|[0-9][A-HJKPS-UW]) ?[0-9][ABD-HJLNP-UW-Z]{2})\b/i,
  IE: /\b[A-Z]\d{2} ?[A-Z0-9]{4}\b/i,
  AU: /\b\d{4}\b/,
  NZ: /\b\d{4}\b/,
  FI: /\b\d{5}\b/,
  MX: /\b\d{5}\b/,
  DE: /\b\d{5}\b/,
  FR: /\b\d{5}\b/,
  ES: /\b\d{5}\b/,
  IT: /\b\d{5}\b/,
  NL: /\b\d{4} ?[A-Z]{2}\b/i,
  BE: /\b\d{4}\b/,
  AT: /\b\d{4}\b/,
  CH: /\b\d{4}\b/,
  SE: /\b\d{3} ?\d{2}\b/,
  NO: /\b\d{4}\b/,
  DK: /\b\d{4}\b/,
  PL: /\b\d{2}-\d{3}\b/,
  PT: /\b\d{4}-\d{3}\b/,
  CZ: /\b\d{3} ?\d{2}\b/,
  IN: /\b\d{6}\b/,
  JP: /\b\d{3}-?\d{4}\b/,
  KR: /\b\d{5}\b/,
  SG: /\b\d{6}\b/,
  BR: /\b\d{5}-?\d{3}\b/,
  AR: /\b[A-Z]?\d{4}[A-Z]{0,3}\b/i,
  ZA: /\b\d{4}\b/,
  HK: null,   // Hong Kong has no postal code
}

// ── State/region codes to strip (so they don't pollute "city") ──
const REGION_CODES = {
  AU: ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'],
  US: ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'],
  CA: ['ON','QC','NS','NB','MB','BC','PE','SK','AB','NL','NT','YT','NU'],
  MX: ['AGS','BC','BCS','CAMP','CHIS','CHIH','COAH','COL','CDMX','DGO','GTO','GRO','HGO','JAL','MEX','MICH','MOR','NAY','NL','OAX','PUE','QRO','QROO','SLP','SIN','SON','TAB','TAMPS','TLAX','VER','YUC','ZAC'],
}

/**
 * Try to extract a postal code from a token using a country regex.
 * Returns { postal, remainder } or null.
 */
function extractPostal(token, countryCode) {
  const rx = POSTAL_REGEX[countryCode]
  if (!rx) return null
  const m = token.match(rx)
  if (!m) return null
  const postal = m[0].toUpperCase()
  const remainder = token.replace(m[0], '').replace(/\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '').trim()
  return { postal, remainder }
}

/**
 * Strip a leading/trailing region/state code from a token.
 * Returns { region, remainder } — region '' if none found.
 */
function extractRegion(token, countryCode) {
  const codes = REGION_CODES[countryCode] || []
  if (!codes.length || !token) return { region: '', remainder: token }
  // Match a stand-alone state code anywhere in the token (word-boundary)
  const upper = token.toUpperCase()
  for (const code of codes) {
    const rx = new RegExp(`(^|[\\s,])${code}([\\s,]|$)`)
    if (rx.test(upper)) {
      const remainder = token.replace(new RegExp(`(^|[\\s,])${code}([\\s,]|$)`, 'i'), ' ')
        .replace(/\s+/g, ' ').replace(/^[\s,-]+|[\s,-]+$/g, '').trim()
      return { region: code, remainder }
    }
  }
  return { region: '', remainder: token }
}

/**
 * Parse a free-form address using the chosen country as a hint.
 *
 * @param {string} input       — raw user message
 * @param {string} countryCode — ISO-2 country code (always known from cpCountryCode)
 * @returns {object} parse result (see top of file)
 */
function autoParseAddress(input, countryCode) {
  if (!input || typeof input !== 'string') return { ok: false, reason: 'empty input' }
  const cc = (countryCode || '').toUpperCase()

  // 1) Normalise: convert newlines / pipes / semi-colons / tabs to commas
  let normalised = input.replace(/[\n\r\t|;]+/g, ',')
  // collapse repeated commas/spaces
  normalised = normalised.replace(/\s*,\s*/g, ', ').replace(/,+/g, ',').trim()

  // 2) Split into tokens
  let tokens = normalised.split(',').map(t => t.trim()).filter(Boolean)
  if (tokens.length === 0) return { ok: false, reason: 'empty tokens' }

  // ── If the user already gave us the canonical 4 parts, fast-path:
  if (tokens.length >= 4) {
    const street = tokens[0]
    const city = tokens[1]
    let postalCode = tokens[tokens.length - 2]
    let region = tokens.length >= 5 ? tokens[2] : ''
    // Validate the postal candidate against country regex.
    // Some users send "Street, City, State, Postcode, Country" (5 parts) — in
    // which case `tokens[len-2]` would be the postcode and `tokens[2]` the state.
    // Others send "Street, City, State, Postcode" (4 parts, no country) — here
    // `tokens[len-2]` would be the STATE not the postcode. Detect & swap.
    const rxPc = POSTAL_REGEX[cc]
    if (rxPc && !rxPc.test(postalCode)) {
      // Scan all tokens for a real postal code; treat what was "postal" as region.
      const realPostalIdx = tokens.findIndex(t => rxPc.test(t))
      if (realPostalIdx >= 0) {
        const realPostalToken = tokens[realPostalIdx]
        const ex = extractPostal(realPostalToken, cc)
        if (ex) {
          postalCode = ex.postal
          if (!region) region = tokens.slice(2, realPostalIdx).join(' ').trim()
        }
      }
    }
    return {
      ok: true,
      street, city, region, postalCode,
      country: cc,
      confidence: 'high',
      _wasStrict: true,
    }
  }

  // ── Heuristic mode: 1-3 tokens, need to extract postcode + city
  // 3) Find the postal code — search tokens from the end backwards
  let postal = ''
  let postalIdx = -1
  let postalTokenRemainder = ''
  for (let i = tokens.length - 1; i >= 0; i--) {
    const res = extractPostal(tokens[i], cc)
    if (res) {
      postal = res.postal
      postalIdx = i
      postalTokenRemainder = res.remainder
      break
    }
  }

  // HK / other postal-less countries: skip postal logic entirely
  if (cc === 'HK' || !POSTAL_REGEX[cc]) {
    if (tokens.length < 2) return { ok: false, reason: 'need at least street + city' }
    const street = tokens.slice(0, -1).join(', ')
    const city = tokens[tokens.length - 1]
    return { ok: true, street, city, region: '', postalCode: '', country: cc, confidence: 'medium' }
  }

  if (!postal) {
    return { ok: false, reason: `could not find a ${cc} postal code in the message` }
  }

  // 4) Strip region/state from the postal-carrying token
  let cityRemainder = postalTokenRemainder
  let region = ''
  const reg = extractRegion(cityRemainder, cc)
  if (reg.region) {
    region = reg.region
    cityRemainder = reg.remainder
  }

  // 5) City = whatever remained in the postal-carrying token after stripping postal + region.
  //    If the postal token had ONLY the postcode (e.g. "Tarneit VIC 3029" → "Tarneit"), we get "Tarneit".
  //    If the postal token had ONLY postcode (e.g. user wrote "3029" by itself),
  //    fall back to the previous token as city.
  let city = cityRemainder
  let streetTokens = tokens.slice(0, postalIdx)
  if (!city && streetTokens.length > 0) {
    // city is the last of the pre-postal tokens
    city = streetTokens.pop()
  }
  // Edge case: user sent "9 Cobram Street, Tarneit VIC 3029" (2 commas)
  // tokens=['9 Cobram Street','Tarneit VIC 3029']
  // postalIdx=1, cityRemainder='Tarneit', streetTokens=['9 Cobram Street'] ✓

  const street = streetTokens.filter(Boolean).join(', ')

  if (!street || !city) {
    return { ok: false, reason: 'could not separate street from city' }
  }

  return {
    ok: true,
    street: street.trim(),
    city: city.trim(),
    region: region.trim(),
    postalCode: postal.trim(),
    country: cc,
    confidence: 'medium',
  }
}

module.exports = { autoParseAddress }
