/**
 * Pull recent Railway logs filtered by complaint/AI/anti-red signals
 * for the last 24h, plus the full thread for a specific chatId.
 */
require('dotenv').config({ path: '/app/.env' });
const https = require('https');
const fs = require('fs');

const TOKEN = process.env.RAILWAY_PROJECT_TOKEN || process.env.API_KEY_RAILWAY;
const EID = process.env.RAILWAY_ENVIRONMENT_ID;
const SID = process.env.RAILWAY_SERVICE_ID;
const FOCUS_CHATID = process.argv[2] || '1960615421';
const LOOKBACK_HOURS = Number(process.argv[3]) || 24;

function gql(query, vars = {}) {
  const data = JSON.stringify({ query, variables: vars });
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'backboard.railway.app',
      path: '/graphql/v2',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': TOKEN },
    }, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => { try { res(JSON.parse(b)); } catch { res({ raw: b }); } });
    });
    req.on('error', rej);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Get the active deployment
  const depRes = await gql(`query D($e: String!, $s: String!) {
    deployments(input: { environmentId: $e, serviceId: $s }, first: 3) {
      edges { node { id status createdAt } }
    }
  }`, { e: EID, s: SID });
  const deps = depRes?.data?.deployments?.edges || [];
  const active = deps.find((d) => ['SUCCESS', 'RUNNING'].includes(d.node.status)) || deps[0];
  const depId = active.node.id;
  console.log(`Deployment: ${depId} (${active.node.status}, created ${active.node.createdAt})`);

  const filters = [
    // complaint/refund/billing
    '[Support]',
    'support session',
    'admin->user',
    'admin → user',
    '-> admin:',
    'refund',
    'complaint',
    'angry',
    'not working',
    'broken',
    // anti-red specific
    'showing red',
    'red',
    'blocked',
    'flagged',
    'Anti-Red',
    'AntiRed',
    'antired',
    'cloudflare',
    'CF zone',
    'protection',
    'cloak',
    'challenge',
    // WHM / cPanel post-migration
    'WHM',
    'cPanel',
    'origin IP',
    'origin leak',
    'whitelist',
    'hostbay',
    // focused user
    FOCUS_CHATID,
    'HHR2009',
    'hhr2009',
  ];

  const allLogs = [];
  for (const f of filters) {
    const r = await gql(
      `query L($d: String!, $f: String, $l: Int) { deploymentLogs(deploymentId: $d, filter: $f, limit: $l) { timestamp message severity } }`,
      { d: depId, f, l: 1500 }
    );
    const logs = r?.data?.deploymentLogs || [];
    console.log(`  filter="${f}" → ${logs.length}`);
    allLogs.push(...logs);
  }

  // Dedupe + filter to last 24h
  const cutoff = Date.now() - LOOKBACK_HOURS * 3600 * 1000;
  const seen = new Set();
  const dedup = [];
  for (const l of allLogs) {
    const k = `${l.timestamp}|${l.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (new Date(l.timestamp).getTime() < cutoff) continue;
    dedup.push(l);
  }
  dedup.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  fs.writeFileSync('/app/memory/complaints_24h.json', JSON.stringify(dedup, null, 2));
  console.log(`\nDeduped 24h lines: ${dedup.length} (saved to /app/memory/complaints_24h.json)`);

  // Classify
  const support = dedup.filter((l) => /\[Support\]|support session|-> admin:|admin -> user|AI -> /.test(l.message));
  const antired = dedup.filter((l) => /Anti-Red|AntiRed|antired|showing red|cloudflare|CF|cloak|challenge|protect/i.test(l.message));
  const focusUser = dedup.filter((l) => l.message.includes(FOCUS_CHATID) || /hhr2009/i.test(l.message));
  const whmIssues = dedup.filter((l) => /WHM|cPanel|hostbay|whitelist|origin/i.test(l.message));

  console.log(`\n=== SUPPORT THREADS (${support.length} lines) ===`);
  support.forEach((l) => console.log(`[${l.timestamp}] ${l.message.slice(0, 350)}`));

  console.log(`\n\n=== FOCUS USER ${FOCUS_CHATID} (${focusUser.length} lines) ===`);
  focusUser.forEach((l) => console.log(`[${l.timestamp}] ${l.message.slice(0, 500)}`));

  console.log(`\n\n=== ANTI-RED related (${antired.length} lines, last 40) ===`);
  antired.slice(-40).forEach((l) => console.log(`[${l.timestamp}] [${l.severity || 'info'}] ${l.message.slice(0, 400)}`));

  console.log(`\n\n=== WHM/cPanel/hostbay (${whmIssues.length} lines, last 30) ===`);
  whmIssues.slice(-30).forEach((l) => console.log(`[${l.timestamp}] [${l.severity || 'info'}] ${l.message.slice(0, 400)}`));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
