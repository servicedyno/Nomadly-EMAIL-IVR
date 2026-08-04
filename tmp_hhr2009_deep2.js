// More deep investigation for @HHR2009
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
  const CHAT_ID_NUM = 1960615421;

  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test');

  // Session state
  const state = await db.collection('state').findOne({ _id: CHAT_ID });
  console.log('state:', JSON.stringify(state, null, 2));

  // Action states
  const actions = await db.collection('actionOf').findOne({ _id: CHAT_ID });
  console.log('\nactionOf:', JSON.stringify(actions, null, 2));

  // Payment intents (last 5)
  const intents = await db.collection('paymentIntents').find({
    $or: [{ chatId: CHAT_ID }, { chatId: CHAT_ID_NUM }]
  }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(`\npaymentIntents (${intents.length}):`);
  intents.forEach(i => console.log('  →', JSON.stringify({
    _id: i._id, ref: i.ref, amount: i.amount, type: i.type,
    domain: i.domain, plan: i.plan, provider: i.provider,
    status: i.status, createdAt: i.createdAt, expiresAt: i.expiresAt,
    paidAt: i.paidAt, failedReason: i.failedReason,
  })));

  // Transactions
  const txns = await db.collection('transactions').find({
    $or: [{ chatId: CHAT_ID }, { chatId: CHAT_ID_NUM }]
  }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(`\ntransactions (${txns.length}):`);
  txns.forEach(t => console.log('  →', JSON.stringify({
    amount: t.amount, type: t.type, status: t.status,
    metadata: t.metadata, createdAt: t.createdAt,
  })));

  // Escalations
  const escs = await db.collection('escalations').find({
    $or: [{ chatId: CHAT_ID }, { chatId: CHAT_ID_NUM }]
  }).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(`\nescalations (${escs.length}):`);
  escs.forEach(e => console.log('  →', JSON.stringify({
    _id: e._id, reason: e.reason, status: e.status,
    createdAt: e.createdAt, resolvedAt: e.resolvedAt, resolution: e.resolution,
  })));

  // Support sessions
  const supp = await db.collection('supportSessions').findOne({ _id: CHAT_ID });
  console.log('\nsupportSessions:', JSON.stringify(supp?.messages?.slice(-8), null, 2));

  await client.close();

  // Railway logs — search for capricorntools6666
  console.log('\n=== Railway logs for "capricorntools6666" ===');
  const q1 = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 300, filter: "capricorntools6666") { message timestamp } }`;
  const r1 = await gql(q1);
  (r1.data?.deploymentLogs || []).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,280)}`));

  // Railway logs — HHR2009 payment flow
  console.log('\n=== Railway logs — "1960615421" without HHR2009 handle (unfiltered) ===');
  // We already saw them. Look for [PaymentTimeout], [AntiRed], [ProtectionEnforcer]-related for his other domains
  const q2 = `query { deploymentLogs(deploymentId: "${DEPLOY_ID}", limit: 300, filter: "1960615421 ProtectionEnforcer") { message timestamp } }`;
  const r2 = await gql(q2);
  (r2.data?.deploymentLogs || []).forEach(l => console.log(`  ${l.timestamp.slice(0,19)} ${l.message.slice(0,280)}`));
}

main().catch(e => { console.error(e); process.exit(1); });
