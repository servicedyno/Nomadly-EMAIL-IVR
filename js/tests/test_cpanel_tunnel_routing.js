/**
 * Regression test: getBaseUrl tunnel routing.
 *
 * Context: @ciroovblzz production report — user's files were live on the web
 * but invisible in the hosting panel. Root cause: every cpanel account has
 * `whmHost = WHM_HOST = origin IP (209.38.241.9)`, and the DO firewall
 * lockdown now blocks direct port 2083. So calls went to the firewalled
 * origin instead of the Cloudflare Tunnel at `cpanel-api.hostbay.io`.
 *
 * The fix: treat `host === WHM_HOST` as "the default server" and route via
 * the tunnel. Only resellers on a DIFFERENT box use direct IP:2083.
 */

const assert = require('assert')
const path = require('path')

process.env.WHM_HOST = '209.38.241.9'
process.env.CPANEL_API_URL = 'https://cpanel-api.hostbay.io'

// Fresh-require so env vars take effect
delete require.cache[require.resolve(path.resolve(__dirname, '../cpanel-proxy.js'))]
const cpProxy = require(path.resolve(__dirname, '../cpanel-proxy.js'))

// Expose getBaseUrl for testing via a tiny monkey patch — it's not exported
// directly, so we exercise it through uapi()'s URL construction indirectly.
// Simpler: since getBaseUrl is used to build the axios URL, we can mock axios
// and assert the URL it was called with for each (host) case.

const axios = require('axios')
const calls = []
axios.get = async (url) => { calls.push(url); return { data: { status: 1, data: [], errors: [] } } }
axios.post = async (url) => { calls.push(url); return { data: { status: 1, data: [], errors: [] } } }

function run(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}\n   ${e.message}`)
    process.exit(1)
  }
}

;(async () => {
  // 1. No host passed (bot-level calls) → tunnel
  calls.length = 0
  await cpProxy.uapi('u', 'p', 'Fileman', 'list_files', {}, 'GET', null)
  run('Routes through tunnel when host is null', () => {
    assert.ok(calls[0].startsWith('https://cpanel-api.hostbay.io/execute/'),
      `expected tunnel URL, got: ${calls[0]}`)
  })

  // 2. host === WHM_HOST (the @ciroovblzz case) → tunnel
  calls.length = 0
  await cpProxy.uapi('u', 'p', 'Fileman', 'list_files', {}, 'GET', '209.38.241.9')
  run('Routes through tunnel when host equals WHM_HOST (origin IP)', () => {
    assert.ok(calls[0].startsWith('https://cpanel-api.hostbay.io/execute/'),
      `expected tunnel URL for origin-IP host, got: ${calls[0]}`)
    assert.ok(!calls[0].includes('209.38.241.9'),
      `should not expose origin IP in URL, got: ${calls[0]}`)
  })

  // 3. Reseller on a different WHM box → direct
  calls.length = 0
  await cpProxy.uapi('u', 'p', 'Fileman', 'list_files', {}, 'GET', 'reseller2.other.com')
  run('Routes direct for resellers on a different WHM box', () => {
    assert.strictEqual(calls[0], 'https://reseller2.other.com:2083/execute/Fileman/list_files',
      `expected direct URL for reseller host, got: ${calls[0]}`)
  })

  // 4. uploadFile also honors tunnel routing for WHM_HOST
  calls.length = 0
  await cpProxy.uploadFile('u', 'p', '/home/u/public_html', 'x.txt', Buffer.from('x'), '209.38.241.9')
  run('uploadFile routes through tunnel when host equals WHM_HOST', () => {
    assert.ok(calls[0].startsWith('https://cpanel-api.hostbay.io/execute/Fileman/upload_files'),
      `expected tunnel URL for upload, got: ${calls[0]}`)
  })

  console.log('\nAll getBaseUrl tunnel-routing tests passed.')
})().catch(e => { console.error(e); process.exit(1) })
