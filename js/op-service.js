/* global process */
require('dotenv').config()
const axios = require('axios')
const { log } = require('console')

const OP_BASE_URL = 'https://api.openprovider.eu'
const OP_USERNAME = process.env.OPENPROVIDER_USERNAME
const OP_PASSWORD = process.env.OPENPROVIDER_PASSWORD
const SERVICE_EMAIL = process.env.NOMADLY_SERVICE_EMAIL || 'cloakhost@tutamail.com'
const PERCENT_INCREASE_DOMAIN = 1 + Number(process.env.PERCENT_INCREASE_DOMAIN || 0)
const MIN_DOMAIN_PRICE = Number(process.env.MIN_DOMAIN_PRICE || 30)

// OpenProvider built-in DNS hosting nameservers — used when provider_default is selected
const OP_DEFAULT_NS = ['ns1.openprovider.nl', 'ns2.openprovider.be', 'ns3.openprovider.eu']

let cachedToken = null
let tokenExpiry = 0

// ─── Auth ───────────────────────────────────────────────

const authenticate = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  try {
    const res = await axios.post(`${OP_BASE_URL}/v1beta/auth/login`, {
      username: OP_USERNAME,
      password: OP_PASSWORD,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 })

    if (res.data?.code === 0 && res.data?.data?.token) {
      cachedToken = res.data.data.token
      tokenExpiry = Date.now() + 3500 * 1000
      log('OpenProvider auth success')
      return cachedToken
    }
    log('OpenProvider auth failed:', res.data)
    return null
  } catch (err) {
    log('OpenProvider auth error:', err.message)
    return null
  }
}

const authHeaders = async () => {
  const token = await authenticate()
  if (!token) throw new Error('OpenProvider authentication failed')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// ─── Helpers ────────────────────────────────────────────

const parseDomain = (domainName) => {
  const parts = domainName.split('.')
  const name = parts[0]
  const extension = parts.slice(1).join('.')
  return { name, extension }
}

/**
 * Country-specific TLD additional_data for registration
 */
const getCountryTLDData = (tld) => {
  // IMPORTANT: OpenProvider v1beta REST API expects additional_data as a FLAT object
  // e.g. { legal_type: 'CCT' } — NOT nested under TLD key like { ca: { legal_type: 'CCT' } }
  const map = {
    us: { application_purpose: 'P1', nexus_category: 'C12' },
    ca: { legal_type: 'CCT' },
    it: { entity_type: 2, nationality: 'IT', reg_code: 'IT04126990961' },
    sg: {
      registrant_type: 'organization',
      company_registration_number: process.env.SINGAPORE_COMPANY_UEN || '201688888A',
      organization_name: process.env.SINGAPORE_COMPANY_NAME || 'Hostbay PLC',
      admin_singpass_id: process.env.SINGAPORE_ADMIN_SINGPASS_ID || '201688888A',
    },
    eu: { registrant_citizenship: 'FR' },
    fr: {},
    es: { registrant_type: 1, id_number: 'X0000000T' },
    de: {},
    nl: {},
    be: { registrant_lang: 'en' },
    uk: { registrant_type: 'IND' },
    'co.uk': { registrant_type: 'IND' },
    au: { registrant_id: 'ABN 12345678901', registrant_id_type: 'ABN', eligibility_type: 'Company' },
    nz: {},
    in: {},
    br: { registrant_type: 'individual', cpf: '000.000.000-00' },
    cl: {},
    mx: {},
  }
  return map[tld] || null
}

// ─── Domain availability & pricing ──────────────────────

const checkDomainAvailability = async (domainName) => {
  try {
    const headers = await authHeaders()
    const { name, extension } = parseDomain(domainName)

    const res = await axios.post(`${OP_BASE_URL}/v1beta/domains/check`, {
      domains: [{ name, extension }],
      with_price: true,
    }, { headers, timeout: 15000 })

    if (res.data?.code !== 0) {
      return { available: false, message: res.data?.desc || 'OpenProvider check failed' }
    }

    const results = res.data?.data?.results
    if (!results || results.length === 0) {
      return { available: false, message: 'No results from OpenProvider' }
    }

    const result = results[0]
    const status = (result.status || '').toLowerCase()

    if (status === 'free' || status === 'available') {
      const priceObj = result.price || {}
      const createPrice = parseFloat(priceObj.create?.price || priceObj.product?.price || 0)
      const originalPrice = createPrice < 1 ? 1 : createPrice
      let price = Math.ceil(originalPrice * PERCENT_INCREASE_DOMAIN)
      price = Math.max(price, MIN_DOMAIN_PRICE)

      return { available: true, originalPrice, price, registrar: 'OpenProvider' }
    }

    return { available: false, message: 'Domain not available on OpenProvider' }
  } catch (err) {
    log('OP checkDomainAvailability error:', err.message)
    return { available: false, message: `OpenProvider error: ${err.message}` }
  }
}

// ─── Contact handle ─────────────────────────────────────

// TLD → required contact country suffix mapping
// Based on ACTUAL OpenProvider data analysis:
// .fr → VS062711-IT works (Italian company with VAT + verified email)
// .it → Must use Italian contacts with VAT
// .ca → Canadian contact preferred (BK921363-CA)
// .eu → Needs EU-based contact
// .sg → Needs Singapore contact with UEN
const TLD_CONTACT_COUNTRY = {
  fr: ['IT'],
  it: ['IT'],
  ca: ['CA'],
  eu: ['FR', 'IT', 'DE', 'NL'],
  sg: ['SG'],
  us: ['US'],  // .us requires US-based contact with extension_additional_data (nexus)
}

// Known working contact handles (verified in OpenProvider account)
// These are used as preferred handles before falling back to search/create
const PREFERRED_HANDLES = {
  IT: 'MR971932-IT',
  CA: 'BK921363-CA',
  US: 'JC961841-US',  // John CloakHost — has .us extension_additional_data (nexus_category: C21, applicant_purpose: P1)
}

// Handles that must NEVER be used for domain registration
const EXCLUDED_HANDLES = new Set([
  'RA1083275-US',  // Richard Adebayo — do not use per owner request
])

// EU contact details for creating new handles when none exist
const EU_CONTACT_TEMPLATES = {
  FR: {
    name: { first_name: 'Paul', last_name: 'Gaulle' },
    phone: { country_code: '+33', area_code: '1', subscriber_number: '44556677' },
    address: { street: '15 Rue de la Paix', number: '15', zipcode: '75002', city: 'Paris', state: 'IDF', country: 'FR' },
  },
  DE: {
    name: { first_name: 'Paul', last_name: 'Gaulle' },
    phone: { country_code: '+49', area_code: '30', subscriber_number: '12345678' },
    address: { street: 'Friedrichstrasse 100', number: '100', zipcode: '10117', city: 'Berlin', state: 'BE', country: 'DE' },
  },
  NL: {
    name: { first_name: 'Carsten', last_name: 'van Noort' },
    phone: { country_code: '+31', area_code: '20', subscriber_number: '1234567' },
    address: { street: 'Keizersgracht 100', number: '100', zipcode: '1015 AA', city: 'Amsterdam', state: 'NH', country: 'NL' },
  },
  IT: {
    name: { first_name: 'Marco', last_name: 'Rossi' },
    phone: { country_code: '+39', area_code: '0522', subscriber_number: '274411' },
    address: { street: 'Via Giovanni Bovio', number: '2A', zipcode: '42124', city: 'Reggio nell Emilia', state: 'RE', country: 'IT' },
    organization: 'Nomadly Services SRL',
    vat: 'IT04081310965',
  },
  CA: {
    name: { first_name: 'Brian', last_name: 'Kaitn' },
    phone: { country_code: '+1', area_code: '416', subscriber_number: '5551234' },
    address: { street: '100 King Street West', number: '100', zipcode: 'M5X 1A9', city: 'Toronto', state: 'ON', country: 'CA' },
  },
  SG: {
    name: { first_name: 'Hostbay', last_name: 'PLC' },
    phone: { country_code: '+65', area_code: '', subscriber_number: '61234567' },
    address: {
      street: process.env.SINGAPORE_COMPANY_ADDRESS || '123 Orchard Road #05-123',
      number: '123',
      zipcode: process.env.SINGAPORE_COMPANY_POSTAL_CODE || '238823',
      city: 'Singapore', state: 'SG', country: 'SG',
    },
    organization: process.env.SINGAPORE_COMPANY_NAME || 'Hostbay PLC',
  },
}

/**
 * Get or create a contact handle appropriate for a specific TLD.
 * Strategy (based on OpenProvider account analysis):
 * 1. Check PREFERRED_HANDLES for known working handles - verify they exist via direct API call
 * 2. Search all contacts by email to find matching country handles (avoids pagination issues)
 * 3. Create new handle from template as last resort
 */
const getContactHandleForTLD = async (tld) => {
  const requiredCountries = TLD_CONTACT_COUNTRY[tld]
  if (!requiredCountries) return getContactHandle()

  try {
    const headers = await authHeaders()

    // Strategy 1: Try preferred/known-working handles first via direct lookup
    for (const country of requiredCountries) {
      const preferredHandle = PREFERRED_HANDLES[country]
      if (preferredHandle) {
        try {
          const checkRes = await axios.get(`${OP_BASE_URL}/v1beta/customers/${preferredHandle}`, {
            headers, timeout: 10000,
          })
          if (checkRes.data?.code === 0 && !checkRes.data?.data?.is_deleted) {
            log(`Using preferred ${country} handle for .${tld}: ${preferredHandle}`)
            return preferredHandle
          }
        } catch (e) {
          log(`Preferred handle ${preferredHandle} not found or error: ${e.message}`)
        }
      }
    }

    // Strategy 2: Search contacts filtered by service email to reduce result set
    const res = await axios.get(`${OP_BASE_URL}/v1beta/customers`, {
      headers, params: { limit: 500, email_pattern: SERVICE_EMAIL }, timeout: 15000,
    })

    if (res.data?.code === 0) {
      const contacts = res.data?.data?.results || []

      for (const country of requiredCountries) {
        const suffix = `-${country}`
        const match = contacts.find(c => c.handle && c.handle.endsWith(suffix) && !EXCLUDED_HANDLES.has(c.handle))
        if (match) {
          log(`Found existing ${country} contact handle for .${tld}: ${match.handle}`)
          return match.handle
        }
      }
    }

    // Strategy 3: Broader search without email filter, with higher limit
    const res2 = await axios.get(`${OP_BASE_URL}/v1beta/customers`, {
      headers, params: { limit: 500 }, timeout: 15000,
    })

    if (res2.data?.code === 0) {
      const contacts = res2.data?.data?.results || []

      for (const country of requiredCountries) {
        const suffix = `-${country}`
        const match = contacts.find(c => c.handle && c.handle.endsWith(suffix) && !EXCLUDED_HANDLES.has(c.handle))
        if (match) {
          log(`Found ${country} contact handle via broad search for .${tld}: ${match.handle}`)
          return match.handle
        }
      }
    }

    // Strategy 4: Create new handle from template
    const targetCountry = requiredCountries[0]
    const template = EU_CONTACT_TEMPLATES[targetCountry]
    if (!template) {
      log(`No contact template for country ${targetCountry}, falling back to default`)
      return getContactHandle()
    }

    log(`Creating new ${targetCountry} contact handle for .${tld} TLD registration`)
    const contactData = {
      name: template.name,
      phone: template.phone,
      email: SERVICE_EMAIL,
      address: template.address,
    }
    if (template.organization) contactData.organization = template.organization
    if (template.vat) contactData.vat = template.vat
    if (template.social_security_number) contactData.social_security_number = template.social_security_number

    const createRes = await axios.post(`${OP_BASE_URL}/v1beta/customers`, contactData, {
      headers, timeout: 15000,
    })

    if (createRes.data?.code === 0) {
      const newHandle = createRes.data?.data?.handle
      log(`Created ${targetCountry} contact handle: ${newHandle}`)
      return newHandle
    }

    log(`Failed to create ${targetCountry} contact:`, createRes.data)
    return getContactHandle() // fallback
  } catch (err) {
    log(`getContactHandleForTLD error for .${tld}:`, err.message)
    return getContactHandle()
  }
}

const getContactHandle = async (attempt = 1) => {
  try {
    const headers = await authHeaders()

    const res = await axios.get(`${OP_BASE_URL}/v1beta/customers`, {
      headers, params: { limit: 50 }, timeout: 15000,
    })

    if (res.data?.code === 0) {
      const contacts = res.data?.data?.results || []
      // Prefer US-based contacts, skip excluded handles
      const usContacts = contacts.filter(c => c.handle && c.handle.endsWith('-US') && !EXCLUDED_HANDLES.has(c.handle))
      if (usContacts.length > 0) return usContacts[0].handle
      const validContacts = contacts.filter(c => c.handle && !EXCLUDED_HANDLES.has(c.handle))
      if (validContacts.length > 0) return validContacts[0].handle
    }

    const createRes = await axios.post(`${OP_BASE_URL}/v1beta/customers`, {
      name: { first_name: 'Hostbay', last_name: 'Support' },
      phone: { country_code: '+1', area_code: '555', subscriber_number: '1234567' },
      email: SERVICE_EMAIL,
      address: {
        street: '123 Business Ave', number: '1',
        zipcode: '10001', city: 'New York', state: 'NY', country: 'US',
      },
      organization: 'Hostbay Domain Services',
    }, { headers, timeout: 15000 })

    if (createRes.data?.code === 0) return createRes.data?.data?.handle
    log('Failed to create OP contact handle:', createRes.data)
    return null
  } catch (err) {
    log(`OP getContactHandle error (attempt ${attempt}): ${err.message}`)
    // Retry once with forced re-auth (handles expired/stale token)
    if (attempt < 2) {
      log('[OP] getContactHandle retrying with fresh auth in 2s...')
      cachedToken = null
      tokenExpiry = 0
      await new Promise(r => setTimeout(r, 2000))
      return getContactHandle(attempt + 1)
    }
    return null
  }
}

// ─── Domain registration ────────────────────────────────

const registerDomain = async (domainName, nameservers = []) => {
  try {
    const headers = await authHeaders()
    const { name, extension } = parseDomain(domainName)
    const tld = extension.toLowerCase()

    // Use TLD-specific contact handle (IT for .fr/.it, CA for .ca, EU for .eu, default US for others)
    let contactHandle = await getContactHandleForTLD(tld)
    if (!contactHandle) {
      // Retry once with forced re-auth (handles transient auth/network failures)
      log(`[OP] Contact handle lookup failed for .${tld} — retrying with fresh auth in 2s...`)
      cachedToken = null
      tokenExpiry = 0
      await new Promise(r => setTimeout(r, 2000))
      contactHandle = await getContactHandleForTLD(tld)
    }
    if (!contactHandle) return { error: 'Failed to prepare domain registration. Please try again or contact support.' }

    // Final safety: reject excluded handles before proceeding
    if (EXCLUDED_HANDLES.has(contactHandle)) {
      log(`[OP] BLOCKED: excluded handle ${contactHandle} was selected for ${domainName} — aborting`)
      return { error: 'Domain registration configuration error. Please contact support.' }
    }

    // Resolve effective nameservers:
    // 1. Use provided NS (cloudflare or custom) if available
    // 2. For NS-required TLDs without NS, fall back to Cloudflare defaults
    // 3. For all other cases with no NS, use OP built-in DNS hosting nameservers
    const NS_REQUIRED_TLDS = ['fr', 're', 'pm', 'tf', 'wf', 'yt']
    let effectiveNS = nameservers
    if (effectiveNS.length < 2 && NS_REQUIRED_TLDS.includes(tld)) {
      log(`[registerDomain] .${tld} requires 2+ nameservers, adding Cloudflare defaults`)
      effectiveNS = ['hank.ns.cloudflare.com', 'nova.ns.cloudflare.com']
    } else if (effectiveNS.length === 0) {
      log(`[registerDomain] No nameservers provided for ${domainName}, using OP built-in: ${OP_DEFAULT_NS.join(', ')}`)
      effectiveNS = OP_DEFAULT_NS
    }

    const nsPayload = effectiveNS.map((ns, i) => ({ name: ns, seq_nr: i + 1 }))

    const regData = {
      domain: { name, extension },
      period: 1,
      owner_handle: contactHandle,
      admin_handle: contactHandle,
      tech_handle: contactHandle,
      billing_handle: contactHandle,
      name_servers: nsPayload,
      autorenew: 'off',
    }

    // Country-specific TLD data
    const tldData = getCountryTLDData(tld)
    if (tldData && Object.keys(tldData).length > 0) {
      regData.additional_data = tldData
    }

    log(`[registerDomain] Registering ${domainName} | contact: ${contactHandle} | NS: ${effectiveNS.join(', ') || 'none'} | additional_data: ${JSON.stringify(tldData || {})}`)

    // For .us domains: ensure the customer handle has extension_additional_data with nexus fields
    // OpenProvider requires nexus_category and applicant_purpose on the CUSTOMER HANDLE, not domain additional_data
    if (tld === 'us') {
      try {
        const custRes = await axios.get(`${OP_BASE_URL}/v1beta/customers/${contactHandle}`, {
          headers, params: { with_additional_data: true }, timeout: 10000,
        })
        const extData = custRes.data?.data?.extension_additional_data || []
        const hasUsData = extData.some(e => e.name === 'us' && e.data?.nexus_category && e.data?.applicant_purpose)
        if (!hasUsData) {
          log(`[OP] .us handle ${contactHandle} missing extension_additional_data — adding nexus fields`)
          await axios.put(`${OP_BASE_URL}/v1beta/customers/${contactHandle}`, {
            extension_additional_data: [
              { name: 'us', data: { nexus_category: 'C21', applicant_purpose: 'P1' } }
            ]
          }, { headers, timeout: 10000 })
          log(`[OP] Updated ${contactHandle} with .us extension_additional_data`)
        } else {
          log(`[OP] .us handle ${contactHandle} already has extension_additional_data`)
        }
      } catch (extErr) {
        log(`[OP] Warning: failed to verify/set .us extension data on ${contactHandle}: ${extErr.message}`)
      }
    }

    const res = await axios.post(`${OP_BASE_URL}/v1beta/domains`, regData, {
      headers, timeout: 30000,
    })

    if (res.data?.code === 0) {
      const domainId = res.data?.data?.id
      log(`[OP] Domain registered: ${domainName}, ID: ${domainId}`)
      return { success: true, domainId, registrar: 'OpenProvider' }
    }

    // Non-zero code but not an HTTP error — check if domain was actually registered (false-negative)
    const errMsg = res.data?.desc || 'Unknown registration error'
    log(`[OP] registerDomain non-zero code (${res.data?.code}): ${errMsg}`)
    const verifyResult = await _verifyRegistration(domainName)
    if (verifyResult) {
      log(`[OP] FALSE NEGATIVE: ${domainName} actually registered despite error code ${res.data?.code}. ID: ${verifyResult.domainId}`)
      return { success: true, domainId: verifyResult.domainId, registrar: 'OpenProvider' }
    }
    return { error: `Registration failed: ${errMsg}` }
  } catch (err) {
    const opDesc = err?.response?.data?.desc || ''
    const opCode = err?.response?.data?.code || ''
    const statusCode = err?.response?.status || ''
    log(`[OP] registerDomain error: ${err.message} | HTTP ${statusCode} | OP code: ${opCode} | desc: ${opDesc}`)

    // For 5xx server errors, the registrar may have processed the request despite the error.
    // Wait briefly and verify if the domain was actually registered (false-negative protection).
    if (statusCode >= 500) {
      log(`[OP] Server error ${statusCode} for ${domainName} — waiting 5s then verifying registration...`)
      await new Promise(r => setTimeout(r, 5000))
      const verifyResult = await _verifyRegistration(domainName)
      if (verifyResult) {
        log(`[OP] FALSE NEGATIVE CONFIRMED: ${domainName} registered despite HTTP ${statusCode}. ID: ${verifyResult.domainId}`)
        return { success: true, domainId: verifyResult.domainId, registrar: 'OpenProvider' }
      }
      log(`[OP] Verification negative — ${domainName} NOT registered after HTTP ${statusCode}`)
    }

    return { error: opDesc || 'Domain registration failed due to a server error. Please try again.' }
  }
}

/**
 * Verify if a domain was actually registered on OP (handles false-negative API errors).
 * Returns { domainId } if found, null otherwise.
 */
const _verifyRegistration = async (domainName) => {
  try {
    const headers = await authHeaders()
    const { name, extension } = parseDomain(domainName)
    const searchRes = await axios.get(`${OP_BASE_URL}/v1beta/domains`, {
      headers, params: { domain_name_pattern: name, extension, limit: 1 }, timeout: 15000,
    })
    if (searchRes.data?.code === 0 && searchRes.data?.data?.results?.length > 0) {
      const found = searchRes.data.data.results[0]
      if (found.status === 'ACT' || found.status === 'REQ') {
        return { domainId: found.id }
      }
    }
    return null
  } catch (verifyErr) {
    log(`[OP] _verifyRegistration error for ${domainName}: ${verifyErr.message}`)
    return null
  }
}

// ─── Domain info ────────────────────────────────────────

const getDomainInfo = async (domainName) => {
  try {
    const headers = await authHeaders()
    const { name, extension } = parseDomain(domainName)

    const searchRes = await axios.get(`${OP_BASE_URL}/v1beta/domains`, {
      headers, params: { domain_name_pattern: name, extension, limit: 1 }, timeout: 15000,
    })

    if (searchRes.data?.code !== 0 || !searchRes.data?.data?.results?.length) return null

    const domainId = searchRes.data.data.results[0].id
    const res = await axios.get(`${OP_BASE_URL}/v1beta/domains/${domainId}`, {
      headers, timeout: 15000,
    })

    if (res.data?.code === 0) {
      const data = res.data.data
      const nameservers = (data.name_servers || []).map(ns => ns.name).filter(Boolean)
      return { domainId, nameservers, status: data.status, expiresAt: data.renewal_date, domainData: data }
    }
    return null
  } catch (err) {
    log('OP getDomainInfo error:', err.message)
    return null
  }
}

// ─── Nameserver management ──────────────────────────────

const updateNameservers = async (domainName, nameservers) => {
  try {
    const info = await getDomainInfo(domainName)
    if (!info || !info.domainId) return { error: 'Domain not found at registrar' }

    const headers = await authHeaders()
    const nsPayload = nameservers.map((ns, i) => ({ name: ns, seq_nr: i + 1 }))

    // First attempt with 30s timeout (increased from 15s — OP can be slow for some TLDs)
    let res
    try {
      res = await axios.put(`${OP_BASE_URL}/v1beta/domains/${info.domainId}`, {
        name_servers: nsPayload,
      }, { headers, timeout: 30000 })
    } catch (firstErr) {
      // Retry once with 45s timeout on timeout/network errors
      if (firstErr.code === 'ECONNABORTED' || firstErr.message?.includes('timeout') || firstErr.code === 'ETIMEDOUT') {
        log(`OP updateNameservers timeout for ${domainName}, retrying with 45s…`)
        res = await axios.put(`${OP_BASE_URL}/v1beta/domains/${info.domainId}`, {
          name_servers: nsPayload,
        }, { headers, timeout: 45000 })
      } else {
        throw firstErr
      }
    }

    if (res.data?.code === 0) return { success: true }
    return { error: res.data?.desc || 'Failed to update nameservers' }
  } catch (err) {
    // Extract the actual error from OP API response (e.g. DENIC rejection for .de domains)
    const opData = err.response?.data
    const opDesc = opData?.desc || opData?.data?.desc || ''
    const opWarnings = opData?.warnings || opData?.data?.warnings || []
    const opCode = opData?.code ?? err.response?.status ?? ''

    // Build detailed log for debugging
    log(`OP updateNameservers error for ${domainName}:`, err.message,
      opDesc ? `| desc: ${opDesc}` : '',
      opWarnings.length ? `| warnings: ${JSON.stringify(opWarnings)}` : '',
      opData ? `| full: ${JSON.stringify(opData).substring(0, 500)}` : '')

    // Build user-friendly error
    let userMsg = ''
    if (opDesc) {
      userMsg = opDesc
    } else if (opWarnings.length) {
      userMsg = opWarnings.map(w => w.message || w).join('; ')
    } else if (err.response?.status === 500) {
      // OP 500 on .de domains usually means DENIC rejected the NS (unresolvable or invalid)
      const isDe = domainName.endsWith('.de')
      userMsg = isDe
        ? 'Registry rejected the nameservers — .de domains require nameservers that are resolvable. Please verify the nameservers are correct and active.'
        : 'Registrar rejected the request (500). Please verify the nameservers are valid and resolvable.'
    } else {
      userMsg = err.message
    }

    return { error: userMsg }
  }
}

// ─── DNS zone management ────────────────────────────────

/**
 * Ensure DNS zone exists at OpenProvider. Creates it via POST if missing.
 * Returns { exists: true } or { created: true } or { error }
 */
const ensureDnsZone = async (domainName) => {
  try {
    const headers = await authHeaders()

    // Check if zone exists
    try {
      const zoneRes = await axios.get(`${OP_BASE_URL}/v1beta/dns/zones/${domainName}`, {
        headers, timeout: 15000,
      })
      if (zoneRes.data?.code === 0) return { exists: true }
    } catch (e) {
      if (e.response?.status !== 404 && e.response?.status !== 500) {
        log(`[OP] ensureDnsZone GET error for ${domainName}: ${e.message}`)
      }
    }

    // Zone doesn't exist — create via POST
    log(`[OP] DNS zone not found for ${domainName}, creating...`)
    const { name, extension } = parseDomain(domainName)
    const createRes = await axios.post(`${OP_BASE_URL}/v1beta/dns/zones`, {
      domain: { name, extension },
      type: 'master',
      active: true,
    }, { headers, timeout: 15000 })

    if (createRes.data?.code === 0) {
      log(`[OP] DNS zone created for ${domainName}`)
      return { created: true }
    }
    // Zone may already exist (race condition or error desc says so)
    const desc = createRes.data?.desc || ''
    if (desc.toLowerCase().includes('already exists') || desc.toLowerCase().includes('zone for domain')) {
      log(`[OP] DNS zone already exists for ${domainName} (create returned: ${desc})`)
      return { exists: true }
    }
    return { error: desc || 'Failed to create DNS zone' }
  } catch (err) {
    // OP sometimes returns 500 with "Zone for domain already exists" — treat as exists
    const errMsg = err.response?.data?.desc || err.message || ''
    if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('zone for domain')) {
      log(`[OP] DNS zone already exists for ${domainName} (from error: ${errMsg})`)
      return { exists: true }
    }
    log(`[OP] ensureDnsZone error for ${domainName}: ${errMsg}`)
    return { error: errMsg }
  }
}

/**
 * Get DNS zone records for a domain from OpenProvider's DNS zone API
 * IMPORTANT: Must pass with_records=true param, otherwise OP returns no records
 */
const listDNSRecords = async (domainName) => {
  try {
    const headers = await authHeaders()

    const res = await axios.get(`${OP_BASE_URL}/v1beta/dns/zones/${domainName}`, {
      headers, timeout: 15000,
      params: { with_records: true },
    })

    if (res.data?.code === 0 && res.data?.data?.records) {
      // Filter out SOA/NS records (infrastructure records managed by OP) for cleaner display
      const userRecords = (res.data.data.records || []).filter(r =>
        !['SOA'].includes(r.type)
      )
      return {
        records: userRecords.map(r => ({
          recordType: r.type,
          recordContent: r.value,
          // OP returns full FQDN in name — normalize: strip trailing zone name for display
          recordName: r.name || domainName,
          ttl: r.ttl,
          priority: r.prio,
        })),
      }
    }
    return { records: [] }
  } catch (err) {
    // Zone may not exist yet (404) or domain has custom NS so no zone on OP (500) — that's OK
    if (err.response?.status === 404 || err.response?.status === 500) return { records: [] }
    log('OP listDNSRecords error:', err.message)
    return { records: [] }
  }
}

/**
 * Add a DNS record to OpenProvider zone.
 * Uses records.add (not records.update) for NEW records.
 * Auto-creates DNS zone via POST if it doesn't exist.
 */
const addDNSRecord = async (domainName, recordType, recordValue, hostName, priority, extraData) => {
  try {
    const headers = await authHeaders()

    // ── 1. Ensure DNS zone exists (create if needed) ──
    const zoneCheck = await ensureDnsZone(domainName)
    if (zoneCheck.error) {
      log(`[OP] addDNSRecord: zone ensure failed for ${domainName}: ${zoneCheck.error}`)
      // Still try to add — PUT may create zone implicitly in some OP versions
    }

    const type = recordType.toUpperCase()
    // OP auto-appends zone name to record name.
    // Root records: name must be '' (empty), NOT the domain name.
    // Subdomains: name should be just the subdomain part (e.g. 'www', 'api').
    let opName = hostName || ''
    // If caller passed the full domain as hostname, treat as root → empty
    if (opName === domainName) opName = ''
    // Strip the zone suffix if present (e.g. 'www.example.com' → 'www')
    if (opName.endsWith('.' + domainName)) opName = opName.slice(0, -(domainName.length + 1))

    const newRecord = {
      type,
      name: opName,
      value: recordValue,
      ttl: 600,
    }
    if (type === 'MX' && priority !== undefined) newRecord.prio = Number(priority)
    // SRV record fields for OpenProvider
    if (type === 'SRV' && extraData) {
      newRecord.name = `${extraData.service}.${extraData.proto}.${opName}`
      newRecord.value = recordValue
      newRecord.prio = Number(extraData.priority || 10)
      // OP uses weight and port embedded in the value or as separate fields
      // Format: "weight port target" for standard SRV
      newRecord.value = `${extraData.weight || 100} ${extraData.port || 0} ${recordValue}`
    }
    // CAA record fields for OpenProvider
    if (type === 'CAA' && extraData) {
      // OP CAA value format: "flags tag value"
      newRecord.value = `${extraData.flags || 0} ${extraData.tag || 'issue'} "${recordValue}"`
    }

    // ── 2. Add record using records.add (NOT records.update) ──
    log(`[OP] Adding ${type} record to ${domainName}: ${newRecord.name} → ${newRecord.value}`)
    const res = await axios.put(`${OP_BASE_URL}/v1beta/dns/zones/${domainName}`, {
      records: { add: [newRecord] },
    }, { headers, timeout: 15000 })

    if (res.data?.code === 0) {
      log(`[OP] ✅ ${type} record added to ${domainName}: ${newRecord.name} → ${newRecord.value}`)
      return { success: true }
    }
    log(`[OP] addDNSRecord API returned code ${res.data?.code}: ${res.data?.desc}`)
    return { error: res.data?.desc || 'Failed to add DNS record' }
  } catch (err) {
    log(`[OP] addDNSRecord error for ${domainName}: ${err.response?.data?.desc || err.message}`)
    return { error: err.response?.data?.desc || err.message }
  }
}

/**
 * Update a DNS record in OpenProvider zone.
 * Uses the record's name as-is from listDNSRecords (already in OP format).
 */
const updateDNSRecord = async (domainName, originalRecord, newValue, newType) => {
  try {
    const headers = await authHeaders()

    // The recordName from listDNSRecords is already in OP's FQDN format
    // For the update/remove, pass the name as OP returned it
    const origName = originalRecord.recordName || domainName
    // Normalize: if name equals the full domain, OP may expect empty for root
    const opOrigName = origName === domainName ? '' : (origName.endsWith('.' + domainName) ? origName.slice(0, -(domainName.length + 1)) : origName)

    const newType_ = (newType || originalRecord.recordType).toUpperCase()
    const origType_ = originalRecord.recordType.toUpperCase()

    const res = await axios.put(`${OP_BASE_URL}/v1beta/dns/zones/${domainName}`, {
      records: {
        update: [{
          type: newType_,
          name: opOrigName,
          value: newValue,
          ttl: originalRecord.ttl || 600,
        }],
        remove: [{
          type: origType_,
          name: opOrigName,
          value: originalRecord.recordContent,
        }],
      },
    }, { headers, timeout: 15000 })

    if (res.data?.code === 0) return { success: true }
    return { error: res.data?.desc || 'Failed to update DNS record' }
  } catch (err) {
    log('OP updateDNSRecord error:', err.message)
    return { error: err.message }
  }
}

/**
 * Delete a DNS record from OpenProvider zone.
 * recordName comes from listDNSRecords — pass as-is in OP FQDN format.
 */
const deleteDNSRecord = async (domainName, record) => {
  try {
    const headers = await authHeaders()

    // Normalize name for OP: strip domain suffix, root = ''
    const origName = record.recordName || domainName
    const opName = origName === domainName ? '' : (origName.endsWith('.' + domainName) ? origName.slice(0, -(domainName.length + 1)) : origName)

    const res = await axios.put(`${OP_BASE_URL}/v1beta/dns/zones/${domainName}`, {
      records: {
        remove: [{
          type: record.recordType.toUpperCase(),
          name: opName,
          value: record.recordContent,
        }],
      },
    }, { headers, timeout: 15000 })

    if (res.data?.code === 0) return { success: true }
    return { error: res.data?.desc || 'Failed to delete DNS record' }
  } catch (err) {
    log('OP deleteDNSRecord error:', err.message)
    return { error: err.message }
  }
}

module.exports = {
  authenticate,
  checkDomainAvailability,
  registerDomain,
  getDomainInfo,
  updateNameservers,
  getContactHandle,
  getContactHandleForTLD,
  parseDomain,
  getCountryTLDData,
  ensureDnsZone,
  listDNSRecords,
  addDNSRecord,
  updateDNSRecord,
  deleteDNSRecord,
}
