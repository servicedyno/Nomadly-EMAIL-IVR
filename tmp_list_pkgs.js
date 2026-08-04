// List available WHM packages
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const https = require('https')

const WHM_HOST = process.env.WHM_HOST
const WHM_TOKEN = process.env.WHM_TOKEN
const WHM_API_URL = (process.env.WHM_API_URL || '').replace(/\/+$/, '')
const WHM_BASE = WHM_API_URL ? `${WHM_API_URL}/json-api` : `https://${WHM_HOST}:2087/json-api`

const whmApi = axios.create({
  baseURL: WHM_BASE,
  headers: {
    Authorization: `whm root:${WHM_TOKEN}`,
    ...(process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET ? {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
    } : {}),
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 30000,
})

async function main() {
  console.log('--- /version ---')
  try {
    const r = await whmApi.get('/version', { params: { 'api.version': 1 } })
    console.log(JSON.stringify(r.data, null, 2).slice(0, 800))
  } catch (e) { console.log('err:', e.response?.data || e.message) }

  console.log('\n--- /loadavg ---')
  try {
    const r = await whmApi.get('/loadavg', { params: { 'api.version': 1 } })
    console.log(JSON.stringify(r.data, null, 2).slice(0, 500))
  } catch (e) { console.log('err:', e.response?.data || e.message) }

  console.log('\n--- /listaccts (list first 3 accounts) ---')
  try {
    const r = await whmApi.get('/listaccts', { params: { 'api.version': 1, want: 'user,domain,plan' } })
    const accts = r.data?.data?.acct || []
    console.log('total accounts:', accts.length)
    console.log('sample plans:', [...new Set(accts.slice(0, 20).map(a => a.plan))])
    console.log('first acct:', JSON.stringify(accts[0], null, 2))
  } catch (e) { console.log('err:', e.response?.data || e.message) }

  console.log('\n--- /listpkgs ---')
  try {
    const r = await whmApi.get('/listpkgs', { params: { 'api.version': 1 } })
    console.log(JSON.stringify(r.data, null, 2).slice(0, 3000))
  } catch (e) { console.log('err:', e.response?.data || e.message) }
}
main().catch(e => console.error(e.response?.data || e.message))
