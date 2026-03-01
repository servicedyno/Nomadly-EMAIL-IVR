// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Twilio Service — Sub-accounts, Phone Numbers, SIP, Voice
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
require('dotenv').config()
const twilio = require('twilio')
const { log } = require('console')

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const CALL_FORWARDING_RATE_MIN = parseFloat(process.env.CALL_FORWARDING_RATE_MIN || '0.50')

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

    // Fallback: if exact area code returned 0, try nearNumber with a seed from that area
    if (numbers.length === 0 && areaCode && numberType === 'local') {
      log(`[Twilio] No numbers for area code ${areaCode}, trying nearNumber fallback`)
      const fallbackParams = { limit, voiceEnabled: true, nearNumber: `+1${areaCode}0000000` }
      numbers = await doSearch(fallbackParams).catch(() => [])
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

async function buyNumber(phoneNumber, subSid, subToken, webhookBaseUrl, addressSid) {
  try {
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    const client = subSid && subToken ? getSubClient(subSid, subToken) : getClient()
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
    return { error: e.message }
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
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports = {
  getClient,
  getSubClient,
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
  generateDialTwiml,
  generateForwardTwiml,
  generateRejectTwiml,
  initializeTwilioResources,
  transferNumberToSubAccount,
  updateSubAccountNumberWebhooks,
  getTwilioSipDomainName,
  createAddress,
  NO_COMPLIANCE_COUNTRIES,
  NUMBER_COST_FREE_THRESHOLD,
  CALL_FORWARDING_RATE_MIN,
}
