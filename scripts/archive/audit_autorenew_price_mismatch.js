#!/usr/bin/env node
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test_database');

  const domains = ['sechtsft.de', 'hunt-verify.org'];
  for (const d of domains) {
    const acct = await db.collection('cpanelAccounts').findOne({ domain: d });
    if (acct) {
      console.log(`\n${d} (cpanelAccount):`);
      console.log(JSON.stringify({
        plan: acct.plan, chatId: acct.chatId, cpUser: acct.cpUser,
        expiryDate: acct.expiryDate, autoRenew: acct.autoRenew,
        suspended: acct.suspended, suspendedAt: acct.suspendedAt,
        renewalCount: acct.renewalCount, lastRenewedAt: acct.lastRenewedAt,
        createdAt: acct.createdAt, terminatedOnWhm: acct.terminatedOnWhm,
        deleted: acct.deleted,
      }, null, 2));
    } else {
      console.log(`\n${d}: NO cpanelAccount found`);
    }
    // Original purchase
    const txn = await db.collection('hostingTransactions').findOne({ domain: d });
    if (txn) {
      console.log(`${d} original purchase: plan=${txn.plan} priceUsd=$${txn.priceUsd} timestamp=${txn.timestamp} chatId=${txn.chatId}`);
    }
    // Wallet
    if (acct?.chatId) {
      const w = await db.collection('walletOf').findOne({ _id: String(acct.chatId) });
      if (w) {
        console.log(`${d} wallet:`, JSON.stringify({
          usd: w.usd, usdOut: w.usdOut, ngnIn: w.ngnIn, ngnOut: w.ngnOut,
        }, null, 2));
      }
    }
  }

  // Wider scan — every cpanelAccount with autoRenew not explicitly false
  console.log(`\n\n══ AUTO-RENEW PRICE-MISMATCH AUDIT — ALL ACTIVE cpanelAccounts ══\n`);
  const all = await db.collection('cpanelAccounts').find({
    terminatedOnWhm: { $ne: true }, archived: { $ne: true },
    autoRenew: { $ne: false },
  }).toArray();
  console.log(`${all.length} active auto-renew-eligible cpanelAccounts\n`);

  function planPriceCode(planName) {
    const n = (planName || '').toLowerCase();
    if (n.includes('golden')) return 100;
    if (n.includes('premium') && n.includes('hostpanel')) return 75;
    if (n.includes('premium') && n.includes('week')) return 50;
    if (n.includes('business')) return 100;
    if (n.includes('pro')) return 75;
    if (n.includes('starter')) return 50;
    return 0;
  }

  const mismatches = [];
  for (const acct of all) {
    const txn = await db.collection('hostingTransactions').findOne({ chatId: acct.chatId, domain: acct.domain, outcome: 'success' });
    const renewPrice = planPriceCode(acct.plan);
    const purchasePrice = txn?.priceUsd ?? null;
    if (purchasePrice !== null && Math.abs(renewPrice - purchasePrice) > 0.01) {
      mismatches.push({
        domain: acct.domain, chatId: acct.chatId, plan: acct.plan,
        renewPrice, purchasePrice, delta: renewPrice - purchasePrice,
        expiryDate: acct.expiryDate, suspended: acct.suspended,
      });
    }
  }
  console.log(`Mismatches found: ${mismatches.length}`);
  mismatches.sort((a, b) => b.delta - a.delta);
  for (const m of mismatches.slice(0, 30)) {
    const flag = m.suspended ? '  ⚠️ SUSPENDED' : '';
    console.log(`  ${m.domain.padEnd(35)} plan=${m.plan.padEnd(36)} paid=$${String(m.purchasePrice).padEnd(7)} renews=$${String(m.renewPrice).padEnd(5)} Δ=+$${m.delta}${flag}`);
  }

  // Also: number of accounts with mismatch >$10 or >2x purchase price
  const bigDelta = mismatches.filter(m => m.delta > 10);
  console.log(`\nAccounts where renewal > $10 above what user paid: ${bigDelta.length}`);
  const doubled = mismatches.filter(m => m.renewPrice > m.purchasePrice * 1.5);
  console.log(`Accounts where renewal is >1.5× what user paid: ${doubled.length}`);

  // Are any of these currently suspended?
  const susp = mismatches.filter(m => m.suspended);
  console.log(`Suspended accounts among mismatches: ${susp.length}`);

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
