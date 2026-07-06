/**
 * Regression test — @LevelupwithME "A record didn't update" fix
 * (2026-07-06). Prod incident: chatId 5991214713, domain
 * assist-user04.com, wanted A record @ → 161.35.11.55. The record WAS
 * saved to Cloudflare, but with proxied=true (orange cloud), so `dig`
 * returned CF edge IPs (172.67.x.x / 104.21.x.x) instead of the user's
 * origin IP. To the customer this reads as "the A record didn't update".
 *
 * Root cause: /app/js/domain-service.js `addDNSRecord()` unconditionally
 * set `shouldProxy = true` for all A/AAAA/CNAME records on CF-managed
 * zones. Fine for the Anti-Red hosting flow (they WANT origin hidden),
 * wrong for user-driven DNS-Management "Add Record" — the user is
 * pointing the domain at THEIR OWN origin.
 *
 * Fix contract:
 *   • addDNSRecord() now accepts a trailing `opts` object with a
 *     `proxied: false` opt-out. Historic default preserved (A/AAAA/CNAME
 *     proxied) so shortener CNAME + www-CNAME + hosting paths that rely
 *     on CF proxy keep working unchanged.
 *   • resolveConflictAndAdd() now accepts + forwards `opts` so the
 *     conflict-replace path can also opt out.
 *   • Every user-driven Add-Record call site in _index.js explicitly
 *     passes `{ proxied: false }`:
 *       - dns-add-value (main Add DNS Record → typed IP)
 *       - dns-quick-subdomain-ip (subdomain → my IP)
 *       - dns-quick-subdomain-domain (subdomain → CNAME to my domain)
 *       - dns-confirm-conflict-replace (conflict replacement path)
 */

const fs = require('fs')
const path = require('path')

let failures = 0
function check(name, cond, detail) {
  if (cond) console.log(`  ✅ ${name}`)
  else { failures++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// ─── 1. Static asserts on domain-service.js ──────────────────
console.log('\n[1] domain-service.js — proxied opt-out contract')
const dsSrc = fs.readFileSync(path.join(__dirname, '..', 'domain-service.js'), 'utf8')

check('addDNSRecord accepts a trailing opts arg (with default {})',
  /addDNSRecord\s*=\s*async\s*\([^)]*opts\s*=\s*\{\s*\}\s*\)/.test(dsSrc))

check('shouldProxy is gated by isProxiable AND `opts.proxied !== false`',
  /const shouldProxy\s*=\s*isProxiable\s*&&\s*opts\.proxied\s*!==\s*false/.test(dsSrc))

check('@LevelupwithME attribution anchor in bug-fix comment',
  /LevelupwithME/i.test(dsSrc))

check('resolveConflictAndAdd accepts + forwards opts to addDNSRecord',
  /resolveConflictAndAdd\s*=\s*async\s*\([^)]*opts\s*\)[\s\S]{0,800}?return\s+await\s+addDNSRecord\s*\([^)]*opts\s*\)/.test(dsSrc))

// ─── 2. Static asserts on _index.js — every user-driven Add-Record path ──
console.log('\n[2] _index.js — user-driven Add-Record paths opt out of proxying')
const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

// Main "dns-add-value" flow — line ~21139
check('dns-add-value main path passes { proxied: false }',
  /const result = await domainService\.addDNSRecord\(domain,\s*recordType,\s*value,\s*hostname,\s*db,\s*undefined,\s*undefined,\s*\{\s*proxied:\s*false\s*\}\)/.test(idxSrc))

// dns-quick-subdomain-ip — line ~20930
check('dns-quick-subdomain-ip passes { proxied: false }',
  /addDNSRecord\(domain,\s*'A',\s*message\.trim\(\),\s*subName,\s*db,\s*undefined,\s*undefined,\s*\{\s*proxied:\s*false\s*\}\)/.test(idxSrc))

// dns-quick-subdomain-domain — line ~20941
check('dns-quick-subdomain-domain passes { proxied: false }',
  /addDNSRecord\(domain,\s*'CNAME',\s*target,\s*subName,\s*db,\s*undefined,\s*undefined,\s*\{\s*proxied:\s*false\s*\}\)/.test(idxSrc))

// dns-confirm-conflict-replace — line ~21231
check('dns-confirm-conflict-replace passes { proxied: false }',
  /resolveConflictAndAdd\(domain,\s*recordType,\s*value,\s*hostname,\s*conflictingRecords,\s*db,\s*undefined,\s*\{\s*proxied:\s*false\s*\}\)/.test(idxSrc))

check('@LevelupwithME attribution anchor in _index.js',
  /LevelupwithME/i.test(idxSrc))

// ─── 3. Behavioural check via mock of cfService.createDNSRecord ──
console.log('\n[3] Behavioural — addDNSRecord respects opts.proxied')

// Isolate cf-service via require.cache mock
const cfServicePath = require.resolve('../cf-service')
const originalCf = require.cache[cfServicePath]

let capturedProxied = null
require.cache[cfServicePath] = {
  id: cfServicePath, filename: cfServicePath, loaded: true,
  exports: {
    createDNSRecord: async (zoneId, type, name, content, ttl, proxied) => {
      capturedProxied = proxied
      return { success: true, id: 'test-rec-id', proxied }
    },
    getZoneByName: async () => null,
    updateDNSRecord: async () => ({ success: true }),
    deleteDNSRecord: async () => ({ success: true }),
    createZone: async () => ({ success: true, zoneId: 'test-zone' }),
  },
}

// Also stub the db so getDomainMeta returns a CF-managed shape
const dsPath = require.resolve('../domain-service')
delete require.cache[dsPath]
const ds = require('../domain-service')

// Mock the getDomainMeta path by providing a fake db that returns a domain
// on Cloudflare
const fakeDb = {
  collection: (name) => ({
    findOne: async (q) => {
      if (name === 'registeredDomains' && q._id === 'assist-user04.com') {
        return { val: { cfZoneId: 'f8ee81ba6fc35fe0fcf9f767cbee349c',
                        nameserverType: 'cloudflare', registrar: 'OpenProvider' } }
      }
      return null
    },
    updateOne: async () => ({ matchedCount: 1 }),
  }),
}

;(async () => {
  // Case 1: DEFAULT (no opts) — historic behaviour preserved (A record proxied)
  capturedProxied = null
  await ds.addDNSRecord('assist-user04.com', 'A', '161.35.11.55', '', fakeDb)
  check('default (no opts) → proxied=true for A record (historic behaviour)',
    capturedProxied === true, `got proxied=${capturedProxied}`)

  // Case 2: Explicit opt-OUT — proxied:false → DNS-only
  capturedProxied = null
  await ds.addDNSRecord('assist-user04.com', 'A', '161.35.11.55', '', fakeDb, undefined, undefined, { proxied: false })
  check('opts.proxied=false → proxied=false (DNS-only, the @LevelupwithME fix)',
    capturedProxied === false, `got proxied=${capturedProxied}`)

  // Case 3: Explicit opt-IN — proxied:true → proxied
  capturedProxied = null
  await ds.addDNSRecord('assist-user04.com', 'A', '161.35.11.55', '', fakeDb, undefined, undefined, { proxied: true })
  check('opts.proxied=true → proxied=true',
    capturedProxied === true, `got proxied=${capturedProxied}`)

  // Case 4: Non-proxiable record type (MX) — proxied stays false regardless
  capturedProxied = null
  await ds.addDNSRecord('assist-user04.com', 'MX', 'mail.example.com', '', fakeDb, 10, undefined, { proxied: true })
  check('MX record → proxied=false even with opts.proxied=true (not proxiable)',
    capturedProxied === false, `got proxied=${capturedProxied}`)

  // Case 5: CNAME with opt-out
  capturedProxied = null
  await ds.addDNSRecord('assist-user04.com', 'CNAME', 'target.example.com', 'www', fakeDb, undefined, undefined, { proxied: false })
  check('CNAME + opts.proxied=false → proxied=false',
    capturedProxied === false, `got proxied=${capturedProxied}`)

  // Case 6: resolveConflictAndAdd forwards opts
  capturedProxied = null
  await ds.resolveConflictAndAdd('assist-user04.com', 'A', '161.35.11.55', '', [], fakeDb, undefined, { proxied: false })
  check('resolveConflictAndAdd forwards opts.proxied=false to addDNSRecord',
    capturedProxied === false, `got proxied=${capturedProxied}`)

  // Restore
  if (originalCf) require.cache[cfServicePath] = originalCf
  else delete require.cache[cfServicePath]

  // ─── 4. Regression sanity — previous fixes untouched ───
  console.log('\n[4] Regression sanity — prior fixes still intact')
  const cpProxy = require('../cpanel-proxy')
  check('cpanel-proxy.looksLikeUapiPermFailure still exported',
    typeof cpProxy.looksLikeUapiPermFailure === 'function')
  check('cpanel-proxy.extractCpanelErrorFromResponse still exported',
    typeof cpProxy.extractCpanelErrorFromResponse === 'function')

  console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} test(s) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch(err => {
  console.error('Async block threw:', err.stack || err)
  process.exit(1)
})
