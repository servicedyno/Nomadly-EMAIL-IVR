// ============================================================
// Static-source assertions for the 2026-07-06 mpChat bugfix trio.
//
// Bug #1: '🏠 Main Menu' in mpChat is relayed as chat message.
// Bug #2: Duplicate getConversation(convId) calls per mpChat message.
// Bug #3: Unpaid seller cannot mark pre-fee listing sold (design call →
//         mark-sold is now FREE like remove).
//
// These are read-only source scans — no DB / no bot mocks — so they run
// in every environment. Same style as test_marketplace_old_seller_gates.js.
// ============================================================
const fs = require('fs')
const path = require('path')
const INDEX = fs.readFileSync(path.join(__dirname, '..', '_index.js'), 'utf8')

let pass = 0
let fail = 0
const it = (label, cond) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.log(`  ❌ ${label}`) }
}

console.log('\n═══ mpChat bugfix trio (2026-07-06) ═══\n')

// Locate the mpChat handler slice — anchor on the "Marketplace Chat Relay"
// comment (unique in the file).
const mpChatAnchor = INDEX.indexOf('// ── Marketplace Chat Relay')
if (mpChatAnchor < 0) { console.error('❌ Could not find mpChat handler anchor'); process.exit(1) }
// Grab enough forward window to include the text-relay path.
const mpChatSlice = INDEX.slice(mpChatAnchor, mpChatAnchor + 8000)

// ────────────────────────────────────────────────────────────
// Bug #1 — '🏠 Main Menu' is an escape hatch (handled by GLOBAL cancel
// handler upstream, which now also closes the marketplace conversation +
// notifies the other party).
// ────────────────────────────────────────────────────────────
console.log('─── Bug #1: 🏠 Main Menu escape hatch (global handler) ───')

// Locate the global cancel handler block.
const cancelHandlerAnchor = INDEX.indexOf("isCancelPress(message) || message === '🏠 Main Menu'")
it('global cancel handler line found', cancelHandlerAnchor > 0)
// Grab ~6KB forward from the anchor (covers the cancel-refund block, then
// our new mpChat cleanup block, and the support-session cleanup).
const cancelSlice = INDEX.slice(cancelHandlerAnchor, cancelHandlerAnchor + 6000)

it('global handler has MARKETPLACE mpChat cleanup block',
  cancelSlice.includes('MARKETPLACE mpChat cleanup'))
it('global handler checks `action === \'mpChat\'` before cleanup',
  /if \(action === 'mpChat'\)/.test(cancelSlice))
it('global handler calls marketplaceService.closeConversation(...)',
  /marketplaceService\.closeConversation\(_convId\)/.test(cancelSlice))
it('global handler resets user mpActiveConversation to null',
  /set\(state, chatId, 'mpActiveConversation', null\)/.test(cancelSlice))
it('global handler notifies the other party (mpChatEndedNotify or mpChatClosedReset)',
  cancelSlice.includes('mpChatEndedNotify') && cancelSlice.includes('mpChatClosedReset'))
it('global handler resets other party state if they\'re still in the same chat',
  /set\(state, _otherParty, 'action', a\.mpHome\)/.test(cancelSlice))
it('global handler logs the marketplace cleanup event',
  cancelSlice.includes('Conversation') && cancelSlice.includes('closed by'))

// The mpChat local escape hatch should NO LONGER match '🏠 Main Menu'
// (that button is fully handled by the upstream global handler now).
const escapeHatchLine = mpChatSlice.match(/if \(message === '\/done' \|\| isBackPress\(message\) \|\| message === '↩️ Back'[^)]*\) \{/)
it('mpChat local escape-hatch conditional found', !!escapeHatchLine)
it('mpChat local escape-hatch DOES NOT match 🏠 Main Menu (handled upstream)',
  escapeHatchLine && !escapeHatchLine[0].includes('🏠 Main Menu'))
it('mpChat local escape-hatch still matches /done',
  escapeHatchLine && escapeHatchLine[0].includes("'/done'"))
it('mpChat local escape-hatch still matches ↩️ Back',
  escapeHatchLine && escapeHatchLine[0].includes('↩️ Back'))

// ────────────────────────────────────────────────────────────
// Bug #2 — single getConversation(convId) per mpChat message
// ────────────────────────────────────────────────────────────
console.log('\n─── Bug #2: single getConversation() fetch per message ───')

// Count getConversation(convId) inside the mpChat handler window.
// Note: there are TWO legitimate calls:
//   (1) inside the escape-hatch closeConversation block — needed to notify
//       the other party's chat state, only runs on /done, ↩️ Back, 🏠 Main Menu
//   (2) at the seller-fee gate — the shared `conv` for the rest of the handler
// The FIX removes the pre-fix 3rd/4th/5th duplicate calls that lived inside
// /price, /report, and the text-relay path. So we expect exactly 2 calls.
const getConvCalls = mpChatSlice.match(/marketplaceService\.getConversation\(\s*convId\s*\)/g) || []
it(`mpChat handler has exactly 2 getConversation(convId) calls — escape-hatch + gate (found ${getConvCalls.length})`,
  getConvCalls.length === 2)
// And the SHARED `conv` from the gate must exist:
// Note: 2 declarations expected — (a) inside the escape-hatch if-block
// scope (isolated), (b) at the seller-fee gate (shared with rest of handler).
const gateFetches = mpChatSlice.match(/const conv = await marketplaceService\.getConversation\(convId\)/g) || []
it(`exactly 2 \`const conv = ...\` declarations (escape-hatch scope + gate scope) (found ${gateFetches.length})`,
  gateFetches.length === 2)

it('no `_mpConvForGate` variable left over (renamed → conv)',
  !mpChatSlice.includes('_mpConvForGate'))

// The /price handler must NOT redeclare `conv` — it should reuse the outer one.
const priceBranch = mpChatSlice.match(/if \(message\.startsWith\('\/price'\)\)[\s\S]{0,800}?\n\s*\}/)
it('/price branch found', !!priceBranch)
it('/price branch does NOT redeclare `const conv`',
  priceBranch && !priceBranch[0].includes('const conv = await marketplaceService.getConversation'))

// The /report handler must NOT redeclare `conv` either.
const reportBranch = mpChatSlice.match(/if \(message === '\/report'\)[\s\S]{0,400}?\n\s*\}/)
it('/report branch found', !!reportBranch)
it('/report branch does NOT redeclare `const conv`',
  reportBranch && !reportBranch[0].includes('const conv = await marketplaceService.getConversation'))

// The rate-limit / relay path must NOT redeclare `conv` either.
it('rate-limit / relay path does NOT redeclare `const conv`',
  !/Rate limit check\s*\n\s*const conv = await marketplaceService\.getConversation/.test(mpChatSlice))

// ────────────────────────────────────────────────────────────
// Bug #3 — mpMarkSold is FREE (before the gate) like Remove
// ────────────────────────────────────────────────────────────
console.log('\n─── Bug #3: mpMarkSold is free like remove ───')

const manageIdx = INDEX.indexOf('// ── Manage Listing')
it('mpManageListing handler found', manageIdx > 0)
const manageSlice = INDEX.slice(manageIdx, manageIdx + 3200)

const removeIdx = manageSlice.indexOf('mpRemoveProduct')
const markSoldIdx = manageSlice.indexOf('mpMarkSold')
const editIdx = manageSlice.indexOf('mpEditProduct')
const gate2Idx = manageSlice.indexOf('hasMarketplaceAccess')

it('mpMarkSold branch is BEFORE the seller-fee gate (free like remove)',
  markSoldIdx > 0 && gate2Idx > 0 && markSoldIdx < gate2Idx)
it('mpRemoveProduct branch is BEFORE the gate (unchanged — remove stays free)',
  removeIdx > 0 && removeIdx < gate2Idx)
it('mpEditProduct branch is AFTER the gate (edit stays gated — unchanged)',
  editIdx > 0 && gate2Idx < editIdx)
it('mpMarkSold branch calls marketplaceService.markProductSold(pid)',
  /if \(message === t\.mpMarkSold\)[\s\S]{0,200}markProductSold\(pid\)/.test(manageSlice))
it('gate comment reflects new "edit only" scope',
  manageSlice.includes('SELLER FEE GATE (edit only)') || manageSlice.includes('edit only'))

// ────────────────────────────────────────────────────────────
console.log(`\n═══ ${pass}/${pass + fail} passed, ${fail} failed ═══\n`)
process.exit(fail === 0 ? 0 : 1)
