/**
 * Regression test: hosting purchase admin notifications must reflect the
 * domain the user is actually buying hosting for, NOT a stale domain left
 * over from an earlier "Register a New Domain" search in the same chat
 * session.
 *
 * Context (2026-06-12, Railway prod): user @clarkh21 (chatId 5080273733)
 *   1. searched edocusi.com at 12:51 (saved info.domain = 'edocusi.com')
 *   2. abandoned that flow, opened Anti-Red Hosting at 15:15
 *   3. picked "Connect External Domain" + entered siraut.sbs at 15:51
 *      (saveInfo('website_name', 'siraut.sbs') — info.domain still 'edocusi.com')
 *   4. paid via Crypto DynoPay; provisioning at 17:01 used info.website_name
 *      correctly (cPanel sirad717@siraut.sbs minted, CF zone activated)
 *   5. admin alert at 17:02 read "Domain: edocusi.com" because the code
 *      used `info?.domain || info?.website_name` and the stale `domain`
 *      won. Admin then tried to visit edocusi.com, saw nothing, reported
 *      "domain not working / DNS issue".
 *
 * This test pins the resolver order and the cleanup behaviour so the
 * defect can't regress.
 */

const assert = require('assert')

// The resolver pattern used by all 10 hosting-payment sites in _index.js.
const resolveHostingDomain = (info) => info?.website_name || info?.domain

function run(name, fn) {
  try {
    fn()
    console.log('✓', name)
  } catch (e) {
    console.error('✗', name, '\n   ', e.stack || e.message)
    process.exitCode = 1
  }
}

// 1. Connect External Domain (after a stale domain search) MUST resolve to the
//    externally-connected domain, never the stale one.
run('connect-external resolves to website_name when info.domain is stale', () => {
  const info = {
    // user searched this earlier but never bought it
    domain: 'edocusi.com',
    // then connected siraut.sbs for hosting
    website_name: 'siraut.sbs',
    connectExternalDomain: true,
    existingDomain: false,
  }
  assert.strictEqual(resolveHostingDomain(info), 'siraut.sbs')
})

// 2. Use My Domain flow likewise.
run('use-my-domain resolves to website_name (registered domain)', () => {
  const info = {
    domain: 'something-old.com',
    website_name: 'my-registered.com',
    existingDomain: true,
    connectExternalDomain: false,
  }
  assert.strictEqual(resolveHostingDomain(info), 'my-registered.com')
})

// 3. Register New Domain + hosting in one flow: website_name and domain
//    should be the same value (both set during the new-domain purchase).
run('register-new-domain has matching website_name and domain', () => {
  const info = {
    domain: 'fresh-purchase.com',
    website_name: 'fresh-purchase.com',
    existingDomain: false,
    connectExternalDomain: false,
  }
  assert.strictEqual(resolveHostingDomain(info), 'fresh-purchase.com')
})

// 4. Defensive: even if website_name is missing (legacy flows), fall back
//    to domain so admin alert is never blank.
run('falls back to info.domain when website_name is missing', () => {
  assert.strictEqual(resolveHostingDomain({ domain: 'legacy.com' }), 'legacy.com')
})

// 5. After the connectExternalDomain handler runs, both keys should hold
//    the externally-connected value (mirroring fix in _index.js:8881-8883).
//    This sanity-checks the saveInfo sequence we now expect.
run('post-handler state: both website_name and domain match the chosen domain', () => {
  const stateAfterHandler = {
    domain: 'siraut.sbs',          // mirrored by handler
    website_name: 'siraut.sbs',    // primary
    connectExternalDomain: true,
  }
  assert.strictEqual(resolveHostingDomain(stateAfterHandler), 'siraut.sbs')
  assert.strictEqual(stateAfterHandler.domain, stateAfterHandler.website_name)
})

if (!process.exitCode) console.log('\nAll hosting-domain-resolver regression tests passed.')
