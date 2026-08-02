#!/usr/bin/env node
// Focused SEC-004 renderer verification for all phone-config locales.

const fs = require('fs')
const phoneConfig = require('/app/js/phone-config.js')

const hostile = 'Sales <script>alert("x")</script> & "Support"'
const locales = ['en', 'fr', 'zh', 'hi']
const allowedTags = ['<b>', '</b>', '<i>', '</i>', '<code>', '</code>']

function rawLtOutsideAllowedTags(s) {
  const offenders = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '<') continue
    const allowed = allowedTags.find(t => s.startsWith(t, i))
    if (allowed) {
      i += allowed.length - 1
      continue
    }
    offenders.push(s.slice(i, i + 50))
  }
  return offenders
}

function assertOk(condition, msg, failures) {
  if (!condition) failures.push(msg)
}

const config = {
  enabled: true,
  greeting: hostile,
  options: {
    '1': { action: 'submenu', label: hostile, subMenu: { options: {} } },
    '2': { action: 'message', message: hostile },
    '3<': { action: 'voicemail' },
  },
}

const analytics = {
  totalCalls: 3,
  topOption: { digit: '1', count: 2, percent: 66 },
  optionBreakdown: [
    { digit: '1', count: 2, percent: 66 },
    { digit: '3<', count: 1, percent: 33 },
  ],
  recentCalls: [{ from: '+19995551234', digit: '3<', action: hostile, time: new Date() }],
}
const labels = { '1': hostile, '3<': hostile }

const output = {
  helper: phoneConfig.escapeHtml('<b>&"x"</b>'),
  locales: {},
  pass: true,
  failures: [],
}

assertOk(output.helper === '&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;', `escapeHtml helper returned ${output.helper}`, output.failures)

for (const locale of locales) {
  const txt = phoneConfig.getTxt(locale)
  const menu = txt.ivrMenu('+18473556048', config)
  const report = txt.ivrAnalyticsReport('+18473556048', analytics, labels)
  const combined = `${menu}\n---\n${report}`
  const failures = []
  assertOk(combined.includes('&lt;script&gt;'), `${locale}: escaped script tag missing`, failures)
  assertOk(combined.includes('&amp;'), `${locale}: escaped ampersand missing`, failures)
  assertOk(combined.includes('&quot;Support&quot;'), `${locale}: escaped quoted Support missing`, failures)
  assertOk(combined.includes('3&lt;'), `${locale}: escaped digit/key 3< missing`, failures)
  assertOk(!combined.includes('<script>'), `${locale}: raw <script> present`, failures)
  assertOk(!combined.includes(hostile), `${locale}: full raw hostile string present`, failures)
  const offenders = rawLtOutsideAllowedTags(combined)
  assertOk(offenders.length === 0, `${locale}: raw '<' outside allowed tags ${JSON.stringify(offenders)}`, failures)
  output.locales[locale] = {
    ok: failures.length === 0,
    failures,
    menuSnippet: menu.slice(0, 420),
    analyticsSnippet: report.slice(0, 520),
  }
  output.failures.push(...failures)
}

output.pass = output.failures.length === 0
fs.writeFileSync('/app/test_reports/sec004_locale_render_results.json', JSON.stringify(output, null, 2), 'utf8')
console.log(JSON.stringify({ pass: output.pass, failures: output.failures, locale_results: '/app/test_reports/sec004_locale_render_results.json' }, null, 2))
process.exit(output.pass ? 0 : 1)