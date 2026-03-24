// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Twilio Service — Sub-accounts, Phone Numbers, SIP, Voice
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
require('dotenv').config()
const twilio = require('twilio')
const { log } = require('console')

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')

// ━━━ SECURITY: Main account SID — used to detect and block unauthorized main-account usage ━━━
const MAIN_ACCOUNT_SID = ACCOUNT_SID

// Stores the active Twilio SIP domain name (set during initialization)
let activeSipDomainName = null
function getTwilioSipDomainName() { return activeSipDomainName }

let mainClient = null

function getClient() {
  if (!mainClient && ACCOUNT_SID && AUTH_TOKEN) {
    mainClient = twilio(ACCOUNT_SID, AUTH_TOKEN)
  }
  return mainClient
}

function getSubClient(subSid, subToken) {
  return twilio(subSid, subToken)
}

// ━━━ SECURITY: Validate sub-account credentials — returns sub-client or throws ━━━
// User-facing operations MUST use sub-accounts. This prevents fallback to main account.
function requireSubClient(subSid, subToken, operation) {
  if (!subSid || !subToken) {
    log(`[Twilio] SECURITY BLOCK: ${operation} rejected — missing sub-account credentials (subSid=${!!subSid}, subToken=${!!subToken})`)
    return null
  }
  if (subSid === MAIN_ACCOUNT_SID) {
    log(`[Twilio] SECURITY BLOCK: ${operation} rejected — sub-account SID matches main account SID`)
    return null
  }
  return getSubClient(subSid, subToken)
}

function getMainAccountSid() { return MAIN_ACCOUNT_SID }

// ── Countries that require a full Regulatory Bundle (not just an address) ──
// Twilio requires a submitted+approved bundle before number purchase
// Countries requiring Twilio Regulatory Compliance bundles (Tier 2+)
// Full list from live API query — all countries needing supporting document uploads
const BUNDLE_REQUIRED_COUNTRIES = ['GB', 'IE', 'AU', 'NZ', 'HK', 'EE', 'CZ', 'KE', 'MY', 'PL', 'ZA', 'TH']

function needsBundle(countryCode) {
  return BUNDLE_REQUIRED_COUNTRIES.includes(countryCode)
}

// ── Available countries (verified via live Twilio API query — voice=true) ──
// addrReq: ['none'] = no address needed, ['any'] = address any country, ['local'] = address must be in-country
// prices: monthly Twilio cost per number type. Numbers < $5/mo are free with plan, >= $5 added as surcharge
const NO_COMPLIANCE_COUNTRIES = [
  // ── addrReq=none (instant buy, no address needed) ──
  { code: 'US', name: '🇺🇸 United States', types: ['local', 'toll_free'], prices: { local: 1.15, toll_free: 2.15 } },
  { code: 'CA', name: '🇨🇦 Canada', types: ['local', 'toll_free'], prices: { local: 1.15, toll_free: 2.15 } },
  { code: 'IL', name: '🇮🇱 Israel', types: ['local', 'mobile'], prices: { local: 4.25, mobile: 15.00 } },
  { code: 'PR', name: '🇵🇷 Puerto Rico', types: ['local'], prices: { local: 3.25 } },
  { code: 'GB', name: '🇬🇧 United Kingdom', types: ['mobile'], prices: { mobile: 1.15 } },
  { code: 'TN', name: '🇹🇳 Tunisia', types: ['local'], prices: { local: 120.00 } },
  { code: 'IE', name: '🇮🇪 Ireland', types: ['local'], addrReq: ['local'], prices: { local: 1.60 } },
  // ── addrReq=any (address required, any country — prompted after payment) ──
  { code: 'AU', name: '🇦🇺 Australia', types: ['toll_free', 'mobile'], addrReq: ['any'], prices: { toll_free: 16.00, mobile: 6.50 } },
  { code: 'FI', name: '🇫🇮 Finland', types: ['toll_free', 'mobile'], addrReq: ['any'], prices: { toll_free: 40.00, mobile: 5.00 } },
  { code: 'NZ', name: '🇳🇿 New Zealand', types: ['local', 'toll_free'], addrReq: ['any'], prices: { local: 3.15, toll_free: 40.00 } },
  { code: 'HK', name: '🇭🇰 Hong Kong', types: ['toll_free', 'mobile'], addrReq: ['any'], prices: { toll_free: 25.00, mobile: 15.00 } },
  { code: 'MX', name: '🇲🇽 Mexico', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 30.00 } },
  { code: 'CO', name: '🇨🇴 Colombia', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 25.00 } },
  { code: 'BG', name: '🇧🇬 Bulgaria', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 110.00 } },
  { code: 'CZ', name: '🇨🇿 Czech Republic', types: ['local', 'toll_free'], addrReq: ['any'], prices: { local: 1.50, toll_free: 35.00 } },
  { code: 'EE', name: '🇪🇪 Estonia', types: ['local', 'toll_free', 'mobile'], addrReq: ['any'], prices: { local: 1.00, toll_free: 38.00, mobile: 3.00 } },
  { code: 'ID', name: '🇮🇩 Indonesia', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 25.00 } },
  { code: 'IT', name: '🇮🇹 Italy', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 25.00 } },
  { code: 'KE', name: '🇰🇪 Kenya', types: ['local'], addrReq: ['any'], prices: { local: 16.00 } },
  { code: 'MY', name: '🇲🇾 Malaysia', types: ['local'], addrReq: ['any'], prices: { local: 4.00 } },
  { code: 'NL', name: '🇳🇱 Netherlands', types: ['mobile'], addrReq: ['any'], prices: { mobile: 6.00 } },
  { code: 'PL', name: '🇵🇱 Poland', types: ['mobile'], addrReq: ['any'], prices: { mobile: 4.00 } },
  { code: 'RO', name: '🇷🇴 Romania', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 25.00 } },
  { code: 'SK', name: '🇸🇰 Slovakia', types: ['toll_free'], addrReq: ['any'], prices: { toll_free: 25.00 } },
  { code: 'ZA', name: '🇿🇦 South Africa', types: ['local'], addrReq: ['any'], prices: { local: 1.50 } },
  { code: 'TH', name: '🇹🇭 Thailand', types: ['toll_free', 'mobile'], addrReq: ['any'], prices: { toll_free: 25.00, mobile: 22.00 } },
]

const NUMBER_COST_FREE_THRESHOLD = 5.00 // Numbers below this are free with plan

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-ACCOUNT MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function createSubAccount(friendlyName) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const account = await client.api.v2010.accounts.create({ friendlyName })
    log(`[Twilio] Created sub-account: ${account.sid} — ${friendlyName}`)
    return {
      accountSid: account.sid,
      authToken: account.authToken,
      friendlyName: account.friendlyName,
      status: account.status,
    }
  } catch (e) {
    log(`[Twilio] createSubAccount error: ${e.message}`)
    return { error: e.message }
  }
}

async function getSubAccount(subSid) {
  try {
    const client = getClient()
    const account = await client.api.v2010.accounts(subSid).fetch()
    return {
      accountSid: account.sid,
      authToken: account.authToken,
      friendlyName: account.friendlyName,
      status: account.status,
    }
  } catch (e) {
    log(`[Twilio] getSubAccount error: ${e.message}`)
    return { error: e.message }
  }
}

async function closeSubAccount(subSid) {
  try {
    const client = getClient()
    await client.api.v2010.accounts(subSid).update({ status: 'closed' })
    log(`[Twilio] Closed sub-account: ${subSid}`)
    return { success: true }
  } catch (e) {
    log(`[Twilio] closeSubAccount error: ${e.message}`)
    return { error: e.message }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHONE NUMBER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Area code overlay groups: same metro, alternative codes when primary is exhausted ──
const AREA_CODE_OVERLAYS = {
  '212': ['332', '646', '917', '718', '347', '929'],
  '332': ['212', '646', '917', '718', '347', '929'],
  '646': ['212', '332', '917', '718', '347', '929'],
  '310': ['424', '213', '323', '818', '747', '626'],
  '213': ['323', '310', '424', '818', '747', '626'],
  '312': ['773', '872', '708', '630'],
  '773': ['312', '872', '708', '630'],
  '305': ['786', '954', '754'],
  '786': ['305', '954', '754'],
  '713': ['832', '281', '346'],
  '832': ['713', '281', '346'],
  '214': ['972', '469', '945'],
  '972': ['214', '469', '945'],
  '415': ['628', '510'],
  '628': ['415', '510'],
  '206': ['253', '425', '564'],
  '253': ['206', '425', '564'],
}

async function searchNumbers(countryCode, numberType = 'local', limit = 5, areaCode = null) {
  try {
    const client = getClient()
    const params = { limit, voiceEnabled: true }
    if (areaCode && numberType === 'local') {
      params.areaCode = areaCode
    }

    const doSearch = async (searchParams) => {
      if (numberType === 'toll_free') {
        return client.availablePhoneNumbers(countryCode).tollFree.list(searchParams)
      } else if (numberType === 'mobile') {
        return client.availablePhoneNumbers(countryCode).mobile.list(searchParams)
      } else if (numberType === 'national') {
        return client.availablePhoneNumbers(countryCode).national.list(searchParams)
      } else {
        return client.availablePhoneNumbers(countryCode).local.list(searchParams)
      }
    }

    let numbers = await doSearch(params)

    // Fallback: if exact area code returned 0, try overlay area codes for same metro
    if (numbers.length === 0 && areaCode && numberType === 'local') {
      const overlays = AREA_CODE_OVERLAYS[areaCode]
      if (overlays) {
        log(`[Twilio] No numbers for ${areaCode}, trying overlay codes: ${overlays.join(',')}`)
        for (const alt of overlays) {
          if (numbers.length >= limit) break
          const altResults = await doSearch({ limit: limit - numbers.length, voiceEnabled: true, areaCode: alt }).catch(() => [])
          numbers = numbers.concat(altResults)
        }
      }
      // Last resort: search by state region if still empty
      if (numbers.length === 0 && countryCode === 'US') {
        log(`[Twilio] Overlay search empty, trying inRegion fallback`)
        numbers = await doSearch({ limit, voiceEnabled: true, inRegion: 'NY' }).catch(() => [])
      }
    }

    // Check if country has custom address requirements
    const countryConfig = NO_COMPLIANCE_COUNTRIES.find(c => c.code === countryCode)
    const allowedAddrReqs = countryConfig?.addrReq || ['none']
    return numbers
      .filter(n => allowedAddrReqs.includes(n.addressRequirements))
      .map(n => ({
        phone_number: n.phoneNumber,
        friendly_name: n.friendlyName,
        locality: n.locality,
        region: n.region,
        capabilities: n.capabilities,
        addressRequirements: n.addressRequirements,
      }))
  } catch (e) {
    log(`[Twilio] searchNumbers error (${countryCode}/${numberType}): ${e.message}`)
    return []
  }
}

async function buyNumber(phoneNumber, subSid, subToken, webhookBaseUrl, addressSid, bundleSid) {
  try {
    // ━━━ SECURITY: buyNumber on main account is ONLY allowed for buy-then-transfer flow ━━━
    // When subSid is null, number MUST be immediately transferred to a sub-account after purchase
    let client
    if (subSid && subToken) {
      client = requireSubClient(subSid, subToken, 'buyNumber')
      if (!client) return { error: 'Number purchase requires valid sub-account credentials.' }
    } else {
      log('[Twilio] NOTICE: buyNumber using main account — number MUST be transferred to sub-account immediately after purchase')
      client = getClient()
    }
    const voiceUrl = webhookBaseUrl ? `${webhookBaseUrl}/twilio/voice-webhook` : undefined
    const smsUrl = webhookBaseUrl ? `${webhookBaseUrl}/twilio/sms-webhook` : undefined
    const statusUrl = webhookBaseUrl ? `${webhookBaseUrl}/twilio/voice-status` : undefined
    const opts = {
      phoneNumber,
      voiceUrl,
      voiceMethod: 'POST',
      smsUrl,
      smsMethod: 'POST',
      statusCallback: statusUrl,
      statusCallbackMethod: 'POST',
    }
    if (addressSid) opts.addressSid = addressSid
    if (bundleSid) opts.bundleSid = bundleSid
    const num = await client.incomingPhoneNumbers.create(opts)
    log(`[Twilio] Purchased number: ${num.phoneNumber} (sid=${num.sid})`)
    return {
      phoneNumber: num.phoneNumber,
      sid: num.sid,
      friendlyName: num.friendlyName,
      capabilities: num.capabilities,
    }
  } catch (e) {
    log(`[Twilio] buyNumber error: ${e.message}`)
    return { error: e.message }
  }
}

// ── Create Address (for addrReq=any countries) ──
async function createAddress(customerName, street, city, region, postalCode, isoCountry, subSid, subToken) {
  try {
    // ━━━ SECURITY: Address creation MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'createAddress')
    if (!client) return { error: 'Address creation requires sub-account credentials. Cannot use main Twilio account.' }
    const addr = await client.addresses.create({
      customerName,
      street,
      city,
      region: region || '',
      postalCode: postalCode || '00000',
      isoCountry: isoCountry || 'US',
      friendlyName: `${customerName} — ${city}, ${isoCountry}`,
    })
    log(`[Twilio] Created address: ${addr.sid} — ${customerName}, ${city}, ${isoCountry}`)
    return { sid: addr.sid }
  } catch (e) {
    log(`[Twilio] createAddress error: ${e.message}`)
    return { error: e.message }
  }
}

async function releaseNumber(numberSid, subSid, subToken) {
  try {
    // ━━━ SECURITY: Release MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'releaseNumber')
    if (!client) return { error: 'Number release requires sub-account credentials. Cannot use main Twilio account.' }
    await client.incomingPhoneNumbers(numberSid).remove()
    log(`[Twilio] Released number: ${numberSid}`)
    return { success: true }
  } catch (e) {
    log(`[Twilio] releaseNumber error: ${e.message}`)
    return { error: e.message }
  }
}

async function updateNumberWebhooks(numberSid, webhookBaseUrl, subSid, subToken) {
  try {
    // ━━━ SECURITY: Webhook updates MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'updateNumberWebhooks')
    if (!client) return { error: 'Webhook update requires sub-account credentials. Cannot use main Twilio account.' }
    await client.incomingPhoneNumbers(numberSid).update({
      voiceUrl: `${webhookBaseUrl}/twilio/voice-webhook`,
      voiceMethod: 'POST',
      smsUrl: `${webhookBaseUrl}/twilio/sms-webhook`,
      smsMethod: 'POST',
      statusCallback: `${webhookBaseUrl}/twilio/voice-status`,
      statusCallbackMethod: 'POST',
    })
    return { success: true }
  } catch (e) {
    log(`[Twilio] updateNumberWebhooks error: ${e.message}`)
    return { error: e.message }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIP DOMAIN + CREDENTIAL MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function createSipDomain(domainName, webhookBaseUrl, subSid, subToken) {
  try {
    // ━━━ SECURITY: SIP domain creation MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'createSipDomain')
    if (!client) return { error: 'SIP domain creation requires sub-account credentials. Cannot use main Twilio account.' }
    const domain = await client.sip.domains.create({
      domainName,
      friendlyName: `Nomadly SIP — ${domainName}`,
      voiceUrl: `${webhookBaseUrl}/twilio/sip-voice`,
      voiceMethod: 'POST',
      sipRegistration: true,
    })
    log(`[Twilio] Created SIP domain: ${domain.domainName} (sid=${domain.sid})`)
    return { sid: domain.sid, domainName: domain.domainName }
  } catch (e) {
    log(`[Twilio] createSipDomain error: ${e.message}`)
    return { error: e.message }
  }
}

async function getOrCreateCredentialList(friendlyName, subSid, subToken) {
  try {
    // NOTE: SIP credential lists are managed on the main account (shared SIP domain)
    // This is intentional — all users share one SIP domain with one credential list
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
    // Check if credential list already exists
    const lists = await client.sip.credentialLists.list({ limit: 50 })
    const existing = lists.find(l => l.friendlyName === friendlyName)
    if (existing) return { sid: existing.sid, friendlyName: existing.friendlyName }
    // Create new
    const cl = await client.sip.credentialLists.create({ friendlyName })
    log(`[Twilio] Created credential list: ${cl.sid}`)
    return { sid: cl.sid, friendlyName: cl.friendlyName }
  } catch (e) {
    log(`[Twilio] getOrCreateCredentialList error: ${e.message}`)
    return { error: e.message }
  }
}

async function addSipCredential(credListSid, username, password, subSid, subToken) {
  try {
    // NOTE: SIP credentials are added to the main account's shared credential list
    // This is intentional — all users share one SIP domain
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
    const cred = await client.sip.credentialLists(credListSid).credentials.create({ username, password })
    log(`[Twilio] Added SIP credential: ${username} to list ${credListSid}`)
    return { sid: cred.sid, username: cred.username }
  } catch (e) {
    log(`[Twilio] addSipCredential error: ${e.message}`)
    return { error: e.message }
  }
}

async function removeSipCredential(credListSid, username) {
  try {
    const client = getClient()
    const creds = await client.sip.credentialLists(credListSid).credentials.list()
    const match = creds.find(c => c.username === username)
    if (match) {
      await client.sip.credentialLists(credListSid).credentials(match.sid).remove()
      log(`[Twilio] Removed SIP credential: ${username} from list ${credListSid}`)
      return { success: true }
    }
    log(`[Twilio] SIP credential ${username} not found in list ${credListSid}`)
    return { success: false, error: 'not found' }
  } catch (e) {
    log(`[Twilio] removeSipCredential error: ${e.message}`)
    return { error: e.message }
  }
}


async function mapCredentialListToDomain(domainSid, credListSid, subSid, subToken) {
  try {
    // ━━━ SECURITY: Credential list mapping MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'mapCredentialListToDomain')
    if (!client) return { error: 'Credential list mapping requires sub-account credentials. Cannot use main Twilio account.' }
    const mapping = await client.sip.domains(domainSid).auth.registrations.credentialListMappings.create({
      credentialListSid: credListSid,
    })
    log(`[Twilio] Mapped cred list ${credListSid} to domain ${domainSid}`)
    return { sid: mapping.sid }
  } catch (e) {
    log(`[Twilio] mapCredentialListToDomain error: ${e.message}`)
    return { error: e.message }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OUTBOUND SIP CALLS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function makeOutboundCall(from, to, twimlUrl, subSid, subToken, options = {}) {
  try {
    // ━━━ SECURITY: Outbound calls MUST use sub-account — never main account ━━━
    const client = requireSubClient(subSid, subToken, 'makeOutboundCall')
    if (!client) return { error: 'Outbound calls require a sub-account. Cannot use main Twilio account.' }
    const callOpts = {
      from,
      to,
      url: twimlUrl,
      method: 'POST',
    }
    if (options.statusCallback) {
      callOpts.statusCallback = options.statusCallback
      callOpts.statusCallbackMethod = 'POST'
      callOpts.statusCallbackEvent = options.statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed']
    }
    if (options.machineDetection) {
      callOpts.machineDetection = options.machineDetection
    }
    if (options.timeout) {
      callOpts.timeout = options.timeout
    }
    const call = await client.calls.create(callOpts)
    log(`[Twilio] Outbound call: ${call.sid} from=${from} to=${to}`)
    return {
      callSid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
    }
  } catch (e) {
    log(`[Twilio] makeOutboundCall error: ${e.message}`)
    const sanitized = e.message
      .replace(/\bTwilio\b/gi, 'Speechcue')
      .replace(/\bTelnyx\b/gi, 'Speechcue')
    return { error: sanitized }
  }
}

// ── TRIAL OUTBOUND CALL — Uses main Twilio account for free trial IVR calls ──
// Trial calls use the shared trial number (+18556820054) which lives on the main account.
// This is the ONLY function that bypasses sub-account requirement.
async function makeTrialOutboundCall(from, to, twimlUrl, options = {}) {
  try {
    const client = getClient()
    if (!client) return { error: 'Twilio main client not initialized.' }
    log(`[Twilio] Trial outbound call: ${from} → ${to} (main account)`)
    const callOpts = {
      from,
      to,
      url: twimlUrl,
      method: 'POST',
    }
    if (options.statusCallback) {
      callOpts.statusCallback = options.statusCallback
      callOpts.statusCallbackMethod = 'POST'
      callOpts.statusCallbackEvent = options.statusCallbackEvent || ['initiated', 'ringing', 'answered', 'completed']
    }
    if (options.timeout) {
      callOpts.timeout = options.timeout
    }
    const call = await client.calls.create(callOpts)
    log(`[Twilio] Trial call initiated: ${call.sid} from=${from} to=${to}`)
    return {
      callSid: call.sid,
      status: call.status,
      from: call.from,
      to: call.to,
    }
  } catch (e) {
    log(`[Twilio] makeTrialOutboundCall error: ${e.message}`)
    const sanitized = e.message
      .replace(/\bTwilio\b/gi, 'Speechcue')
      .replace(/\bTelnyx\b/gi, 'Speechcue')
    return { error: sanitized }
  }
}

// Generate TwiML for dialing out (used for SIP-originated outbound calls)
function generateDialTwiml(to, callerId) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  response.dial({ callerId }).number(to)
  return response.toString()
}

// Generate TwiML for call forwarding
function generateForwardTwiml(forwardTo, callerId) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  const dial = response.dial({ callerId, timeout: 30 })
  dial.number(forwardTo)
  return response.toString()
}

// Generate TwiML to reject call
function generateRejectTwiml(reason) {
  const VoiceResponse = twilio.twiml.VoiceResponse
  const response = new VoiceResponse()
  response.say(reason || 'This call cannot be completed.')
  response.hangup()
  return response.toString()
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// READ-ONLY: Get existing Twilio resources without updating webhooks
// Used when SKIP_WEBHOOK_SYNC=true to prevent preview pods from overwriting production URLs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getTwilioResourcesFromEnv() {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    log('[Twilio] No credentials configured — skipping read-only init')
    return null
  }
  log('━━━ Reading Twilio Resources (READ-ONLY — no webhook updates) ━━━')
  try {
    const client = getClient()

    // Find existing SIP domain — DO NOT create or update
    const domains = await client.sip.domains.list({ limit: 20 })
    const sipDomain = domains.find(d => d.domainName?.startsWith('speechcue-'))
      || domains.find(d => d.friendlyName?.includes('Nomadly') || d.domainName?.startsWith('nomadly-'))

    if (!sipDomain) {
      log('[Twilio] READ-ONLY: No SIP domain found — cannot proceed without full init')
      return null
    }

    log(`[Twilio] READ-ONLY: Found SIP domain: ${sipDomain.domainName} (voiceUrl: ${sipDomain.voiceUrl})`)

    // Find existing credential list — DO NOT create
    const credLists = await client.sip.credentialLists.list({ limit: 20 })
    const credList = credLists.find(cl => cl.friendlyName?.includes('Speechcue'))
      || credLists.find(cl => cl.friendlyName?.includes('Nomadly'))

    activeSipDomainName = sipDomain.domainName
    return {
      sipDomainSid: sipDomain.sid,
      sipDomainName: sipDomain.domainName,
      credentialListSid: credList?.sid || null,
      accountSid: ACCOUNT_SID,
    }
  } catch (e) {
    log(`[Twilio] READ-ONLY init error: ${e.message}`)
    return null
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETUP: Initialize Twilio Resources on Startup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function initializeTwilioResources(selfUrl) {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    log('[Twilio] No credentials configured — skipping initialization')
    return null
  }
  log('━━━ Initializing Twilio Resources ━━━')
  try {
    const client = getClient()
    const account = await client.api.v2010.accounts(ACCOUNT_SID).fetch()
    log(`[Twilio] Connected: ${account.friendlyName} (${account.status})`)

    // Get or create master SIP domain — prefer 'speechcue-' prefix, migrate from 'nomadly-' if needed
    const domains = await client.sip.domains.list({ limit: 20 })
    let sipDomain = domains.find(d => d.domainName?.startsWith('speechcue-'))
    const oldDomain = !sipDomain ? domains.find(d => d.friendlyName?.includes('Nomadly') || d.domainName?.startsWith('nomadly-')) : null

    if (!sipDomain) {
      const domainPrefix = 'speechcue-' + ACCOUNT_SID.slice(-6).toLowerCase()
      sipDomain = await client.sip.domains.create({
        domainName: `${domainPrefix}.sip.twilio.com`,
        friendlyName: 'Speechcue Cloud Phone SIP',
        voiceUrl: `${selfUrl}/twilio/sip-voice`,
        voiceMethod: 'POST',
        sipRegistration: true,
      })
      log(`[Twilio] Created SIP domain: ${sipDomain.domainName}`)
    } else {
      // Update voice URL
      await client.sip.domains(sipDomain.sid).update({
        voiceUrl: `${selfUrl}/twilio/sip-voice`,
        voiceMethod: 'POST',
      })
      log(`[Twilio] Updated SIP domain webhook: ${sipDomain.domainName}`)
    }

    // Get or create master credential list
    const credList = await getOrCreateCredentialList('Speechcue SIP Credentials')

    // Map credential list to domain if not already mapped
    try {
      await client.sip.domains(sipDomain.sid).auth.registrations.credentialListMappings.create({
        credentialListSid: credList.sid,
      })
      log(`[Twilio] Mapped credential list to SIP domain`)
    } catch (e) {
      if (!e.message?.includes('already exists')) {
        log(`[Twilio] Credential mapping note: ${e.message}`)
      }
    }

    // ── CRITICAL FIX: Configure IP ACL for incoming SIP calls from Telnyx ──
    // The credential list above only authenticates SIP REGISTER requests (for device registration).
    // Incoming SIP INVITE requests (actual calls) need separate authentication via IP ACL.
    // Without this, Twilio rejects all incoming SIP calls with call_rejected.
    try {
      // Get or create IP ACL for Telnyx
      let telnyxIpAcl = null
      const existingAcls = await client.sip.ipAccessControlLists.list({ limit: 50 })
      telnyxIpAcl = existingAcls.find(acl => acl.friendlyName?.includes('Telnyx'))

      if (!telnyxIpAcl) {
        telnyxIpAcl = await client.sip.ipAccessControlLists.create({
          friendlyName: 'Telnyx SIP Signaling IPs'
        })
        log(`[Twilio] Created IP ACL for Telnyx: ${telnyxIpAcl.sid}`)

        // Add Telnyx signaling IPs for all regions
        const telnyxIps = [
          { name: 'Telnyx US Primary', ip: '192.76.120.10' },
          { name: 'Telnyx US Secondary', ip: '64.16.250.10' },
          { name: 'Telnyx US Tertiary', ip: '192.76.120.31' },
          { name: 'Telnyx US Quaternary', ip: '64.16.250.13' },
          { name: 'Telnyx Europe Primary', ip: '185.246.41.140' },
          { name: 'Telnyx Europe Secondary', ip: '185.246.41.141' },
          { name: 'Telnyx Australia Primary', ip: '103.115.244.145' },
          { name: 'Telnyx Australia Secondary', ip: '103.115.244.146' },
        ]

        for (const { name, ip } of telnyxIps) {
          try {
            await client.sip.ipAccessControlLists(telnyxIpAcl.sid).ipAddresses.create({
              friendlyName: name,
              ipAddress: ip
            })
          } catch (e) {
            if (!e.message?.includes('already exists')) {
              log(`[Twilio] IP add note: ${name} (${ip}) - ${e.message}`)
            }
          }
        }
        log(`[Twilio] Added ${telnyxIps.length} Telnyx IP addresses to ACL`)
      }

      // Map IP ACL to SIP domain for incoming calls (auth.calls, not auth.registrations)
      try {
        await client.sip.domains(sipDomain.sid).auth.calls.ipAccessControlListMappings.create({
          ipAccessControlListSid: telnyxIpAcl.sid
        })
        log(`[Twilio] ✅ Mapped Telnyx IP ACL to SIP domain for incoming calls`)
      } catch (e) {
        if (!e.message?.includes('already exists')) {
          log(`[Twilio] IP ACL mapping note: ${e.message}`)
        } else {
          log(`[Twilio] ✅ Telnyx IP ACL already mapped to SIP domain`)
        }
      }
    } catch (aclErr) {
      log(`[Twilio] ⚠️ IP ACL configuration error: ${aclErr.message}`)
      log(`[Twilio] Incoming SIP calls from Telnyx may be rejected without IP ACL`)
    }

    // Migrate credentials from old domain and clean it up
    if (oldDomain) {
      try {
        // Also map credentials to old domain during transition (so existing registrations still work)
        try {
          await client.sip.domains(oldDomain.sid).auth.registrations.credentialListMappings.create({ credentialListSid: credList.sid })
        } catch (_) { /* already mapped or not needed */ }
        log(`[Twilio] Old domain ${oldDomain.domainName} kept for transition`)
      } catch (e) {
        log(`[Twilio] Old domain cleanup note: ${e.message}`)
      }
    }

    activeSipDomainName = sipDomain.domainName
    return {
      sipDomainSid: sipDomain.sid,
      sipDomainName: sipDomain.domainName,
      credentialListSid: credList.sid,
      accountSid: ACCOUNT_SID,
    }
  } catch (e) {
    log(`[Twilio] Initialization error: ${e.message}`)
    return null
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRANSFER NUMBER TO SUB-ACCOUNT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function transferNumberToSubAccount(numberSid, subAccountSid) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const updated = await client.incomingPhoneNumbers(numberSid).update({
      accountSid: subAccountSid,
    })
    log(`[Twilio] Transferred number ${numberSid} to sub-account ${subAccountSid}`)
    return { success: true, phoneNumber: updated.phoneNumber, sid: updated.sid }
  } catch (e) {
    log(`[Twilio] transferNumberToSubAccount error: ${e.message}`)
    return { error: e.message }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPDATE NUMBER WEBHOOKS ON SUB-ACCOUNT (via parent)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function updateSubAccountNumberWebhooks(subSid, numberSid, webhookBaseUrl) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    await client.api.v2010.accounts(subSid).incomingPhoneNumbers(numberSid).update({
      voiceUrl: `${webhookBaseUrl}/twilio/voice-webhook`,
      voiceMethod: 'POST',
      smsUrl: `${webhookBaseUrl}/twilio/sms-webhook`,
      smsMethod: 'POST',
      statusCallback: `${webhookBaseUrl}/twilio/voice-status`,
      statusCallbackMethod: 'POST',
    })
    log(`[Twilio] Updated webhooks for number ${numberSid} on sub-account ${subSid}`)
    return { success: true }
  } catch (e) {
    log(`[Twilio] updateSubAccountNumberWebhooks error: ${e.message}`)
    return { error: e.message }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REGULATORY BUNDLE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch the Regulation SID for a given country + number type + end-user type.
 * Twilio requires this when creating a regulatory bundle.
 */
async function getRegulationSid(isoCountry, numberType, endUserType) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const regulations = await client.numbers.v2.regulatoryCompliance.regulations.list({
      isoCountry,
      numberType: numberType || 'local',
      endUserType: endUserType || 'individual',
      limit: 5,
    })
    if (regulations.length === 0) {
      log(`[Twilio] No regulation found for ${isoCountry}/${numberType}/${endUserType}`)
      return { error: `No regulation found for ${isoCountry}` }
    }
    const reg = regulations[0]
    log(`[Twilio] Regulation SID for ${isoCountry}: ${reg.sid} (${reg.friendlyName})`)
    return { sid: reg.sid, friendlyName: reg.friendlyName }
  } catch (e) {
    log(`[Twilio] getRegulationSid error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Create an End-User entity (individual or business) for regulatory compliance.
 */
async function createEndUser(friendlyName, type, attributes) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const endUser = await client.numbers.v2.regulatoryCompliance.endUsers.create({
      friendlyName,
      type: type || 'individual',
      attributes: attributes || {},
    })
    log(`[Twilio] Created end-user: ${endUser.sid} (${friendlyName}, ${type})`)
    return { sid: endUser.sid, type: endUser.type }
  } catch (e) {
    log(`[Twilio] createEndUser error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Create a Regulatory Compliance Bundle for a specific country/number type.
 */
async function createBundle(friendlyName, email, isoCountry, numberType, endUserType, regulationSid, statusCallback) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const opts = {
      friendlyName,
      email: email || process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com',
    }
    // When regulationSid is provided, use it ALONE — passing isoCountry/numberType/endUserType
    // alongside regulationSid causes Twilio to return "ambiguous regulation parameters"
    if (regulationSid) {
      opts.regulationSid = regulationSid
    } else {
      opts.endUserType = endUserType || 'individual'
      opts.isoCountry = isoCountry || 'ZA'
      opts.numberType = numberType || 'local'
    }
    if (statusCallback) opts.statusCallback = statusCallback
    const bundle = await client.numbers.v2.regulatoryCompliance.bundles.create(opts)
    log(`[Twilio] Created bundle: ${bundle.sid} (${friendlyName}, ${isoCountry}, status=${bundle.status})`)
    return { sid: bundle.sid, status: bundle.status }
  } catch (e) {
    log(`[Twilio] createBundle error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Create a Supporting Document for regulatory compliance.
 * Twilio bundles only accept End-User SIDs and Supporting Document SIDs,
 * NOT raw Address SIDs. This wraps an Address SID into a Supporting Document.
 * For address proof, use type='tax_document' with attributes={address_sids: addressSid}.
 */
async function createSupportingDocument(friendlyName, type, attributes) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    // Ensure address_sids is always an array (Twilio requires array format)
    if (attributes && attributes.address_sids && !Array.isArray(attributes.address_sids)) {
      attributes.address_sids = [attributes.address_sids]
    }
    const doc = await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName,
      type: type || 'tax_document',
      attributes: attributes || {},
    })
    log(`[Twilio] Created supporting document: ${doc.sid} (${friendlyName}, type=${type})`)
    return { sid: doc.sid, status: doc.status }
  } catch (e) {
    log(`[Twilio] createSupportingDocument error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Add an item (supporting document or end-user) to a regulatory bundle.
 */
async function addBundleItem(bundleSid, objectSid) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const item = await client.numbers.v2.regulatoryCompliance.bundles(bundleSid).itemAssignments.create({
      objectSid,
    })
    log(`[Twilio] Added item ${objectSid} to bundle ${bundleSid}`)
    return { sid: item.sid }
  } catch (e) {
    log(`[Twilio] addBundleItem error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Submit a bundle for review (changes status from 'draft' to 'pending-review').
 */
async function submitBundle(bundleSid) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const bundle = await client.numbers.v2.regulatoryCompliance.bundles(bundleSid).update({
      status: 'pending-review',
    })
    log(`[Twilio] Bundle ${bundleSid} submitted for review (status=${bundle.status})`)
    return { sid: bundle.sid, status: bundle.status }
  } catch (e) {
    log(`[Twilio] submitBundle error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Fetch the current status of a regulatory bundle.
 * Possible statuses: draft, pending-review, in-review, twilio-approved, twilio-rejected, provisionally-approved
 */
async function getBundleStatus(bundleSid) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')
    const bundle = await client.numbers.v2.regulatoryCompliance.bundles(bundleSid).fetch()
    log(`[Twilio] Bundle ${bundleSid} status: ${bundle.status}`)
    return {
      sid: bundle.sid,
      status: bundle.status,
      friendlyName: bundle.friendlyName,
      validUntil: bundle.validUntil,
    }
  } catch (e) {
    log(`[Twilio] getBundleStatus error: ${e.message}`)
    return { error: e.message }
  }
}

/**
 * Sanitize rejection reason text — remove any provider-specific branding
 * so users only see neutral telecom compliance language.
 */
function sanitizeRejectionReason(reason) {
  if (!reason || typeof reason !== 'string') return 'Document did not meet verification requirements.'
  return reason
    .replace(/Twilio/gi, '')
    .replace(/our Regulatory Requirements criteria/gi, 'the telecom regulatory requirements')
    .replace(/our Guidelines/gi, 'the regulatory guidelines')
    .replace(/our requirements/gi, 'the requirements')
    .replace(/our criteria/gi, 'the criteria')
    .replace(/Please upload a Supporting Document according to/gi, 'Please re-upload a document that meets')
    .replace(/Supporting Document/gi, 'supporting document')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Get rejection reasons for a bundle by fetching its item assignments
 * and checking each SupportingDocument for failure_reason.
 */
async function getDocRejectionReasons(bundleSid) {
  try {
    const client = getClient()
    if (!client) throw new Error('Twilio client not initialized')

    // Fetch item assignments for the bundle
    const items = await client.numbers.v2.regulatoryCompliance
      .bundles(bundleSid).itemAssignments.list()

    const reasons = []
    for (const item of items) {
      // Only check SupportingDocuments (SID starts with RD)
      if (!item.objectSid || !item.objectSid.startsWith('RD')) continue
      try {
        const doc = await client.numbers.v2.regulatoryCompliance
          .supportingDocuments(item.objectSid).fetch()
        if (doc.status === 'rejected' || doc.failureReason) {
          // Map Twilio doc types to user-friendly names
          const typeNames = {
            government_issued_document: 'Government-issued ID',
            utility_bill: 'Proof of Address / Utility Bill',
            tax_document: 'Tax Document / Proof of Address',
            business_registration: 'Business Registration',
            power_of_attorney: 'Power of Attorney',
          }
          reasons.push({
            docSid: doc.sid,
            docType: doc.type,
            docName: typeNames[doc.type] || doc.type,
            friendlyName: doc.friendlyName,
            status: doc.status,
            failureReason: sanitizeRejectionReason(doc.failureReason || 'Document did not meet verification requirements.'),
          })
        }
      } catch (docErr) {
        log(`[Twilio] Error fetching doc ${item.objectSid}: ${docErr.message}`)
      }
    }
    log(`[Twilio] Bundle ${bundleSid} rejection reasons: ${reasons.length} rejected doc(s)`)
    return reasons
  } catch (e) {
    log(`[Twilio] getDocRejectionReasons error: ${e.message}`)
    return []
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CALLER ID VERIFICATION: Verify sub-account numbers on main account
// Required for SIP bridge: main account SIP domain must use sub-account numbers as caller ID
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// In-memory store for pending verification codes (code → phoneNumber)
const pendingVerifications = {}

/**
 * Check if a phone number is verified as an outgoing caller ID on the main account
 */
async function isCallerIdVerified(phoneNumber) {
  try {
    const client = getClient()
    if (!client) return false
    const callerIds = await client.outgoingCallerIds.list({ phoneNumber })
    return callerIds.length > 0
  } catch (e) {
    log(`[Twilio] isCallerIdVerified error: ${e.message}`)
    return false
  }
}

/**
 * Verify a sub-account phone number as an outgoing caller ID on the main account.
 * This is required for the SIP bridge flow: the main account's SIP domain needs to
 * use <Dial callerId="+1xxx"> with sub-account numbers.
 * 
 * Flow:
 * 1. Create a validation request on the main account
 * 2. Twilio calls the phone number with a verification PIN
 * 3. Our /twilio/verify-callerid endpoint answers and plays the PIN via DTMF
 * 4. Number is verified on the main account
 * 
 * @param {string} phoneNumber - The sub-account phone number to verify
 * @param {string} subSid - Sub-account SID  
 * @param {string} subToken - Sub-account auth token
 * @param {string} selfUrl - The server's webhook base URL
 * @param {string} phoneSid - The phone number resource SID (PN...)
 * @returns {boolean} Whether verification succeeded
 */
async function verifyCallerIdOnMainAccount(phoneNumber, subSid, subToken, selfUrl, phoneSid) {
  try {
    const mainClient = getClient()
    if (!mainClient) throw new Error('Twilio main client not initialized')

    // Check if already verified
    const existing = await mainClient.outgoingCallerIds.list({ phoneNumber })
    if (existing.length > 0) {
      log(`[Twilio] Caller ID ${phoneNumber} already verified on main account`)
      return true
    }

    const subClient = require('twilio')(subSid, subToken)

    // Step 1: Save the original webhook URL
    const numberResource = await subClient.incomingPhoneNumbers(phoneSid).fetch()
    const originalVoiceUrl = numberResource.voiceUrl
    const originalVoiceMethod = numberResource.voiceMethod

    // Step 2: Create validation request (Twilio will call the number)
    const validation = await mainClient.validationRequests.create({
      phoneNumber,
      friendlyName: `Nomadly-Bridge-${phoneNumber}`,
      callDelay: 10, // 10s delay before calling
    })
    const code = validation.validationCode
    log(`[Twilio] Caller ID verification started for ${phoneNumber} (code: ${code})`)

    // Step 3: Store the code and redirect the number's webhook
    pendingVerifications[phoneNumber] = code
    await subClient.incomingPhoneNumbers(phoneSid).update({
      voiceUrl: `${selfUrl}/twilio/verify-callerid?code=${code}`,
      voiceMethod: 'POST',
    })

    // Step 4: Wait for verification to complete (up to 60 seconds)
    let verified = false
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const callerIds = await mainClient.outgoingCallerIds.list({ phoneNumber })
      if (callerIds.length > 0) {
        verified = true
        log(`[Twilio] ✅ Caller ID ${phoneNumber} verified on main account (SID: ${callerIds[0].sid})`)
        break
      }
    }

    // Step 5: Always restore the original webhook
    await subClient.incomingPhoneNumbers(phoneSid).update({
      voiceUrl: originalVoiceUrl || `${selfUrl}/twilio/voice-webhook`,
      voiceMethod: originalVoiceMethod || 'POST',
    })
    delete pendingVerifications[phoneNumber]

    if (!verified) {
      log(`[Twilio] ⚠️ Caller ID verification for ${phoneNumber} timed out`)
    }
    return verified
  } catch (e) {
    log(`[Twilio] Caller ID verification error for ${phoneNumber}: ${e.message}`)
    return false
  }
}

/**
 * Verify all active Twilio sub-account numbers as caller IDs on the main account.
 * Called during startup or as a maintenance task.
 */
async function verifyAllTwilioCallerIds(db, selfUrl) {
  try {
    const phoneNumbers = await db.collection('phoneNumbersOf').find({}).toArray()
    for (const doc of phoneNumbers) {
      const numbers = doc.val?.numbers || []
      for (const num of numbers) {
        if (num.provider === 'twilio' && num.status === 'active' && num.phoneNumber) {
          const alreadyVerified = await isCallerIdVerified(num.phoneNumber)
          if (!alreadyVerified) {
            log(`[Twilio] Need to verify caller ID: ${num.phoneNumber}`)
            const subSid = num.twilioSubAccountSid || doc.val?.twilioSubAccountSid
            const subToken = num.twilioSubAccountToken || doc.val?.twilioSubAccountToken
            if (subSid && subToken && num.twilioPhoneSid) {
              await verifyCallerIdOnMainAccount(num.phoneNumber, subSid, subToken, selfUrl, num.twilioPhoneSid)
            } else {
              log(`[Twilio] Missing sub-account credentials for ${num.phoneNumber} — skipping verification`)
            }
          }
        }
      }
    }
  } catch (e) {
    log(`[Twilio] verifyAllTwilioCallerIds error: ${e.message}`)
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports = {
  getClient,
  getSubClient,
  requireSubClient,
  getMainAccountSid,
  createSubAccount,
  getSubAccount,
  closeSubAccount,
  searchNumbers,
  buyNumber,
  releaseNumber,
  updateNumberWebhooks,
  createSipDomain,
  getOrCreateCredentialList,
  addSipCredential,
  removeSipCredential,
  mapCredentialListToDomain,
  makeOutboundCall,
  makeTrialOutboundCall,
  generateDialTwiml,
  generateForwardTwiml,
  generateRejectTwiml,
  initializeTwilioResources,
  getTwilioResourcesFromEnv,
  transferNumberToSubAccount,
  updateSubAccountNumberWebhooks,
  getTwilioSipDomainName,
  createAddress,
  NO_COMPLIANCE_COUNTRIES,
  NUMBER_COST_FREE_THRESHOLD,
  CALL_FORWARDING_RATE_MIN,
  // Regulatory bundle
  BUNDLE_REQUIRED_COUNTRIES,
  needsBundle,
  getRegulationSid,
  createEndUser,
  createSupportingDocument,
  createBundle,
  addBundleItem,
  submitBundle,
  getBundleStatus,
  getDocRejectionReasons,
  sanitizeRejectionReason,
}
