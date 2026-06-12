require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
async function gql(q,v={}) { const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:30000}); if(r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500)); return r.data?.data }

;(async () => {
  const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'
  const ENV_ID = '889fd56a-720a-4020-884c-034784992666'
  const SVC = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'  // Nomadly-EMAIL-IVR
  // Try variables query
  const v = await gql(`query($projectId: String!, $environmentId: String!, $serviceId: String!) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC }).catch(e => { console.log('vars err:', e.message); return null })
  if (v?.variables) {
    const vars = v.variables
    const keys = Object.keys(vars).filter(k => k.includes('CONTABO'))
    for (const k of keys) console.log(`  ${k}: ${k.includes('PASSWORD') || k.includes('SECRET') ? vars[k].substring(0,8)+'...' : vars[k]}`)
  } else {
    console.log('No variables returned')
  }
})()
