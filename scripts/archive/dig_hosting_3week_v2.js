#!/usr/bin/env node
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');

(async () => {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test_database');
  const now = new Date();
  const start = new Date(now.getTime() - 21*86400000);

  console.log(`\n=== HOSTING DRILL v2 (correct schema: outcome + timestamp) ===`);
  console.log(`Window: ${start.toISOString()} → ${now.toISOString()}\n`);

  const all = await db.collection('hostingTransactions').find({
    timestamp: { $gte: start.toISOString() }
  }).sort({ timestamp: 1 }).toArray();

  // also try date object form for safety
  const alsoDateObj = await db.collection('hostingTransactions').find({
    timestamp: { $gte: start }
  }).toArray();
  console.log(`Found ${all.length} txns by timestamp (string), ${alsoDateObj.length} by date obj`);

  // Some timestamps are strings, some are dates — normalize
  const txns = (all.length >= alsoDateObj.length ? all : alsoDateObj);
  console.log(`Using ${txns.length} txns total\n`);

  // by outcome
  const byOutcome = {};
  for (const t of txns) {
    const o = t.outcome || 'NO_OUTCOME';
    byOutcome[o] = (byOutcome[o] || 0) + 1;
  }
  console.log(`OUTCOME breakdown:`, byOutcome);

  // by week
  const wk = (d) => {
    const dt = typeof d === 'string' ? new Date(d) : d;
    const daysAgo = Math.floor((now - dt) / 86400000);
    if (daysAgo < 7) return 'week3_recent';
    if (daysAgo < 14) return 'week2_mid';
    return 'week1_oldest';
  };
  const weekly = { week1_oldest: { total:0, success:0, failed:0, other:0 },
                   week2_mid:    { total:0, success:0, failed:0, other:0 },
                   week3_recent: { total:0, success:0, failed:0, other:0 } };
  for (const t of txns) {
    const w = wk(t.timestamp);
    weekly[w].total++;
    if (t.outcome === 'success') weekly[w].success++;
    else if (t.outcome === 'failed') weekly[w].failed++;
    else weekly[w].other++;
  }
  console.log(`\nWEEKLY HOSTING SUCCESS/FAIL RATE:`);
  for (const [w, s] of Object.entries(weekly)) {
    const fr = s.total ? (s.failed*100/s.total).toFixed(1) : '0';
    console.log(`  ${w.padEnd(15)}  total=${s.total}  success=${s.success}  failed=${s.failed}  other=${s.other}  failRate=${fr}%`);
  }

  // FAILED txns detail
  const failed = txns.filter(t => t.outcome === 'failed');
  console.log(`\n── ${failed.length} FAILED hostingTransactions ──`);
  for (const t of failed) {
    console.log(`\n  ${t.timestamp} chat=${t.chatId} domain=${t.domain}`);
    console.log(`    plan=${t.plan} price=$${t.priceUsd}  pmt=${t.paymentMethod}`);
    console.log(`    hostingUsername=${t.hostingUsername} refund=${t.refundAmount} ${t.refundCurrency || ''}`);
    if (t.notes) console.log(`    notes: ${t.notes}`);
    if (t.error) console.log(`    error: ${JSON.stringify(t.error).slice(0, 220)}`);
    const extraKeys = Object.keys(t).filter(k => !['_id','timestamp','chatId','domain','plan','priceUsd','paymentMethod','currency','outcome','hostingUsername','refundAmount','refundCurrency','gatewayData','couponApplied','couponDiscount','existingDomain','hostingType','notes','error'].includes(k));
    if (extraKeys.length) {
      console.log(`    extra fields: ${extraKeys.map(k => `${k}=${JSON.stringify(t[k]).slice(0,80)}`).join(', ')}`);
    }
  }

  // Refunds (recovery indicator)
  const refunded = txns.filter(t => t.refundAmount);
  console.log(`\n── ${refunded.length} REFUNDED hostingTransactions ──`);
  for (const t of refunded) {
    console.log(`  ${t.timestamp} chat=${t.chatId} domain=${t.domain} refund=$${t.refundAmount}  outcome=${t.outcome}`);
  }

  // Manual recovery notes (filter)
  const withNotes = txns.filter(t => t.notes);
  console.log(`\n── ${withNotes.length} txns WITH notes (manual recoveries / admin annotations) ──`);
  for (const t of withNotes) {
    console.log(`  ${t.timestamp} chat=${t.chatId} domain=${t.domain}`);
    console.log(`    notes: ${t.notes}`);
  }

  // BY DAY
  const byDay = {};
  for (const t of txns) {
    const d = String(t.timestamp).slice(0, 10);
    if (!byDay[d]) byDay[d] = { total:0, success:0, failed:0 };
    byDay[d].total++;
    if (t.outcome === 'success') byDay[d].success++;
    if (t.outcome === 'failed') byDay[d].failed++;
  }
  console.log(`\n── DAILY HOSTING TXNS ──`);
  for (const [d, s] of Object.entries(byDay).sort()) {
    const fr = s.total ? (s.failed*100/s.total).toFixed(0) : '0';
    const bar = '█'.repeat(s.total);
    const fbar = '✗'.repeat(s.failed);
    console.log(`  ${d}  total=${s.total.toString().padStart(2)} success=${s.success.toString().padStart(2)} failed=${s.failed.toString().padStart(2)} ${fr}%   ${bar}${fbar}`);
  }

  // Plan mix
  const byPlan = {};
  for (const t of txns) {
    const p = t.plan || 'unknown';
    byPlan[p] = (byPlan[p] || 0) + 1;
  }
  console.log(`\n── PLAN MIX ──`);
  for (const [p, c] of Object.entries(byPlan).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${c.toString().padStart(3)}  ${p}`);
  }

  // Output
  const out = {
    window: { start: start.toISOString(), end: now.toISOString() },
    totalTxns: txns.length,
    byOutcome,
    byWeek: weekly,
    byDay,
    byPlan,
    failedTxns: failed.map(t => ({
      timestamp: t.timestamp, chatId: t.chatId, domain: t.domain, plan: t.plan,
      priceUsd: t.priceUsd, refundAmount: t.refundAmount,
      hostingUsername: t.hostingUsername, notes: t.notes,
    })),
    refundedTxns: refunded.map(t => ({
      timestamp: t.timestamp, chatId: t.chatId, domain: t.domain,
      refundAmount: t.refundAmount, refundCurrency: t.refundCurrency,
      outcome: t.outcome,
    })),
    notedTxns: withNotes.map(t => ({
      timestamp: t.timestamp, chatId: t.chatId, domain: t.domain,
      outcome: t.outcome, notes: t.notes,
    })),
  };
  fs.writeFileSync('/app/logs_prod/_hosting_3week_v2.json', JSON.stringify(out, null, 2));
  console.log(`\n→ Saved /app/logs_prod/_hosting_3week_v2.json\n`);

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
