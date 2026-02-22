// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Telnyx API v2 Service — All HTTP calls to Telnyx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const axios = require('axios')
const { log } = require('console')

const TELNYX_API_KEY = process.env.TELNYX_API_KEY
const BASE = 'https://api.telnyx.com/v2'

const headers = () => ({
  'Authorization': `Bearer ${TELNYX_API_KEY}`,
  'Content-Type': 'application/json'
})

// ── Search available phone numbers ──
async function searchNumbers(countryCode, numberType, areaCode, limit = 5) {
  const params = {
    'filter[country_code]': countryCode || 'US',
    'filter[phone_number_type]': numberType || 'local',
    'filter[limit]': limit,
    'filter[best_effort]': true,
  }
  if (areaCode) params['filter[national_destination_code]'] = areaCode
  // Request voice and sms capable numbers
  params['filter[features][]'] = ['sms', 'voice']

  try {
    const res = await axios.get(`${BASE}/available_phone_numbers`, { headers: headers(), params })
    const numbers = res.data?.data || []
    // Enrich each result with parsed capabilities
    return numbers.map(n => ({
      ...n,
      _capabilities: {
        voice: (n.features || []).some(f => f.name === 'voice'),
        sms: (n.features || []).some(f => f.name === 'sms'),
        mms: (n.features || []).some(f => f.name === 'mms'),
        fax: (n.features || []).some(f => f.name === 'fax'),
      }
    }))
  } catch (e) {
    log('Telnyx searchNumbers error:', e.response?.data || e.message)
    return []
  }
}

/**
 * Get capabilities for an already-purchased number from Telnyx API
 */
async function getNumberCapabilities(phoneNumber) {
  try {
    const encoded = encodeURIComponent(phoneNumber)
    const res = await axios.get(`${BASE}/phone_numbers/${encoded}`, { headers: headers() })
    const data = res.data?.data
    if (!data) return { voice: true, sms: true, fax: false }
    const features = data.features || []
    return {
      voice: features.some(f => f.name === 'voice') || true,
      sms: features.some(f => f.name === 'sms'),
      mms: features.some(f => f.name === 'mms'),
      fax: features.some(f => f.name === 'fax'),
    }
  } catch (e) {
    log('Telnyx getNumberCapabilities error:', e.response?.data?.errors?.[0]?.detail || e.message)
    return { voice: true, sms: true, fax: false }
  }
}

// ── Buy a phone number ──
async function buyNumber(phoneNumber, connectionId, messagingProfileId) {
  try {
    const body = {
      phone_numbers: [{ phone_number: phoneNumber }]
    }
    if (connectionId) body.connection_id = connectionId
    if (messagingProfileId) body.messaging_profile_id = messagingProfileId

    const res = await axios.post(`${BASE}/number_orders`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx buyNumber error:', e.response?.data || e.message)
    return null
  }
}

// ── Update a phone number (assign connection, messaging profile) ──
async function updateNumber(phoneNumberId, updates) {
  try {
    const res = await axios.patch(`${BASE}/phone_numbers/${phoneNumberId}`, updates, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx updateNumber error:', e.response?.data || e.message)
    return null
  }
}

// ── Release a phone number ──
async function releaseNumber(phoneNumberId) {
  try {
    const res = await axios.delete(`${BASE}/phone_numbers/${phoneNumberId}`, { headers: headers() })
    return true
  } catch (e) {
    log('Telnyx releaseNumber error:', e.response?.data || e.message)
    return false
  }
}

// ── Release by phone number string (lookup then delete) ──
async function releaseByPhoneNumber(phoneNumber) {
  try {
    const clean = phoneNumber.replace(/[^+\d]/g, '')
    const res = await axios.get(`${BASE}/phone_numbers`, {
      headers: headers(),
      params: { 'filter[phone_number]': clean, 'page[size]': 1 }
    })
    const found = res.data?.data?.[0]
    if (found) {
      await axios.delete(`${BASE}/phone_numbers/${found.id}`, { headers: headers() })
      log(`Telnyx releaseByPhoneNumber: released ${clean} (id=${found.id})`)
      return true
    }
    log(`Telnyx releaseByPhoneNumber: number ${clean} not found on account`)
    return false
  } catch (e) {
    log('Telnyx releaseByPhoneNumber error:', e.response?.data || e.message)
    return false
  }
}

// ── List owned phone numbers ──
async function listNumbers() {
  try {
    const res = await axios.get(`${BASE}/phone_numbers`, { headers: headers(), params: { 'page[size]': 100 } })
    return res.data?.data || []
  } catch (e) {
    log('Telnyx listNumbers error:', e.response?.data || e.message)
    return []
  }
}

// ── Create SIP Connection (credential-based) ──
async function createSIPConnection(name, webhookUrl) {
  try {
    const body = {
      active: true,
      connection_name: name,
      user_name: 'nomadlySipMain01',
      password: 'NomadlySIP2026Secure',
      webhook_event_url: webhookUrl,
      webhook_api_version: '2',
    }
    const res = await axios.post(`${BASE}/credential_connections`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx createSIPConnection error:', e.response?.data || e.message)
    return null
  }
}

// ── Get SIP Connection details ──
async function getSIPConnection(connectionId) {
  try {
    const res = await axios.get(`${BASE}/credential_connections/${connectionId}`, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx getSIPConnection error:', e.response?.data || e.message)
    return null
  }
}

// ── Create SIP Credential (username/password for a connection) ──
async function createSIPCredential(connectionId, username, password) {
  try {
    const body = {
      connection_id: connectionId,
      sip_username: username,
      sip_password: password,
    }
    const res = await axios.post(`${BASE}/telephony_credentials`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx createSIPCredential error:', e.response?.data || e.message)
    return null
  }
}

// ── Create Messaging Profile ──
async function createMessagingProfile(name, webhookUrl) {
  try {
    const body = {
      name: name,
      webhook_url: webhookUrl,
      webhook_api_version: '2',
      whitelisted_destinations: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
    }
    const res = await axios.post(`${BASE}/messaging_profiles`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx createMessagingProfile error:', e.response?.data || e.message)
    return null
  }
}

// ── Update Messaging Profile webhook ──
async function updateMessagingProfile(profileId, webhookUrl) {
  try {
    const body = { webhook_url: webhookUrl, webhook_api_version: '2' }
    const res = await axios.patch(`${BASE}/messaging_profiles/${profileId}`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx updateMessagingProfile error:', e.response?.data || e.message)
    return null
  }
}

// ── Create Call Control Application ──
async function createCallControlApp(name, webhookUrl) {
  try {
    const body = {
      application_name: name,
      webhook_event_url: webhookUrl,
      webhook_api_version: '2',
    }
    const res = await axios.post(`${BASE}/call_control_applications`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx createCallControlApp error:', e.response?.data || e.message)
    return null
  }
}

// ── Update Call Control Application webhook ──
async function updateCallControlApp(appId, webhookUrl) {
  try {
    const body = { webhook_event_url: webhookUrl, webhook_api_version: '2' }
    // Ensure outbound voice profile is assigned (required for call forwarding/transfer)
    const appRes = await axios.get(`${BASE}/call_control_applications/${appId}`, { headers: headers() })
    const currentProfileId = appRes.data?.data?.outbound?.outbound_voice_profile_id
    if (!currentProfileId) {
      // Find an active outbound voice profile
      const profiles = await axios.get(`${BASE}/outbound_voice_profiles`, { headers: headers() })
      const active = (profiles.data?.data || []).find(p => p.enabled)
      if (active) {
        body.outbound = { outbound_voice_profile_id: active.id }
        log('Assigning outbound voice profile:', active.id, active.name)
        await ensureProfileWhitelist(active.id)
      }
    } else {
      // Profile already assigned — ensure its whitelist is comprehensive
      await ensureProfileWhitelist(currentProfileId)
    }
    const res = await axios.patch(`${BASE}/call_control_applications/${appId}`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx updateCallControlApp error:', e.response?.data || e.message)
    return null
  }
}

// ── Ensure outbound voice profile has comprehensive international whitelist ──
async function ensureProfileWhitelist(profileId) {
  try {
    const res = await axios.get(`${BASE}/outbound_voice_profiles/${profileId}`, { headers: headers() })
    const current = res.data?.data?.whitelisted_destinations || []
    // Check if PT (Portugal) is missing as a canary — if so, the whitelist needs updating
    if (!current.includes('PT') || current.length < 50) {
      const fullWhitelist = [
        'US','CA','AL','AD','AT','BE','BA','BG','HR','CY','CZ','DK','EE','FO','FI','FR','DE','GI','GR','GL','GG','HU','IS','IE','IM','IT','JE','LV','LI','LT','LU','MK','MT','MC','ME','NL','NO','PL','PT','XK','RO','RU','SM','RS','SK','SI','ES','SJ','SE','CH','UA','GB','VA',
        'AI','AG','AW','BS','BB','BM','BQ','KY','CU','CW','DM','DO','GD','GP','HT','JM','MQ','MS','PR','BL','KN','LC','MF','VC','SX','TT','TC','VG','VI','MX','PM','BZ','CR','SV','GT','HN','NI','PA','AR','BO','BR','CL','CO','EC','FK','GF','GY','PY','PE','SR','UY','VE',
        'AS','AU','CX','CC','CK','FJ','PF','GU','KI','MH','FM','NR','NC','NZ','NU','NF','MP','PW','PG','PN','WS','SB','TK','TO','TV','UM','VU','WF','CN','HK','JP','KP','KR','MO','MN','TW',
        'BD','BT','IO','BN','KH','IN','ID','LA','MY','MV','MM','NP','PH','SG','LK','TH','TL','VN',
        'AF','AM','AZ','BH','GE','IR','IQ','IL','JO','KZ','KW','KG','LB','OM','PK','PS','QA','SA','SY','TJ','TR','TM','AE','UZ','YE',
        'DZ','EG','LY','MA','TN','EH','AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CG','CD','CI','DJ','GQ','ER','ET','GA','GM','GH','GN','GW','KE','LS','LR','MG','MW','ML','MR','MU','YT','MZ','NA','NE','NG','RE','RW','SH','ST','SN','SC','SL','SO','ZA','SS','SD','SZ','TZ','TG','UG','ZM','ZW',
        'BY','MD','AX','AQ','BV','TF','HM','GS'
      ]
      await axios.patch(`${BASE}/outbound_voice_profiles/${profileId}`, {
        whitelisted_destinations: fullWhitelist
      }, { headers: headers() })
      log(`[Telnyx] Updated outbound voice profile ${profileId} whitelist to ${fullWhitelist.length} countries`)
    } else {
      log(`[Telnyx] Outbound voice profile ${profileId} whitelist OK (${current.length} countries)`)
    }
  } catch (e) {
    log(`[Telnyx] ensureProfileWhitelist error: ${e.response?.data?.errors?.[0]?.detail || e.message}`)
  }
}

// ── Call Control: Answer ──
async function answerCall(callControlId) {
  try {
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/answer`, {}, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx answerCall error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Transfer ──
async function transferCall(callControlId, toNumber, fromNumber, options = {}) {
  try {
    const body = { to: toNumber }
    if (fromNumber) body.from = fromNumber
    if (options.audioUrl) body.audio_url = options.audioUrl
    if (options.timeoutSecs) body.timeout_secs = options.timeoutSecs
    log(`[Telnyx] Transferring call ${callControlId} to ${toNumber}${fromNumber ? ' from ' + fromNumber : ''}${options.audioUrl ? ' with hold music' : ''}`)
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/transfer`, body, { headers: headers() })
    log(`[Telnyx] Transfer initiated successfully`)
    return res.data?.data || null
  } catch (e) {
    const errDetail = e.response?.data?.errors?.[0]?.detail || e.response?.data || e.message
    log(`[Telnyx] transferCall error (to=${toNumber}): ${JSON.stringify(errDetail)}`)
    return null
  }
}

// ── Call Control: Speak (TTS) ──
async function speakOnCall(callControlId, text, voice = 'female', language = 'en-US') {
  try {
    const body = { payload: text, voice, language }
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/speak`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx speakOnCall error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Record Start ──
async function startRecording(callControlId, channels = 'single', format = 'mp3') {
  try {
    const body = { channels, format }
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/record_start`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx startRecording error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Gather (DTMF for IVR) ──
async function gatherDTMF(callControlId, payload, options = {}) {
  try {
    const body = {
      payload: payload,
      voice: options.voice || 'female',
      language: options.language || 'en-US',
      minimum_digits: options.minDigits || 1,
      maximum_digits: options.maxDigits || 1,
      timeout_millis: options.timeout || 10000,
      inter_digit_timeout_millis: options.interDigitTimeout || 5000,
      valid_digits: options.validDigits || '0123456789*#',
    }
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/gather_using_speak`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx gatherDTMF error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Playback Stop ──
async function playbackStop(callControlId) {
  try {
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/playback_stop`, {}, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx playbackStop error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Record Stop ──
async function stopRecording(callControlId) {
  try {
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/record_stop`, {}, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx stopRecording error:', e.response?.data || e.message)
    return null
  }
}

// ── Call Control: Hangup ──
async function hangupCall(callControlId) {
  try {
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/hangup`, {}, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log('Telnyx hangupCall error:', e.response?.data || e.message)
    return null
  }
}

// ── Setup: Initialize Telnyx resources (SIP + Messaging Profile + Call Control App) ──
async function initializeTelnyxResources(selfUrl) {
  const voiceWebhook = `${selfUrl}/telnyx/voice-webhook`
  const smsWebhook = `${selfUrl}/telnyx/sms-webhook`

  log('━━━ Initializing Telnyx Resources ━━━')
  log('Voice webhook:', voiceWebhook)
  log('SMS webhook:', smsWebhook)

  let sipConnectionId = process.env.TELNYX_SIP_CONNECTION_ID
  let messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID
  let callControlAppId = process.env.TELNYX_CALL_CONTROL_APP_ID

  // Update SIP Connection webhook to current domain
  if (!sipConnectionId) {
    const sip = await createSIPConnection('Nomadly Cloud Phone SIP', voiceWebhook)
    if (sip) {
      sipConnectionId = sip.id
      log('Created SIP Connection:', sipConnectionId)
    }
  } else {
    // Always update SIP connection webhook to current URL and ensure outbound profile is linked
    try {
      const connRes = await axios.get(`${BASE}/credential_connections/${sipConnectionId}`, { headers: headers() })
      const currentOutboundProfileId = connRes.data?.data?.outbound?.outbound_voice_profile_id
      const patchBody = { webhook_event_url: voiceWebhook }

      // Ensure outbound voice profile is linked (required for SIP outbound calls to reach PSTN)
      if (!currentOutboundProfileId) {
        try {
          const profiles = await axios.get(`${BASE}/outbound_voice_profiles`, { headers: headers() })
          const active = (profiles.data?.data || []).find(p => p.enabled)
          if (active) {
            patchBody.outbound = { outbound_voice_profile_id: active.id }
            log(`[Telnyx] Linking outbound voice profile ${active.id} to SIP connection`)
          } else {
            log('[Telnyx] WARNING: No active outbound voice profile found — outbound SIP calls will fail!')
          }
        } catch (e) {
          log('[Telnyx] Error fetching outbound voice profiles:', e.message)
        }
      }

      await axios.patch(`${BASE}/credential_connections/${sipConnectionId}`, patchBody, { headers: headers() })
      log('Updated SIP Connection webhook:', sipConnectionId)
    } catch (e) {
      log('SIP Connection webhook update error:', e.response?.data?.errors?.[0]?.detail || e.message)
    }
  }

  // Create Messaging Profile if not exists, or recreate if stale
  if (!messagingProfileId) {
    const mp = await createMessagingProfile('Nomadly Cloud Phone SMS', smsWebhook)
    if (mp) {
      messagingProfileId = mp.id
      log('Created Messaging Profile:', messagingProfileId)
    }
  } else {
    // Update webhook URL to current domain — if profile is gone, recreate
    const updated = await updateMessagingProfile(messagingProfileId, smsWebhook)
    if (updated === null) {
      log(`Messaging Profile ${messagingProfileId} not found on Telnyx — creating new one`)
      const mp = await createMessagingProfile('Nomadly Cloud Phone SMS', smsWebhook)
      if (mp) {
        messagingProfileId = mp.id
        log('Created replacement Messaging Profile:', messagingProfileId)
      }
    } else {
      log('Updated Messaging Profile webhook:', messagingProfileId)
    }
  }

  // Create Call Control App if not exists
  if (!callControlAppId) {
    const app = await createCallControlApp('Nomadly Cloud Phone Voice', voiceWebhook)
    if (app) {
      callControlAppId = app.id
      log('Created Call Control App:', callControlAppId)
    } else {
      // Try listing existing apps to find ours
      try {
        const listRes = await axios.get(`${BASE}/call_control_applications`, { headers: headers(), params: { 'page[size]': 20 } })
        const apps = listRes.data?.data || []
        const existing = apps.find(a => a.application_name === 'Nomadly Cloud Phone Voice')
        if (existing) {
          callControlAppId = existing.id
          await updateCallControlApp(callControlAppId, voiceWebhook)
          log('Found and updated existing Call Control App:', callControlAppId)
        }
      } catch (e) {
        log('Error listing call control apps:', e.message)
      }
    }
  } else {
    await updateCallControlApp(callControlAppId, voiceWebhook)
    log('Updated Call Control App webhook:', callControlAppId)
  }

  log('━━━ Telnyx Resources Ready ━━━')
  log('SIP Connection ID:', sipConnectionId)
  log('Messaging Profile ID:', messagingProfileId)
  log('Call Control App ID:', callControlAppId)

  return { sipConnectionId, messagingProfileId, callControlAppId }
}

// ── Validate destination number is routable ──
async function validateForwardingDestination(toNumber) {
  try {
    // Use Telnyx number lookup to validate the number
    const res = await axios.get(`${BASE}/number_lookup/${encodeURIComponent(toNumber)}`, { 
      headers: headers(),
      params: { type: 'carrier' }
    })
    const data = res.data?.data
    if (data) {
      return { 
        valid: true, 
        country: data.country_code || 'unknown',
        carrier: data.carrier?.name || 'unknown',
        type: data.carrier?.type || 'unknown'
      }
    }
    return { valid: true, country: 'unknown', carrier: 'unknown', type: 'unknown' }
  } catch (e) {
    // If lookup fails, try a lightweight validation — check if the outbound profile allows the destination
    log(`[Telnyx] Number lookup failed for ${toNumber}: ${e.response?.status || e.message}`)
    // Fall back: consider it valid if lookup just isn't available (402 = billing, 404 = not found)
    if (e.response?.status === 404) {
      return { valid: false, reason: 'Number not found or invalid format' }
    }
    // For other errors (e.g. 402 no balance for lookup), assume valid
    return { valid: true, country: 'unknown', carrier: 'unknown', type: 'unknown' }
  }
}

// ── Outbound Call: Create a new outbound call via Telnyx Call Control ──
async function createOutboundCall(from, to, webhookUrl, connectionId) {
  try {
    const body = {
      connection_id: connectionId || process.env.TELNYX_CALL_CONTROL_APP_ID,
      to,
      from,
      webhook_url: webhookUrl,
    }
    const res = await axios.post(`${BASE}/calls`, body, { headers: headers() })
    const data = res.data?.data
    log(`[Telnyx] Outbound call created: ${data?.call_control_id} from=${from} to=${to}`)
    return {
      callControlId: data?.call_control_id,
      callLegId: data?.call_leg_id,
      callSessionId: data?.call_session_id,
    }
  } catch (e) {
    const errDetail = e.response?.data?.errors?.[0]?.detail || e.message
    log(`[Telnyx] createOutboundCall error (${from} → ${to}): ${errDetail}`)
    return { error: errDetail }
  }
}

// ── Call Control: Play audio file on call ──
async function playbackStart(callControlId, audioUrl, options = {}) {
  try {
    const body = { audio_url: audioUrl }
    if (options.loop) body.loop = options.loop
    log(`[Telnyx] playbackStart: ${callControlId} url=${audioUrl} loop=${options.loop || 'none'}`)
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/playback_start`, body, { headers: headers() })
    log(`[Telnyx] playbackStart OK: ${callControlId}`)
    return res.data?.data || { success: true }
  } catch (e) {
    const detail = e.response?.data?.errors?.[0]?.detail || e.response?.data || e.message
    log(`[Telnyx] playbackStart FAILED: ${callControlId} — ${JSON.stringify(detail)}`)
    return null
  }
}

// ── Call Control: Gather DTMF with audio playback (instead of TTS) ──
async function gatherDTMFWithAudio(callControlId, audioUrl, options = {}) {
  try {
    const body = {
      audio_url: audioUrl,
      minimum_digits: options.minDigits || 1,
      maximum_digits: options.maxDigits || 1,
      timeout_millis: options.timeout || 15000,
      inter_digit_timeout_millis: options.interDigitTimeout || 5000,
    }
    if (options.validDigits) body.valid_digits = options.validDigits
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/gather_using_audio`, body, { headers: headers() })
    return res.data?.data || null
  } catch (e) {
    log(`[Telnyx] gatherDTMFWithAudio error: ${e.response?.data?.errors?.[0]?.detail || e.message}`)
    return null
  }
}

// ── Call Control: Bridge two call legs together ──
async function bridgeCalls(callControlId, otherCallControlId) {
  try {
    const body = { call_control_id: otherCallControlId }
    log(`[Telnyx] Bridging ${callControlId} ↔ ${otherCallControlId}`)
    const res = await axios.post(`${BASE}/calls/${callControlId}/actions/bridge`, body, { headers: headers() })
    log(`[Telnyx] Bridge OK: ${callControlId} ↔ ${otherCallControlId}`)
    return res.data?.data || { success: true }
  } catch (e) {
    log(`[Telnyx] bridgeCalls error: ${e.response?.data?.errors?.[0]?.detail || e.message}`)
    return null
  }
}

module.exports = {
  searchNumbers,
  getNumberCapabilities,
  buyNumber,
  updateNumber,
  releaseNumber,
  releaseByPhoneNumber,
  listNumbers,
  createSIPConnection,
  getSIPConnection,
  createSIPCredential,
  createMessagingProfile,
  updateMessagingProfile,
  createCallControlApp,
  updateCallControlApp,
  answerCall,
  transferCall,
  speakOnCall,
  startRecording,
  stopRecording,
  hangupCall,
  gatherDTMF,
  gatherDTMFWithAudio,
  playbackStop,
  playbackStart,
  createOutboundCall,
  bridgeCalls,
  initializeTelnyxResources,
  validateForwardingDestination,
}
