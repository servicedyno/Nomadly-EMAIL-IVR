#!/usr/bin/env node
/**
 * Drill into 21-day hosting failures:
 *  - The 5 failed hostingTransactions — full docs + error messages
 *  - 2 domain_only transactions — were these "hosting purchase that fell back to domain"?
 *  - 99 escalations — filter for hosting/cpanel/whm/antired keywords, show daily trend + sample
 *  - Cross-reference failed txns with escalations (same chatId / domain / timestamp)
 *  - Compare hosting failure rate week-over-week (week 1 vs 2 vs 3)
 */
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'test_database';

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  const now = new Date();
  const start = new Date(now.getTime() - 21 * 86400000);
  const week1Cut = new Date(now.getTime() - 14 * 86400000);
  const week2Cut = new Date(now.getTime() - 7 * 86400000);

  console.log(`\n=== HOSTING FAILURE DRILL ===`);
  console.log(`Window: ${start.toISOString()} → ${now.toISOString()}\n`);

  // ----- 1. FAILED HOSTING TXNs -----
  const failedTxns = await db.collection('hostingTransactions').find({
    status: 'failed',
    createdAt: { $gte: start },
  }).sort({ createdAt: 1 }).toArray();

  console.log(`── ${failedTxns.length} FAILED hostingTransactions ──\n`);
  const failureReport = failedTxns.map(t => ({
    id: t._id?.toString(),
    chatId: t.chatId,
    domain: t.domain,
    plan: t.plan,
    amount: t.amount,
    status: t.status,
    failureReason: t.failureReason || t.error || t.reason,
    failedStep: t.failedStep,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    refunded: t.refunded,
    extras: Object.fromEntries(
      Object.entries(t).filter(([k]) => !['_id','chatId','domain','plan','amount','status','createdAt','updatedAt','failureReason','error','reason','failedStep','refunded'].includes(k))
    ),
  }));
  for (const t of failureReport) {
    console.log(`  ${t.createdAt?.toISOString?.()} chat=${t.chatId} domain=${t.domain}`);
    console.log(`    plan=${t.plan} amount=${t.amount} refunded=${t.refunded}`);
    console.log(`    failureReason: ${t.failureReason}`);
    console.log(`    failedStep:    ${t.failedStep}`);
    if (Object.keys(t.extras).length) {
      const k = Object.keys(t.extras).slice(0, 6);
      console.log(`    other fields:  ${JSON.stringify(Object.fromEntries(k.map(x => [x, t.extras[x]])))}`);
    }
    console.log('');
  }

  // ----- 2. DOMAIN_ONLY TXNs -----
  const domainOnly = await db.collection('hostingTransactions').find({
    status: 'domain_only',
    createdAt: { $gte: start },
  }).toArray();
  console.log(`── ${domainOnly.length} DOMAIN_ONLY hostingTransactions ──\n`);
  for (const t of domainOnly) {
    console.log(`  ${t.createdAt?.toISOString?.()} chat=${t.chatId} domain=${t.domain}`);
    console.log(`    plan=${t.plan} reason=${t.failureReason || t.reason || t.note}`);
    console.log('');
  }

  // ----- 3. Weekly failure rate -----
  const weeks = [
    { name: 'week1_oldest', from: start, to: week1Cut },
    { name: 'week2_mid',    from: week1Cut, to: week2Cut },
    { name: 'week3_recent', from: week2Cut, to: now },
  ];
  console.log(`── WEEKLY HOSTING SUCCESS RATE ──\n`);
  const weeklyStats = [];
  for (const w of weeks) {
    const total = await db.collection('hostingTransactions').countDocuments({
      createdAt: { $gte: w.from, $lt: w.to },
    });
    const failed = await db.collection('hostingTransactions').countDocuments({
      createdAt: { $gte: w.from, $lt: w.to },
      status: 'failed',
    });
    const success = await db.collection('hostingTransactions').countDocuments({
      createdAt: { $gte: w.from, $lt: w.to },
      status: 'success',
    });
    const failRate = total ? (failed * 100 / total).toFixed(1) : '0';
    weeklyStats.push({ ...w, total, success, failed, failRate });
    console.log(`  ${w.name.padEnd(15)} ${w.from.toISOString().slice(0,10)} → ${w.to.toISOString().slice(0,10)}: total=${total}  success=${success}  failed=${failed}  failRate=${failRate}%`);
  }

  // ----- 4. ESCALATIONS keyword filter -----
  const escAll = await db.collection('escalations').find({
    createdAt: { $gte: start },
  }).sort({ createdAt: 1 }).toArray();

  const hostingEsc = escAll.filter(e => {
    const blob = JSON.stringify(e).toLowerCase();
    return /hosting|cpanel|whm|antired|cloudflare|provision/.test(blob);
  });
  console.log(`\n── ESCALATIONS ──`);
  console.log(`  total in window: ${escAll.length}`);
  console.log(`  hosting/cpanel/whm/antired related: ${hostingEsc.length}`);
  // by day
  const escByDay = {};
  for (const e of hostingEsc) {
    const k = e.createdAt.toISOString().slice(0, 10);
    escByDay[k] = (escByDay[k] || 0) + 1;
  }
  console.log(`  hosting-related by day: ${JSON.stringify(Object.fromEntries(Object.entries(escByDay).sort()))}`);

  // by category
  const escByType = {};
  for (const e of hostingEsc) {
    const t = e.type || e.category || e.kind || e.reason || 'unknown';
    escByType[t] = (escByType[t] || 0) + 1;
  }
  console.log(`  hosting-related by type: ${JSON.stringify(escByType)}`);

  // unique sample of each type
  console.log(`\n── HOSTING-ESCALATION SAMPLES (one per type) ──\n`);
  const seenType = new Set();
  for (const e of hostingEsc) {
    const t = e.type || e.category || e.kind || e.reason || 'unknown';
    if (seenType.has(t)) continue;
    seenType.add(t);
    console.log(`  TYPE=${t}`);
    console.log(`    ${e.createdAt.toISOString()} chat=${e.chatId} status=${e.status}`);
    const msg = e.message || e.details || e.note || e.error;
    if (msg) console.log(`    msg: ${String(msg).slice(0, 220)}`);
    console.log('');
  }

  // ----- 5. ALL escalations daily trend -----
  const escAllByDay = {};
  for (const e of escAll) {
    const k = e.createdAt.toISOString().slice(0, 10);
    escAllByDay[k] = (escAllByDay[k] || 0) + 1;
  }
  console.log(`── ALL-ESCALATIONS DAILY ──`);
  for (const [d, c] of Object.entries(escAllByDay).sort()) {
    const bar = '█'.repeat(c);
    console.log(`  ${d}  ${c.toString().padStart(3)}  ${bar}`);
  }

  // ----- 6. Top types overall -----
  const allByType = {};
  for (const e of escAll) {
    const t = e.type || e.category || e.kind || e.reason || 'unknown';
    allByType[t] = (allByType[t] || 0) + 1;
  }
  console.log(`\n── ALL-ESCALATIONS TYPES (21d) ──`);
  for (const [t, c] of Object.entries(allByType).sort((a,b) => b[1]-a[1])) {
    console.log(`  ${t.padEnd(40)} ${c}`);
  }

  // ----- Save report -----
  const report = {
    window: { start: start.toISOString(), end: now.toISOString() },
    weeklyStats,
    failedTxns: failureReport,
    domainOnlyTxns: domainOnly.map(t => ({
      chatId: t.chatId, domain: t.domain, plan: t.plan,
      reason: t.failureReason || t.reason || t.note,
      createdAt: t.createdAt,
    })),
    escalationsTotal: escAll.length,
    hostingEscalationsCount: hostingEsc.length,
    hostingEscalationsByDay: escByDay,
    hostingEscalationsByType: escByType,
    allEscalationsByDay: escAllByDay,
    allEscalationsByType: allByType,
  };
  fs.writeFileSync('/app/logs_prod/_hosting_3week_drill.json', JSON.stringify(report, null, 2));
  console.log(`\n→ Saved: /app/logs_prod/_hosting_3week_drill.json\n`);

  await client.close();
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
