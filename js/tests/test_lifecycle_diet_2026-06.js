// Test suite for Lifecycle Diet (#18) — 1/24h cap, <72h welcome window,
// active-balance-wall pause, and batch suppression sets.
// Runs against an isolated local MongoDB database.

const { MongoClient } = require('mongodb')
const { initLifecycleDiet } = require('../lifecycle-diet.js')

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const TEST_DB = 'lifecycle_diet_test'

let pass = 0, fail = 0
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}`) }
}

const HOUR = 60 * 60 * 1000

async function main() {
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(TEST_DB)

  // Clean slate
  await db.collection('unsolicitedLog').deleteMany({})
  await db.collection('funnelEvents').deleteMany({})
  await db.collection('userConversion').deleteMany({})

  const diet = initLifecycleDiet(db)

  // ── 1. 24h cap ────────────────────────────────────────────────────
  console.log('\n[1] 1-per-24h cap')
  ok('no record → not capped', (await diet.isWithin24hCap('u1')) === false)
  await diet.markUnsolicitedSent('u1', 'autopromo_morning')
  ok('after mark → capped', (await diet.isWithin24hCap('u1')) === true)
  const rec = await db.collection('unsolicitedLog').findOne({ _id: 'u1' })
  ok('mark stored lastChannel', rec?.lastChannel === 'autopromo_morning')
  ok('mark incremented count', rec?.count === 1)
  // Simulate a send 25h ago → cap expired
  await db.collection('unsolicitedLog').updateOne({ _id: 'u1' }, { $set: { lastSentAt: new Date(Date.now() - 25 * HOUR) } })
  ok('25h-old send → cap expired', (await diet.isWithin24hCap('u1')) === false)

  // ── 2. Welcome window (<72h) ──────────────────────────────────────
  console.log('\n[2] <72h welcome window')
  ok('no conversion record → not in window', (await diet.isInWelcomeWindow('u2')) === false)
  await db.collection('userConversion').insertOne({ chatId: 'u2', joinedAt: new Date(Date.now() - 10 * HOUR) })
  ok('joined 10h ago → in window', (await diet.isInWelcomeWindow('u2')) === true)
  await db.collection('userConversion').insertOne({ chatId: 'u3', joinedAt: new Date(Date.now() - 80 * HOUR) })
  ok('joined 80h ago → NOT in window', (await diet.isInWelcomeWindow('u3')) === false)

  // ── 3. Active balance wall ────────────────────────────────────────
  console.log('\n[3] active balance wall')
  ok('no wall event → not active', (await diet.hasActiveBalanceWall('u4')) === false)
  // Wall, no deposit → active
  await db.collection('funnelEvents').insertOne({ chatId: 'u4', event: 'insufficient_balance_wall', ts: new Date(Date.now() - 3 * HOUR) })
  ok('wall + no deposit → active', (await diet.hasActiveBalanceWall('u4')) === true)
  // Deposit AFTER wall → resolved
  await db.collection('funnelEvents').insertOne({ chatId: 'u4', event: 'deposit_confirmed', ts: new Date(Date.now() - 1 * HOUR) })
  ok('deposit after wall → resolved', (await diet.hasActiveBalanceWall('u4')) === false)
  // Deposit BEFORE a newer wall → still active
  await db.collection('funnelEvents').insertOne({ chatId: 'u5', event: 'deposit_confirmed', ts: new Date(Date.now() - 5 * HOUR) })
  await db.collection('funnelEvents').insertOne({ chatId: 'u5', event: 'insufficient_balance_wall', ts: new Date(Date.now() - 2 * HOUR) })
  ok('wall newer than deposit → active', (await diet.hasActiveBalanceWall('u5')) === true)

  // ── 4. canSendPromo gate combinations ─────────────────────────────
  console.log('\n[4] canSendPromo gate')
  // Fresh user with no history → ok
  ok('clean user → ok', (await diet.canSendPromo('clean')).ok === true)
  // Capped user
  await diet.markUnsolicitedSent('capped', 'x')
  ok('capped user → blocked cap_24h', (await diet.canSendPromo('capped')).reason === 'cap_24h')
  // Welcome-window user (u2)
  const g2 = await diet.canSendPromo('u2')
  ok('welcome user → blocked welcome_window', g2.reason === 'welcome_window')
  ok('welcome user with skipWelcomeWindow → ok', (await diet.canSendPromo('u2', { skipWelcomeWindow: true })).ok === true)
  // Balance-wall user (u5), old enough to not be in welcome window
  await db.collection('userConversion').insertOne({ chatId: 'u5', joinedAt: new Date(Date.now() - 200 * HOUR) })
  const g5 = await diet.canSendPromo('u5')
  ok('wall user → blocked balance_wall', g5.reason === 'balance_wall')
  ok('wall user with skipBalanceWall → ok', (await diet.canSendPromo('u5', { skipBalanceWall: true })).ok === true)

  // ── 5. buildSuppressionSets (batch) ───────────────────────────────
  console.log('\n[5] buildSuppressionSets batch')
  // Reset & seed a known population
  await db.collection('unsolicitedLog').deleteMany({})
  await db.collection('funnelEvents').deleteMany({})
  await db.collection('userConversion').deleteMany({})
  // b1 capped, b2 welcome-window, b3 active wall, b4 clean, b5 wall-but-deposited
  await diet.markUnsolicitedSent('b1', 'autopromo_morning')
  await db.collection('userConversion').insertOne({ chatId: 'b2', joinedAt: new Date(Date.now() - 5 * HOUR) })
  await db.collection('funnelEvents').insertOne({ chatId: 'b3', event: 'insufficient_balance_wall', ts: new Date(Date.now() - 2 * HOUR) })
  await db.collection('funnelEvents').insertOne({ chatId: 'b5', event: 'insufficient_balance_wall', ts: new Date(Date.now() - 4 * HOUR) })
  await db.collection('funnelEvents').insertOne({ chatId: 'b5', event: 'deposit_confirmed', ts: new Date(Date.now() - 1 * HOUR) })

  const sets = await diet.buildSuppressionSets(['b1', 'b2', 'b3', 'b4', 'b5'])
  ok('b1 in capped set', sets.capped.has('b1'))
  ok('b2 in welcome set', sets.welcome.has('b2'))
  ok('b3 in balanceWall set', sets.balanceWall.has('b3'))
  ok('b4 in no set (clean)', !sets.capped.has('b4') && !sets.welcome.has('b4') && !sets.balanceWall.has('b4'))
  ok('b5 NOT in balanceWall (deposited after)', !sets.balanceWall.has('b5'))

  // Simulate AutoPromo filter: keep only users not in any set
  const target = ['b1', 'b2', 'b3', 'b4', 'b5']
  const kept = target.filter(c => !sets.capped.has(c) && !sets.welcome.has(c) && !sets.balanceWall.has(c))
  ok('filter keeps only b4 & b5', kept.length === 2 && kept.includes('b4') && kept.includes('b5'))

  // Cleanup
  await db.dropDatabase()
  await client.close()

  console.log(`\n──────────────────────────────`)
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
