// Localization parity (#21) regression test.
//  1. Reverse record-type map resolves in EVERY locale via the SAME path the
//     DNS "add record" wizard uses: t[recordTypeLabel] === '<TYPE>'.
//  2. Cloudflare proxied-mode strings + keyboard + VPS SSH-blocked help exist
//     and are non-empty (and localised, not English) in fr/zh/hi.
//  3. Global language-switch handler is wired before the action handlers in
//     _index.js (works from any state) and only targets the 🌍 UI button.

const fs = require('fs')
const path = require('path')
const { translation } = require('../translation')

let pass = 0, fail = 0
function ok(name, cond, note = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name}${note ? ' — ' + note : ''}`) }
}

const LOCALES = ['en', 'fr', 'zh', 'hi']

// ── 1. Reverse record-type map (the real wizard path) ────────────────
console.log('\n[1] Reverse record-type map t[t.<type>] resolves in every locale')
const typeKeys = [['a', 'A'], ['aaaa', 'AAAA'], ['cname', 'CNAME'], ['mx', 'MX'], ['txt', 'TXT'],
  ['ns', 'NS'], ['srvRecord', 'SRV'], ['caaRecord', 'CAA'],
  ['caaTagIssue', 'issue'], ['caaTagIssuewild', 'issuewild'], ['caaTagIodef', 'iodef']]
for (const lang of LOCALES) {
  const t = translation('t', lang) // user-language t object (same as handler)
  for (const [labelKey, code] of typeKeys) {
    const label = t[labelKey]                 // e.g. fr → "Enregistrement MX"
    const resolved = t[label]                 // reverse lookup used by the wizard
    ok(`[${lang}] t[t.${labelKey}] = "${code}"`, resolved === code, `label="${label}" got="${resolved}"`)
  }
}

// ── 2. DNS proxied-mode + VPS SSH help present & localised ───────────
console.log('\n[2] DNS proxied-mode strings + keyboard + vpsSshBlockedHelp')
for (const lang of LOCALES) {
  const dnsOnly = translation('t.dnsProxiedChoiceLabelDnsOnly', lang)
  const proxied = translation('t.dnsProxiedChoiceLabelProxied', lang)
  const invalid = translation('t.dnsProxiedChoiceInvalid', lang)
  const ask = translation('t.dnsProxiedChoiceAsk', lang, 'A', '1.2.3.4')
  const kb = translation('dnsProxiedChoiceKeyboard', lang)
  const ssh = translation('vp.vpsSshBlockedHelp', lang, 'srv1', '5.6.7.8', 'root')

  ok(`[${lang}] DnsOnly label starts ⚪`, typeof dnsOnly === 'string' && dnsOnly.startsWith('⚪'))
  ok(`[${lang}] Proxied label starts 🟠`, typeof proxied === 'string' && proxied.startsWith('🟠'))
  ok(`[${lang}] invalid msg non-empty`, typeof invalid === 'string' && invalid.length > 0)
  ok(`[${lang}] ask() renders record type + HTML`, typeof ask === 'string' && ask.includes('<b>') && ask.includes('A'))
  ok(`[${lang}] keyboard buttons match label constants`,
    kb && kb.reply_markup && kb.reply_markup.keyboard[0][0] === dnsOnly && kb.reply_markup.keyboard[1][0] === proxied)
  ok(`[${lang}] vpsSshBlockedHelp includes host + ufw`, typeof ssh === 'string' && ssh.includes('5.6.7.8') && ssh.includes('ufw'))
}
// Localisation sanity: non-EN ask/help must NOT equal the EN string (proves translated)
const enAsk = translation('t.dnsProxiedChoiceAsk', 'en', 'A', '1.2.3.4')
const enSsh = translation('vp.vpsSshBlockedHelp', 'en', 'srv1', '5.6.7.8', 'root')
for (const lang of ['fr', 'zh', 'hi']) {
  ok(`[${lang}] ask is translated (≠ en)`, translation('t.dnsProxiedChoiceAsk', lang, 'A', '1.2.3.4') !== enAsk)
  ok(`[${lang}] sshHelp is translated (≠ en)`, translation('vp.vpsSshBlockedHelp', lang, 'srv1', '5.6.7.8', 'root') !== enSsh)
}

// ── 3. Global language-switch handler wiring in _index.js ────────────
console.log('\n[3] Global language switch works from any state')
const src = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')
ok('handles /language command', /_m === '\/language'/.test(src))
ok('matches 🌍 UI Change Language buttons', src.includes('🌍 Change Language') && src.includes('🌍 Changer de langue') && src.includes('🌍 更改语言') && src.includes('🌍 भाषा बदलें'))
ok('sets action to updateUserLanguage from the global handler',
  /_changeLangLabels\.has\(_m\)\)\s*\{[\s\S]*?a\.updateUserLanguage/.test(src))
ok('global handler is placed BEFORE the /start handler',
  src.indexOf('Global language switch (#21') < src.indexOf("if (message === '/start'"))
ok('does NOT hijack the IVR 🌐 Change Language button',
  !/_changeLangLabels[\s\S]{0,120}🌐 Change Language/.test(src))

console.log(`\n──────────────────────────────`)
console.log(`RESULT: ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
