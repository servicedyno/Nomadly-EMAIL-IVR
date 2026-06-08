#!/usr/bin/env node
/**
 * One-shot Origin CA cert provisioning for cPanel domains that are in Cloudflare
 * but lack an Origin CA cert. Mirrors the addon-domain-flow.js hardening block
 * applied today, but for the 13 domains that pre-date the fix.
 *
 * Steps per domain:
 *   1. Resolve its cPanel account (cpUser) via WHM /listaccts
 *   2. Generate CF Origin CA cert (15-yr validity via local openssl CSR)
 *   3. Install on cPanel via WHM /installssl
 *   4. Set clobber_externally_signed=0 on the user (so AutoSSL doesn't overwrite)
 *   5. Upgrade CF SSL mode for the zone to 'strict' (= Full strict)
 *
 * Safety:
 *   - Skips any domain that already has an active Origin CA cert
 *   - --apply required (default = dry-run print plan)
 *   - --domain=foo can target one domain only
 *   - Logs every action; failures don't abort the loop
 */

require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const { execSync } = require('child_process')
const os = require('os')
const fs = require('fs')
const path = require('path')

const CF_BASE = 'https://api.cloudflare.com/client/v4'
const WHM_URL = 'https://whm-api.hostbay.io'

const CF_HEADERS = {
  'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
  'X-Auth-Key':   process.env.CLOUDFLARE_API_KEY,
  'Content-Type': 'application/json',
}
const WHM_HEADERS = {
  'Authorization': `whm root:${process.env.WHM_TOKEN}`,
}

const APPLY  = process.argv.includes('--apply')
const ONE    = (process.argv.find(a => a.startsWith('--domain=')) || '').slice(9) || null

if (!process.env.CLOUDFLARE_API_KEY || !process.env.WHM_TOKEN) {
  console.error('missing CLOUDFLARE_API_KEY or WHM_TOKEN in /app/backend/.env')
  process.exit(1)
}

const log  = (m) => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`)
const fail = (m) => { console.error(`FAILED: ${m}`); process.exit(1) }

async function cfGet(path)  { return (await axios.get(CF_BASE + path, { headers: CF_HEADERS, timeout: 20000 })).data }
async function cfPost(p, b) { return (await axios.post(CF_BASE + p, b, { headers: CF_HEADERS, timeout: 30000 })).data }
async function cfPatch(p,b) { return (await axios.patch(CF_BASE + p, b, { headers: CF_HEADERS, timeout: 20000 })).data }
async function whmGet(path) { return (await axios.get(WHM_URL + path, { headers: WHM_HEADERS, timeout: 60000 })).data }


async function listAccts() {
  const d = await whmGet('/json-api/listaccts?api.version=1&want=user,domain')
  return d?.data?.acct || []
}

async function findCfZone(domain) {
  const d = await cfGet(`/zones?name=${domain}`)
  return (d.result || [])[0] || null
}

async function getZoneCerts(zoneId) {
  const d = await cfGet(`/certificates?zone_id=${zoneId}`)
  return (d.result || []).filter(c => !c.revoked)
}

async function generateOriginCACert(hostnames, validityDays = 5475) {
  const tmpDir = os.tmpdir()
  const keyFile = path.join(tmpDir, `origin-ca-${Date.now()}.key`)
  const csrFile = path.join(tmpDir, `origin-ca-${Date.now()}.csr`)
  const conf    = path.join(tmpDir, `origin-ca-${Date.now()}.cnf`)

  const sanEntries = hostnames.map(h => `DNS:${h}`).join(',')
  const confText = [
    '[req]',
    'distinguished_name = req_distinguished_name',
    'req_extensions = v3_req',
    'prompt = no',
    '[req_distinguished_name]',
    `CN = ${hostnames[0]}`,
    '[v3_req]',
    `subjectAltName = ${sanEntries}`,
  ].join('\n')
  fs.writeFileSync(conf, confText)

  execSync(`openssl genrsa -out "${keyFile}" 2048 2>/dev/null`)
  execSync(`openssl req -new -key "${keyFile}" -out "${csrFile}" -config "${conf}" 2>/dev/null`)

  const privateKey = fs.readFileSync(keyFile, 'utf8')
  const csr        = fs.readFileSync(csrFile, 'utf8')

  try { fs.unlinkSync(keyFile) } catch (_) {}
  try { fs.unlinkSync(csrFile) } catch (_) {}
  try { fs.unlinkSync(conf)    } catch (_) {}

  const res = await cfPost('/certificates', {
    csr,
    hostnames,
    requested_validity: validityDays,
    request_type: 'origin-rsa',
  })
  if (!res.success) {
    const err = res.errors?.[0]?.message || 'unknown'
    throw new Error(`CF Origin CA: ${err}`)
  }
  return {
    certificate: res.result.certificate,
    privateKey,
    expiresOn: res.result.expires_on,
    id: res.result.id,
  }
}

async function installDomainSSL(cpUser, domain, cert, key) {
  const r = await axios.get(WHM_URL + '/json-api/installssl', {
    headers: WHM_HEADERS,
    params: { 'api.version': 1, domain, crt: cert, key, cab: '' },
    timeout: 90000,
  })
  const meta = r.data?.metadata
  if (meta?.result === 1) return { ok: true }
  return { ok: false, error: meta?.reason || JSON.stringify(r.data) }
}

async function setClobberExternalSafe(cpUser) {
  const r = await axios.get(WHM_URL + '/json-api/set_autossl_metadata', {
    headers: WHM_HEADERS,
    params: {
      'api.version': 1,
      username: cpUser,
      metadata_json: JSON.stringify({ clobber_externally_signed: 0 }),
    },
    timeout: 15000,
  })
  return r.data?.metadata?.result === 1
}

async function setSslMode(zoneId, mode) {
  const r = await cfPatch(`/zones/${zoneId}/settings/ssl`, { value: mode })
  return r.success === true
}


// ── MAIN ────────────────────────────────────────────────────────────────────
;(async () => {
  log(`mode: ${APPLY ? 'APPLY (will write)' : 'DRY-RUN (no writes)'}`)
  if (ONE) log(`scoped to single domain: ${ONE}`)
  console.log()

  // 1. list cPanel accounts and map domain → cpUser
  const accts = await listAccts()
  const domainToUser = {}
  for (const a of accts) {
    if (a.domain && a.user) domainToUser[a.domain.toLowerCase()] = a.user
  }
  log(`cPanel accounts: ${Object.keys(domainToUser).length}`)

  // 2. iterate targets
  const targets = ONE ? [ONE] : Object.keys(domainToUser)
  log(`targets: ${targets.length}`)
  console.log()

  let ok = 0, skipped = 0, failed = 0
  for (const domain of targets) {
    const cpUser = domainToUser[domain]
    if (!cpUser) {
      log(`✗ ${domain}: no cPanel user mapping — skip`)
      skipped++; continue
    }

    let zone
    try { zone = await findCfZone(domain) } catch (e) {
      log(`✗ ${domain}: CF lookup error: ${e.message}`)
      failed++; continue
    }
    if (!zone) {
      log(`✗ ${domain}: not in CF account — skip (would need zone creation + NS delegation)`)
      skipped++; continue
    }
    if (zone.status !== 'active') {
      log(`✗ ${domain}: CF zone status=${zone.status} — skip (registry hasn't delegated NS to Cloudflare yet)`)
      skipped++; continue
    }

    let existing
    try { existing = await getZoneCerts(zone.id) } catch (e) {
      log(`✗ ${domain}: cert list error: ${e.message}`)
      failed++; continue
    }
    if (existing.length > 0) {
      const c = existing[0]
      log(`✓ ${domain}: already has ${existing.length} Origin CA cert(s), expires ${(c.expires_on||'?').slice(0,10)} — skip`)
      ok++; continue
    }

    if (!APPLY) {
      log(`▸ ${domain} (user=${cpUser}, zoneId=${zone.id}) — WOULD issue + install + harden`)
      ok++; continue
    }

    log(`▸ ${domain} (user=${cpUser}, zone=${zone.id}) — provisioning…`)
    try {
      const cert = await generateOriginCACert([domain, `*.${domain}`])
      log(`   ✓ CF Origin CA cert issued (expires ${cert.expiresOn?.slice(0,10)})`)

      const inst = await installDomainSSL(cpUser, domain, cert.certificate, cert.privateKey)
      if (!inst.ok) { log(`   ✗ installssl failed: ${inst.error}`); failed++; continue }
      log(`   ✓ installed on cPanel for ${cpUser}`)

      const clobberOk = await setClobberExternalSafe(cpUser)
      log(`   ${clobberOk ? '✓' : '✗'} clobber_externally_signed=0 for ${cpUser}`)

      const strictOk = await setSslMode(zone.id, 'strict')
      log(`   ${strictOk ? '✓' : '✗'} CF SSL mode → strict (Full strict)`)

      ok++
    } catch (e) {
      log(`   ✗ ${e.message}`)
      failed++
    }
  }

  console.log()
  log(`done. ok=${ok} skipped=${skipped} failed=${failed}`)
  if (!APPLY) log(`▶ to commit, re-run with --apply`)
})().catch(err => fail(err.message))
