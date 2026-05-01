/**
 * Tests for cpanel-job-queue.js + cpanel-job-handlers.js
 *
 * Uses a real local MongoDB. Picks a unique DB name per run so it's isolated.
 *
 * Run with: node js/tests/test_cpanel_queue.js
 */

const path = require('path')
const assert = require('assert')

const { MongoClient } = require('mongodb')

;(async () => {
  let pass = 0, fail = 0
  function ok(name, cond, note = '') {
    if (cond) { pass++; console.log(`  ✓ ${name}`) }
    else { fail++; console.log(`  ✗ ${name} — ${note}`) }
  }

  process.env.WHM_HOST = '127.0.0.1'
  process.env.MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'

  const dbName = `nomadly_test_queue_${Date.now()}`
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(dbName)

  // Fresh modules
  for (const m of ['../cpanel-health', '../cpanel-job-queue', '../cpanel-job-handlers']) {
    try { delete require.cache[require.resolve(m)] } catch (_) {}
  }
  const cpHealth = require('../cpanel-health')
  const cpQueue  = require('../cpanel-job-queue')
  require('../cpanel-job-handlers')
  cpHealth._resetCache()

  // Capture sends + admin notifications
  const sent = []
  const admin = []
  const send = (chatId, message) => sent.push({ chatId, message })
  const notifyAdmin = (text) => admin.push(text)

  cpQueue.init({ db, send, notifyAdmin })

  // Register a custom test handler we control
  const handlerCalls = []
  cpQueue.registerHandler('test_action', async ({ job }) => {
    handlerCalls.push(job)
    if (job.params?.simulate === 'success') return { ok: true }
    if (job.params?.simulate === 'defer')   return { ok: false, deferred: true, reason: 'WHM still down' }
    return { ok: false, deferred: false, reason: 'fail' }
  })

  // Fake reachability — start as down so worker won't drain
  let reachable = false
  const origIsWhmReachable = cpHealth.isWhmReachable
  cpHealth.isWhmReachable = async () => reachable

  // 1. Enqueue while down — should persist with status=pending and NOT call handler
  await cpQueue.enqueue({
    type: 'test_action', chatId: '111', lang: 'en',
    params: { simulate: 'success' }, dedupeKey: 'k1',
  })
  await new Promise(r => setTimeout(r, 100))
  ok('enqueue while down — handler NOT called', handlerCalls.length === 0)

  const stats1 = await cpQueue.getStats()
  ok('stats: 1 pending', stats1.pending === 1, JSON.stringify(stats1))

  // 2. Dedup — same dedupeKey should return same job, not insert new
  await cpQueue.enqueue({
    type: 'test_action', chatId: '111', lang: 'en',
    params: { simulate: 'success' }, dedupeKey: 'k1',
  })
  const stats2 = await cpQueue.getStats()
  ok('dedupe by key — still 1 pending', stats2.pending === 1, JSON.stringify(stats2))

  // 3. Flip reachable=true and drain — handler should fire and job → done
  reachable = true
  await cpQueue.drain()
  await new Promise(r => setTimeout(r, 50))
  ok('drain when up — handler fired', handlerCalls.length === 1)
  const stats3 = await cpQueue.getStats()
  ok('after drain — 0 pending', stats3.pending === 0, JSON.stringify(stats3))
  ok('after drain — 1 done',   stats3.done === 1,    JSON.stringify(stats3))

  // 4. Soft-failure (deferred) — should re-mark pending, not fail
  await cpQueue.enqueue({
    type: 'test_action', chatId: '222', lang: 'en',
    params: { simulate: 'defer' },
  })
  await cpQueue.drain()
  const stats4 = await cpQueue.getStats()
  ok('deferred → re-pending', stats4.pending === 1, JSON.stringify(stats4))
  ok('deferred → not failed', stats4.failed === 0, JSON.stringify(stats4))

  // Clean the deferred job before the next cases (otherwise it sits at FIFO head
  // and pauses the drain, hiding subsequent test results).
  await db.collection(cpQueue._COLLECTION).deleteMany({ chatId: '222' })

  // 5. Hard failure → failed + admin notified
  await cpQueue.enqueue({
    type: 'test_action', chatId: '333', lang: 'en',
    params: { simulate: 'hard_fail' },
  })
  await cpQueue.drain()
  const stats5 = await cpQueue.getStats()
  ok('hard fail → failed bucket', stats5.failed >= 1, JSON.stringify(stats5))
  ok('hard fail → admin notified', admin.some(t => /failed permanently/i.test(t)), JSON.stringify(admin))

  // 6. Unknown type → failed
  await cpQueue.enqueue({
    type: 'no_such_handler', chatId: '444', lang: 'en', params: {},
  })
  await cpQueue.drain()
  const stats6 = await cpQueue.getStats()
  ok('unknown type → failed bucket grows', stats6.failed >= 2, JSON.stringify(stats6))

  // Cleanup
  cpHealth.isWhmReachable = origIsWhmReachable
  await db.dropDatabase()
  await client.close()

  console.log(`\n${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test crashed:', err)
  process.exit(2)
})
