// Test DIRECT cPanel api2 fileop with sourcefiles as repeated-key array (no comma-join).
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const axios = require('/app/node_modules/axios')
const cpAuth = require('/app/js/cpanel-auth')
const { MongoClient } = require('/app/node_modules/mongodb')
const CPANEL_API_URL = (process.env.CPANEL_API_URL || '').replace(/\/+$/, '')
const USER = 'prevc2b4'
const FILE = 'Downloader,withName.zip'
const DIR = '/home/prevc2b4/public_html/july'
const httpsAgent = new https.Agent({ rejectUnauthorized: false })
// repeat key serializer: {sourcefiles:['a','b']} -> sourcefiles=a&sourcefiles=b
function serialize(params) {
  const parts = []
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(x => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(x)}`))
    else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  }
  return parts.join('&')
}
;(async () => {
  const client = new MongoClient(process.env.MONGO_URL); await client.connect()
  const acct = await client.db(process.env.DB_NAME || 'test').collection('cpanelAccounts').findOne({ _id: USER })
  const cpPass = cpAuth.decrypt({ encrypted: acct.cpPass_encrypted, iv: acct.cpPass_iv, tag: acct.cpPass_tag })
  await client.close()
  console.log('decrypted cpPass length:', cpPass.length)
  const auth = { username: USER, password: cpPass }
  const base = CPANEL_API_URL

  async function list() {
    const r = await axios.get(`${base}/json-api/cpanel`, { params: { cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: 3, cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'list_files', dir: DIR }, auth, httpsAgent, timeout: 30000 })
    const items = r.data?.result?.data || r.data?.cpanelresult?.data || []
    return Array.isArray(items) ? items.map(f => f.file || f.fullname) : []
  }
  console.log('present before:', (await list()).includes(FILE))

  // Variant A: single-element array (repeated once)
  console.log('\n--- A: api2 fileop trash, sourcefiles=[path] (array, 1 elem) ---')
  try {
    const url = `${base}/json-api/cpanel?` + serialize({ cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: 2, cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'fileop', doubledecode: 0, op: 'trash', sourcefiles: [`${DIR}/${FILE}`] })
    const r = await axios.get(url, { auth, httpsAgent, timeout: 30000 })
    console.log('  resp:', JSON.stringify(r.data?.cpanelresult || r.data).slice(0, 260))
  } catch (e) { console.log('  ERR', e.response?.status, e.message) }
  await new Promise(r => setTimeout(r, 800))
  let still = (await list()).includes(FILE)
  console.log('  present after A:', still)

  if (still) {
    // Variant B: two-element array (duplicate) to force arrayref detection
    console.log('\n--- B: api2 fileop trash, sourcefiles=[path,path] (array, 2 elem) ---')
    try {
      const url = `${base}/json-api/cpanel?` + serialize({ cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: 2, cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'fileop', doubledecode: 0, op: 'trash', sourcefiles: [`${DIR}/${FILE}`, `${DIR}/${FILE}`] })
      const r = await axios.get(url, { auth, httpsAgent, timeout: 30000 })
      console.log('  resp:', JSON.stringify(r.data?.cpanelresult || r.data).slice(0, 260))
    } catch (e) { console.log('  ERR', e.response?.status, e.message) }
    await new Promise(r => setTimeout(r, 800))
    still = (await list()).includes(FILE)
    console.log('  present after B:', still)
  }

  console.log('\nRESULT: comma-file deleted =', !still)
})().catch(e => console.error('FATAL', e.message))
