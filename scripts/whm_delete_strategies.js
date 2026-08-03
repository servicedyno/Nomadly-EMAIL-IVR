// Test remaining delete strategies for the comma file (july copy only).
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const axios = require('/app/node_modules/axios')
const net = require('net')
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.WHM_TOKEN
const USER = 'prevc2b4'
const FILE = 'Downloader,withName.zip'
const DIR = '/home/prevc2b4/public_html/july'
const agent = new https.Agent({ rejectUnauthorized: false })
const AUTH = { Authorization: `whm root:${TOKEN}` }
const enc = encodeURIComponent
async function rawGet(qs) {
  const r = await axios.get(`${WHM_API_URL}/json-api/cpanel?${qs}`, { headers: AUTH, httpsAgent: agent, timeout: 30000 })
  return r.data
}
async function list(dir) {
  const d = await rawGet(`api.version=1&cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=3&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=list_files&dir=${enc(dir)}`)
  const items = d?.result?.data || []
  return Array.isArray(items) ? items.map(f => f.file || f.fullname) : []
}
async function present() { return (await list(DIR)).includes(FILE) }
function tcp(host, port, ms) { return new Promise(res => { const s = new net.Socket(); let done = false; const fin = (ok, r) => { if (done) return; done = true; try { s.destroy() } catch (_) {} res({ ok, r }) }; s.setTimeout(ms); s.once('connect', () => fin(true, 'connected')); s.once('timeout', () => fin(false, 'TIMEOUT')); s.once('error', e => fin(false, e.code || e.message)); s.connect(port, host) }) }

;(async () => {
  console.log('== SSH:22 reachability from this pod ==')
  console.log('  68.183.77.106:22 ->', JSON.stringify(await tcp('68.183.77.106', 22, 6000)))

  console.log('\n== present before:', await present(), '==')

  // V1: backslash-escape the comma
  console.log('\n--- V1 backslash-escape comma (api2 unlink) ---')
  try {
    const sf = `${DIR}/Downloader\\,withName.zip`
    const r = await rawGet(`cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=trash&sourcefiles=${enc(sf)}`)
    console.log('  resp:', JSON.stringify(r?.cpanelresult || r).slice(0, 260))
  } catch (e) { console.log('  ERR', e.message) }
  await new Promise(r => setTimeout(r, 800))
  console.log('  present after V1:', await present())

  // V2: rename (strip comma) then delete
  if (await present()) {
    console.log('\n--- V2 rename to comma-free name, then trash ---')
    const NEW = 'cleanupA.zip'
    try {
      const r = await rawGet(`cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=rename&sourcefiles=${enc(DIR + '/' + FILE)}&destfiles=${enc(DIR + '/' + NEW)}`)
      console.log('  rename resp:', JSON.stringify(r?.cpanelresult || r).slice(0, 260))
    } catch (e) { console.log('  rename ERR', e.message) }
    await new Promise(r => setTimeout(r, 800))
    const after = await list(DIR)
    console.log('  dir now:', JSON.stringify(after))
    console.log('  comma-file present:', after.includes(FILE), '| renamed present:', after.includes(NEW))
    // if renamed, delete it
    if (after.includes('cleanupA.zip')) {
      const r2 = await rawGet(`cpanel_jsonapi_user=${USER}&cpanel_jsonapi_apiversion=2&cpanel_jsonapi_module=Fileman&cpanel_jsonapi_func=fileop&doubledecode=0&op=trash&sourcefiles=${enc(DIR + '/cleanupA.zip')}`)
      console.log('  delete-renamed resp:', JSON.stringify(r2?.cpanelresult || r2).slice(0, 200))
      await new Promise(r => setTimeout(r, 600))
      console.log('  dir final:', JSON.stringify(await list(DIR)))
    }
  }
})().catch(e => console.error('FATAL', e.message))
