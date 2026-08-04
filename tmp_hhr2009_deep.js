// Deeper investigation for @HHR2009's current issue
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');

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
  const CHAT_ID = '1960615421';

  // --- Mongo: user's data ---
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test');

  console.log('=== @HHR2009 (chatId 1960615421) — Mongo state ===\n');

  const [wallet, plan, planEnd, hostingPlans, cpAccts, pendingJobs, domainsOf, hostingCarts, cartRec, hostingHistoryLast] = await Promise.all([
    db.collection('walletOf').findOne({ _id: CHAT_ID }),
    db.collection('planOf').findOne({ _id: CHAT_ID }),
    db.collection('planEndingTime').findOne({ _id: CHAT_ID }),
    db.collection('hostingPlansOf').findOne({ _id: CHAT_ID }),
    db.collection('cpanelAccounts').find({ chatId: CHAT_ID }).toArray(),
    db.collection('cpanelPendingJobs').find({ chatId: CHAT_ID }).sort({ createdAt: -1 }).limit(5).toArray(),
    db.collection('domainsOf').findOne({ _id: CHAT_ID }),
    db.collection('hostingCarts').find({ chatId: CHAT_ID }).sort({ updatedAt: -1 }).limit(5).toArray(),
    db.collection('cartRecovery').find({ chatId: CHAT_ID }).sort({ createdAt: -1 }).limit(5).toArray(),
    db.collection('hostingHistory').find({ chatId: CHAT_ID }).sort({ createdAt: -1 }).limit(10).toArray(),
  ]);

  console.log('wallet:', JSON.stringify(wallet));
  console.log('plan:', JSON.stringify(plan));
  console.log('planEndingTime:', JSON.stringify(planEnd));
  console.log('hostingPlansOf:', JSON.stringify(hostingPlans, null, 2));
  console.log(`\ncpanelAccounts (${cpAccts.length}):`);
  cpAccts.forEach(a => console.log('  →', JSON.stringify({
    _id: a._id, domain: a.domain, cpUser: a.cpUser, whmHost: a.whmHost,
    plan: a.plan, planExpiresAt: a.planExpiresAt, status: a.status,
    createdAt: a.createdAt, deleted: a.deleted, deletedAt: a.deletedAt,
    autoRenewEnabled: a.autoRenewEnabled,
  })));
  console.log(`\ncpanelPendingJobs (${pendingJobs.length}):`);
  pendingJobs.forEach(j => console.log('  →', JSON.stringify({
    _id: j._id, domain: j.domain, status: j.status,
    attempts: j.attempts, lastError: j.lastError?.slice(0, 200),
    createdAt: j.createdAt, completedAt: j.completedAt,
    escalated: j.escalated,
  })));
  console.log(`\ndomainsOf (owned domains):`, domainsOf ? Object.keys(domainsOf.val || {}).length : 'no doc');
  if (domainsOf?.val) console.log('  domains:', Object.keys(domainsOf.val));
  console.log(`\nhostingCarts (${hostingCarts.length}):`);
  hostingCarts.forEach(c => console.log('  →', JSON.stringify({
    _id: c._id, domain: c.domain, plan: c.plan, status: c.status,
    createdAt: c.createdAt, updatedAt: c.updatedAt, paidAt: c.paidAt,
  })));
  console.log(`\ncartRecovery (${cartRec.length}):`);
  cartRec.forEach(c => console.log('  →', JSON.stringify(c)));
  console.log(`\nhostingHistory (last ${hostingHistoryLast.length}):`);
  hostingHistoryLast.forEach(h => console.log('  →', JSON.stringify(h)));

  // --- Look at older deployment logs where the deleted domain might be ---
  console.log('\n=== Railway logs — filter by "primeguestvirevite" ===');
  const q1 = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 300, filter: "primeguestvirevite") { message timestamp } }`;
  const r1 = await gql(q1);
  (r1.data?.deploymentLogs || []).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,240)}`));

  // Filter by HHR2009 handle
  console.log('\n=== Railway logs — filter by "HHR2009" ===');
  const q2 = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 300, filter: "HHR2009") { message timestamp } }`;
  const r2 = await gql(q2);
  (r2.data?.deploymentLogs || []).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,240)}`));

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
