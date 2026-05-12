/**
 * Quick health snapshot for a specific leadJob.
 * Usage: node /app/scripts/check_leadjob.js <jobId>
 */

const { MongoClient } = require('mongodb');

// Read latest production MONGO_URL fetched via Railway GraphQL (fetch_railway_env.js)
const fs = require('fs');
const railwayEnv = JSON.parse(fs.readFileSync('/app/memory/railway_prod_env.json', 'utf8'));
const MONGO_URL = railwayEnv.MONGO_URL;
const JOB_ID = process.argv[2] || 'f7c619a9-0d9e-42f4-8b5f-aa912049a98d';

(async () => {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    // Try common DB names used by this app
    const candidateDbs = ['test', 'nomadly', 'nomadly_prod', 'production'];
    let foundDoc = null;
    let foundDb = null;

    for (const dbName of candidateDbs) {
      const db = client.db(dbName);
      const collections = (await db.listCollections({ name: 'leadJobs' }).toArray());
      if (collections.length === 0) continue;
      const doc = await db.collection('leadJobs').findOne({ jobId: JOB_ID });
      if (doc) {
        foundDoc = doc;
        foundDb = dbName;
        break;
      }
    }

    // Fallback: enumerate all dbs and look for leadJobs
    if (!foundDoc) {
      const adminDbs = await client.db().admin().listDatabases();
      for (const d of adminDbs.databases) {
        if (['admin', 'local', 'config'].includes(d.name)) continue;
        const db = client.db(d.name);
        const collections = (await db.listCollections({ name: 'leadJobs' }).toArray());
        if (collections.length === 0) continue;
        const doc = await db.collection('leadJobs').findOne({ jobId: JOB_ID });
        if (doc) {
          foundDoc = doc;
          foundDb = d.name;
          break;
        }
      }
    }

    if (!foundDoc) {
      console.log(JSON.stringify({ found: false, jobId: JOB_ID, checkedDbs: candidateDbs }, null, 2));
      process.exit(2);
    }

    // Trim huge arrays for readability
    const summary = { ...foundDoc };
    if (Array.isArray(summary.results)) {
      summary.resultsCount = summary.results.length;
      const last = summary.results[summary.results.length - 1];
      const first = summary.results[0];
      summary.results = `[truncated: ${summary.results.length} entries] first=${JSON.stringify(first)} last=${JSON.stringify(last)}`;
    }
    if (Array.isArray(summary.leads)) {
      summary.leadsCount = summary.leads.length;
      summary.leads = `[truncated: ${summary.leads.length} entries]`;
    }
    if (Array.isArray(summary.errors)) {
      summary.errorsCount = summary.errors.length;
      if (summary.errors.length > 5) summary.errors = summary.errors.slice(-5);
    }
    if (Array.isArray(summary.processed)) {
      summary.processedCount = summary.processed.length;
      delete summary.processed;
    }

    console.log(JSON.stringify({
      found: true,
      db: foundDb,
      jobId: JOB_ID,
      now: new Date().toISOString(),
      doc: summary,
    }, null, 2));
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
