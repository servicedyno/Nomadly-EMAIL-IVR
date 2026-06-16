/**
 * Push the CORRECTED .au registrant credentials to Railway production.
 * Changes from previous push:
 *   - AU_REGISTRANT_ID_TYPE: ABN → ACN  (OP registry blocks ABN for Company type)
 *   - NEW: AU_ELIGIBILITY_RELATIONSHIP = "2" (closely & substantially connected)
 *   - (AU_POLICY_REASON is now unused but we leave it in place — harmless)
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN      = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'
const GQL_URL    = 'https://backboard.railway.com/graphql/v2'

const variables = {
  AU_REGISTRANT_ID_TYPE:        process.env.AU_REGISTRANT_ID_TYPE        || 'ACN',
  AU_ELIGIBILITY_RELATIONSHIP:  process.env.AU_ELIGIBILITY_RELATIONSHIP  || '2',
  AU_ELIGIBILITY_TYPE:          process.env.AU_ELIGIBILITY_TYPE          || 'Company',
}

console.log('Pushing corrected AU vars to Railway production:')
for (const [k, v] of Object.entries(variables)) console.log(`  ${k}=${v}`)

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
  const input = { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID, variables, replace: false }
  const r = await gql(mutation, { input })
  console.log('\nResult:', JSON.stringify(r))

  // Verify
  const verifyQ = `query($projectId:String!,$environmentId:String!,$serviceId:String!){
    variables(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId)
  }`
  const v = await gql(verifyQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  console.log('\nReadback on Railway:')
  for (const k of Object.keys(variables)) console.log(`  ${k}=${v.variables[k]}`)
  console.log('\nRailway will auto-redeploy with the new env vars within ~1–2 min.')
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
