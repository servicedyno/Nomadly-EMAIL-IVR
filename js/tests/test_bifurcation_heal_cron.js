/**
 * Unit test — bifurcation heal cron wrapper.
 *
 * Verifies the module exports the right shape, init() schedules a job, and
 * runOnce() invokes the heal script with the correct options and surfaces
 * a Telegram admin DM only when there are findings.
 */
const Module = require('module')

let passed = 0
let failed = 0
function assert(name, cond, hint) {
  if (cond) {
    console.log(`  ✓ ${name}`)
    passed++
  } else {
    console.log(`  ✗ ${name}${hint ? ' — ' + hint : ''}`)
    failed++
  }
}

// Mock node-schedule
const scheduledJobs = []
const fakeSchedule = {
  scheduleJob: (cron, fn) => {
    scheduledJobs.push({ cron, fn })
    return { name: 'job' }
  },
}

// Mock heal script
let healCallArgs = null
let healReturnValue = { summary: { OK: 5, A: 0, B: 0, C: 0, ERROR: 0 }, results: [] }
const fakeHeal = {
  runHealSweep: async (opts) => {
    healCallArgs = opts
    return healReturnValue
  },
}

// Mock bot
const sentMessages = []
const fakeBot = {
  sendMessage: async (chatId, body, opts) => {
    sentMessages.push({ chatId, body, opts })
  },
}

const origLoad = Module._load
Module._load = function (req, parent, isMain) {
  if (req === 'node-schedule') return fakeSchedule
  if (req === '/app/scripts/heal_bifurcated_domains') return fakeHeal
  return origLoad.call(this, req, parent, isMain)
}

;(async () => {
  // ── A. Module shape ────────────────────────────────────────────────────
  console.log('A. Module shape')
  delete require.cache[require.resolve('../bifurcation-heal-cron.js')]
  const cron = require('../bifurcation-heal-cron.js')

  assert('A.1 exports init', typeof cron.init === 'function')
  assert('A.2 exports runOnce', typeof cron.runOnce === 'function')

  // ── B. init() schedules a job after boot delay ────────────────────────
  console.log('\nB. init() scheduling')
  scheduledJobs.length = 0
  const fakeDb = {}

  // We can't easily wait 90s — instead, force schedule synchronously by
  // monkey-patching setTimeout to fire instantly.
  const origSetTimeout = global.setTimeout
  global.setTimeout = (fn) => { fn(); return { unref: () => {} } }
  cron.init({ bot: fakeBot, db: fakeDb })
  global.setTimeout = origSetTimeout

  assert('B.1 scheduleJob was called', scheduledJobs.length === 1)
  if (scheduledJobs.length === 1) {
    const job = scheduledJobs[0]
    assert('B.2 cron is daily 03:30 UTC', job.cron === '30 3 * * *', `got '${job.cron}'`)
    assert('B.3 fn is a function', typeof job.fn === 'function')
  }

  // ── C. init() is idempotent (calling twice should NOT double-schedule) ─
  console.log('\nC. init() idempotency')
  scheduledJobs.length = 0
  global.setTimeout = (fn) => { fn(); return { unref: () => {} } }
  cron.init({ bot: fakeBot, db: fakeDb })  // second call
  global.setTimeout = origSetTimeout
  assert('C.1 second init() does NOT schedule again', scheduledJobs.length === 0)

  // ── D. runOnce() invokes heal with correct args ───────────────────────
  console.log('\nD. runOnce() invocation')
  healCallArgs = null
  sentMessages.length = 0
  await cron.runOnce({ bot: fakeBot, db: fakeDb, admin: '12345', apply: 'A,B' })

  assert('D.1 heal.runHealSweep was called', !!healCallArgs)
  if (healCallArgs) {
    assert('D.2 db passed through', healCallArgs.db === fakeDb)
    assert('D.3 apply mode is A,B', healCallArgs.apply === 'A,B')
  }
  assert('D.4 no admin DM when summary is all-OK', sentMessages.length === 0,
    `unexpectedly sent: ${JSON.stringify(sentMessages)}`)

  // ── E. runOnce() DMs admin when findings exist ────────────────────────
  console.log('\nE. runOnce() admin alert on findings')
  healReturnValue = {
    summary: { OK: 100, A: 3, B: 1, C: 2, ERROR: 0 },
    results: [
      { category: 'C', domain: 'orphan1.com' },
      { category: 'C', domain: 'orphan2.net' },
    ],
  }
  sentMessages.length = 0
  await cron.runOnce({ bot: fakeBot, db: fakeDb, admin: '12345', apply: 'A,B' })

  assert('E.1 admin DM was sent', sentMessages.length === 1)
  if (sentMessages.length === 1) {
    const m = sentMessages[0]
    assert('E.2 sent to correct admin', m.chatId === '12345')
    assert('E.3 body mentions A-healed', /A-healed.*3|A.*auto-healed.*3|A.*3/i.test(m.body) || m.body.includes('3'),
      `body: ${m.body.slice(0, 200)}`)
    assert('E.4 body lists C orphans', m.body.includes('orphan1.com') && m.body.includes('orphan2.net'))
    assert('E.5 HTML parse_mode', m.opts?.parse_mode === 'HTML')
  }

  // ── F. runOnce() handles heal exceptions ──────────────────────────────
  console.log('\nF. runOnce() exception handling')
  fakeHeal.runHealSweep = async () => { throw new Error('CF API down') }
  sentMessages.length = 0
  let crashed = false
  try {
    await cron.runOnce({ bot: fakeBot, db: fakeDb, admin: '12345', apply: 'A,B' })
  } catch {
    crashed = true
  }
  assert('F.1 runOnce does NOT throw on heal exception', !crashed)
  assert('F.2 admin DM on exception', sentMessages.length === 1 && /FAILED/i.test(sentMessages[0]?.body || ''))

  Module._load = origLoad

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
})().catch(e => { console.error('Unexpected:', e); process.exit(1) })
