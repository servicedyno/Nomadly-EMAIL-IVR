/**
 * Update Railway env vars for Nomadly-EMAIL-IVR service:
 *   - CONTABO_CLIENT_SECRET = jtwgLkHt11SB6u3KpFVEJPJLcDpIR5ix
 *   - CONTABO_API_PASSWORD  = Godisgood123@
 *
 * Triggers an automatic redeploy.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885' // Nomadly-EMAIL-IVR

const NEW_CLIENT_SECRET = 'jtwgLkHt11SB6u3KpFVEJPJLcDpIR5ix'
const NEW_PASSWORD      = 'Godisgood123@'

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

async function gql(q, v={}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 600))
  return r.data?.data
}

;(async () => {
  // Use variableCollectionUpsert to update both vars in one call (atomic-ish)
  const mutation = `mutation Upsert($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`
  const input = {
    projectId:     PROJECT_ID,
    environmentId: ENV_ID,
    serviceId:     SVC_ID,
    variables: {
      CONTABO_CLIENT_SECRET: NEW_CLIENT_SECRET,
      CONTABO_API_PASSWORD:  NEW_PASSWORD,
    },
    replace: false,  // merge with existing, don't replace entire set
  }
  console.log(`Updating CONTABO_CLIENT_SECRET + CONTABO_API_PASSWORD on Nomadly-EMAIL-IVR ...`)
  const r = await gql(mutation, { input })
  console.log('Result:', JSON.stringify(r, null, 2))

  // Now trigger a redeploy by deploying the latest service commit
  // serviceInstanceRedeploy needs serviceId + environmentId
  console.log('\nTriggering redeploy ...')
  const redeployMut = `mutation Redeploy($serviceId: String!, $environmentId: String!) {
    serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
  }`
  try {
    const rr = await gql(redeployMut, { serviceId: SVC_ID, environmentId: ENV_ID })
    console.log('Redeploy result:', JSON.stringify(rr, null, 2))
  } catch (e) {
    console.log('Redeploy err (Railway often auto-redeploys on env change):', e.message.substring(0, 300))
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
