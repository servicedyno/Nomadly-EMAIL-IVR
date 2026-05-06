/**
 * test_delete_vps_verify.js
 *
 * Unit test for the updated deleteVPSinstance function which now VERIFIES
 * that cancelDate is set after the Contabo cancelInstance call, preventing
 * the "soft success" ghost scenario that silently kept pending_payment
 * instances billing indefinitely.
 *
 * We mock the Contabo module and the vpsPlansOf collection.
 *
 * Run: node /app/js/tests/test_delete_vps_verify.js
 */

const assert = require('assert')
const path = require('path')
const Module = require('module')

let testsRun = 0
let testsPass = 0
function test(name, fn) {
  testsRun++
  return Promise.resolve().then(fn).then(
    () => { testsPass++; console.log(`  ✅ ${name}`) },
    (err) => { console.log(`  ❌ ${name}\n     ${err.message}`) }
  )
}

// ── Mock contabo-service ───────────────────────────────────────────────
const contaboMock = {
  _cancelShouldThrow: false,
  _cancelDateAfter: null,  // what getInstance.cancelDate returns after cancel
  _callLog: [],
  async cancelInstance(id) {
    this._callLog.push(['cancelInstance', id])
    if (this._cancelShouldThrow) throw new Error('Contabo 500')
    return { instanceId: id, status: 'cancelled' }
  },
  async getInstance(id) {
    this._callLog.push(['getInstance', id])
    return { instanceId: id, cancelDate: this._cancelDateAfter, status: this._cancelDateAfter ? 'cancelled' : 'running' }
  },
  reset() { this._cancelShouldThrow = false; this._cancelDateAfter = null; this._callLog = [] }
}

// Intercept require('./contabo-service') from vm-instance-setup.js
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, ...args) {
  if (request === './contabo-service' || request === './contabo-service.js') {
    return path.join(__dirname, '__mock_contabo.js')
  }
  return originalResolve.call(this, request, parent, ...args)
}
require.cache[path.join(__dirname, '__mock_contabo.js')] = {
  id: path.join(__dirname, '__mock_contabo.js'),
  filename: path.join(__dirname, '__mock_contabo.js'),
  loaded: true,
  exports: contaboMock,
  children: [],
  parent: null,
  paths: []
}

const { initVpsDb, deleteVPSinstance } = require('../vm-instance-setup')

// ── Mock _vpsPlansOf collection ────────────────────────────────────────
const dbMock = {
  updates: [],
  collection(name) {
    const self = this
    return {
      collectionName: name,
      async findOne() { return { chatId: '123', vpsId: '456', contaboInstanceId: 789 } },
      async updateOne(q, u) { self.updates.push({ q, u }); return { acknowledged: true } },
      createIndex() { return Promise.resolve() }
    }
  },
  _reset() { this.updates = [] }
}

initVpsDb(dbMock)

async function run() {
  console.log('── deleteVPSinstance verification tests ──\n')

  await test('SUCCESS: cancelInstance + cancelDate set → returns success, DB updated', async () => {
    contaboMock.reset()
    dbMock._reset()
    contaboMock._cancelDateAfter = '2026-05-06T23:00:00Z'
    const result = await deleteVPSinstance('123', '456')
    assert.strictEqual(result.success, true, 'should succeed')
    assert.strictEqual(result.cancelDate, '2026-05-06T23:00:00Z')
    assert.strictEqual(dbMock.updates.length, 1, 'should update DB once')
    const setOp = dbMock.updates[0].u.$set
    assert.strictEqual(setOp.status, 'DELETED')
    assert.strictEqual(setOp.contaboCancelDate, '2026-05-06T23:00:00Z')
    // cancelInstance called once, getInstance polled at least once
    assert.ok(contaboMock._callLog.some(c => c[0] === 'cancelInstance'), 'cancelInstance must be called')
    assert.ok(contaboMock._callLog.some(c => c[0] === 'getInstance'), 'getInstance must be called for verification')
  })

  await test('SOFT-SUCCESS: cancel returns 2xx but cancelDate never set → returns error, DB NOT updated', async () => {
    contaboMock.reset()
    dbMock._reset()
    contaboMock._cancelDateAfter = null // Contabo lies — looks cancelled but isn't
    const result = await deleteVPSinstance('123', '456')
    assert.strictEqual(result.success, undefined, 'should NOT succeed')
    assert.ok(result.error, 'should have error')
    assert.strictEqual(result.softSuccess, true, 'should flag soft-success')
    assert.strictEqual(dbMock.updates.length, 0, 'DB must NOT be updated on soft-success')
    // Polled 3 times before giving up
    const getCalls = contaboMock._callLog.filter(c => c[0] === 'getInstance').length
    assert.strictEqual(getCalls, 3, 'should poll getInstance 3 times')
  })

  await test('HARD-FAILURE: cancelInstance throws → returns error, DB NOT updated', async () => {
    contaboMock.reset()
    dbMock._reset()
    contaboMock._cancelShouldThrow = true
    const result = await deleteVPSinstance('123', '456')
    assert.strictEqual(result.success, undefined)
    assert.ok(result.error && result.error.includes('Contabo 500'))
    assert.strictEqual(dbMock.updates.length, 0, 'DB must NOT be updated on hard failure')
  })

  console.log(`\n── ${testsPass}/${testsRun} passed ──`)
  if (testsPass !== testsRun) process.exit(1)
}

run().catch(e => { console.error('FATAL', e); process.exit(1) })
