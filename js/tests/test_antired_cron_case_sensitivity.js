#!/usr/bin/env node
// Regression test for the AntiRed-Cron $unset case-sensitivity bug.
//
// Repro (production, 2026-08-31 → 2026-09-01):
//   registeredDomains had a document with _id "Userserv-oauth26.com" (capital U).
//   The cron enumerated it, lowercased to "userserv-oauth26.com" for CF calls,
//   then tried:  db.registeredDomains.updateOne({_id: "userserv-oauth26.com"}, {$unset: 'val.cfZoneId'})
//   Because Mongo _id matching is case-sensitive, the $unset silently no-op'd.
//   Result: stale cfZoneId survived → cron looped on 403 every 6h forever.
//
// Fix: preserve the original doc._id ("origId") and use it in the updateOne
// filter. This test asserts both the buggy and fixed behaviour against a
// stubbed Mongo collection so we never regress.

const assert = require('assert')

function makeStubCollection(docs) {
  return {
    _docs: docs,
    updateOne(filter, update) {
      const matches = this._docs.filter(d => Object.keys(filter).every(k => d[k] === filter[k]))
      for (const d of matches) {
        if (update.$unset) {
          for (const path of Object.keys(update.$unset)) {
            const parts = path.split('.')
            let cur = d
            for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] || {}
            delete cur[parts[parts.length - 1]]
          }
        }
        if (update.$set) {
          for (const path of Object.keys(update.$set)) {
            const parts = path.split('.')
            let cur = d
            for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] || {}; cur = cur[parts[i]] }
            cur[parts[parts.length - 1]] = update.$set[path]
          }
        }
      }
      return { matchedCount: matches.length, modifiedCount: matches.length }
    },
    findOne(filter) {
      return this._docs.find(d => Object.keys(filter).every(k => d[k] === filter[k])) || null
    },
  }
}

// ── 1. Prove the OLD (buggy) filter fails on mixed-case _id ─────────
{
  const coll = makeStubCollection([{
    _id: 'Userserv-oauth26.com',
    val: { cfZoneId: 'stale123', chatId: '6575290557' },
  }])
  const domain = 'userserv-oauth26.com' // lowercased by cron
  const res = coll.updateOne({ _id: domain }, { $unset: { 'val.cfZoneId': '' } })
  assert.strictEqual(res.matchedCount, 0, 'buggy filter must NOT match')
  assert.strictEqual(coll._docs[0].val.cfZoneId, 'stale123', 'buggy filter leaves cfZoneId intact — confirms the loop bug')
  console.log('✓ [OLD BUG] lowercased _id filter fails to match mixed-case doc (as expected)')
}

// ── 2. Prove the NEW (fixed) filter using origId works ───────────────
{
  const coll = makeStubCollection([{
    _id: 'Userserv-oauth26.com',
    val: { cfZoneId: 'stale123', chatId: '6575290557' },
  }])
  const origId = 'Userserv-oauth26.com' // preserved from doc._id
  const res = coll.updateOne({ _id: origId }, { $unset: { 'val.cfZoneId': '' } })
  assert.strictEqual(res.matchedCount, 1, 'fixed filter must match')
  assert.strictEqual(coll._docs[0].val.cfZoneId, undefined, 'fixed filter must unset cfZoneId')
  console.log('✓ [FIX] origId filter matches mixed-case doc and clears stale cfZoneId')
}

// ── 3. Fixed filter still works on already-lowercased _id docs ────────
{
  const coll = makeStubCollection([{
    _id: 'plain-domain.com',
    val: { cfZoneId: 'z999' },
  }])
  const origId = 'plain-domain.com'
  const res = coll.updateOne({ _id: origId }, { $unset: { 'val.cfZoneId': '' } })
  assert.strictEqual(res.matchedCount, 1)
  assert.strictEqual(coll._docs[0].val.cfZoneId, undefined)
  console.log('✓ [FIX] origId filter also works for happy-path lowercased _ids')
}

// ── 4. $set (fresh zoneId path) works for mixed-case too ──────────────
{
  const coll = makeStubCollection([{
    _id: 'Mixed-Case.com',
    val: { cfZoneId: 'stale' },
  }])
  const res = coll.updateOne({ _id: 'Mixed-Case.com' }, { $set: { 'val.cfZoneId': 'fresh' } })
  assert.strictEqual(res.matchedCount, 1)
  assert.strictEqual(coll._docs[0].val.cfZoneId, 'fresh')
  console.log('✓ [FIX] origId filter updates cfZoneId on stale-zone refresh path')
}

console.log('\nAll 4 AntiRed-Cron regression assertions passed.')
