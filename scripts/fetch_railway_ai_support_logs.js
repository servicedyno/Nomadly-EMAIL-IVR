/**
 * Fetch recent Railway logs and grep for AI-support related issues.
 * Usage: node /app/scripts/fetch_railway_ai_support_logs.js [lookback_hours]
 */

require('dotenv').config({ path: '/app/.env' });
const https = require('https');
const fs = require('fs');

const PROJECT_TOKEN = process.env.RAILWAY_PROJECT_TOKEN;
const ACCOUNT_TOKEN = process.env.API_KEY_RAILWAY;
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID;
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const LOOKBACK_HOURS = Number(process.argv[2]) || 12;

function gql(query, variables = {}, useProjectToken = false) {
  const data = JSON.stringify({ query, variables });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  };
  if (useProjectToken && PROJECT_TOKEN) headers['Project-Access-Token'] = PROJECT_TOKEN;
  else if (ACCOUNT_TOKEN) headers.Authorization = `Bearer ${ACCOUNT_TOKEN}`;
  const opts = { hostname: 'backboard.railway.app', path: '/graphql/v2', method: 'POST', headers };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function main() {
  // Find latest active deployment id
  const deployQuery = `query Deps($envId: String!, $serviceId: String!) {
    deployments(input: { environmentId: $envId, serviceId: $serviceId }, first: 5) {
      edges { node { id status createdAt staticUrl } }
    }
  }`;
  let dr = await gql(deployQuery, { envId: ENV_ID, serviceId: SERVICE_ID }, true);
  if (dr.body && dr.body.errors) dr = await gql(deployQuery, { envId: ENV_ID, serviceId: SERVICE_ID }, false);
  const deps = dr.body?.data?.deployments?.edges || [];
  const active = deps.find(e => ['SUCCESS', 'RUNNING'].includes(e.node.status)) || deps[0];
  if (!active) { console.error('No deployments found'); process.exit(1); }
  const depId = active.node.id;
  console.log(`Using deployment: ${depId} (${active.node.status})`);

  const startDate = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const endDate = new Date().toISOString();

  // Pull a large batch and filter client-side. Railway log API supports a
  // simple text filter; use server-side filter on multiple terms.
  const filters = [
    'AI Support',
    'AI failed',
    '[AI]',
    'AISupport',
    'AI support',
    'aiSupport',
    'support session',
    'getAiResponse',
    'OpenAI',
    'AI error',
  ];

  const logQuery = `query Logs($depId: String!, $filter: String, $limit: Int) {
    deploymentLogs(deploymentId: $depId, filter: $filter, limit: $limit) {
      timestamp message severity
    }
  }`;

  const allLogs = [];
  // Server-side filter for each AI term (limit 1500 each, deduped after)
  for (const f of filters) {
    let r = await gql(logQuery, { depId, filter: f, limit: 1500 }, true);
    if (r.body?.errors) r = await gql(logQuery, { depId, filter: f, limit: 1500 }, false);
    const logs = r.body?.data?.deploymentLogs || [];
    console.log(`  filter="${f}" → ${logs.length} lines`);
    allLogs.push(...logs);
  }

  // Dedupe by timestamp+message
  const seen = new Set();
  const dedup = [];
  for (const l of allLogs) {
    const k = `${l.timestamp}|${l.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(l);
  }
  dedup.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  console.log(`\nTotal unique lines: ${dedup.length}`);
  fs.writeFileSync('/app/memory/ai_support_logs.json', JSON.stringify(dedup, null, 2));
  console.log('Saved → /app/memory/ai_support_logs.json');

  // Print a short tail
  console.log('\n--- Last 50 lines ---');
  for (const l of dedup.slice(-50)) {
    console.log(`[${l.timestamp}] [${l.severity || 'info'}] ${l.message.slice(0, 300)}`);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
