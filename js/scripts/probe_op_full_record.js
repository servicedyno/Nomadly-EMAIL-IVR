/**
 * Diagnostic: pull the FULL OP domain record (no field projection) for each
 * stuck domain to identify any fields preventing the CF NS from publishing
 * at DENIC. Likely culprits: nsentry, is_use_internal_dns, web_forwarding,
 * nominee_email, dns_zone, etc.
 *
 * READ-ONLY.
 */
'use strict'

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const axios = require('axios')

const DOMAINS = [
  'inviowelcoparty.de',
  'rsvpeviteguestview.de',
  'rsvpcrumelbell.de',
  'paperlesseviteinvio.com',
  'strivepartypaperless.com',
]

const OP_BASE = 'https://api.openprovider.eu'

const main = async () => {
  const auth = await axios.post(`${OP_BASE}/v1beta/auth/login`, {
    username: process.env.OPENPROVIDER_USERNAME,
    password: process.env.OPENPROVIDER_PASSWORD,
  }, { timeout: 15000 })
  const token = auth.data.data.token

  for (const dom of DOMAINS) {
    const [name, ...rest] = dom.split('.')
    const ext = rest.join('.')
    console.log(`\n══════ ${dom} ══════`)
    try {
      const search = await axios.get(`${OP_BASE}/v1beta/domains`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { domain_name_pattern: name, extension: ext, limit: 5 },
        timeout: 15000,
      })
      const matches = (search.data?.data?.results || []).filter((r) =>
        `${r.domain?.name}.${r.domain?.extension}`.toLowerCase() === dom.toLowerCase()
      )
      if (matches.length === 0) {
        console.log('  NOT FOUND in OP')
        continue
      }
      const id = matches[0].id
      console.log(`  OP id: ${id}, status from search: ${matches[0].status}`)

      // Full GET with all expansions
      const full = await axios.get(`${OP_BASE}/v1beta/domains/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          with_history: false,
          with_additional_data: true,
        },
        timeout: 15000,
      })
      const d = full.data?.data || {}
      // Print all top-level keys + selected nested
      const interesting = [
        'id', 'status', 'ns_group', 'name_servers',
        'is_dnssec_enabled', 'dnssec_keys',
        'is_locked', 'autorenew', 'renewal_date', 'creation_date',
        'is_use_internal_dns', 'is_private_whois_enabled',
        'nameservers', 'dns_records', 'use_dns_credentials',
      ]
      for (const k of interesting) {
        if (d[k] !== undefined) {
          const v = typeof d[k] === 'object' ? JSON.stringify(d[k]) : d[k]
          console.log(`  ${k}: ${v}`)
        }
      }
      // Print any other top-level keys we don't know about
      const knownKeys = new Set([
        ...interesting,
        'domain', 'owner_handle', 'admin_handle', 'tech_handle', 'billing_handle',
        'reseller_handle', 'auth_code', 'additional_data', 'comments',
        'expiration_date', 'is_premium', 'period', 'restorable', 'application_mode',
        'tag', 'updated_date', 'verification_email_name', 'is_spam',
        'is_sandbox', 'tld_data', 'sub_status', 'phase', 'flags',
        'recurring_billing_request_id', 'wp_url', 'wp_themes', 'wp_users',
        'webhost_provider', 'webhosting_id',
      ])
      const unknownKeys = Object.keys(d).filter((k) => !knownKeys.has(k))
      if (unknownKeys.length) {
        console.log(`  UNKNOWN KEYS:`)
        for (const k of unknownKeys) {
          const v = typeof d[k] === 'object' ? JSON.stringify(d[k]).slice(0, 200) : d[k]
          console.log(`    ${k}: ${v}`)
        }
      }
      // Lock fields
      ;['is_locked', 'lock_status', 'status_extra'].forEach((k) => {
        if (d[k] !== undefined) console.log(`  ${k}: ${JSON.stringify(d[k])}`)
      })
    } catch (e) {
      const opData = e.response?.data
      console.log(`  ERROR: HTTP ${e.response?.status} ${e.message} | desc: ${opData?.desc || ''} | full: ${JSON.stringify(opData).slice(0, 300)}`)
    }
  }
  process.exit(0)
}

main().catch((e) => { console.error('FATAL:', e?.stack || e); process.exit(1) })
