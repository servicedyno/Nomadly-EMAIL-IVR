/**
 * Static-source guard: verifies the NEW defense-in-depth seller-fee gates
 * (2026-07-06) are wired into every code path an OLD seller could reach with
 * stale action-state from before the 2026-07-01 fee rollout.
 *
 * Fails if a future refactor removes any gate.
 */
'use strict'

const fs = require('fs')
const INDEX = fs.readFileSync('/app/js/_index.js', 'utf8')

let pass = 0, fail = 0
const it = (label, cond, detail = '') => {
  if (cond) { console.log(`  ✅ ${label}`); pass++ }
  else      { console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`); fail++ }
}

console.log('\n=== Marketplace OLD-seller gate wiring (2026-07-06) ===')

// ── 1) NEW module-scope helpers ─────────────────────────────────────────
it('helper _showMpSellerPaywallInline is defined',
  /async function _showMpSellerPaywallInline\s*\(chatId,\s*intent[^)]*\)/.test(INDEX))
it('helper _isSellerUnpaid is defined',
  /async function _isSellerUnpaid\s*\(chatId,\s*conv\)/.test(INDEX))
it('_isSellerUnpaid checks conv.sellerId === chatId',
  /_isSellerUnpaid[\s\S]{0,600}String\(conv\.sellerId\)\s*!==\s*String\(chatId\)/.test(INDEX))
it('_showMpSellerPaywallInline sets mpPaywallIntent + mpPaywallConvId + action=mpSellerPaywall',
  /_showMpSellerPaywallInline[\s\S]{0,1500}mpPaywallIntent[\s\S]{0,600}mpPaywallConvId[\s\S]{0,600}action['"],\s*['"]mpSellerPaywall/.test(INDEX))

// ── 2) mpChat TEXT handler gate ─────────────────────────────────────────
const mpChatTextIdx = INDEX.indexOf('// ── Marketplace Chat Relay')
it('mpChat text handler exists', mpChatTextIdx > 0)
const mpChatSlice = INDEX.slice(mpChatTextIdx, mpChatTextIdx + 5000)
it('mpChat text handler has SELLER FEE GATE comment',
  mpChatSlice.includes('SELLER FEE GATE'))
it('mpChat text handler calls _isSellerUnpaid',
  mpChatSlice.includes('_isSellerUnpaid(chatId'))
it('mpChat text handler routes to goto.mpSellerPaywall("reply", convId)',
  /goto\.mpSellerPaywall\(\s*['"]reply['"]\s*,\s*convId\s*\)/.test(mpChatSlice))
it('mpChat text gate placed AFTER /done escape hatch',
  mpChatSlice.indexOf('/done') < mpChatSlice.indexOf('_isSellerUnpaid'))
it('mpChat text gate placed BEFORE /escrow handler',
  mpChatSlice.indexOf('_isSellerUnpaid') < mpChatSlice.indexOf("=== '/escrow'"))

// ── 3) mpChat PHOTO handler gate ────────────────────────────────────────
const photoIdx = INDEX.indexOf("if (userInfo?.action === 'mpChat') {")
it('mpChat photo handler exists', photoIdx > 0)
const photoSlice = INDEX.slice(photoIdx, photoIdx + 2200)
it('mpChat photo handler has SELLER FEE GATE',
  photoSlice.includes('SELLER FEE GATE'))
it('mpChat photo handler calls _isSellerUnpaid',
  photoSlice.includes('_isSellerUnpaid(chatId'))
it('mpChat photo handler calls _showMpSellerPaywallInline (inline — goto is in TDZ here)',
  photoSlice.includes("_showMpSellerPaywallInline(chatId, 'reply', convId)"))
it('mpChat photo gate is BEFORE marketplaceService.addMessage(...type: "photo")',
  photoSlice.indexOf('_isSellerUnpaid') < photoSlice.indexOf("type: 'photo'"))

// ── 4) mpConversations resume gate ──────────────────────────────────────
const convIdx = INDEX.indexOf('// ── My Conversations — select one to resume')
it('mpConversations handler exists', convIdx > 0)
const convSlice = INDEX.slice(convIdx, convIdx + 1600)
it('mpConversations handler calls _isSellerUnpaid on the picked conv',
  convSlice.includes('_isSellerUnpaid(chatId'))
it('mpConversations handler routes to goto.mpSellerPaywall("reply", conv._id)',
  /goto\.mpSellerPaywall\(\s*['"]reply['"]\s*,\s*conv\._id\s*\)/.test(convSlice))
it('mpConversations gate is BEFORE the action=mpChat state write',
  convSlice.indexOf('_isSellerUnpaid') < convSlice.indexOf("'action', a.mpChat"))

// ── 5) mpNewConfirm publish gate (defense-in-depth) ─────────────────────
const publishIdx = INDEX.indexOf('// ── New Product: Confirm & Publish')
it('mpNewConfirm handler exists', publishIdx > 0)
const publishSlice = INDEX.slice(publishIdx, publishIdx + 2600)
it('mpNewConfirm has defense-in-depth gate before createProduct',
  publishSlice.includes('SELLER FEE GATE') &&
  publishSlice.indexOf('hasMarketplaceAccess') < publishSlice.indexOf('createProduct'))
it('mpNewConfirm gate routes to goto.mpSellerPaywall("list")',
  /goto\.mpSellerPaywall\(\s*['"]list['"]\s*\)/.test(publishSlice))

// ── 6) mpManageListing edit gate + FREE remove + FREE mark-sold ─────────
const manageIdx = INDEX.indexOf('// ── Manage Listing')
it('mpManageListing handler exists', manageIdx > 0)
const manageSlice = INDEX.slice(manageIdx, manageIdx + 3200)
it('mpManageListing has SELLER FEE GATE comment', manageSlice.includes('SELLER FEE GATE'))
it('mpManageListing gate is AFTER mpRemoveProduct branch (remove stays free)',
  manageSlice.indexOf('mpRemoveProduct') < manageSlice.indexOf('hasMarketplaceAccess'))
// Bug #3 fix (2026-07-06): mark-sold is now FREE (before the gate) like remove
it('mpManageListing gate is AFTER mpMarkSold branch (mark-sold stays free — Bug #3 fix)',
  manageSlice.indexOf('mpMarkSold') < manageSlice.indexOf('hasMarketplaceAccess'))
it('mpManageListing gate is BEFORE mpEditProduct branch',
  manageSlice.indexOf('hasMarketplaceAccess') < manageSlice.indexOf('mpEditProduct'))

// ── 7) mpEditTitle / mpEditDesc / mpEditPrice defense-in-depth gates ────
for (const action of ['mpEditTitle', 'mpEditDesc', 'mpEditPrice']) {
  const idx = INDEX.indexOf(`// ── Edit ${action.replace('mpEdit', '')}`)
  it(`${action} handler exists`, idx > 0)
  const slice = INDEX.slice(idx, idx + 1400)
  it(`${action} handler calls hasMarketplaceAccess`, slice.includes('hasMarketplaceAccess'))
  it(`${action} handler routes to goto.mpSellerPaywall("list") when unpaid`,
    /goto\.mpSellerPaywall\(\s*['"]list['"]\s*\)/.test(slice))
  it(`${action} gate is BEFORE marketplaceService.updateProduct`,
    slice.indexOf('hasMarketplaceAccess') < slice.indexOf('updateProduct'))
}

// ── 8) Buyer safety — every _isSellerUnpaid call must be conv-scoped ────
const usages = INDEX.match(/_isSellerUnpaid\(chatId,\s*([^)]+)\)/g) || []
it('every _isSellerUnpaid call passes a conv object (not undefined/null literal)',
  usages.length >= 3 && usages.every(u => !u.match(/,\s*(null|undefined)\)/)))

// ── 9) Buyers are NEVER gated — _isSellerUnpaid returns false when not seller
it('_isSellerUnpaid returns false (allowed) when chatId is not the seller',
  /_isSellerUnpaid[\s\S]{0,600}sellerId\)\s*!==\s*String\(chatId\)\)\s*return\s*false/.test(INDEX))

// ── 10) Payment path unchanged: mpSellerPaywall handler still resumes intent 'reply'
const paywallIdx = INDEX.indexOf("if (action === a.mpSellerPaywall)")
it('mpSellerPaywall handler exists', paywallIdx > 0)
const paywallSlice = INDEX.slice(paywallIdx, paywallIdx + 3500)
it('mpSellerPaywall handler resumes chat (intent=reply → action=mpChat)',
  paywallSlice.includes("'action', a.mpChat"))
it('mpSellerPaywall handler resumes listing (intent=list → action=mpNewImage)',
  paywallSlice.includes("'action', a.mpNewImage"))

console.log(`\n═══ ${pass}/${pass + fail} passed, ${fail} failed ═══\n`)
process.exit(fail === 0 ? 0 : 1)
