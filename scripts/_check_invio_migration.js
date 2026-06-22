#!/usr/bin/env node
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'test_database');

  // Look for inviowelcoparty.de account
  const variants = ['inviowelcoparty.de', 'inviowelcoparty', 'invi'];
  for (const v of variants) {
    const accts = await db.collection('cpanelAccounts').find({
      $or: [
        { domain: { $regex: v, $options: 'i' } },
        { cpUser: { $regex: v, $options: 'i' } },
        { addonDomains: { $regex: v, $options: 'i' } },
      ]
    }).toArray();
    if (accts.length) {
      console.log(`=== Found ${accts.length} matches for "${v}" ===`);
      for (const a of accts) {
        console.log(JSON.stringify({
          _id: a._id, domain: a.domain, addonDomains: a.addonDomains,
          cpUser: a.cpUser, chatId: a.chatId, plan: a.plan,
          whmHost: a.whmHost, whmHostMigratedAt: a.whmHostMigratedAt,
          suspended: a.suspended, deleted: a.deleted, terminatedOnWhm: a.terminatedOnWhm,
          createdAt: a.createdAt, expiryDate: a.expiryDate,
        }, null, 2));
      }
      break;
    }
  }

  // Also look at chat 1960615421 — list all their cpanel accounts
  console.log(`\n=== All cpanelAccounts for chat 1960615421 ===`);
  const userAccts = await db.collection('cpanelAccounts').find({ chatId: '1960615421' }).toArray();
  for (const a of userAccts) {
    console.log(`  ${a.domain || '?'} (cpUser=${a.cpUser}) plan=${a.plan}`);
    console.log(`    suspended=${a.suspended} deleted=${a.deleted} terminatedOnWhm=${a.terminatedOnWhm}`);
    console.log(`    whmHost=${a.whmHost || 'n/a'} migrated=${a.whmHostMigratedAt || 'n/a'}`);
    console.log(`    expiry=${a.expiryDate}`);
  }

  // Check migrationLog
  if ((await db.listCollections({ name: 'migrationLog' }).toArray()).length) {
    console.log(`\n=== migrationLog (last 5) ===`);
    const migs = await db.collection('migrationLog').find({}).sort({ _id: -1 }).limit(5).toArray();
    for (const m of migs) console.log(JSON.stringify(m, null, 2).slice(0, 600));
  }

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
