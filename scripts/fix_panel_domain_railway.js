/**
 * fix_panel_domain_railway.js
 *
 * Updates PANEL_DOMAIN on Railway production (Nomadly-EMAIL-IVR) by
 * removing the trailing slash so the Express request-host equality check
 * in js/_index.js earlyApp.get('/') resolves correctly and the new
 * Web Storefront React SPA is served on https://panel.1.hostbay.io/
 * instead of the legacy URL-Shortener landing.
 *
 * READ-MODIFY-VERIFY:
 *   1. GET current PANEL_DOMAIN
 *   2. If trailing slash / path → strip → upsert (merge, replace:false)
 *   3. Read back to confirm
 *
 * Triggers a Railway redeploy automatically on env change.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN      = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'
const GQL_URL    = 'https://backboard.railway.com/graphql/v2'

if (!TOKEN) {
  console.error('FATAL: API_KEY_RAILWAY missing in /app/backend/.env')
  process.exit(1)
}

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q, v = {}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 600))
  return r.data?.data
}

function normalize(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
}

;(async () => {
  // 1. Read current value
  const varsQ = `query($projectId:String!,$environmentId:String!,$serviceId:String!){
    variables(projectId:$projectId, environmentId:$environmentId, serviceId:$serviceId)
  }`
  const before = await gql(varsQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const current = before?.variables?.PANEL_DOMAIN || ''
  const cleaned = normalize(current)
  console.log(`Current PANEL_DOMAIN on Railway:  "${current}"`)
  console.log(`Normalized value:                 "${cleaned}"`)

  if (!cleaned) {
    console.error('FATAL: PANEL_DOMAIN is unset on Railway. Aborting.')
    process.exit(2)
  }
  if (current === cleaned) {
    console.log('✅ Already clean — no action needed.')
    return
  }

  // 2. Upsert
  const mutation = `mutation Upsert($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`
  const input = {
    projectId: PROJECT_ID,
    environmentId: ENV_ID,
    serviceId: SVC_ID,
    variables: { PANEL_DOMAIN: cleaned },
    replace: false,
  }
  console.log(`\nUpserting PANEL_DOMAIN -> "${cleaned}" (merge, replace:false)`)
  const upsert = await gql(mutation, { input })
  console.log('Upsert result:', JSON.stringify(upsert))

  // 3. Verify
  const after = await gql(varsQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const post = after?.variables?.PANEL_DOMAIN || ''
  console.log(`\nPost-update PANEL_DOMAIN on Railway: "${post}"`)
  if (post === cleaned) console.log('✅ Verified — Railway will auto-redeploy.')
  else { console.error('❌ Verification mismatch'); process.exit(3) }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
