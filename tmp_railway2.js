require('dotenv').config({ path: '/app/backend/.env' })
const https = require('https')
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = '4f01d2a9-13fb-4321-b6d8-c1f4d5fc7e60'
const ENV_ID = 'b9c87cda-ad3a-4d8e-add5-2a83bc4af3ad'
const SVC = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885' // Nomadly-EMAIL-IVR

function gql(query, variables={}, useProjectHeader=false){
  const data = JSON.stringify({ query, variables })
  const headers = { 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(data) }
  if (useProjectHeader) headers['Project-Access-Token'] = ACCOUNT_TOKEN
  else headers.Authorization = 'Bearer ' + ACCOUNT_TOKEN
  const opts = { hostname:'backboard.railway.app', path:'/graphql/v2', method:'POST', headers }
  return new Promise((res,rej)=>{ const r=https.request(opts,x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>{try{res(JSON.parse(b))}catch{res({raw:b})}})}); r.on('error',rej); r.write(data); r.end() })
}

const Q = `query($p:String!,$e:String!,$s:String!){ deployments(input:{projectId:$p,environmentId:$e,serviceId:$s}, first:5){ edges{ node{ id status createdAt } } } }`
const Q_PROJ = `query($id:String!){ project(id:$id){ id name environments{edges{node{id name}}} services{edges{node{id name}}} } }`

;(async()=>{
  for (const useProj of [false, true]){
    console.log('\n===== auth mode:', useProj?'Project-Access-Token':'Bearer', '=====')
    const pr = await gql(Q_PROJ, { id: PROJECT_ID }, useProj)
    console.log('project query:', JSON.stringify(pr).slice(0,600))
    const dr = await gql(Q, { p:PROJECT_ID, e:ENV_ID, s:SVC }, useProj)
    console.log('deployments query:', JSON.stringify(dr).slice(0,600))
  }
})().catch(e=>console.log('FATAL', e.message))
