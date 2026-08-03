// Empirically find a working delete for the comma-named file, then delete BOTH copies.
// Only ever targets 'Downloader,withName.zip'. Verifies via re-list after each attempt.
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const axios = require('/app/node_modules/axios')
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.WHM_TOKEN
const USER = 'prevc2b4'
const FILE = 'Downloader,withName.zip'
const agent = new https.Agent({ rejectUnauthorized: false })
const AUTH = { Authorization: `whm root:${TOKEN}` }
const enc = encodeURIComponent

async function rawGet(qs) {
  const url = `${WHM_API_URL}/json-api/cpanel?${qs}`
  const r = await axios.get(url, { headers: AUTH, httpsAgent: agent, timeout: 30000 })
  return r.data
}
async function listDir(dir) {
  const qs = `api.version=1&cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=list_files&dir=${enc(dir)}`
  const d = await rawGet(qs)
  const items = d?.result?.data || []
  return Array.isArray(items) ? items.map(f => f.file || f.fullname) : []
}
async function present(dir) { return (await listDir(dir)).includes(FILE) }

// candidate delete methods; each returns raw response
const methods = {
  // M2: UAPI (apiversion 3) fileop trash, scalar sourcefiles
  M2_uapi_scalar: (dir) => rawGet(`api.version=1&cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=trash&sourcefiles=${enc(dir + '/' + FILE)}`),
  // M3: UAPI fileop trash, array (repeated key) -> forces arrayref, no comma-split
  M3_uapi_array: (dir) => rawGet(`api.version=1&cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=trash&sourcefiles=${enc(dir + '/' + FILE)}&sourcefiles=${enc(dir + '/' + FILE)}`),
  // M4: API2 fileop unlink, array (repeated key)
  M4_api2_array: (dir) => rawGet(`cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=trash&sourcefiles=${enc(dir + '/' + FILE)}&sourcefiles=${enc(dir + '/' + FILE)}`),
}

;(async () => {
  const dir = '/home/prevc2b4/public_html/july'   // test on the 'july' copy first
  console.log('Target dir:', dir, '| present before:', await present(dir))
  let winner = null
  for (const [name, fn] of Object.entries(methods)) {
    if (!(await present(dir))) { console.log('  file already gone — stop'); winner = winner || 'already-gone'; break }
    console.log(`\n--- trying ${name} ---`)
    try {
      const resp = await fn(dir)
      const cp = resp?.result || resp?.cpanelresult || resp
      console.log('  resp:', JSON.stringify(cp).slice(0, 300))
    } catch (e) { console.log('  ERR', e.response?.status, e.message) }
    await new Promise(r => setTimeout(r, 800))
    const still = await present(dir)
    console.log(`  present after ${name}:`, still)
    if (!still) { winner = name; console.log(`  ✅ WORKING METHOD: ${name}`); break }
  }

  if (winner && winner !== 'already-gone') {
    // Apply same method to the 'scren' copy
    const dir2 = '/home/prevc2b4/public_html/scren'
    console.log(`\n=== applying ${winner} to ${dir2} (present: ${await present(dir2)}) ===`)
    if (await present(dir2)) {
      try { await methods[winner](dir2) } catch (e) { console.log('  ERR', e.message) }
      await new Promise(r => setTimeout(r, 800))
      console.log('  present after:', await present(dir2))
    }
  }
  console.log('\nFINAL winner method:', winner)
})().catch(e => console.error('FATAL', e.message))
