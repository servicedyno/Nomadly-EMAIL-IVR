// Was admin alert "cPanel account needs repair (EPERM)" sent?
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
  const filters = [
    'account needs repair',
    'fixquotas',
    'fixhomedirperms',
    'CPANEL_UAPI_EPERM',
    'EPERM admin alert',
    'panel/files',
    'blocked by',
  ];

  for (const f of filters) {
    const q = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 100, filter: "${f}") { message timestamp } }`;
    const r = await gql(q);
    const logs = r.data?.deploymentLogs || [];
    if (logs.length) {
      console.log(`\n=== "${f}" (${logs.length} lines) ===`);
      logs.slice(0, 20).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,300)}`));
    } else {
      console.log(`\n=== "${f}" — no hits`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
