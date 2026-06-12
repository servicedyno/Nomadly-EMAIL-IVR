require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const TOKEN = process.env.API_KEY_RAILWAY
const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }

async function gql(q,v){
  const r = await axios.post('https://backboard.railway.com/graphql/v2',{query:q,variables:v},{headers,timeout:60000})
  if (r.data?.errors) throw new Error(JSON.stringify(r.data.errors).substring(0,500))
  return r.data?.data
}

;(async () => {
  // Project-access tokens can list deployments for the bound project
  const Q = `query { projectToken { projectId environmentId } }`
  const me = await gql(Q)
  console.log('projectToken:', JSON.stringify(me))
  const { projectId, environmentId } = me.projectToken
  const Q2 = `query($p:String!,$e:String!){
    deployments(first:8, input:{projectId:$p, environmentId:$e}) {
      edges { node { id status createdAt serviceId staticUrl meta } }
    }
  }`
  const d = await gql(Q2, { p: projectId, e: environmentId })
  console.log(JSON.stringify(d?.deployments?.edges?.map(e=>e.node) || [], null, 2))
})().catch(e=>console.error('ERR',e.message))
