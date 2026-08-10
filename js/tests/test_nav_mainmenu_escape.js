/**
 * Navigation UX regression — plan "cbd":
 *  (c) declutter: deep-flow keyboards no longer render a redundant plain "Back"
 *  (b) escape hatch: deep-flow keyboards ('↩️ Back' present) now surface "🏠 Main Menu"
 *  (d) hardening: isMainMenuPress util + free-trial dead-code removed
 *
 * Pure/offline: loads the lang modules (no DB) + static-source guards on _index.js.
 * Run with: node js/tests/test_nav_mainmenu_escape.js
 */
'use strict'
const fs = require('fs')
const path = require('path')

let pass = 0, fail = 0
const ok = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${note ? ' — ' + note : ''}`) }
}

const langs = ['en', 'fr', 'zh', 'hi']
const mods = {}
for (const L of langs) mods[L] = require(path.resolve(__dirname, '..', 'lang', `${L}.js`))[L]

// localized cancel word that _mc should carry per locale
const CANCEL = { en: 'Cancel', fr: 'Annuler', zh: '取消', hi: 'रद्द करें' }
const BACK   = { en: 'Back',   fr: 'Retour',  zh: '返回', hi: 'वापस' }

console.log('\n=== (b)+(c) kOf keyboard rendering across locales ===')
for (const L of langs) {
  const k = mods[L].k
  const user = mods[L].user
  const t = mods[L].t

  // DEEP flow: list already carries an explicit '↩️ Back'
  const deep = k.of([['🛒 Do Thing', '↩️ Back']]).reply_markup.keyboard
  const deepRows = JSON.stringify(deep)
  ok(`[${L}] deep flow keeps '↩️ Back'`, deep.some(r => r.includes('↩️ Back')), deepRows)
  ok(`[${L}] deep flow shows '🏠 Main Menu'`, deep.some(r => r.includes('🏠 Main Menu')), deepRows)
  ok(`[${L}] deep flow keeps localized Cancel`, deep.some(r => r.includes(CANCEL[L])), deepRows)
  ok(`[${L}] deep flow drops redundant plain Back row`,
     !deep.some(r => r.length && r[0] === BACK[L] && r.includes(CANCEL[L])), deepRows)

  // SHALLOW menu: no back at all -> unchanged legacy [Back, Cancel]
  const shallow = k.of([['A', 'B']]).reply_markup.keyboard
  const shallowRows = JSON.stringify(shallow)
  ok(`[${L}] shallow menu unchanged (no Main Menu)`, !shallow.some(r => r.includes('🏠 Main Menu')), shallowRows)
  ok(`[${L}] shallow menu keeps legacy Back+Cancel`,
     shallow.some(r => r.includes(BACK[L]) && r.includes(CANCEL[L])), shallowRows)

  // CONTEXTUAL back (backToHostingPlans / t.backButton): Task 1 now adds a 🏠 Main Menu row
  const ctx = k.of([['Buy'], [user.backToHostingPlans]]).reply_markup.keyboard
  ok(`[${L}] contextual-back now shows 🏠 Main Menu (no Cancel)`,
     ctx.some(r => r.includes('🏠 Main Menu')) && !ctx.some(r => r.includes(CANCEL[L])), JSON.stringify(ctx))
  const ctx2 = k.of([['X'], [t.backButton]]).reply_markup.keyboard
  ok(`[${L}] t.backButton screen adds a 🏠 Main Menu row`,
     ctx2.length === 3 && ctx2.some(r => r.includes('🏠 Main Menu')), JSON.stringify(ctx2))
}

console.log('\n=== (d) isMainMenuPress util ===')
// mirror the implementation from _index.js
function isMainMenuPress(message) {
  if (!message || typeof message !== 'string') return false
  const stripped = message.replace(/^[^\p{L}]+/u, '').trim()
  const known = new Set(['Main Menu', 'Menu principal', '主菜单', 'मुख्य मेनू'])
  return known.has(stripped)
}
ok("isMainMenuPress('🏠 Main Menu')", isMainMenuPress('🏠 Main Menu'))
ok("isMainMenuPress('Main Menu')", isMainMenuPress('Main Menu'))
ok("isMainMenuPress('🏠 主菜单')", isMainMenuPress('🏠 主菜单'))
ok("isMainMenuPress('🏠 Menu principal')", isMainMenuPress('🏠 Menu principal'))
ok("isMainMenuPress('🏠 मुख्य मेनू')", isMainMenuPress('🏠 मुख्य मेनू'))
ok("!isMainMenuPress('↩️ Back')", !isMainMenuPress('↩️ Back'))
ok("!isMainMenuPress('🛒 Buy')", !isMainMenuPress('🛒 Buy'))
ok('!isMainMenuPress(null)', !isMainMenuPress(null))
ok("!isMainMenuPress('')", !isMainMenuPress(''))

console.log('\n=== (d) static-source guards on _index.js ===')
const src = fs.readFileSync(path.resolve(__dirname, '..', '_index.js'), 'utf8')
ok('isMainMenuPress defined', /function\s+isMainMenuPress/.test(src))
ok('global cancel/menu handler uses isMainMenuPress',
   /if \(isCancelPress\(message\) \|\| isMainMenuPress\(message\) \|\| \(firstSteps\.includes\(action\)/.test(src))
ok('global handler no longer uses literal 🏠 Main Menu in the firstSteps condition',
   !/message === '🏠 Main Menu' \|\| \(firstSteps\.includes\(action\)/.test(src))
ok('free-trial dead line removed',
   !/if \(message === '↩️ Back'\) return goto\.freeTrialMenu\(\)/.test(src))
ok('free-trial Back still routes via isBackPress -> submenu3',
   /if \(action === a\.freeTrial\)[\s\S]{0,300}isBackPress\(message\)\) return goto\.submenu3\(\)/.test(src))
ok('isBackPress still defined (regression)', /function\s+isBackPress/.test(src))

console.log('\n=== Task 1: Main-Menu escape on contextual-back (plan-detail) screens ===')
for (const L of langs) {
  const k = mods[L].k, user = mods[L].user
  const plan = k.of([[user.buyPremiumWeekly], [user.backToHostingPlans]]).reply_markup.keyboard
  ok(`[${L}] plan-detail screen shows 🏠 Main Menu`, plan.some(r => r.includes('🏠 Main Menu')), JSON.stringify(plan))
  ok(`[${L}] plan-detail keeps its contextual back`, plan.some(r => r.some(b => typeof b === 'string' && b.includes('⬅️'))), JSON.stringify(plan))
  // dedup: don't add a second Main Menu when list already has one
  const dup = k.of([['x', '🏠 Main Menu'], [user.backToHostingPlans]]).reply_markup.keyboard
  ok(`[${L}] no duplicate 🏠 Main Menu`, dup.flat().filter(b => b === '🏠 Main Menu').length === 1, JSON.stringify(dup))
}

console.log('\n=== Task 2: label declutter + stale-keyboard backward compat ===')
for (const L of langs) {
  const user = mods[L].user
  ok(`[${L}] hosting label decluttered (no 🛡️🔥)`, !user.hostingDomainsRedirect.startsWith('🛡️🔥') && user.hostingDomainsRedirect.startsWith('🛡️'))
  ok(`[${L}] vps label decluttered (no 'VPS/RDP —')`, !user.vpsPlans.includes('VPS/RDP') && user.vpsPlans.includes('VPS'))
}
// stale detectors (mirror handler logic) match OLD labels, reject NEW
const oldHost = ['🛡️🔥 Anti-Red Hosting', '🛡️🔥 Hébergement Anti-Red', '🛡️🔥 Anti-Red 托管', '🛡️🔥 Anti-Red होस्टिंग']
const oldVps = ['🖥️ VPS/RDP — Port 25 Open🛡️', '🖥️ VPS/RDP — Port 25 Ouvert🛡️', '🖥️ VPS/RDP — 端口25开放🛡️', '🖥️ VPS/RDP — पोर्ट 25 खुला🛡️']
ok('old hosting labels match startsWith(🛡️🔥)', oldHost.every(s => s.startsWith('🛡️🔥')))
ok('new hosting labels do NOT match startsWith(🛡️🔥)', langs.every(L => !mods[L].user.hostingDomainsRedirect.startsWith('🛡️🔥')))
ok('🔥 Browse Deals does NOT match startsWith(🛡️🔥)', !'🔥 Browse Deals'.startsWith('🛡️🔥'))
ok('old vps labels match startsWith(🖥️ VPS/RDP —)', oldVps.every(s => s.startsWith('🖥️ VPS/RDP —')))
ok('new vps labels do NOT match startsWith(🖥️ VPS/RDP —)', langs.every(L => !mods[L].user.vpsPlans.startsWith('🖥️ VPS/RDP —')))
// source-level: handlers carry the stale fallbacks
ok('hosting handler carries startsWith(🛡️🔥) fallback', src.includes("message.startsWith('🛡️🔥')"))
ok('vps handler carries startsWith(🖥️ VPS/RDP —) fallback', src.includes("message.startsWith('🖥️ VPS/RDP —')"))

console.log('\n=== lang exports intact (regression) ===')
for (const L of langs) {
  ok(`[${L}] exports k.of`, typeof mods[L].k?.of === 'function')
  ok(`[${L}] exports kOf`, typeof mods[L].kOf === 'function')
}

console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
