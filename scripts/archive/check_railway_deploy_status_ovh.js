/**
 * Check the latest Railway deploy status for Nomadly-EMAIL-IVR + tail logs.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')

const TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

async function gql(q, v = {}) {
  const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
  if (r.data?.errors) throw new Error('GQL: ' + JSON.stringify(r.data.errors).substring(0, 800))
  return r.data?.data
}

;(async () => {
  // Get the 3 most recent deployments for this service
  const q = `query Deploys($projectId: String!, $environmentId: String!, $serviceId: String!) {
    deployments(
      input: { projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId },
      first: 3
    ) {
      edges { node { id status createdAt staticUrl meta } }
    }
  }`
  const r = await gql(q, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const deploys = r.deployments?.edges || []
  console.log(`Latest ${deploys.length} deployments:`)
  for (const e of deploys) {
    const d = e.node
    const age = Math.round((Date.now() - new Date(d.createdAt).getTime()) / 1000)
    console.log(`  ${d.createdAt}  (${age}s ago)  status=${d.status}  id=${d.id.substring(0, 8)}`)
  }

  // Tail logs from the most recent SUCCESS deployment to see if OVH refs appear
  if (deploys.length) {
    const latest = deploys[0].node
    console.log(`\n━━━ Tailing logs of latest deploy (${latest.status}):`)
    const logsQ = `query Logs($deploymentId: String!) {
      deploymentLogs(deploymentId: $deploymentId, limit: 80)  { message timestamp severity }
    }`
    try {
      const lg = await gql(logsQ, { deploymentId: latest.id })
      const lines = lg.deploymentLogs || []
      for (const l of lines.slice(-50)) {
        console.log(`  [${l.severity || 'info'}] ${(l.message || '').substring(0, 220)}`)
      }
    } catch (e) {
      console.log('  log fetch err:', e.message.substring(0, 200))
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
