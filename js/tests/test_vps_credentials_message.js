// Verifies the VPS/RDP "credentials delivered" message in all 4 language files:
//   1. Password is wrapped in <code>...</code> INSIDE the <tg-spoiler>
//      so Telegram's tap-to-copy works reliably after reveal.
//   2. IP and username are wrapped in <code>...</code> for tap-to-copy.
//   3. A "first-boot setup — wait 2–5 minutes" readiness note is included
//      for Linux (cloud-init race) and 5–10 minutes for RDP/Windows.
//
// Background: bot users (e.g. @spoofed, chat 6996287179) were reporting
// "password not right" right after VPS purchase. Root cause was the
// cloud-init script not finishing before they first SSH'd, plus an
// unreliable copy UX because the password sat in a spoiler without <code>.

const assert = require('assert')
const fs = require('fs')

const LANGS = ['en', 'fr', 'zh', 'hi']

for (const lang of LANGS) {
  const src = fs.readFileSync(require.resolve(`../lang/${lang}.js`), 'utf8')

  console.log(`\n— Lang: ${lang} —`)

  // Find the vpsBoughtSuccess block
  const startIdx = src.indexOf('vpsBoughtSuccess:')
  assert.ok(startIdx !== -1, `${lang}.js must export vpsBoughtSuccess`)
  // Slice a generous window — definition is ~40 lines
  const block = src.slice(startIdx, startIdx + 3000)

  // 1. Password wrapped in <code> inside <tg-spoiler>
  assert.ok(
    /<tg-spoiler><code>\$\{credentials\.password\}<\/code><\/tg-spoiler>/.test(block),
    `${lang}: password must be wrapped in <tg-spoiler><code>...</code></tg-spoiler> for reliable tap-to-copy`
  )
  console.log('  ✓ password wrapped in <code> inside <tg-spoiler>')

  // 2. IP wrapped in <code>
  assert.ok(
    /<code>\$\{response\.host\}<\/code>/.test(block),
    `${lang}: IP (response.host) must be wrapped in <code>...</code>`
  )
  console.log('  ✓ IP wrapped in <code>')

  // 3. Username wrapped in <code>
  assert.ok(
    /<code>\$\{credentials\.username\}<\/code>/.test(block),
    `${lang}: username must be wrapped in <code>...</code>`
  )
  console.log('  ✓ username wrapped in <code>')

  // 4. readinessNote variable declared
  assert.ok(
    /const readinessNote = isRDP/.test(block),
    `${lang}: must declare a readinessNote (RDP vs Linux split)`
  )
  console.log('  ✓ readinessNote variable present')

  // 5. RDP branch mentions ~5–10 min wait
  assert.ok(
    /5[\s\S]{0,5}10\s*(minutes?|分钟|मिनट)/i.test(block),
    `${lang}: RDP/Windows branch must mention 5–10 minute first-boot wait`
  )
  console.log('  ✓ RDP first-boot wait (5–10 min) mentioned')

  // 6. Linux branch mentions 2–5 min wait
  assert.ok(
    /2[\s\S]{0,5}5\s*(minutes?|分钟|मिनट)/i.test(block),
    `${lang}: Linux branch must mention 2–5 minute first-boot wait`
  )
  console.log('  ✓ Linux first-boot wait (2–5 min) mentioned')

  // 7. readinessNote interpolated into the template
  assert.ok(
    /\$\{readinessNote\}/.test(block),
    `${lang}: readinessNote must be inlined into the returned template string`
  )
  console.log('  ✓ readinessNote inlined into output template')
}

console.log('\n✅ VPS credentials delivery message hardened in EN/FR/ZH/HI.')
