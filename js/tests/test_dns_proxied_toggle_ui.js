/**
 * Regression test — Per-record CF proxied toggle in Add-DNS-Record flow
 * (2026-07-06). Follow-up enhancement to the @LevelupwithME fix: expose
 * an in-bot orange/grey-cloud toggle at the Add-Record step so power
 * users can choose per record — matches what Cloudflare's own dashboard
 * exposes.
 *
 * Pins the following contract:
 *   1. lang/en.js has:
 *      - dnsProxiedChoiceKeyboard (with the two labels + Back/Cancel row)
 *      - dnsProxiedChoiceLabelDnsOnly, dnsProxiedChoiceLabelProxied strings
 *      - dnsProxiedChoiceAsk(recordType, value) function
 *      - dnsProxiedChoiceInvalid string
 *      - Keyboard IS exported from the `en` object
 *   2. _index.js state machine has:
 *      - goto handler 'dns-add-proxied-choice' registered
 *      - dns-add-value branch that routes A/AAAA/CNAME on CF zones to the
 *        proxied-choice state
 *      - action handler for 'dns-add-proxied-choice' that:
 *        • recognises both ⚪ and 🟠 labels + emoji prefix shortcuts
 *        • calls resolveConflictAndAdd(...) when dnsConflictRecords is set
 *          (conflict-replace path)
 *        • otherwise calls addDNSRecord(...) directly
 *        • forwards the chosen `proxied` flag to both call sites
 *      - dns-confirm-conflict-replace routes into proxied-choice for
 *        A/AAAA/CNAME on CF zones instead of applying with hardcoded
 *        proxied:false
 *   3. Regression sanity: earlier @LevelupwithME + @hellpeaces + @HHR2009
 *      fixes still intact.
 */

const fs = require('fs')
const path = require('path')

let failures = 0
function check(name, cond, detail) {
  if (cond) console.log(`  ✅ ${name}`)
  else { failures++; console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
}

// ─── 1. lang/en.js — new i18n keys + keyboard ─────────────────
console.log('\n[1] lang/en.js — proxied-choice i18n keys')
const { translation } = require('../translation')
const { en } = require('../lang/en')

const labelDnsOnly = translation('t.dnsProxiedChoiceLabelDnsOnly', 'en')
const labelProxied = translation('t.dnsProxiedChoiceLabelProxied', 'en')
const askFn = en.t?.dnsProxiedChoiceAsk

check('t.dnsProxiedChoiceLabelDnsOnly present + contains ⚪ + "DNS"',
  typeof labelDnsOnly === 'string' && /⚪/.test(labelDnsOnly) && /DNS/i.test(labelDnsOnly))
check('t.dnsProxiedChoiceLabelProxied present + contains 🟠 + "Cloudflare"',
  typeof labelProxied === 'string' && /🟠/.test(labelProxied) && /Cloudflare/i.test(labelProxied))
check('t.dnsProxiedChoiceAsk is a function of (recordType, value)',
  typeof askFn === 'function' && askFn.length >= 2)
check('t.dnsProxiedChoiceAsk output contains "A record" + the value',
  (() => { const s = askFn('A', '161.35.11.55'); return /A record/i.test(s) && /161\.35\.11\.55/.test(s) })())
check('t.dnsProxiedChoiceInvalid present',
  typeof translation('t.dnsProxiedChoiceInvalid', 'en') === 'string' && translation('t.dnsProxiedChoiceInvalid', 'en').length > 5)

const kbd = translation('dnsProxiedChoiceKeyboard', 'en')
check('dnsProxiedChoiceKeyboard exists with parse_mode HTML',
  kbd && kbd.parse_mode === 'HTML')
check('dnsProxiedChoiceKeyboard first row is [DnsOnly] label',
  kbd?.reply_markup?.keyboard?.[0]?.[0] === labelDnsOnly)
check('dnsProxiedChoiceKeyboard second row is [Proxied] label',
  kbd?.reply_markup?.keyboard?.[1]?.[0] === labelProxied)
check('dnsProxiedChoiceKeyboard last row has Back + Cancel',
  (() => {
    const rows = kbd?.reply_markup?.keyboard || []
    const last = rows[rows.length - 1] || []
    return last.includes('Back') && last.includes('Cancel')
  })())

// ─── 2. _index.js — state machine wiring ──────────────────────
console.log('\n[2] _index.js — state machine wiring')
const idxSrc = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

check('goto handler `dns-add-proxied-choice` registered',
  /'dns-add-proxied-choice':\s*async\s*\(recordType,\s*value\)\s*=>/.test(idxSrc))
check('goto handler sets action state and sends the ask keyboard',
  /'dns-add-proxied-choice':[\s\S]{0,400}?set\(state,\s*chatId,\s*'action',\s*'dns-add-proxied-choice'\)[\s\S]{0,400}?trans\(['"]dnsProxiedChoiceKeyboard['"]\)/.test(idxSrc))
check('dns-add-value routes proxiable A/AAAA/CNAME on CF zone → proxied-choice',
  /if \(\['A', 'AAAA', 'CNAME'\]\.includes\(recordType\)\) \{[\s\S]{0,600}?getDomainMeta\(info\?\.domainToManage[\s\S]{0,600}?goto\['dns-add-proxied-choice'\]\(recordType, value\)/.test(idxSrc))
check('action handler `dns-add-proxied-choice` present',
  /if \(action === 'dns-add-proxied-choice'\)/.test(idxSrc))
check('action handler parses ⚪ (DNS-only) → proxied=false',
  /chosenProxied\s*=\s*false[\s\S]{0,120}?\/\^⚪\//.test(idxSrc) || /\/\^⚪\/[\s\S]{0,120}?chosenProxied\s*=\s*false/.test(idxSrc))
check('action handler parses 🟠 (Proxied) → proxied=true',
  /chosenProxied\s*=\s*true[\s\S]{0,120}?\/\^🟠\//.test(idxSrc) || /\/\^🟠\/[\s\S]{0,120}?chosenProxied\s*=\s*true/.test(idxSrc))
check('action handler forwards proxied to addDNSRecord',
  /addDNSRecord\(domain,\s*recordType,\s*value,\s*hostname,\s*db,\s*undefined,\s*undefined,\s*\{\s*proxied:\s*chosenProxied\s*\}\)/.test(idxSrc))
check('action handler forwards proxied to resolveConflictAndAdd on conflict-replace path',
  /resolveConflictAndAdd\(domain,\s*recordType,\s*value,\s*hostname,\s*conflictingRecords,\s*db,\s*undefined,\s*\{\s*proxied:\s*chosenProxied\s*\}\)/.test(idxSrc))
check('action handler clears dnsConflictRecords after use (prevents leak)',
  /set\(state,\s*chatId,\s*'dnsConflictRecords',\s*null\)/.test(idxSrc))
check('dns-confirm-conflict-replace routes A/AAAA/CNAME on CF → proxied-choice',
  /if \(action === 'dns-confirm-conflict-replace'\)[\s\S]{0,2000}?getDomainMeta\(domain[\s\S]{0,400}?goto\['dns-add-proxied-choice'\]/.test(idxSrc))
check('proxied-choice message differentiates Proxied vs DNS Only outcome',
  /🟠[^']*Proxied through Cloudflare[^']*SSL[\s\S]{0,300}?⚪[^']*DNS Only[^']*lookups resolve/.test(idxSrc))

// ─── 3. Regression sanity — earlier fixes intact ──────────────
console.log('\n[3] Regression sanity — earlier fixes intact')

const dsSrc = fs.readFileSync(path.join(__dirname, '..', 'domain-service.js'), 'utf8')
check('addDNSRecord still gated by opts.proxied !== false (LevelupwithME base fix)',
  /const shouldProxy\s*=\s*isProxiable\s*&&\s*opts\.proxied\s*!==\s*false/.test(dsSrc))
check('resolveConflictAndAdd still forwards opts',
  /resolveConflictAndAdd\s*=\s*async\s*\([^)]*opts\s*\)[\s\S]{0,800}?return\s+await\s+addDNSRecord\s*\([^)]*opts\s*\)/.test(dsSrc))

const cpProxy = require('../cpanel-proxy')
check('cpanel-proxy.looksLikeUapiPermFailure still exported (hellpeaces)',
  typeof cpProxy.looksLikeUapiPermFailure === 'function')
check('cpanel-proxy.extractCpanelErrorFromResponse still exported',
  typeof cpProxy.extractCpanelErrorFromResponse === 'function')

const handlersSrc = fs.readFileSync(path.join(__dirname, '..', 'cpanel-job-handlers.js'), 'utf8')
check('cpanel-job-handlers still classifies queued===true as deferred (HHR2009)',
  /result\?\.queued\s*===\s*true[\s\S]{0,200}?return\s*\{\s*ok:\s*false,\s*deferred:\s*true/.test(handlersSrc))

console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} test(s) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
