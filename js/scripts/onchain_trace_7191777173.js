/* global process */
/**
 * READ-ONLY: trace the actual on-chain transactions for user 7191777173.
 * Pulls from blockstream.info (public BTC blockchain explorer API).
 */
const axios = require('axios')

// Hash submitted by user in support chat at 2026-06-18 11:11:18 UTC
const USER_SUBMITTED_HASH = '01abbd84bf3934831a9513886fb1843b7a1886eab6702ae45de586082df228c1'

;(async () => {
  console.log('=== On-chain trace for user 7191777173 deposits ===\n')

  const txid = USER_SUBMITTED_HASH
  console.log(`-- User-submitted hash: ${txid} --`)

  try {
    const r = await axios.get(`https://blockstream.info/api/tx/${txid}`, { timeout: 15000 })
    const tx = r.data
    console.log('Status:', JSON.stringify(tx.status))
    console.log('Block height:', tx.status?.block_height)
    console.log('Block time:', tx.status?.block_time && new Date(tx.status.block_time * 1000).toISOString())
    console.log('Confirmations: (current tip - block_height)')
    console.log('Fee (sats):', tx.fee)
    console.log('')
    console.log('INPUTS (sender):')
    for (const vin of tx.vin || []) {
      const v = vin.prevout
      console.log(`  - ${v?.scriptpubkey_address || '(unknown)'}  value=${v?.value} sats = ${(v?.value / 1e8).toFixed(8)} BTC`)
    }
    console.log('OUTPUTS (recipients):')
    for (const vout of tx.vout || []) {
      console.log(`  - ${vout.scriptpubkey_address || '(unknown)'}  value=${vout.value} sats = ${(vout.value / 1e8).toFixed(8)} BTC  type=${vout.scriptpubkey_type}`)
    }
  } catch (e) {
    console.log('Error:', e?.response?.status, e?.response?.data || e.message)
  }

  console.log('\n=== Looking up addresses that the bot generated for this user ===')
  // From chatIdOfDynopayPayment we have ref 4Ua6g for domain pay-route:
  //   bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2
  // (this was for a domain purchase, not wallet deposit, ultimately paid via wallet instead)
  // Let's check if it has any activity
  const knownAddrs = ['bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2']
  for (const addr of knownAddrs) {
    try {
      const r = await axios.get(`https://blockstream.info/api/address/${addr}`, { timeout: 10000 })
      console.log(`\nAddr: ${addr}`)
      console.log('  chain_stats:', JSON.stringify(r.data.chain_stats))
      console.log('  mempool_stats:', JSON.stringify(r.data.mempool_stats))
    } catch (e) {
      console.log(`Addr ${addr}: error`, e?.response?.status, e?.message)
    }
  }
})()
