/**
 * Smoke test for the URL shortener fixes:
 *  1. Bitly path — shortens DESTINATION directly (no Railway hop)
 *  2. RapidAPI random — shortens DESTINATION directly (no Railway hop)
 *  3. Custom alias — uses user's alias as slug on SELF_URL (no third-party call)
 *  4. getBitlyClicks helper works
 *
 * No DB writes, no Telegram calls — just verifies the underlying functions.
 */
require('dotenv').config()
const axios = require('axios')

const DEST = 'https://example.com/landing-page-' + Date.now()
let pass = 0, fail = 0
const results = []

function assert(name, cond, detail) {
  if (cond) { pass++; results.push(`✅ ${name}`); console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`) }
  else      { fail++; results.push(`❌ ${name}${detail ? ' — ' + detail : ''}`); console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`) }
}

;(async () => {
  console.log('━'.repeat(70))
  console.log('  URL SHORTENER FIX — SMOKE TEST')
  console.log('━'.repeat(70))
  console.log(`Destination URL: ${DEST}\n`)

  // ── Test 1: Bitly direct destination shortening ──
  console.log('── 1. Bitly: shorten destination directly ──')
  try {
    const { createShortBitly, isBitlyUrl, getBitlyClicks } = require('./js/bitly.js')
    const bitlyShort = await createShortBitly(DEST)
    console.log(`  Bitly returned: ${bitlyShort}`)
    assert('Bitly returns bit.ly URL', isBitlyUrl(bitlyShort), bitlyShort)

    // Follow the bitly link with HEAD/GET (no follow) to verify it points DIRECTLY at DEST
    const r = await axios.get(bitlyShort, { maxRedirects: 0, validateStatus: () => true })
    const loc = r.headers.location || ''
    console.log(`  HTTP ${r.status} → Location: ${loc}`)
    assert('Bitly redirects DIRECTLY to destination (no Railway hop)',
      loc === DEST,
      `expected ${DEST}, got ${loc}`)

    // Verify clicks helper
    const clicks = await getBitlyClicks(bitlyShort)
    console.log(`  Clicks reported by Bitly API: ${clicks}`)
    assert('getBitlyClicks returns numeric value', typeof clicks === 'number', `value=${clicks}`)
  } catch (e) {
    fail++
    console.log(`  ❌ Bitly test errored: ${e.message}`)
  }

  // ── Test 2: RapidAPI random direct destination shortening ──
  console.log('\n── 2. RapidAPI: shorten destination directly ──')
  try {
    const { createShortUrlApi } = require('./js/cuttly.js')
    const rapidShort = await createShortUrlApi(DEST)
    console.log(`  RapidAPI returned: ${rapidShort}`)
    assert('RapidAPI returns a non-empty short URL', rapidShort && rapidShort.startsWith('http'), rapidShort)

    // Follow it. RapidAPI shorteners usually require ?param or actual GET to redirect.
    const r = await axios.get(rapidShort, { maxRedirects: 0, validateStatus: () => true, timeout: 15000 })
    const loc = r.headers.location || ''
    console.log(`  HTTP ${r.status} → Location: ${loc}`)
    // RapidAPI may redirect via 301/302 — verify location is the destination, not a railway URL
    assert('RapidAPI redirects to destination (not Railway URL)',
      loc === DEST || loc.startsWith(DEST.split('?')[0]),
      `expected ${DEST}, got ${loc}`)
    assert('Redirect target does NOT contain "railway"',
      !loc.toLowerCase().includes('railway'),
      `loc=${loc}`)
  } catch (e) {
    fail++
    console.log(`  ❌ RapidAPI test errored: ${e.message}`)
  }

  // ── Test 3: Custom alias path — verify in code (no live test possible without bot) ──
  console.log('\n── 3. Custom alias path: code-level verification ──')
  const fs = require('fs')
  const indexJs = fs.readFileSync('/app/js/_index.js', 'utf8')

  assert('createCustomShortUrlCuttly is no longer required',
    !indexJs.includes("require('./customCuttly.js')"),
    'old require statement removed')

  // The new custom path should use the user's alias as slug
  assert('Custom alias path uses ${SELF_URL}/${alias} as the short URL',
    indexJs.includes('const __shortUrl = `${SELF_URL}/${alias}`'),
    'alias is now the slug')

  // Validation: 3-32 chars, allowed charset
  assert('Custom alias validated against /^[A-Za-z0-9_-]{3,32}$/',
    indexJs.includes('/^[A-Za-z0-9_-]{3,32}$/.test(alias)'),
    'regex enforced')

  // Reserved words enforced
  assert('Custom alias rejects reserved words (panel, login, etc.)',
    indexJs.includes("'panel'") && indexJs.includes("'login'") && indexJs.includes('reserved.has'),
    'reserved set used')

  // Uniqueness check
  assert('Custom alias checks uniqueness against fullUrlOf',
    /if\s*\(\s*await\s+get\(\s*fullUrlOf\s*,\s*shortUrl\s*\)\s*\)\s*{[\s\S]{0,120}linkAlreadyExist/.test(indexJs),
    'collision check before write')

  // ── Test 4: Bitly handler in _index.js patched ──
  console.log('\n── 4. Bitly handler in _index.js — call-site verification ──')
  assert('Bitly handler now calls createShortBitly(url) not (__shortUrl)',
    indexJs.includes('_shortUrl = await createShortBitly(url)'),
    'destination URL is shortened')
  assert('RapidAPI random handler now calls createShortUrlApi(url) not (__shortUrl)',
    indexJs.includes('_shortUrl = await createShortUrlApi(url)'),
    'destination URL is shortened')
  assert('My Links view wired to getBitlyClicks for bit.ly links',
    indexJs.includes('isBitlyUrl(maskUrl)') && indexJs.includes('getBitlyClicks(maskUrl)'),
    'Bitly stats integration in getShortLinks()')

  // ── Summary ──
  console.log('\n' + '━'.repeat(70))
  console.log(`  RESULT: ${pass} passed, ${fail} failed`)
  console.log('━'.repeat(70))
  results.forEach(r => console.log('  ' + r))
  process.exit(fail > 0 ? 1 : 0)
})().catch(err => {
  console.error('Test harness crashed:', err)
  process.exit(2)
})
