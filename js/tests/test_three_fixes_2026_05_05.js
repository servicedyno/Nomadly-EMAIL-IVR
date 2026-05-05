/**
 * Regression tests for three production bugs surfaced during the 2026-05-05
 * @johngambino / @burnt0ut777 incident review:
 *
 * 1. VPS order-confirm Back button skipped over the "Are you sure (skip
 *    SSH)?" screen and bounced users two steps back, causing them to lose
 *    fully-configured orders. (root cause: hardcoded `goto.vpsAskSSHKey()`
 *    on Back regardless of which path the user came from.)
 *
 * 2. CRITICAL low-balance wallet alerts had no actionable button — the user
 *    saw "Top up anytime via 👛 Wallet" mid-campaign with seconds counting
 *    down. (@johngambino went from $0.42 to $0 mid-IVR-campaign.)
 *
 * 3. Bulk-call billing wrote anonymous "wallet_deduction" ledger entries
 *    with null callType / destination / phoneNumber, leaving 2,937 entries
 *    in production unauditable. The corresponding phoneLogs row had the
 *    detail; only the ledger was missing it.
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

function run(name, fn) {
  try { fn(); console.log(`✓ ${name}`) }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); process.exit(1) }
}

const indexSrc = fs.readFileSync(path.resolve(__dirname, '../_index.js'), 'utf8')
const bulkSrc = fs.readFileSync(path.resolve(__dirname, '../bulk-call-service.js'), 'utf8')
const voiceSrc = fs.readFileSync(path.resolve(__dirname, '../voice-service.js'), 'utf8')

// ── Fix #1: VPS Back button breadcrumbs ──

run('vpsAskPaymentConfirmation records _prevNavStep before showing bill', () => {
  assert.ok(indexSrc.includes("_prevNavStep = 'rdp'"), 'should label RDP path')
  assert.ok(indexSrc.includes("_prevNavStep = 'sshSkipped'"), 'should label password-login path')
  assert.ok(indexSrc.includes("_prevNavStep = 'sshLinked'"), 'should label linked-key path')
  assert.ok(indexSrc.includes('saveInfo(\'vpsDetails\', vpsDetails)'),
    'should persist the breadcrumb so it survives a process restart mid-flow')
})

run('proceedWithVpsPayment Back uses the breadcrumb (not hardcoded vpsAskSSHKey)', () => {
  // Locate the Back-handler block within proceedWithVpsPayment
  const start = indexSrc.indexOf("if (action === a.proceedWithVpsPayment)")
  const block = indexSrc.slice(start, start + 1200)
  assert.ok(block.includes('_prevNavStep'),
    'Back handler must consult info.vpsDetails._prevNavStep')
  assert.ok(block.includes("if (prev === 'sshSkipped') return goto.askSkipSSHkeyconfirmation()"),
    "skipped-path Back must return to the 'Are you sure?' screen, not 2 steps further back")
  assert.ok(block.includes("if (prev === 'sshLinked') return goto.vpsLinkSSHKey()"),
    'linked-key path Back should return to the link-SSH screen')
})

// ── Fix #2: Wallet-low actionable button ──

run('CRITICAL low-balance alert exposes an inline Top-Up button', () => {
  assert.ok(voiceSrc.includes("callback_data: 'wallet_topup_quick'"),
    'should attach a wallet_topup_quick callback to the alert')
  assert.ok(voiceSrc.includes("text: '💰 Top Up Wallet'"),
    'button text should be branded')
  // Guard: button is gated by severity === critical/empty (not every nudge).
  // Search the source for the actual gate, not the comment.
  const ok = /severity === 'critical' \|\| severity === 'empty'/.test(voiceSrc)
    || /level === 'critical' \|\| level === 'empty'/.test(voiceSrc)
  assert.ok(ok,
    'button must be gated on critical/empty severity so we don\'t nag low/medium users')
})

run('callback_query handler routes wallet_topup_quick to the wallet command', () => {
  assert.ok(indexSrc.includes("if (data === 'wallet_topup_quick')"),
    'callback handler must recognise the wallet_topup_quick prefix')
  assert.ok(indexSrc.includes("text: '/wallet'"),
    'should re-issue /wallet so the user lands on the existing wallet UI')
  assert.ok(indexSrc.includes("answerCallbackQuery(query.id, { text: 'Opening wallet…'"),
    'should ack the callback so Telegram clears the loading spinner')
})

// ── Fix #3: Bulk-call billing ledger attribution ──

run('Bulk-call smartWalletDeduct passes metadata for ledger attribution', () => {
  // Find the deductResult call inside bulk-call-service
  const start = bulkSrc.indexOf('await smartWalletDeduct(_walletOf, freshCampaign.chatId, charge')
  assert.ok(start > 0, 'smartWalletDeduct call site must exist')
  const block = bulkSrc.slice(start, start + 600)
  assert.ok(block.includes("type: 'outbound_call'"),
    'ledger entry should be typed outbound_call (was generic wallet_deduction)')
  assert.ok(block.includes("callType: 'BulkIVR'"),
    'ledger entry should record callType=BulkIVR for filterability')
  assert.ok(block.includes('destination: freshLead?.number'),
    'ledger entry should record destination phone for audit')
  assert.ok(block.includes('phoneNumber: freshLead?.number'),
    'ledger entry should record the same number as phoneNumber for legacy compat')
  assert.ok(/description:.*BulkIVR/.test(block),
    'description should include BulkIVR + caller→destination + minutes for human readability')
})

run('No bulk-call deduction writes anonymous ledger entries anymore', () => {
  // Codebase guard: bulk-call should never call smartWalletDeduct without metadata
  const naked = bulkSrc.match(/smartWalletDeduct\(_walletOf, freshCampaign\.chatId, charge\)\s*$/m)
  assert.strictEqual(naked, null,
    'no bare smartWalletDeduct(walletOf, chatId, charge) — must always pass metadata')
})

console.log('\nAll three-fix regression tests passed.')
