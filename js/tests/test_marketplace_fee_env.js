/**
 * Verifies MARKETPLACE_ACCESS_FEE_USD env var changes are picked up at
 * module-load time (the env value is read once when marketplace-service is
 * first required, so this test forks a clean child process for each test).
 */
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')

let pass = 0
let fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

function readFeeWithEnv(feeStr) {
  const env = { ...process.env }
  if (feeStr === null) delete env.MARKETPLACE_ACCESS_FEE_USD
  else env.MARKETPLACE_ACCESS_FEE_USD = feeStr
  // Use a script that DOES NOT load the .env file so our env override sticks.
  // The dotenv.config in tests would otherwise re-overwrite env from .env.
  const code = `
    const ms = require('${path.join(__dirname, '..', 'marketplace-service').replace(/\\/g, '/')}');
    process.stdout.write(String(ms.MARKETPLACE_ACCESS_FEE_USD));
  `
  const res = spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8' })
  return res.stdout.trim()
}

console.log('\n=== MARKETPLACE_ACCESS_FEE_USD env configurability ===')

it('default fee = 50 when env unset', readFeeWithEnv(null) === '50', `got ${readFeeWithEnv(null)}`)
it('fee = 25 with MARKETPLACE_ACCESS_FEE_USD=25', readFeeWithEnv('25') === '25')
it('fee = 100 with MARKETPLACE_ACCESS_FEE_USD=100', readFeeWithEnv('100') === '100')
it('fee = 0 with MARKETPLACE_ACCESS_FEE_USD=0', readFeeWithEnv('0') === '0')
it('garbage env value falls back gracefully to default $50', readFeeWithEnv('not-a-number') === '50', `got ${readFeeWithEnv('not-a-number')}`)
it('negative env value falls back gracefully to default $50', readFeeWithEnv('-10') === '50', `got ${readFeeWithEnv('-10')}`)

console.log(`\n═══ ${pass} passed, ${fail} failed ═══`)
process.exit(fail === 0 ? 0 : 1)
