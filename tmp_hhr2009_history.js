// Query older Railway deployments for HHR2009 history
require('dotenv').config({ path: '/app/backend/.env' });

const API_KEY = process.env.API_KEY_RAILWAY;
const PID = 'c23ac3d9-51c5-4242-8776-eed4e3801abe';
const EID = '889fd56a-720a-4020-884c-034784992666';
const SID = 'b9c4ad64-7667-4dd3-8b9a-3867ede47885';

async function gql(query) {
  const r = await fetch('https://backboard.railway.app/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': API_KEY },
    body: JSON.stringify({ query })
  });
  return r.json();
}

async function main() {
  // Fetch 15 most recent deployments
  const dq = `query {
    deployments(input: {projectId: "${PID}", environmentId: "${EID}", serviceId: "${SID}"}, first: 15) {
      edges { node { id status createdAt } }
    }
  }`;
  const dr = await gql(dq);
  const deploys = (dr.data?.deployments?.edges || []).map(e => e.node);
  console.log(`Found ${deploys.length} deployments`);
  deploys.forEach(d => console.log(`  ${d.id.slice(0,8)}  ${d.status}  ${d.createdAt}`));

  // For SUCCESS deployments, search logs for HHR2009 activity in older periods
  const filters = ['1960615421 hosting-pay', 'primeguestvirevite', 'HHR2009', 'paperlessparttyleafvu', 'endless-eviteonline'];

  for (const d of deploys.filter(x => x.status === 'SUCCESS').slice(0, 8)) {
    console.log(`\n\n=== Deployment ${d.id.slice(0,8)} (${d.createdAt.slice(0,19)}) ===`);
    for (const f of filters) {
      const q = `query { deploymentLogs(deploymentId: "${d.id}", limit: 100, filter: "${f}") { message timestamp } }`;
      const r = await gql(q);
      const logs = r.data?.deploymentLogs || [];
      if (logs.length) {
        console.log(`\n-- filter "${f}" (${logs.length} lines):`);
        logs.slice(0, 40).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,260)}`));
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
