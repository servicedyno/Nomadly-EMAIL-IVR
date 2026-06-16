/**
 * Push the new .au registrant credentials to Railway production for
 * the Nomadly-EMAIL-IVR service. Uses variableCollectionUpsert with
 * replace:false so no existing variables are touched.
 *
 * Variables pushed:
 *   AU_REGISTRANT_ABN       (11-digit ABN, no spaces)
 *   AU_REGISTRANT_ACN       (9-digit ACN, backup)
 *   AU_REGISTRANT_NAME      (legal entity name)
 *   AU_REGISTRANT_ID_TYPE   (ABN or ACN)
 *   AU_POLICY_REASON        (name_connected_firmly | name_matches_acronym)
 *   AU_ELIGIBILITY_TYPE     (Company / Sole Trader / Charity / …)
 *
 * Reads the actual values from /app/backend/.env so we never duplicate
 * secrets in source. Railway will auto-redeploy on env change.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN      = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'   // production
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'   // Nomadly-EMAIL-IVR
const GQL_URL    = 'https://backboard.railway.com/graphql/v2'

if (!TOKEN) {
  console.error('FATAL: API_KEY_RAILWAY not set in /app/backend/.env')
  process.exit(1)
}

const AU_VAR_NAMES = [
  'AU_REGISTRANT_ABN',
  'AU_REGISTRANT_ACN',
  'AU_REGISTRANT_NAME',
  'AU_REGISTRANT_ID_TYPE',
  'AU_POLICY_REASON',
  'AU_ELIGIBILITY_TYPE',
]
const variables = {}
for (const n of AU_VAR_NAMES) {
  const v = process.env[n]
  if (!v) {
    console.error(`FATAL: ${n} is missing from /app/backend/.env — refusing to push partial set`)
    process.exit(1)
  }
  variables[n] = v
}

const masked = (v) => (v.length <= 4 ? '****' : v.slice(0, 2) + '…' + v.slice(-2))
console.log('About to push these 6 vars to Railway production (Nomadly-EMAIL-IVR):')
for (const [k, v] of Object.entries(variables)) {
  // Don't mask the policy / type fields — they are not secrets
  const display = ['AU_REGISTRANT_ABN', 'AU_REGISTRANT_ACN'].includes(k) ? masked(v) : v
  console.log(`  ${k}=${display}`)
}

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q, v = {}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 600))
  return r.data?.data
}

;(async () => {
  const mutation = `mutation Upsert($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`
  const input = {
    projectId:     PROJECT_ID,
    environmentId: ENV_ID,
    serviceId:     SVC_ID,
    variables,
    replace:       false,   // merge with existing — do NOT wipe other vars
  }
  console.log('\nPushing variableCollectionUpsert ...')
  const r = await gql(mutation, { input })
  console.log('Result:', JSON.stringify(r))

  // Verify by reading back
  console.log('\nVerifying via getVariables query ...')
  const verifyQ = `query($projectId:String!, $environmentId:String!, $serviceId:String!) {
    variables(projectId:$projectId, environmentId:$environmentId, serviceId:$serviceId)
  }`
  try {
    const v = await gql(verifyQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
    const present = AU_VAR_NAMES.filter(n => v?.variables?.[n] !== undefined)
    console.log(`Confirmed ${present.length}/${AU_VAR_NAMES.length} AU_* vars now exist on Railway:`)
    for (const n of present) {
      const live = v.variables[n]
      const display = ['AU_REGISTRANT_ABN', 'AU_REGISTRANT_ACN'].includes(n) ? masked(live) : live
      console.log(`  ${n}=${display}`)
    }
    if (present.length !== AU_VAR_NAMES.length) {
      console.error('\nFATAL: some vars did not stick. Missing: ' + AU_VAR_NAMES.filter(n => !present.includes(n)).join(', '))
      process.exit(2)
    }
  } catch (e) {
    console.log('(Verification query failed — Railway may still have applied the change. Error: ' + e.message.substring(0, 200) + ')')
  }

  console.log('\nDone. Railway typically auto-redeploys within 1–2 minutes.')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
