// Validates the AI-action-button → menu-escape mapping in the support handler
// without booting the full bot. Replicates the exact data structures from
// js/_index.js lines ~9876-9970 and asserts:
//   1) AI action button labels (e.g. "🖥️ VPS/RDP") are recognised as escape taps
//   2) Tapping such a button rewrites `message` to the canonical menu label
//   3) Real menu labels still escape (regression check)
//   4) Random/unknown text is NOT escape-tapped (regression check)

'use strict'

// Mirror of the AI button label → user-dict key map from _index.js
const AI_BUTTON_TO_USER_KEY = {
  '🔗✂️ URL Shortener — Unlimited': 'urlShortener',
  '📞 Cloud IVR + SIP':              'cloudPhone',
  '👛 Wallet':                       'wallet',
  '🏪 Marketplace':                  'marketplace',
  '🏪 Marché':                       'marketplace',
  '🌐 Bulletproof Domains':          'domainNames',
  '🌐 Domaines Bulletproof':         'domainNames',
  '🌐 防弹域名':                      'domainNames',
  '🌐 बुलेटप्रूफ डोमेन':            'domainNames',
  '🛡️🔥 Anti-Red Hosting':           'hostingDomainsRedirect',
  '🛡️🔥 Hébergement Anti-Red':       'hostingDomainsRedirect',
  '🌐 离岸托管':                      'hostingDomainsRedirect',
  '🌐 ऑफ़शोर होस्टिंग':            'hostingDomainsRedirect',
  '🖥️ VPS/RDP':                     'vpsPlans',
  '📱 SMS Leads':                    'leadsValidation',
  '💳 Virtual Card':                 'virtualCard',
  '📧 Email Validation':             'emailValidation',
  '📲 BulkSMS — Free':               'smsAppMain',
  '📦 Digital Products':             'digitalProducts',
}

// Pull the actual user-translation dict from the EN lang file
const enLang = require('../js/lang/en.js')
const user = (enLang.en && enLang.en.user) || {}

function buildMenuEscapeLabels(user) {
  const set = new Set()
  for (const key of ['cloudPhone','hostingDomainsRedirect','domainNames','digitalProducts','marketplace','vpsPlans','emailValidation','emailBlast','virtualCard','wallet','referEarn','becomeReseller','getSupport','changeSetting','changeLanguage','shippingLabel','smsAppMain','freeTrialAvailable','serviceBundles','viewPlan','shortLink','urlShortener','leadsValidation','joinChannel','upgradePlan']) {
    const v = user && user[key]
    if (typeof v === 'string' && v) set.add(v)
  }
  for (const s of ['📱 Browse All Services','📱 Parcourir tous les services','📱 浏览所有服务','📱 सभी सेवाएं ब्राउज़ करें']) set.add(s)
  for (const aiLabel of Object.keys(AI_BUTTON_TO_USER_KEY)) set.add(aiLabel)
  return set
}

function isEscapeTap(message, set) {
  return set.has(message) || /^\/(start|menu|home)\b/.test(message)
}

function rewriteMessageIfAiButton(message, user) {
  const key = AI_BUTTON_TO_USER_KEY[message]
  if (key && user && typeof user[key] === 'string' && user[key] && user[key] !== message) {
    return user[key]
  }
  return message
}

const escapeSet = buildMenuEscapeLabels(user)

let passed = 0
let failed = 0

function assert(name, cond, extra) {
  if (cond) { passed++; console.log(`✅ ${name}`) }
  else { failed++; console.log(`❌ ${name}`, extra || '') }
}

// ── 1. AI action button labels ARE escape taps ──
assert('AI label "🖥️ VPS/RDP" is escape-tap', isEscapeTap('🖥️ VPS/RDP', escapeSet))
assert('AI label "👛 Wallet" is escape-tap', isEscapeTap('👛 Wallet', escapeSet))
assert('AI label "🌐 Bulletproof Domains" is escape-tap', isEscapeTap('🌐 Bulletproof Domains', escapeSet))
assert('AI label "🛡️🔥 Anti-Red Hosting" is escape-tap', isEscapeTap('🛡️🔥 Anti-Red Hosting', escapeSet))
assert('AI label "📞 Cloud IVR + SIP" is escape-tap', isEscapeTap('📞 Cloud IVR + SIP', escapeSet))
assert('AI label "🏪 Marketplace" is escape-tap', isEscapeTap('🏪 Marketplace', escapeSet))

// ── 2. AI short label gets rewritten to canonical menu label ──
const rewritten = rewriteMessageIfAiButton('🖥️ VPS/RDP', user)
assert(`"🖥️ VPS/RDP" rewrites to canonical "${user.vpsPlans}"`, rewritten === user.vpsPlans, `got "${rewritten}"`)

const rwHosting = rewriteMessageIfAiButton('🛡️🔥 Anti-Red Hosting', user)
assert(`"🛡️🔥 Anti-Red Hosting" rewrites to canonical "${user.hostingDomainsRedirect}"`, rwHosting === user.hostingDomainsRedirect, `got "${rwHosting}"`)

const rwWallet = rewriteMessageIfAiButton('👛 Wallet', user)
assert('Identical AI label "👛 Wallet" stays as-is', rwWallet === '👛 Wallet')

// ── 3. Real menu labels still escape ──
assert('user.cloudPhone is escape-tap', isEscapeTap(user.cloudPhone, escapeSet))
assert('user.wallet is escape-tap', isEscapeTap(user.wallet, escapeSet))
assert('user.vpsPlans is escape-tap', isEscapeTap(user.vpsPlans, escapeSet))
assert('user.hostingDomainsRedirect is escape-tap', isEscapeTap(user.hostingDomainsRedirect, escapeSet))
assert('user.domainNames is escape-tap', isEscapeTap(user.domainNames, escapeSet))
assert('user.marketplace is escape-tap', isEscapeTap(user.marketplace, escapeSet))

// ── 4. Random text is NOT escape-tapped ──
assert('Plain English question is NOT escape-tap', !isEscapeTap('Do you have any vps to host screenconnect?', escapeSet))
assert('Random word "test" is NOT escape-tap', !isEscapeTap('test', escapeSet))
assert('Empty string is NOT escape-tap', !isEscapeTap('', escapeSet))

// ── 5. Slash commands still escape ──
assert('/start escapes', isEscapeTap('/start', escapeSet))
assert('/menu escapes', isEscapeTap('/menu', escapeSet))
assert('/home escapes', isEscapeTap('/home', escapeSet))

// ── 6. The OLD code's wrong keys (regression check) ──
assert('Old key "vpsRdp" does NOT exist in user dict', user.vpsRdp === undefined)
assert('Old key "antiRedHosting" does NOT exist in user dict', user.antiRedHosting === undefined)
assert('Correct key "vpsPlans" DOES exist', typeof user.vpsPlans === 'string' && user.vpsPlans.length > 0)
assert('Correct key "hostingDomainsRedirect" DOES exist', typeof user.hostingDomainsRedirect === 'string' && user.hostingDomainsRedirect.length > 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
