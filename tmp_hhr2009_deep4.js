// Deep dive: what happened around 11:33 UTC on 2026-08-04 (File Manager opened)
require('dotenv').config({ path: '/app/backend/.env' });

const API_KEY = process.env.API_KEY_RAILWAY;
const DEPLOY_ID = '63c777a5-d81d-4aeb-9083-e956130146e4';

async function gql(query) {
  const r = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': API_KEY },
    body: JSON.stringify({ query })
  });
  return r.json();
}

async function main() {
  // Search anchors that pinpoint HHR2009's flow between Aug 4 11:00 and 18:20
  // Filter can also work with domain names, hostbay.io, or "Open File" phrases
  const filters = [
    'hostbay',
    'panel.1.hostbay',
    'HostPanel Login',
    'cPanel Login',
    'papea895 -',
    'papedb86 -',
    'Manage Hosting',
    'Renew Now',
    'cannot edit',
    'permission denied',
    'EPERM',
    'not allowed',
    'suspended',
    'expired',
    'Enable Anti',
    'Disable Anti',
  ];

  for (const f of filters) {
    const q = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 60, filter: "${f}") { message timestamp } }`;
    const r = await gql(q);
    const logs = r.data?.deploymentLogs || [];
    if (logs.length) {
      console.log(`\n=== "${f}" (${logs.length} lines) ===`);
      logs.slice(0, 20).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,250)}`));
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
