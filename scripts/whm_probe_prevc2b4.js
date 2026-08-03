// READ-ONLY WHM probe for prevc2b4 — confirm comma file + account/quota state.
require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const axios = require('/app/node_modules/axios')
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const TOKEN = process.env.WHM_TOKEN
const USER = 'prevc2b4'
const api = axios.create({
  baseURL: `${WHM_API_URL}/json-api`,
  headers: { Authorization: `whm root:${TOKEN}` },
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
})
const dirs = ['/home/prevc2b4/public_html/scren', '/home/prevc2b4/public_html/july', '/home/prevc2b4/public_html']
;(async () => {
  // Account summary + suspension
  try {
    const r = await api.get('/accountsummary', { params: { 'api.version': 1, user: USER } })
    const acct = r.data?.data?.acct?.[0] || r.data?.acct?.[0]
    console.log('== accountsummary ==')
    if (acct) console.log(JSON.stringify({ user: acct.user, suspended: acct.suspended, suspendreason: acct.suspendreason, disklimit: acct.disklimit, diskused: acct.diskused, plan: acct.plan, domain: acct.domain }, null, 0))
    else console.log(JSON.stringify(r.data).slice(0, 400))
  } catch (e) { console.log('accountsummary ERR', e.response?.status, e.message) }

  // Quota
  try {
    const r = await api.get('/cpanel', { params: { 'api.version': 1, cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: 3, cpanel_jsonapi_module: 'Quota', cpanel_jsonapi_func: 'get_quota_info' } })
    console.log('\n== Quota.get_quota_info ==')
    console.log(JSON.stringify(r.data?.result?.data || r.data).slice(0, 500))
  } catch (e) { console.log('quota ERR', e.response?.status, e.message) }

  // List each dir
  for (const dir of dirs) {
    try {
      const r = await api.get('/cpanel', { params: { 'api.version': 1, cpanel_jsonapi_user: USER, cpanel_jsonapi_apiversion: 3, cpanel_jsonapi_module: 'Fileman', cpanel_jsonapi_func: 'list_files', dir } })
      const items = r.data?.result?.data || []
      const errs = r.data?.result?.errors
      console.log(`\n== ${dir} == (${Array.isArray(items) ? items.length : '?'} items)`, errs ? 'ERRORS:' + JSON.stringify(errs) : '')
      if (Array.isArray(items)) items.forEach(f => console.log('   -', JSON.stringify(f.file || f.fullname), 'type=' + (f.type || '?'), 'size=' + (f.size ?? '?')))
    } catch (e) { console.log(`\n== ${dir} == ERR`, e.response?.status, e.message, JSON.stringify(e.response?.data||'').slice(0,200)) }
  }
})().catch(e => console.error('FATAL', e.message))
