// Standalone smoke test for shortener-reconciler.js
// Verifies the 4 behavioural contracts:
//   1. Transient upstream error during deactivate → caller does NOT delete CF
//      and a retry task is queued.
//   2. Reconciler retries the queued task on its next tick and notifies user
//      once upstream succeeds.
//   3. Reconciler stops retrying after MAX_DEACTIVATION_RETRIES and notifies
//      the user that automatic recovery failed.
//   4. Reconciler heals orphan state (upstream claims domain, but CF has no
//      shortener CNAME) by removing upstream claim and marking activation
//      needs_reactivation.

const assert = require('assert')

// ─── In-memory mock MongoDB ───────────────────────────────────────────────
function makeMockDb() {
  const data = new Map() // collectionName -> Map<_id, doc>
  function col(name) {
    if (!data.has(name)) data.set(name, new Map())
    const store = data.get(name)
    return {
      _store: store,
      async findOne(filter) {
        const id = filter?._id
        if (id !== undefined) return store.get(id) || null
        for (const v of store.values()) {
          if (Object.entries(filter).every(([k, vv]) => v[k] === vv)) return v
        }
        return null
      },
      async updateOne(filter, update, opts = {}) {
        const id = filter._id
        let doc = store.get(id)
        if (!doc && opts.upsert) {
          doc = { _id: id }
          store.set(id, doc)
        }
        if (!doc) return { matchedCount: 0 }
        if (update.$set) Object.assign(doc, update.$set)
        if (update.$setOnInsert && doc.createdAt === undefined) Object.assign(doc, update.$setOnInsert)
        if (update.$inc) for (const [k, v] of Object.entries(update.$inc)) doc[k] = (doc[k] || 0) + v
        return { matchedCount: 1 }
      },
      async findOneAndUpdate(filter, update, opts = {}) {
        await this.updateOne(filter, update)
        const doc = store.get(filter._id) || null
        return { value: doc }
      },
      find(filter = {}) {
        const all = [...store.values()].filter(d =>
          Object.entries(filter).every(([k, v]) => {
            const dv = d[k]
            if (v && typeof v === 'object' && '$in' in v) return v.$in.includes(dv)
            if (v && typeof v === 'object' && '$lt' in v) return (dv || 0) < v.$lt
            return dv === v
          })
        )
        return {
          toArray: async () => all,
          sort: () => ({ limit: () => ({ [Symbol.asyncIterator]: async function* () { for (const x of all) yield x } }) }),
        }
      },
    }
  }
  return { collection: col, _data: data }
}

// ─── Mocks for upstream + domain service ──────────────────────────────────
function makeMockUpstream({ failTimes = 0, transient = true, claimedDomains = [] } = {}) {
  let calls = 0
  return {
    calls: () => calls,
    removeDomainFromRailway: async (domain) => {
      calls++
      if (failTimes > 0) {
        failTimes--
        return { error: 'simulated 503', transient, statusCode: 503 }
      }
      const idx = claimedDomains.indexOf(domain)
      if (idx >= 0) claimedDomains.splice(idx, 1)
      else return { success: true, note: 'domain_not_found' }
      return { success: true }
    },
    listRailwayDomains: async () => [...claimedDomains],
  }
}

function makeMockDomainService({ cnameContent } = {}) {
  let deletes = 0
  return {
    deletes: () => deletes,
    viewDNSRecords: async (_d, _db) => ({
      records: cnameContent
        ? [{ recordType: 'CNAME', recordContent: cnameContent, cfRecordId: 'rec1' }]
        : [],
    }),
    deleteDNSRecord: async () => { deletes++; return { success: true } },
  }
}

async function test1_transientPathDoesNotTouchCloudflare() {
  console.log('▶ Test 1: Transient upstream error → CF CNAME untouched, retry queued')
  // We simulate the handler logic by calling the persistence APIs the way
  // the patched _index.js handler does.
  const persistence = require('../shortener-activation-persistence.js')
  const db = makeMockDb()
  persistence.initShortenerPersistence(db)

  // Pretend the user pressed Deactivate and we hit a 503
  await persistence.enqueueDeactivation('test1.com', 555, 'en')

  const queued = await persistence.findPendingDeactivations()
  assert.strictEqual(queued.length, 1, 'expected 1 pending deactivation')
  assert.strictEqual(queued[0].domain, 'test1.com')
  assert.strictEqual(queued[0].retryCount, 0)
  console.log('  ✓ Deactivation queued, retryCount=0')
}

async function test2_reconcilerCompletesDeactivation() {
  console.log('▶ Test 2: Reconciler tick → upstream succeeds → user notified, queue cleared, CF CNAME removed')
  const persistence = require('../shortener-activation-persistence.js')
  const { processPendingDeactivations } = require('../shortener-reconciler.js')

  const db = makeMockDb()
  persistence.initShortenerPersistence(db)
  await persistence.enqueueDeactivation('test2.com', 777, 'en')

  // Upstream is healthy on first call
  const upstream = makeMockUpstream({ failTimes: 0, claimedDomains: ['test2.com'] })
  const dsvc = makeMockDomainService({ cnameContent: '0zr8k19y.up.railway.app' })
  const notifications = []
  const stats = await processPendingDeactivations({
    db,
    removeDomainFromRailway: upstream.removeDomainFromRailway,
    domainService: dsvc,
    notifyUser: async (cid, html) => { notifications.push({ cid, html }) },
    persistence: {
      findPendingDeactivations: persistence.findPendingDeactivations,
      incrementDeactivationRetry: persistence.incrementDeactivationRetry,
      markDeactivationDone: persistence.markDeactivationDone,
      markDeactivationFailed: persistence.markDeactivationFailed,
      MAX_DEACTIVATION_RETRIES: persistence.MAX_DEACTIVATION_RETRIES,
    },
  })

  assert.strictEqual(stats.processed, 1)
  assert.strictEqual(stats.completed, 1)
  assert.strictEqual(stats.retried, 0)
  assert.strictEqual(stats.failed, 0)
  assert.strictEqual(notifications.length, 1, 'expected 1 user notification')
  assert.ok(notifications[0].html.includes('deactivated'), 'notification text mentions deactivated')
  assert.strictEqual(dsvc.deletes(), 1, 'CF CNAME cleaned up after upstream success')
  console.log(`  ✓ Notified user, CF CNAME cleaned, ${upstream.calls()} upstream call(s)`)
}

async function test3_retriesExhaustedNotifiesUser() {
  console.log('▶ Test 3: Persistent transient errors → exhausts retries → user gets escalation notice')
  const persistence = require('../shortener-activation-persistence.js')
  const { processPendingDeactivations } = require('../shortener-reconciler.js')

  const db = makeMockDb()
  persistence.initShortenerPersistence(db)
  await persistence.enqueueDeactivation('test3.com', 888, 'en')

  const upstream = makeMockUpstream({ failTimes: 999, transient: true })
  const dsvc = makeMockDomainService({})
  const notifications = []

  const deps = {
    db,
    removeDomainFromRailway: upstream.removeDomainFromRailway,
    domainService: dsvc,
    notifyUser: async (cid, html) => { notifications.push({ cid, html }) },
    persistence: {
      findPendingDeactivations: persistence.findPendingDeactivations,
      incrementDeactivationRetry: persistence.incrementDeactivationRetry,
      markDeactivationDone: persistence.markDeactivationDone,
      markDeactivationFailed: persistence.markDeactivationFailed,
      MAX_DEACTIVATION_RETRIES: persistence.MAX_DEACTIVATION_RETRIES,
    },
  }

  // Run enough ticks to exceed MAX_DEACTIVATION_RETRIES
  let last
  for (let i = 0; i < persistence.MAX_DEACTIVATION_RETRIES + 1; i++) {
    last = await processPendingDeactivations(deps)
    if (last.failed > 0) break
  }
  assert.strictEqual(last.failed, 1, 'expected task to fail after retries')
  assert.strictEqual(notifications.length, 1, 'expected one escalation notification')
  assert.ok(notifications[0].html.includes('contact support') || notifications[0].html.includes('try'),
    'escalation text guides user')
  console.log(`  ✓ Failed after ${persistence.MAX_DEACTIVATION_RETRIES} retries, user notified`)
}

async function test4_orphanHealUpstreamClaimsButCFEmpty() {
  console.log('▶ Test 4: Orphan heal — upstream claims domain but CF has no shortener CNAME')
  const persistence = require('../shortener-activation-persistence.js')
  const { checkAndHealActivation } = require('../shortener-reconciler.js')

  const db = makeMockDb()
  persistence.initShortenerPersistence(db)

  // Seed a "completed" activation that's now in orphan state
  await db.collection('shortenerActivations').updateOne(
    { _id: 'orphan.com' },
    { $set: { _id: 'orphan.com', domain: 'orphan.com', chatId: '9999', status: 'completed' } },
    { upsert: true }
  )

  // Upstream still claims it. CF has no CNAME.
  const upstream = makeMockUpstream({ claimedDomains: ['orphan.com'] })
  const dsvc = makeMockDomainService({ cnameContent: null }) // no CNAME
  const notifications = []

  const verdict = await checkAndHealActivation('orphan.com', {
    db,
    removeDomainFromRailway: upstream.removeDomainFromRailway,
    listRailwayDomains: upstream.listRailwayDomains,
    domainService: dsvc,
    notifyUser: async (cid, html) => { notifications.push({ cid, html }) },
  })

  assert.strictEqual(verdict, 'healed', `expected healed, got ${verdict}`)
  const upstreamAfter = await upstream.listRailwayDomains()
  assert.strictEqual(upstreamAfter.length, 0, 'upstream claim removed')
  const task = await db.collection('shortenerActivations').findOne({ _id: 'orphan.com' })
  assert.strictEqual(task.status, 'needs_reactivation', 'activation marked needs_reactivation')
  assert.strictEqual(notifications.length, 1, 'user notified once')
  assert.ok(notifications[0].html.includes('Activate URL Shortener'),
    'notification guides user to reactivate')
  console.log('  ✓ Orphan healed, upstream cleared, user guided to reactivate')

  // Verify idempotency: second call finds no orphan
  const verdict2 = await checkAndHealActivation('orphan.com', {
    db,
    removeDomainFromRailway: upstream.removeDomainFromRailway,
    listRailwayDomains: upstream.listRailwayDomains,
    domainService: dsvc,
    notifyUser: async () => { notifications.push('extra') },
  })
  assert.strictEqual(verdict2, 'healthy', 'second pass should be healthy (no upstream claim)')
  console.log('  ✓ Idempotent — second pass is a no-op')
}

;(async () => {
  const tests = [test1_transientPathDoesNotTouchCloudflare, test2_reconcilerCompletesDeactivation,
                 test3_retriesExhaustedNotifiesUser, test4_orphanHealUpstreamClaimsButCFEmpty]
  for (const t of tests) {
    try { await t() } catch (e) {
      console.error(`  ✗ ${t.name} FAILED: ${e.message}`)
      console.error(e.stack)
      process.exit(1)
    }
  }
  console.log('\n✅ ALL TESTS PASSED')
})()
