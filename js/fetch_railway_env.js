#!/usr/bin/env node
/**
 * fetch_railway_env.js
 *
 * Fetches production environment variables from Railway via GraphQL using
 * the project token. Prints (or writes) the variables for the service so we
 * can grab the real production MONGO_URL.
 *
 * READ-ONLY — does not modify anything on Railway.
 */

require('dotenv').config({ path: '/app/.env' })
const https = require('https')
const fs = require('fs')

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID

function gql(query, variables = {}, useProjectToken = false) {
  const data = JSON.stringify({ query, variables })
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  }
  if (useProjectToken && PROJECT_TOKEN) {
    headers['Project-Access-Token'] = PROJECT_TOKEN
  } else if (ACCOUNT_TOKEN) {
    headers.Authorization = `Bearer ${ACCOUNT_TOKEN}`
  }
  const opts = {
    hostname: 'backboard.railway.app',
    path: '/graphql/v2',
    method: 'POST',
    headers,
  }
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        } catch (e) {
          resolve({ status: res.statusCode, body })
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  console.log('Railway env fetch — using token:', PROJECT_TOKEN ? 'PROJECT_TOKEN' : 'ACCOUNT_TOKEN')
  console.log('Project:', PROJECT_ID, '| Env:', ENV_ID, '| Service:', SERVICE_ID)

  // First, list project services & environments to confirm IDs work.
  const projQuery = `query Proj($id: String!) {
    project(id: $id) {
      id
      name
      services { edges { node { id name } } }
      environments { edges { node { id name } } }
    }
  }`

  let pr = await gql(projQuery, { id: PROJECT_ID }, true)
  if (pr.body && pr.body.errors) {
    console.log('Project token failed, trying account token. Error:', JSON.stringify(pr.body.errors).slice(0, 300))
    pr = await gql(projQuery, { id: PROJECT_ID }, false)
  }
  console.log('Project query status:', pr.status)
  console.log(JSON.stringify(pr.body, null, 2).slice(0, 2000))

  // Get variables for the configured service+env
  const varsQuery = `query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`
  let vr = await gql(varsQuery, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID }, true)
  if (vr.body && vr.body.errors) {
    console.log('vars(projectToken) error, trying account token...')
    vr = await gql(varsQuery, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID }, false)
  }
  console.log('Vars query status:', vr.status)
  if (vr.body && vr.body.data && vr.body.data.variables) {
    const vars = vr.body.data.variables
    const keys = Object.keys(vars)
    console.log(`Got ${keys.length} variable keys.`)
    fs.writeFileSync('/app/memory/railway_prod_env.json', JSON.stringify(vars, null, 2))
    console.log('Saved -> /app/memory/railway_prod_env.json')
    // Print interesting keys (mask secrets)
    const interesting = ['MONGO_URL', 'DB_NAME', 'CONTABO_CLIENT_ID', 'BOT_ENVIRONMENT', 'HOSTED_ON', 'NODE_ENV']
    for (const k of interesting) {
      if (vars[k]) {
        const v = vars[k]
        const masked = v.length > 50 ? v.slice(0, 30) + '…[' + (v.length - 35) + ' chars]…' + v.slice(-5) : v
        console.log(`  ${k} = ${masked}`)
      }
    }
  } else {
    console.log('vars body:', JSON.stringify(vr.body).slice(0, 2000))
  }
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
