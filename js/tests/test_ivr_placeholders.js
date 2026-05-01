/**
 * Tests for IVR placeholder validation.
 *
 * Bugs reproduced & fixed (from 2026-04-30 production logs):
 *   - Two campaigns went out with literal "[Name]", "[bank]", "$[Amount]",
 *     "[name]" in the call audio because fillTemplate was case-sensitive AND
 *     no post-substitution validation caught the leftover tokens.
 *
 * Run with: node js/tests/test_ivr_placeholders.js
 */

const ivrOb = require('../ivr-outbound')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} — ${note}`) }
}

// ─── fillTemplate — case-insensitive substitution ─────────

ok(
  'exact-case substitution still works',
  ivrOb.fillTemplate('Hello [Name]', { Name: 'Alice' }) === 'Hello Alice',
)
ok(
  'lowercase placeholder, capital key — substitutes (regression: production bug)',
  ivrOb.fillTemplate('Hello [name]', { Name: 'Alice' }) === 'Hello Alice',
)
ok(
  'capital placeholder, lowercase key — substitutes',
  ivrOb.fillTemplate('Hello [Name]', { name: 'Alice' }) === 'Hello Alice',
)
ok(
  'mixed-case placeholder & values',
  ivrOb.fillTemplate('Hi [BANK] from [name]', { Bank: 'Chase', Name: 'Alice' })
    === 'Hi Chase from Alice',
)
ok(
  '$[Amount] dollar prefix is preserved (regression: production bug)',
  ivrOb.fillTemplate('Refund of $[Amount] processed', { Amount: '500' })
    === 'Refund of $500 processed',
)
ok(
  'multiple occurrences of same placeholder',
  ivrOb.fillTemplate('[Name] said [Name] is here', { Name: 'Bob' })
    === 'Bob said Bob is here',
)
ok(
  'whitespace inside brackets is tolerated',
  ivrOb.fillTemplate('Hello [ Name ]', { Name: 'Alice' }) === 'Hello Alice',
)
ok(
  'unfilled placeholder is preserved (NOT silently dropped)',
  ivrOb.fillTemplate('Hello [Name] from [Bank]', { Name: 'Alice' })
    === 'Hello Alice from [Bank]',
)
ok(
  'empty values are NOT substituted (treated as unfilled)',
  ivrOb.fillTemplate('Hello [Name]', { Name: '' }) === 'Hello [Name]',
)
ok(
  'null values are NOT substituted',
  ivrOb.fillTemplate('Hello [Name]', { Name: null }) === 'Hello [Name]',
)
ok(
  'undefined values are NOT substituted',
  ivrOb.fillTemplate('Hello [Name]', { Name: undefined }) === 'Hello [Name]',
)
ok(
  'empty text returns empty',
  ivrOb.fillTemplate('', { Name: 'x' }) === '',
)
ok(
  'null text returns empty',
  ivrOb.fillTemplate(null, { Name: 'x' }) === '',
)
ok(
  'numeric values get coerced to string',
  ivrOb.fillTemplate('Refund $[Amount]', { Amount: 500 }) === 'Refund $500',
)

// ─── validateFilled — detect leftover placeholders ──────

ok(
  'fully filled text → ok=true, unfilled=[]',
  (() => {
    const r = ivrOb.validateFilled('Hello Alice from Chase, refund $500')
    return r.ok === true && r.unfilled.length === 0
  })(),
)
ok(
  'one leftover placeholder is detected',
  (() => {
    const r = ivrOb.validateFilled('Hello Alice from [Bank]')
    return r.ok === false && r.unfilled.length === 1 && r.unfilled[0] === 'Bank'
  })(),
)
ok(
  'multiple leftover placeholders are deduped (case-insensitive)',
  (() => {
    const r = ivrOb.validateFilled('Hello [Name] / [name] from [Bank]')
    return r.ok === false && r.unfilled.length === 2
      && r.unfilled.includes('Name') && r.unfilled.includes('Bank')
  })(),
)
ok(
  '$[Amount] leftover is detected',
  (() => {
    const r = ivrOb.validateFilled('Refund of $[Amount] processed')
    return r.ok === false && r.unfilled.includes('Amount')
  })(),
)
ok(
  'prose with non-identifier brackets is NOT flagged (e.g. [Company XYZ Inc])',
  (() => {
    const r = ivrOb.validateFilled('Greetings from [Company XYZ Inc, est. 2010]')
    return r.ok === true
  })(),
)
ok(
  'underscore in placeholder name is allowed',
  (() => {
    const r = ivrOb.validateFilled('Hello [Card_Last4]')
    return r.ok === false && r.unfilled[0] === 'Card_Last4'
  })(),
)
ok(
  'starts-with-digit is NOT a placeholder (e.g. [123])',
  (() => {
    const r = ivrOb.validateFilled('Press [1] or [2]')
    return r.ok === true
  })(),
)

// ─── End-to-end pipeline (the bug from production) ─────

ok(
  'production bug 1: user typed [name] in script, value provided as Name → fills cleanly',
  (() => {
    const filled = ivrOb.fillTemplate(
      'Hello [name]. This is your bank.',
      { Name: 'Alice' },
    )
    const v = ivrOb.validateFilled(filled)
    return filled === 'Hello Alice. This is your bank.' && v.ok
  })(),
)
ok(
  'production bug 2: $[Amount] with no value → blocks the call',
  (() => {
    const filled = ivrOb.fillTemplate(
      'Refund of $[Amount] processed',
      { Name: 'Alice' },  // user filled Name but forgot Amount
    )
    const v = ivrOb.validateFilled(filled)
    return !v.ok && v.unfilled[0] === 'Amount'
  })(),
)
ok(
  'production bug 3: user back-out leaves [Bank] unfilled → blocks the call',
  (() => {
    const filled = ivrOb.fillTemplate(
      'Hello [Name]. This is [Bank] security.',
      { Name: 'Bob' },
    )
    const v = ivrOb.validateFilled(filled)
    return !v.ok && v.unfilled.includes('Bank') && !v.unfilled.includes('Name')
  })(),
)

// ─── Smart placeholder case-insensitivity ────────────

ok(
  'isSmartPlaceholder("CardLast4") is true (canonical)',
  ivrOb.isSmartPlaceholder('CardLast4') === true,
)
ok(
  'isSmartPlaceholder("cardlast4") is true (lowercase regression)',
  ivrOb.isSmartPlaceholder('cardlast4') === true,
)
ok(
  'isSmartPlaceholder("CARDLAST4") is true (uppercase)',
  ivrOb.isSmartPlaceholder('CARDLAST4') === true,
)
ok(
  'getSmartPlaceholder returns canonical name',
  (() => {
    const sp = ivrOb.getSmartPlaceholder('cardlast4')
    return sp && sp.canonical === 'CardLast4' && sp.type === 'auto'
  })(),
)
ok(
  'generatePlaceholderValue works case-insensitively',
  (() => {
    const v = ivrOb.generatePlaceholderValue('caseid')
    return typeof v === 'string' && v.startsWith('CASE-')
  })(),
)
ok(
  'isSmartPlaceholder("Bank") is false (not in our smart list)',
  ivrOb.isSmartPlaceholder('Bank') === false,
)

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
