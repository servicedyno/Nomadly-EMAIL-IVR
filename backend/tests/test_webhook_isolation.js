/**
 * Regression test: a dev/preview pod must NEVER overwrite the production
 * Telegram webhook URL.
 *
 * Context (2026-06-12): the project-environment .env had BOT_ENVIRONMENT=
 * "production" + a Railway production SELF_URL. When `setup-nodejs.sh` ran on
 * a dev pod it rewrote SELF_URL to the dev pod's preview URL, and the bot's
 * `setupTelegramWebhook()` then called `bot.setWebHook(devPodUrl)` on the
 * PRODUCTION Telegram bot — silently rerouting all real user traffic to the
 * dev pod. Result: 16+ hours of prod webhooks hitting the dev pod, `/credit`
 * admin commands not visible in Railway logs, and Telegram logging
 * "Wrong response from the webhook: 404 Not Found" during every supervisor
 * restart.
 *
 * The fix introduced two interlocking guards:
 *   1. SKIP_WEBHOOK_SYNC=true in .env causes setupTelegramWebhook() to skip
 *      bot.setWebHook entirely and preserve whatever URL is registered.
 *   2. setup-nodejs.sh refuses to rewrite SELF_URL / SELF_URL_PROD when
 *      BOT_ENVIRONMENT=production.
 *
 * This test pins both guards.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

function run(name, fn) {
  try {
    fn()
    console.log('✓', name)
  } catch (e) {
    console.error('✗', name, '\n   ', e.stack || e.message)
    process.exitCode = 1
  }
}

// ── 1. SKIP_WEBHOOK_SYNC gate in setupTelegramWebhook() ──────────────────
run('setupTelegramWebhook honors SKIP_WEBHOOK_SYNC=true (no setWebHook call)', () => {
  // The webhook setup logic is a private function inside _index.js, so we
  // grep the source for the exact guard pattern + ordering. Inline string
  // matching is faster (and more reliable for a 37k-line file) than booting
  // the whole bot in a sandbox just to assert a branch was taken.
  const src = fs.readFileSync(path.resolve(__dirname, '../../js/_index.js'), 'utf8')

  // The guard must appear inside setupTelegramWebhook and BEFORE the call to
  // bot.setWebHook(webhookUrl, ...).
  const fnIdx = src.indexOf('const setupTelegramWebhook = async')
  assert.ok(fnIdx > -1, 'setupTelegramWebhook function not found in js/_index.js')
  const fnSlice = src.substring(fnIdx, fnIdx + 5000)

  const guardIdx = fnSlice.indexOf("process.env.SKIP_WEBHOOK_SYNC === 'true'")
  assert.ok(guardIdx > -1, 'SKIP_WEBHOOK_SYNC guard missing in setupTelegramWebhook')

  const setIdx = fnSlice.indexOf('bot.setWebHook(webhookUrl')
  assert.ok(setIdx > -1, 'bot.setWebHook(webhookUrl, …) call not found in setupTelegramWebhook')
  assert.ok(guardIdx < setIdx,
    'SKIP_WEBHOOK_SYNC guard must appear BEFORE bot.setWebHook(webhookUrl, …) call ' +
    `(found guard at ${guardIdx}, setWebHook at ${setIdx})`)
})

// ── 2. setup-nodejs.sh refuses prod rewrites ─────────────────────────────
run('setup-nodejs.sh refuses to rewrite SELF_URL when BOT_ENVIRONMENT=production', () => {
  const sh = fs.readFileSync(path.resolve(__dirname, '../../scripts/setup-nodejs.sh'), 'utf8')

  // Guard reads BOT_ENVIRONMENT from .env
  assert.ok(/BOT_ENV=.*grep.*BOT_ENVIRONMENT/.test(sh),
    'setup-nodejs.sh must read BOT_ENVIRONMENT from /app/backend/.env')

  // Guard refuses on production
  assert.ok(/BOT_ENV.*=.*"production"|BOT_ENV.*=.*production/.test(sh),
    'setup-nodejs.sh must check for BOT_ENVIRONMENT=production')
  assert.ok(/SKIP_SELF_URL_UPDATE=1/.test(sh),
    'setup-nodejs.sh must set SKIP_SELF_URL_UPDATE=1 to short-circuit the rewrite')

  // The actual sed rewrite must be gated by SKIP_SELF_URL_UPDATE
  const sedIdx = sh.indexOf('sed -i "s|^SELF_URL=')
  const gateIdx = sh.indexOf('if [ -z "$SKIP_SELF_URL_UPDATE" ]')
  assert.ok(sedIdx > -1, 'sed rewrite for SELF_URL not found')
  assert.ok(gateIdx > -1, 'gate `if [ -z "$SKIP_SELF_URL_UPDATE" ]` not found')
  assert.ok(gateIdx < sedIdx,
    'sed rewrite must be wrapped in the SKIP_SELF_URL_UPDATE gate ' +
    `(gate at ${gateIdx}, first sed at ${sedIdx})`)
})

// ── 3. Current /app/backend/.env is in dev mode (post-fix posture check) ──
run('/app/backend/.env runs this pod in development mode with SKIP_WEBHOOK_SYNC=true', () => {
  // This is a defensive check so a future fork or `setup-nodejs.sh` accidentally
  // flipping the pod back to production mode will fail this test.
  const env = fs.readFileSync('/app/backend/.env', 'utf8')
  assert.ok(/^BOT_ENVIRONMENT=("?)development\1?$/m.test(env),
    'BOT_ENVIRONMENT must be "development" on a preview pod')
  assert.ok(/^SKIP_WEBHOOK_SYNC=("?)true\1?$/m.test(env),
    'SKIP_WEBHOOK_SYNC must be "true" on a preview pod')
})

if (!process.exitCode) console.log('\nAll webhook-isolation regression tests passed.')
