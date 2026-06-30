/**
 * Investigate stuck .de domains directly at OpenProvider + DENIC public DNS.
 * Read-only probe — no mutations.
 *
 * Usage: node js/scripts/investigate_de_stuck.js
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const https = require('https')
const axios = require('axios')
const opService = require('../op-service')
const cfService = require('../cf-service')

const DOMAINS = [
  'inviowelcoparty.de',
  'rsvpeviteguestview.de',
  'rsvpcrumelbell.de',
  'paperlesseviteinvio.com',
  'strivepartypaperless.com',
]

const OP_BASE_URL = 'https://api.openprovider.eu'

const doh = (name, type) =>
  new Promise((resolve, reject) => {
    https
      .get(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
        { headers: { accept: 'application/dns-json' } },
        (res) => {
          let body = ''
          res.on('data', (c) => (body += c))
          res.on('end', () => {
            try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
          })
        }
      )
      .on('error', reject)
  })

// Auth — directly call API to expose raw response fields
const opAuth = async () => {
  const res = await axios.post(
    `${OP_BASE_URL}/v1beta/auth/login`,
    {
      username: process.env.OPENPROVIDER_USERNAME,
      password: process.env.OPENPROVIDER_PASSWORD,
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  )
  if (res.data?.code !== 0) throw new Error(`OP auth failed: ${JSON.stringify(res.data)}`)
  return res.data.data.token
}

const opGetDomainRaw = async (token, name, ext) => {
  // First find domain id
  const list = await axios.get(`${OP_BASE_URL}/v1beta/domains`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { domain_name_pattern: name, extension: ext, status: 'ACT,REQ,FAI,DEL,RGP,PEN' },
    timeout: 15000,
  })
  const results = list.data?.data?.results || []
  const match = results.find((d) =>
    `${d.domain?.name}.${d.domain?.extension}`.toLowerCase() === `${name}.${ext}`.toLowerCase()
  )
  if (!match) return null
  const full = await axios.get(`${OP_BASE_URL}/v1beta/domains/${match.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  })
  return full.data?.data
}

const main = async () => {
  const token = await opAuth()
  console.log('=== OpenProvider authenticated ===\n')

  for (const dom of DOMAINS) {
    const [name, ...rest] = dom.split('.')
    const ext = rest.join('.')
    console.log(`\n──────── ${dom} ────────`)

    // Public DNS
    try {
      const nsR = await doh(dom, 'NS')
      const aR = await doh(dom, 'A')
      const publicNs = (nsR.Answer || []).map((a) => a.data)
      const publicA = (aR.Answer || []).map((a) => a.data)
      console.log(`Public NS:`, publicNs)
      console.log(`Public A: `, publicA)
    } catch (e) {
      console.log(`Public DNS error: ${e.message}`)
    }

    // OP record
    try {
      const d = await opGetDomainRaw(token, name, ext)
      if (!d) {
        console.log('OP: NOT FOUND')
      } else {
        console.log(`OP id:               ${d.id}`)
        console.log(`OP status:           ${d.status}`)
        console.log(`OP renewal_date:     ${d.renewal_date}`)
        console.log(`OP creation_date:    ${d.creation_date}`)
        console.log(`OP ns_group:         ${d.ns_group || '(none)'}`)
        console.log(`OP name_servers:     ${JSON.stringify((d.name_servers || []).map((n) => n.name))}`)
        console.log(`OP is_dnssec_enabled:${d.is_dnssec_enabled}`)
        console.log(`OP dnssec_keys:      ${JSON.stringify(d.dnssec_keys || [])}`)
        console.log(`OP is_locked:        ${d.is_locked}`)
        console.log(`OP autorenew:        ${d.autorenew}`)
        if (d.additional_data) console.log(`OP additional_data:  ${JSON.stringify(d.additional_data)}`)
      }
    } catch (e) {
      console.log(`OP lookup error: ${e.response?.status} ${e.response?.data?.desc || e.message}`)
    }

    // Cloudflare zone
    try {
      const zone = await cfService.getZoneByName(dom)
      if (!zone) {
        console.log('CF zone: NOT FOUND')
      } else {
        console.log(`CF zone id:          ${zone.id}`)
        console.log(`CF zone status:      ${zone.status}`)
        console.log(`CF zone NS:          ${JSON.stringify(zone.name_servers)}`)
        console.log(`CF created_on:       ${zone.created_on}`)
        console.log(`CF activated_on:     ${zone.activated_on}`)
      }
    } catch (e) {
      console.log(`CF lookup error: ${e.message}`)
    }
  }

  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e?.stack || e)
  process.exit(1)
})
