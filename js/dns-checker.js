/* global process */
const axios = require('axios')

const DOH_URL = 'https://cloudflare-dns.com/dns-query'

// DNS record type numbers per RFC
const RECORD_TYPE_MAP = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
  SRV: 33,
  CAA: 257,
}

/**
 * Resolve a DNS record via Cloudflare DoH (JSON API)
 * Returns { found: bool, answers: [...], status: string }
 */
const resolve = async (name, type) => {
  try {
    const typeNum = RECORD_TYPE_MAP[type.toUpperCase()] || type
    const res = await axios.get(DOH_URL, {
      params: { name, type: typeNum },
      headers: { Accept: 'application/dns-json' },
      timeout: 8000,
    })

    const data = res.data
    // Status 0 = NOERROR, 3 = NXDOMAIN
    if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
      return {
        found: true,
        answers: data.Answer.map(a => ({
          type: a.type,
          data: a.data,
          ttl: a.TTL,
        })),
        status: 'resolved',
      }
    }

    if (data.Status === 3) {
      return { found: false, answers: [], status: 'nxdomain' }
    }

    return { found: false, answers: [], status: 'norecord' }
  } catch (err) {
    return { found: false, answers: [], status: 'error', error: err.message }
  }
}

/**
 * Check if a specific record value exists in DNS
 * @param {string} domain - FQDN to check (e.g. example.com or sub.example.com)
 * @param {string} type - Record type (A, AAAA, CNAME, MX, TXT, NS, SRV, CAA)
 * @param {string} expectedValue - The value we expect to find (optional — if empty, just checks type exists)
 * @returns {{ live: bool, message: string, answers: Array }}
 */
const checkRecord = async (domain, type, expectedValue) => {
  const result = await resolve(domain, type)

  if (result.status === 'error') {
    return {
      live: false,
      propagating: true,
      message: `Could not check DNS. Try again later.`,
      answers: [],
    }
  }

  if (!result.found) {
    return {
      live: false,
      propagating: true,
      message: `Not resolving yet. DNS changes can take up to 24-48h to propagate globally.`,
      answers: [],
    }
  }

  // If no expected value, just confirm the type resolves
  if (!expectedValue) {
    return {
      live: true,
      propagating: false,
      message: `Record is live.`,
      answers: result.answers,
    }
  }

  // Check if expected value is in the answers
  const normalizedExpected = expectedValue.toLowerCase().replace(/\.+$/, '')
  const match = result.answers.some(a => {
    const answerData = (a.data || '').toLowerCase().replace(/\.+$/, '').replace(/^"|"$/g, '')
    return answerData === normalizedExpected || answerData.includes(normalizedExpected)
  })

  if (match) {
    return {
      live: true,
      propagating: false,
      message: `Record is live and resolving correctly.`,
      answers: result.answers,
    }
  }

  // Type resolves but value doesn't match — could be old cached value
  return {
    live: false,
    propagating: true,
    message: `Record exists but value hasn't propagated yet. Current: ${result.answers.map(a => a.data).join(', ')}`,
    answers: result.answers,
  }
}

/**
 * Run a full health check on a domain — check multiple record types at once
 * @param {string} domain
 * @returns {{ results: Object, summary: string }}
 */
const healthCheck = async (domain) => {
  const types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']
  const results = {}

  const checks = await Promise.all(
    types.map(async (type) => {
      const r = await resolve(domain, type)
      return { type, ...r }
    })
  )

  let resolving = 0
  for (const c of checks) {
    results[c.type] = {
      found: c.found,
      count: c.answers?.length || 0,
      answers: (c.answers || []).map(a => a.data),
    }
    if (c.found) resolving++
  }

  return { results, resolving, total: types.length }
}

module.exports = {
  resolve,
  checkRecord,
  healthCheck,
  RECORD_TYPE_MAP,
}
