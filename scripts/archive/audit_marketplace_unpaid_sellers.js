#!/usr/bin/env node
// Audit: find sellers with active/sold listings who never paid the one-time
// $50 marketplace access fee. These are the "old sellers" who slipped through
// when the fee was rolled out.
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const ADMIN_ID   = process.env.TELEGRAM_ADMIN_CHAT_ID
const DEV_ID     = process.env.TELEGRAM_DEV_CHAT_ID
const EXTRA_ADMS = String(process.env.MARKETPLACE_ACCESS_ADMIN_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const ADMIN_SET  = new Set([ADMIN_ID, DEV_ID, ...EXTRA_ADMS].filter(Boolean).map(String))

async function main () {
  const c = new MongoClient(process.env.MONGO_URL)
  await c.connect()
  const db = c.db(process.env.DB_NAME || 'test')

  const products      = db.collection('marketplaceProducts')
  const access        = db.collection('marketplaceAccess')
  const conversations = db.collection('marketplaceConversations')

  // 1. Distinct seller IDs among active/sold listings.
  const sellers = await products.distinct('sellerId', { status: { $in: ['active', 'sold'] } })
  console.log(`\n─── ${sellers.length} distinct sellers with active/sold listings ───`)

  // 2. Fetch paid sellers.
  const paidDocs = await access.find({ paid: true }).toArray()
  const paidSet  = new Set()
  paidDocs.forEach(d => paidSet.add(String(d._id)))
  console.log(`─── ${paidDocs.length} paid marketplaceAccess docs ───`)

  // 3. Cross-reference.
  const unpaid = []
  for (const sid of sellers) {
    const idStr = String(sid)
    if (paidSet.has(idStr)) continue
    if (ADMIN_SET.has(idStr)) continue  // admin bypass
    const [activeCount, soldCount, firstListing] = await Promise.all([
      products.countDocuments({ sellerId: sid, status: 'active' }),
      products.countDocuments({ sellerId: sid, status: 'sold' }),
      products.findOne({ sellerId: sid }, { sort: { createdAt: 1 }, projection: { createdAt: 1, title: 1 } }),
    ])
    unpaid.push({
      sellerId: idStr,
      active: activeCount,
      sold: soldCount,
      firstListingAt: firstListing?.createdAt || null,
      firstListingTitle: firstListing?.title || null,
    })
  }

  unpaid.sort((a, b) => (a.firstListingAt || '') < (b.firstListingAt || '') ? -1 : 1)

  console.log(`\n══════════════════════════════════════════════════════════════`)
  console.log(`  ${unpaid.length} UNPAID SELLERS have live/sold listings`)
  console.log(`══════════════════════════════════════════════════════════════\n`)
  for (const u of unpaid) {
    console.log(`  seller=${u.sellerId.padEnd(14)} active=${u.active} sold=${u.sold}  first=${(u.firstListingAt || '').slice(0, 19)}  «${(u.firstListingTitle || '').slice(0, 40)}»`)
  }

  // 4. Look at active conversations where an unpaid seller could be replying.
  const unpaidIds = unpaid.map(u => u.sellerId)
  const openConvs = await conversations.countDocuments({
    sellerId: { $in: [...unpaidIds, ...unpaidIds.map(Number)] },
    status: { $in: ['active', 'escrow_started'] },
  })
  console.log(`\n─── ${openConvs} OPEN conversations where seller is UNPAID ───\n`)

  // 5. Print latest listing / creation time so we can see if new ones are being posted post-rollout.
  console.log(`─── Most recent 20 UNPAID listings ───`)
  const recent = await products.find(
    { status: { $in: ['active', 'sold'] } },
    { projection: { sellerId: 1, title: 1, price: 1, createdAt: 1, status: 1 } }
  ).sort({ createdAt: -1 }).limit(80).toArray()

  let shown = 0
  for (const p of recent) {
    if (paidSet.has(String(p.sellerId))) continue
    if (ADMIN_SET.has(String(p.sellerId))) continue
    console.log(`  ${p.createdAt?.slice(0, 19)}  seller=${String(p.sellerId).padEnd(14)}  $${p.price}  status=${p.status.padEnd(6)}  «${(p.title || '').slice(0, 40)}»`)
    if (++shown >= 20) break
  }

  await c.close()
}

main().catch(e => { console.error(e); process.exit(1) })
