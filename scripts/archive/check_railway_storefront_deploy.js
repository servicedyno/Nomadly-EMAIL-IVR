#!/usr/bin/env node
/**
 * check_railway_storefront_deploy.js
 *
 * READ-ONLY. Queries Railway GraphQL using the project token (API_KEY_RAILWAY)
 * for the Nomadly-EMAIL-IVR service to diagnose why panel.1.hostbay.io is
 * still serving the OLD site instead of the new Web Storefront.
 *
 * Outputs:
 *   - /app/memory/railway_storefront_diag.json (structured)
 *   - /app/memory/railway_storefront_build_logs.txt
 *   - /app/memory/railway_storefront_runtime_logs.txt
 */
require('dotenv').config({ path: '/app/backend/.env' })
const axios = require('axios')
const fs = require('fs')

const TOKEN = process.env.API_KEY_RAILWAY
if (!TOKEN) { console.error('FATAL: API_KEY_RAILWAY missing'); process.exit(1) }

const PROJECT_ID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe'   // "New Hosting"
const ENV_ID     = '889fd56a-720a-4020-884c-034784992666'   // production
const SVC_ID     = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885'   // Nomadly-EMAIL-IVR

const headers = { 'Project-Access-Token': TOKEN, 'Content-Type': 'application/json' }
const GQL_URL = 'https://backboard.railway.com/graphql/v2'

async function gql(q, v = {}) {
  try {
    const r = await axios.post(GQL_URL, { query: q, variables: v }, { headers, timeout: 30000 })
    if (r.data?.errors) {
      console.error('GQL errors:', JSON.stringify(r.data.errors).slice(0, 600))
      return { data: r.data?.data || null, errors: r.data.errors }
    }
    return { data: r.data?.data }
  } catch (e) {
    console.error('axios err:', e.message)
    return { error: e.message }
  }
}

async function main() {
  const out = { queriedAt: new Date().toISOString(), service: 'Nomadly-EMAIL-IVR' }

  // 1. List last 10 deployments
  const depsQ = `query Deps($projectId: String!, $environmentId: String!, $serviceId: String!) {
    deployments(input:{projectId:$projectId, environmentId:$environmentId, serviceId:$serviceId}, first: 10) {
      edges { node { id status createdAt updatedAt staticUrl url meta canRollback } }
    }
  }`
  const deps = await gql(depsQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const depEdges = deps.data?.deployments?.edges || []
  out.deployments = depEdges.map(e => e.node)
  console.log('\n=== Last 10 deployments ===')
  for (const d of out.deployments) {
    const age = Math.round((Date.now() - new Date(d.createdAt).getTime()) / 60000)
    const sha = d.meta?.commitHash || d.meta?.commitSha || d.meta?.commitMessage || ''
    console.log(`  ${d.status.padEnd(12)} ${d.createdAt}  (${age}m ago)  ${(d.id||'').slice(0,8)}  ${String(sha).slice(0,80)}`)
  }
  if (!out.deployments.length) {
    console.log('  (none found)')
  }

  const latest = out.deployments[0]
  if (latest) {
    console.log('\n=== Latest deployment full meta ===')
    console.log(JSON.stringify(latest.meta, null, 2))
  }

  // Find latest SUCCESS deployment
  const lastSuccess = out.deployments.find(d => d.status === 'SUCCESS')
  out.latestSuccess = lastSuccess
  if (lastSuccess) {
    console.log('\n=== Latest SUCCESS deployment ===')
    console.log('  id:', lastSuccess.id)
    console.log('  createdAt:', lastSuccess.createdAt)
    console.log('  meta:', JSON.stringify(lastSuccess.meta, null, 2))
  }

  // 2. Build & runtime logs for latest deployment
  if (latest) {
    const blQ = `query BL($deploymentId: String!) {
      buildLogs(deploymentId: $deploymentId, limit: 5000) { timestamp message severity }
    }`
    const bl = await gql(blQ, { deploymentId: latest.id })
    const blLines = bl.data?.buildLogs || []
    out.buildLogsCount = blLines.length
    const blTxt = blLines.map(l => `[${l.timestamp}] ${l.severity || ''} ${l.message}`).join('\n')
    fs.writeFileSync('/app/memory/railway_storefront_build_logs.txt', blTxt)
    console.log(`\n=== Build logs (${blLines.length} lines, saved) — tail 60 ===`)
    for (const l of blLines.slice(-60)) console.log('  ', (l.message || '').slice(0, 250))

    const dlQ = `query DL($deploymentId: String!) {
      deploymentLogs(deploymentId: $deploymentId, limit: 800) { timestamp message severity }
    }`
    const dl = await gql(dlQ, { deploymentId: latest.id })
    const dlLines = dl.data?.deploymentLogs || []
    out.deployLogsCount = dlLines.length
    fs.writeFileSync('/app/memory/railway_storefront_runtime_logs.txt',
      dlLines.map(l => `[${l.timestamp}] ${l.severity || ''} ${l.message}`).join('\n'))
    console.log(`\n=== Runtime logs (${dlLines.length} lines, saved) — tail 30 ===`)
    for (const l of dlLines.slice(-30)) console.log('  ', (l.message || '').slice(0, 250))
  }

  // 3. Variables — PANEL_DOMAIN + build-related
  const varsQ = `query Vars($projectId: String!, $environmentId: String!, $serviceId: String!) {
    variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
  }`
  const vr = await gql(varsQ, { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID })
  const allVars = vr.data?.variables || {}
  out.variableKeyCount = Object.keys(allVars).length
  const interesting = [
    'PANEL_DOMAIN','BOT_ENVIRONMENT','NODE_ENV','PORT','SKIP_WEBHOOK_SYNC',
    'NIXPACKS_BUILD_CMD','NIXPACKS_START_CMD','NIXPACKS_NODE_VERSION','NIXPACKS_INSTALL_CMD',
    'RAILWAY_DOCKERFILE_PATH','RAILWAY_NIXPACKS_DIR','RAILWAY_RUN_BUILD_COMMAND','RAILWAY_BUILD_COMMAND',
    'SELF_URL','SELF_URL_PROD','REACT_APP_BACKEND_URL','CI','YARN_PRODUCTION','SKIP_FRONTEND_BUILD',
    'BUILDPACK','RAILPACK_BUILDER',
  ]
  out.variables = {}
  console.log(`\n=== Selected vars (of ${out.variableKeyCount} total) ===`)
  for (const k of interesting) {
    if (allVars[k] !== undefined) {
      out.variables[k] = allVars[k]
      console.log(`  ${k.padEnd(28)} = ${String(allVars[k]).slice(0, 120)}`)
    } else {
      console.log(`  ${k.padEnd(28)} = <not set>`)
    }
  }

  // 4. Service info (root dir / start command / source)
  const svcQ = `query Svc($id: String!) {
    service(id: $id) {
      id name
      serviceInstances(first: 5) { edges { node {
        environmentId startCommand buildCommand rootDirectory watchPatterns
        railwayConfigFile source { repo branch image }
      } } }
    }
  }`
  const sv = await gql(svcQ, { id: SVC_ID })
  const instances = (sv.data?.service?.serviceInstances?.edges || []).map(e => e.node)
  out.serviceInstances = instances
  console.log('\n=== Service instances ===')
  for (const i of instances) {
    console.log(JSON.stringify(i, null, 2))
  }

  fs.writeFileSync('/app/memory/railway_storefront_diag.json', JSON.stringify(out, null, 2))
  console.log('\nSaved -> /app/memory/railway_storefront_diag.json')
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
