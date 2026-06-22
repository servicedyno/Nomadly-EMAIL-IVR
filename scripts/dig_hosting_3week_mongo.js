#!/usr/bin/env node
/**
 * Dig MongoDB for hosting-plan signal over the last 21 days.
 * Collections probed:
 *   - hostingTransactions / hostingPurchases (sales + failures)
 *   - cpanelPendingJobs (provisioning queue)
 *   - userErrors                (visible-to-user errors)
 *   - escalations               (admin alerts)
 *   - failedHostingJobs / cpanelFailedJobs (if present)
 * Output: /app/logs_prod/_hosting_3week_mongo.json
 */
require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'test_database';

const now = new Date();
const WINDOW_DAYS = 21;
const start = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

function bucketByDay(docs, getDate) {
  const m = {};
  for (const d of docs) {
    const dt = getDate(d);
    if (!dt) continue;
    const k = dayKey(dt);
    m[k] = (m[k] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort());
}

async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log(`\n=== Hosting 3-Week MongoDB Probe ===`);
  console.log(`Window: ${start.toISOString()}  →  ${now.toISOString()}`);
  console.log(`DB: ${DB_NAME}\n`);

  // List of relevant collections to look for
  const allColls = (await db.listCollections().toArray()).map(c => c.name);
  const hostKw = ['hosting', 'cpanel', 'whm', 'panel'];
  const matchedColls = allColls.filter(n =>
    hostKw.some(k => n.toLowerCase().includes(k))
  );
  console.log(`Hosting-related collections found:`);
  for (const c of matchedColls) console.log(`  - ${c}`);

  const report = {
    window: { start: start.toISOString(), end: now.toISOString() },
    collections: {},
  };

  // 1) hostingTransactions
  async function inspectCollection(name, dateField = 'createdAt') {
    try {
      const coll = db.collection(name);
      const total = await coll.countDocuments({});
      const recent = await coll
        .find({ [dateField]: { $gte: start, $lte: now } })
        .sort({ [dateField]: 1 })
        .toArray();
      // try alt date field if empty
      let docs = recent;
      let useField = dateField;
      if (docs.length === 0) {
        for (const alt of ['timestamp', 'created_at', 'updatedAt', 'date', 'queuedAt', 'completedAt']) {
          const alt_docs = await coll
            .find({ [alt]: { $gte: start, $lte: now } })
            .sort({ [alt]: 1 })
            .toArray();
          if (alt_docs.length > 0) {
            docs = alt_docs;
            useField = alt;
            break;
          }
        }
      }
      const sample = docs.slice(0, 3);
      const lastDoc = docs[docs.length - 1];
      const fields = sample[0] ? Object.keys(sample[0]) : [];
      const byDay = bucketByDay(docs, d => d[useField]);

      // Categorize by status if present
      const byStatus = {};
      for (const d of docs) {
        const s = d.status || d.state || d.outcome || 'unknown';
        byStatus[s] = (byStatus[s] || 0) + 1;
      }

      report.collections[name] = {
        totalEverInDB: total,
        recentCount: docs.length,
        usedDateField: useField,
        fields,
        byDay,
        byStatus,
        sample: sample.map(s => Object.fromEntries(
          Object.entries(s).filter(([k]) => !['_id'].includes(k)).slice(0, 12)
        )),
        latestDocTimestamp: lastDoc ? lastDoc[useField] : null,
      };
      console.log(`\n[${name}] recent=${docs.length}, totalEver=${total}`);
      console.log(`  byDay: ${JSON.stringify(byDay)}`);
      console.log(`  byStatus: ${JSON.stringify(byStatus)}`);
    } catch (e) {
      console.log(`  [${name}] error: ${e.message}`);
      report.collections[name] = { error: e.message };
    }
  }

  // Probe hosting-related collections + sometimes-used global ones
  const probeList = [
    ...matchedColls,
    'userErrors',
    'escalations',
    'adminAlerts',
    'admin_alerts',
    'orderHistory',
    'failedJobs',
  ];
  for (const c of probeList) {
    if (allColls.includes(c)) {
      await inspectCollection(c);
    }
  }

  // 2) Cross-cut: error categorisation
  // Pull userErrors mentioning hosting/cpanel keywords in last 21 days
  if (allColls.includes('userErrors')) {
    try {
      const docs = await db.collection('userErrors').find({
        $and: [
          { $or: [
            { createdAt: { $gte: start } },
            { timestamp: { $gte: start } },
            { ts: { $gte: start } },
          ]},
          { $or: [
            { context: /hosting|cpanel|whm/i },
            { module: /hosting|cpanel|whm/i },
            { error: /hosting|cpanel|whm/i },
            { msg: /hosting|cpanel|whm/i },
            { message: /hosting|cpanel|whm/i },
          ]},
        ],
      }).toArray();
      report.collections._userErrors_hosting_filtered = {
        count: docs.length,
        sample: docs.slice(-10).map(d => ({
          ts: d.createdAt || d.timestamp || d.ts,
          module: d.module,
          context: d.context,
          error: d.error || d.msg || d.message,
        })),
      };
      console.log(`\n[userErrors filtered for hosting/cpanel/whm]: ${docs.length}`);
    } catch (e) {
      console.log(`  userErrors filter error: ${e.message}`);
    }
  }

  // 3) cpanelPendingJobs status mix recently
  if (allColls.includes('cpanelPendingJobs')) {
    try {
      const coll = db.collection('cpanelPendingJobs');
      const stuck = await coll.find({
        $or: [
          { status: { $in: ['failed', 'error', 'stalled', 'stuck', 'admin_help', 'admin_action_required'] }},
          { lastError: { $exists: true, $ne: null } },
        ],
      }).sort({ updatedAt: -1 }).limit(50).toArray();
      report.collections._cpanelPendingJobs_failed_or_stuck = {
        count: stuck.length,
        sample: stuck.map(d => ({
          jobType: d.jobType,
          status: d.status,
          attempts: d.attempts,
          lastError: d.lastError,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          chatId: d.chatId,
          domain: d.domain,
        })),
      };
      console.log(`\n[cpanelPendingJobs failed/stuck]: ${stuck.length}`);
    } catch (e) {
      console.log(`  cpanelPendingJobs filter error: ${e.message}`);
    }
  }

  const out = '/app/logs_prod/_hosting_3week_mongo.json';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\n→ Saved: ${out}\n`);
  await client.close();
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
