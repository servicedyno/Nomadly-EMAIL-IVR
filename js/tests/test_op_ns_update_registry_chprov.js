/**
 * Regression test — OpenProvider NS update must include `ns_group: ''` so the
 * registry chprov push fires (notably required for .de domains where OP
 * otherwise leaves the delegation as a stale Nsentry A-record).
 *
 * Real-prod incident: @HHR2009 / rsvpeviteopen.de — DENIC kept
 * `Nsentry: 93.180.69.101` for hours after OP showed CF nameservers,
 * because OP wasn't re-publishing to DENIC. Adding `ns_group: ''` to the
 * PUT payload forced the registry push.
 *
 * This test:
 *   1. Statically inspects the source to verify `ns_group: ''` is present
 *      in the `_sendNsUpdate` helper.
 *   2. Mocks the axios PUT and verifies the actual outgoing payload
 *      contains both `name_servers` and `ns_group: ''`.
 */
const fs = require('fs')
const path = require('path')
const Module = require('module')

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'op-service.js'), 'utf-8')

let passed = 0
let failed = 0
function assert(name, cond, hint) {
  if (cond) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name}${hint ? ' — ' + hint : ''}`)
    failed++
  }
}

// ── A. Static source guard ─────────────────────────────────────────────────
console.log('A. Static source guard')
assert(
  'A.1 _sendNsUpdate present',
  /_sendNsUpdate\s*=\s*async/.test(SOURCE),
  'helper renamed or removed?'
)
// _put closure must include both `name_servers` and `ns_group: ''`
const putBody = SOURCE.match(/const\s+_put\s*=\s*\(timeoutMs\)\s*=>\s*axios\.put\([\s\S]*?,\s*\{([\s\S]*?)\}\s*,\s*\{\s*headers/m)
assert('A.2 _put body extractable', !!putBody, 'could not locate _put closure body')
if (putBody) {
  assert(
    'A.3 _put sends name_servers',
    /name_servers\s*:\s*nsPayload/.test(putBody[1]),
    'name_servers payload missing'
  )
  assert(
    'A.4 _put sends ns_group: \'\'',
    /ns_group\s*:\s*['"]['"]/.test(putBody[1]),
    'ns_group: "" missing — registry chprov will not fire for .de'
  )
}

// ── B. Behavioural test — mock axios and verify outgoing payload ───────────
console.log('\nB. Behavioural test')
const capturedRequests = []
const fakeAxios = {
  put: async (url, body, opts) => {
    capturedRequests.push({ url, body, opts })
    return { data: { code: 0, data: {} } }
  },
  get: async (url, opts) => {
    // mock getDomainInfo: return a fake .de domain
    if (url.includes('/v1beta/domains') && opts?.params?.extension === 'de') {
      return { data: { code: 0, data: { results: [{ id: 999111 }] } } }
    }
    if (url.match(/\/v1beta\/domains\/999111$/)) {
      return {
        data: {
          code: 0,
          data: {
            name_servers: [
              { seq_nr: 0, name: 'ns1.openprovider.nl' },
              { seq_nr: 1, name: 'ns2.openprovider.be' },
            ],
            status: 'ACT',
            renewal_date: '2027-01-01',
            is_dnssec_enabled: false,
            dnssec_keys: [],
          },
        },
      }
    }
    if (url.includes('/v1beta/auth/login')) {
      return { data: { data: { token: 'fake-token' } } }
    }
    return { data: { code: 0 } }
  },
  post: async (url, body) => {
    if (url.includes('/v1beta/auth/login')) {
      return { data: { code: 0, data: { token: 'fake-token' } } }
    }
    return { data: { code: 0 } }
  },
}

// Inject mocked axios + dotenv via Module._load hook
const origLoad = Module._load
Module._load = function (req, parent, isMain) {
  if (req === 'axios') return fakeAxios
  if (req === 'dotenv') return { config: () => ({}) }
  return origLoad.call(this, req, parent, isMain)
}

// Bust cache so the patched axios takes effect
delete require.cache[require.resolve('../op-service.js')]
// Stub env so authHeaders() works without real creds
process.env.OPENPROVIDER_USERNAME = process.env.OPENPROVIDER_USERNAME || 'x@y.z'
process.env.OPENPROVIDER_PASSWORD = process.env.OPENPROVIDER_PASSWORD || 'fake'

;(async () => {
  try {
    const op = require('../op-service.js')
    capturedRequests.length = 0

    const result = await op.updateNameservers('rsvpeviteopen.de', [
      'anderson.ns.cloudflare.com',
      'leanna.ns.cloudflare.com',
    ])

    assert('B.1 updateNameservers returns success', result?.success === true, JSON.stringify(result))
    assert('B.2 at least one PUT was made', capturedRequests.length >= 1, `got ${capturedRequests.length}`)

    const putReq = capturedRequests.find(r => r.url.includes('/v1beta/domains/999111') && !r.url.includes('/v1beta/domains/999111/'))
    assert('B.3 PUT to /v1beta/domains/<id> captured', !!putReq, 'no domain-update PUT was sent')

    if (putReq) {
      assert(
        'B.4 PUT body includes name_servers',
        Array.isArray(putReq.body?.name_servers) && putReq.body.name_servers.length === 2,
        JSON.stringify(putReq.body)
      )
      assert(
        'B.5 PUT body includes ns_group: ""',
        Object.prototype.hasOwnProperty.call(putReq.body, 'ns_group') && putReq.body.ns_group === '',
        `ns_group=${JSON.stringify(putReq.body?.ns_group)} — required for DENIC chprov`
      )
      assert(
        'B.6 name_servers seq_nr ordered',
        putReq.body.name_servers[0]?.name === 'anderson.ns.cloudflare.com'
        && putReq.body.name_servers[1]?.name === 'leanna.ns.cloudflare.com',
        JSON.stringify(putReq.body.name_servers)
      )
    }
  } catch (e) {
    console.log(`  ✗ unexpected exception: ${e.message}`)
    failed++
  }

  Module._load = origLoad

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})()
