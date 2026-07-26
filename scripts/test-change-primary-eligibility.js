// Isolated logic test for the "Change Primary Domain" eligibility computation.
// Uses a THROWAWAY temp collection — never touches the real cpanelAccounts data.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

async function main() {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  const col = db.collection('__tmp_change_primary_test')
  await col.deleteMany({})

  const chatId = 'TESTCHAT_CP'
  // thisPlan: primary bad.com, addon extra.com (owned)
  const thisPlan = { _id: 'cpthisplan', chatId, domain: 'bad.com', addonDomains: ['extra.com'] }
  // otherPlan: primary busy.com
  const otherPlan = { _id: 'cpotherplan', chatId, domain: 'busy.com', addonDomains: ['busyaddon.com'] }
  await col.insertMany([thisPlan, otherPlan])

  // User owns these:
  const owned = ['bad.com', 'fresh.com', 'busy.com', 'extra.com', 'busyaddon.com', 'FRESH2.com']

  // ---- replicate the handler's eligibility computation ----
  const plan = thisPlan
  const domain = plan.domain
  const currentPrimary = domain.toLowerCase()
  const ownedLower = owned.map(d => d.toLowerCase()).filter(Boolean)
  let eligible = []
  const usedRows = await col.find(
    { $or: [{ domain: { $in: ownedLower } }, { addonDomains: { $in: ownedLower } }], deleted: { $ne: true } },
    { projection: { _id: 1, domain: 1, addonDomains: 1 } },
  ).toArray()
  const usedByOther = new Set()
  for (const row of usedRows) {
    if (String(row._id).toLowerCase() === String(plan._id).toLowerCase()) continue
    if (row.domain) usedByOther.add(String(row.domain).toLowerCase())
    if (Array.isArray(row.addonDomains)) for (const ad of row.addonDomains) if (ad) usedByOther.add(String(ad).toLowerCase())
  }
  eligible = ownedLower.filter(d => d !== currentPrimary && !usedByOther.has(d))

  console.log('eligible =', eligible)

  const expected = ['fresh.com', 'extra.com', 'fresh2.com'].sort()
  const got = [...eligible].sort()
  const pass =
    JSON.stringify(got) === JSON.stringify(expected) &&
    !eligible.includes('bad.com') &&      // current primary excluded
    !eligible.includes('busy.com') &&     // primary of other plan excluded
    !eligible.includes('busyaddon.com') && // addon of other plan excluded
    eligible.includes('extra.com')        // addon of THIS plan IS eligible (user choice "c")

  console.log('assertions:')
  console.log('  current primary bad.com excluded:', !eligible.includes('bad.com'))
  console.log('  other-plan primary busy.com excluded:', !eligible.includes('busy.com'))
  console.log('  other-plan addon busyaddon.com excluded:', !eligible.includes('busyaddon.com'))
  console.log('  this-plan addon extra.com eligible:', eligible.includes('extra.com'))
  console.log('  fresh unused domains eligible:', eligible.includes('fresh.com') && eligible.includes('fresh2.com'))
  console.log(pass ? '\nRESULT: PASS ✅' : '\nRESULT: FAIL ❌')

  await col.drop().catch(() => {})
  await client.close()
  process.exit(pass ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
