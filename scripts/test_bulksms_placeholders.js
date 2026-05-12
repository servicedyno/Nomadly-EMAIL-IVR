/**
 * Unit tests for the BulkSMS contact-parser and [name]-placeholder helpers
 * patched into /app/sms-app/www/js/app.js (Fixes A, B, D).
 *
 * Strategy: extract the App object methods from app.js by evaluating just the
 * relevant block in a synthetic DOM-less context. We stub out document
 * (parseContacts reads from a textarea) and call methods directly.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'sms-app', 'www', 'js', 'app.js'), 'utf8');

// ── Lift just the helper methods out of the file by string extraction ──
// We grep for the contiguous block from "_substituteName" through the end of
// "parseContacts()" and assemble a small object literal.
function extractMethod(name) {
  const re = new RegExp(`(${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\})`, 'm');
  const m = SRC.match(re);
  if (!m) throw new Error(`Could not extract method: ${name}`);
  return m[1];
}

// Build a minimal App-like sandbox with the 4 helpers + parseContacts
const helpersSrc = `
const App = {
  ${extractMethod('_substituteName')},
  ${extractMethod('_templateHasPlaceholder')},
  ${extractMethod('_templateHasVariantOnly')},
  ${extractMethod('parseContacts')},
};
`;

let textareaValue = '';
const sandbox = {
  document: {
    getElementById(id) {
      if (id === 'wzContacts') return { value: textareaValue };
      return null;
    },
  },
  console,
  App: null,
};
vm.createContext(sandbox);
vm.runInContext(helpersSrc + '\nthis.App = App;', sandbox);
const App = sandbox.App;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('✓', name); pass++; }
  catch (e) { console.error('✗', name, '\n   ', e.message); fail++; }
}

// ── Fix B: multi-syntax substitution ──
t('[name] is substituted (canonical)', () => {
  assert.strictEqual(App._substituteName('Hi [name]!', 'John'), 'Hi John!');
});
t('[NAME] case-insensitive', () => {
  assert.strictEqual(App._substituteName('Hi [NAME]!', 'John'), 'Hi John!');
});
t('{name} is substituted (variant)', () => {
  assert.strictEqual(App._substituteName('Hi {name}!', 'John'), 'Hi John!');
});
t('<name> is substituted (variant)', () => {
  assert.strictEqual(App._substituteName('Hi <name>!', 'John'), 'Hi John!');
});
t('%name% is substituted (variant)', () => {
  assert.strictEqual(App._substituteName('Hi %name%!', 'John'), 'Hi John!');
});
t('$name is substituted (variant)', () => {
  assert.strictEqual(App._substituteName('Hi $name!', 'John'), 'Hi John!');
});
t('$$name is substituted (variant)', () => {
  assert.strictEqual(App._substituteName('Hi $$name!', 'John'), 'Hi John!');
});
t('multiple occurrences all replaced', () => {
  assert.strictEqual(
    App._substituteName('Hi [name], hi again [name]', 'Jo'),
    'Hi Jo, hi again Jo'
  );
});
t('empty name → empty replacement (no literal [name] left)', () => {
  assert.strictEqual(App._substituteName('Hi [name]!', ''), 'Hi !');
  assert.strictEqual(App._substituteName('Hi [name]!', null), 'Hi !');
  assert.strictEqual(App._substituteName('Hi [name]!', undefined), 'Hi !');
});
t('bracketed brand (NOT the word name) is left alone', () => {
  // Critical: only the literal word "name" is substituted.
  assert.strictEqual(
    App._substituteName('[SmileFundsRecovery] Hi [name]!', 'Jo'),
    '[SmileFundsRecovery] Hi Jo!'
  );
});

// ── _templateHasPlaceholder / _templateHasVariantOnly ──
t('detects [name] placeholder', () => {
  assert.ok(App._templateHasPlaceholder('Hi [name]'));
  assert.ok(!App._templateHasVariantOnly('Hi [name]'));
});
t('detects variant-only template', () => {
  assert.ok(App._templateHasPlaceholder('Hi {name}'));
  assert.ok(App._templateHasVariantOnly('Hi {name}'));
});
t('no placeholder at all', () => {
  assert.ok(!App._templateHasPlaceholder('Hello world'));
  assert.ok(!App._templateHasVariantOnly('Hello world'));
});
t('canonical + variant: not variant-only', () => {
  assert.ok(App._templateHasPlaceholder('Hi [name] / {name}'));
  assert.ok(!App._templateHasVariantOnly('Hi [name] / {name}'));
});

// ── Fix A: contact parser ──
function parse(input) {
  textareaValue = input;
  return App.parseContacts();
}

// Helper: structural-equal that survives vm-context prototype boundary
function deepEq(actual, expected, msg) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), msg);
}

t('canonical "+phone,Name" parses correctly', () => {
  const r = parse('+12128686239,John Doe');
  deepEq(r, [{ phoneNumber: '+12128686239', name: 'John Doe' }]);
});
t('tab-separated parses', () => {
  const r = parse('+12128686239\tJane');
  deepEq(r, [{ phoneNumber: '+12128686239', name: 'Jane' }]);
});
t('space-separated "+phone Name" parses (was the prod bug)', () => {
  const r = parse('+12138686239 Steve Edith');
  deepEq(r, [{ phoneNumber: '+12138686239', name: 'Steve Edith' }]);
});
t('phone-only line parses with empty name', () => {
  const r = parse('+12138686239');
  deepEq(r, [{ phoneNumber: '+12138686239', name: '' }]);
});
t('formatted phone "+1 (213) 868-6239 Steve" parses', () => {
  const r = parse('+1 (213) 868-6239 Steve');
  deepEq(r, [{ phoneNumber: '+12138686239', name: 'Steve' }]);
});
t('phone without leading + still parses', () => {
  const r = parse('12128686239,John');
  deepEq(r, [{ phoneNumber: '12128686239', name: 'John' }]);
});
t('multiple lines mixed formats', () => {
  const r = parse(
    '+12128686239,John\n' +
    '+12138686239 Steve Edith\n' +
    '+1 (818) 927 9992, Carlos\n' +
    '+15555555555\n'
  );
  assert.strictEqual(r.length, 4);
  assert.strictEqual(r[0].name, 'John');
  assert.strictEqual(r[1].name, 'Steve Edith');
  assert.strictEqual(r[1].phoneNumber, '+12138686239');
  assert.strictEqual(r[2].name, 'Carlos');
  assert.strictEqual(r[2].phoneNumber, '+18189279992');
  assert.strictEqual(r[3].name, '');
});
t('garbage line skipped (too short)', () => {
  const r = parse('hello\n+12128686239,John\n123');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'John');
});
t('phone field has stray text → cleaned, name preserved', () => {
  // Old bug: parser kept "+phone+text" verbatim. New parser strips non-digits.
  const r = parse('+12138686239 Steve Edith');
  // phoneNumber must be CLEAN digits — not "+12138686239 Steve Edith"
  assert.ok(!/[a-zA-Z]/.test(r[0].phoneNumber),
    `phoneNumber should be digit-only, got: "${r[0].phoneNumber}"`);
});

console.log(`\nResult: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
