/**
 * Push OVH / VPS-provider env vars to Railway production (Nomadly-EMAIL-IVR).
 *
 * Vars pushed:
 *   OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY
 *   OVH_ENDPOINT, OVH_SUBSIDIARY, OVH_DEFAULT_DATACENTER
 *   VPS_DEFAULT_PROVIDER = "ovh"
 *   VPS_CONTABO_FALLBACK_ENABLED = "false"
 *
 * Intentionally NOT pushed:
 *   OVH_DRY_RUN  → dev-only safety flag; production must make real orders.
 *
 * Uses GraphQL variableCollectionUpsert (merge mode) so the rest of the
 * env stays untouched. After push, triggers a redeploy.
 *
 * Run: node /app/scripts/push_ovh_to_railway.js [--dry]
 *   --dry  prints the upsert payload but skips the actual mutation.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885' // Nomadly-EMAIL-IVR
const DRY_RUN    = process.argv.includes('--dry')

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

async function gql(q, v = {}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 600))
  return r.data?.data
}

// Pull authoritative values straight from /app/backend/.env so we never
// hard-code drifting copies. The local .env is the source of truth.
const VARS_TO_PUSH = {
  OVH_APP_KEY:                process.env.OVH_APP_KEY,
  OVH_APP_SECRET:             process.env.OVH_APP_SECRET,
  OVH_CONSUMER_KEY:           process.env.OVH_CONSUMER_KEY,
  OVH_ENDPOINT:               process.env.OVH_ENDPOINT,
  OVH_SUBSIDIARY:             process.env.OVH_SUBSIDIARY,
  OVH_DEFAULT_DATACENTER:     process.env.OVH_DEFAULT_DATACENTER,
  VPS_DEFAULT_PROVIDER:       process.env.VPS_DEFAULT_PROVIDER,
  VPS_CONTABO_FALLBACK_ENABLED: process.env.VPS_CONTABO_FALLBACK_ENABLED,
}

;(async () => {
  console.log('━━━ Variables to push to Railway (Nomadly-EMAIL-IVR):\n')
  for (const [k, v] of Object.entries(VARS_TO_PUSH)) {
    if (!v) {
      console.error(`  ✗ ${k} is missing from local .env — aborting push`)
      process.exit(1)
    }
    const masked = v.length > 12 ? v.substring(0, 6) + '…' + v.substring(v.length - 4) : v
    console.log(`  ${k.padEnd(32)} = ${masked}`)
  }
  console.log('\n  Excluded:  OVH_DRY_RUN (dev-only — never pushed to prod)\n')

  if (DRY_RUN) {
    console.log('[DRY] --dry flag set, skipping mutation. Re-run without --dry to push.')
    process.exit(0)
  }

  // 1. Upsert all 8 vars in one atomic call
  const mutation = `mutation Upsert($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`
  const input = {
    projectId:     PROJECT_ID,
    environmentId: ENV_ID,
    serviceId:     SVC_ID,
    variables:     VARS_TO_PUSH,
    replace:       false,  // merge, don't replace
  }
  console.log('Pushing 8 OVH/VPS vars to Railway ...')
  const r = await gql(mutation, { input })
  console.log('Push OK:', JSON.stringify(r))

  // 2. Verify by re-reading
  console.log('\n━━━ Verifying push (re-read from Railway):\n')
  const q = `query Vars($projectId: String!, $environmentId: String!, $serviceId: String) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`
  const all = (await gql(q, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })).variables || {}
  let allOk = true
  for (const k of Object.keys(VARS_TO_PUSH)) {
    const ok = all[k] === VARS_TO_PUSH[k]
    console.log(`  ${ok ? '✓' : '✗'} ${k.padEnd(32)} ${ok ? 'matches' : `MISMATCH (got "${all[k]}")`}`)
    if (!ok) allOk = false
  }
  if (!allOk) {
    console.error('\nFATAL: Verification failed — some vars did not persist.')
    process.exit(1)
  }
  console.log('\n✓ All 8 vars verified on Railway production.')

  // 3. Trigger redeploy so the running container picks up the new env
  console.log('\n━━━ Triggering Railway redeploy ...')
  const redeployMut = `mutation Redeploy($serviceId: String!, $environmentId: String!) {
    serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
  }`
  try {
    const rr = await gql(redeployMut, { serviceId: SVC_ID, environmentId: ENV_ID })
    console.log('Redeploy queued:', JSON.stringify(rr))
  } catch (e) {
    console.log('Redeploy trigger note (Railway often auto-redeploys on env change):', e.message.substring(0, 200))
  }
  console.log('\n✅ Done. Production now has OVH credentials + VPS_DEFAULT_PROVIDER=ovh.')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
