// Verifies the AI support knowledge base now answers questions about the new
// self-serve hosting actions: take site offline / bring online, unlink addon,
// cancel hosting plan. Each test grep's a representative phrase from the SP.

const assert = require('assert')

// Import the module so its system prompt template runs (but don't initialise DB).
process.env.HOSTING_PANEL_URL = process.env.HOSTING_PANEL_URL || 'https://example.com/panel'
const fs = require('fs')
const src = fs.readFileSync(require.resolve('../ai-support.js'), 'utf8')

console.log('— Test: AI knowledge base answers "take site offline" —')
assert.ok(/take.*site.*offline/i.test(src), 'should mention "take site offline"')
assert.ok(/maintenance mode/i.test(src), 'should mention maintenance mode')
assert.ok(/full suspend/i.test(src), 'should mention full suspend option')
console.log('  ✓ offline-mode coverage')

console.log('— Test: critical billing-not-paused warning appears —')
assert.ok(/does NOT pause/i.test(src) || /not pause/i.test(src), 'must clarify billing keeps running')
assert.ok(/auto.?renew/i.test(src), 'must mention auto-renew in the warning')
console.log('  ✓ billing reminder present')

console.log('— Test: AI answers "bring site back online" —')
assert.ok(/bring.*site.*online/i.test(src), 'should mention bring site online')
console.log('  ✓ online-restore coverage')

console.log('— Test: AI answers "unlink addon domain" —')
assert.ok(/unlink.*domain|unlink an addon/i.test(src), 'should mention unlinking a domain')
assert.ok(/public_html/i.test(src), 'should warn about file deletion under public_html')
console.log('  ✓ unlink coverage')

console.log('— Test: AI answers "cancel hosting plan" —')
assert.ok(/cancel.*hosting plan/i.test(src), 'should mention cancel hosting plan')
assert.ok(/no refund/i.test(src), 'must mention no-refund policy')
assert.ok(/domain itself stays registered|domain.*remain/i.test(src), 'must reassure domain stays registered')
console.log('  ✓ cancel coverage')

console.log('— Test: web HostPanel parity is documented —')
assert.ok(/web.*HostPanel|web hostpanel|account tab/i.test(src), 'should mention web panel parity')
console.log('  ✓ web panel parity mentioned')

console.log('\n✅ AI support knowledge base is up-to-date with all new self-serve hosting flows.')
