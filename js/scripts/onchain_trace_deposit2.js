/* global process */
/**
 * Find deposit #2 on-chain. Try:
 * 1. Outgoing txs from user's wallet bc1qjfnpl362zygzx09uhwn005zs3sflw7has35lxw
 * 2. Incoming txs to bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2 of 0.00031227 BTC
 */
const axios = require('axios')

const USER_BTC_WALLET = 'bc1qjfnpl362zygzx09uhwn005zs3sflw7has35lxw'
const DEPOSIT_1_ADDR = 'bc1qfgv4f6fz7w2z9z0zcs02c4hzn943vztd64j4l2'
const TARGET_AMOUNT = 31227   // 0.00031227 BTC = 31227 sats
const TARGET_TIME_UTC = '2026-06-18T11:14:55Z'

;(async () => {
  console.log('=== Finding on-chain deposit #2 (0.00031227 BTC) ===\n')

  // List user's wallet transactions
  console.log(`-- Outgoing from user wallet: ${USER_BTC_WALLET} --`)
  try {
    const r = await axios.get(`https://blockstream.info/api/address/${USER_BTC_WALLET}/txs`, { timeout: 15000 })
    const txs = r.data
    console.log(`Total recent txs: ${txs.length}`)
    for (const tx of txs) {
      const time = tx.status?.block_time ? new Date(tx.status.block_time * 1000).toISOString() : 'mempool'
      // Outgoing = user wallet is in vin
      const isOutgoing = (tx.vin || []).some(v => v.prevout?.scriptpubkey_address === USER_BTC_WALLET)
      if (!isOutgoing) continue
      // Show outputs other than self
      const outs = (tx.vout || []).map(v => `${v.scriptpubkey_address} ${v.value} sats (${(v.value/1e8).toFixed(8)} BTC)`)
      console.log(`\n  ${tx.txid}`)
      console.log(`    time: ${time}  block: ${tx.status?.block_height}  fee: ${tx.fee} sats`)
      for (const o of outs) console.log(`    out: ${o}`)
    }
  } catch (e) {
    console.log('Error:', e?.response?.status, e?.message)
  }

  console.log(`\n-- Incoming to ${DEPOSIT_1_ADDR} (DynoPay hot wallet) — looking for ${TARGET_AMOUNT} sats around ${TARGET_TIME_UTC} --`)
  try {
    const r = await axios.get(`https://blockstream.info/api/address/${DEPOSIT_1_ADDR}/txs`, { timeout: 15000 })
    const txs = r.data
    console.log(`Total recent txs (mempool+confirmed, last 25): ${txs.length}`)
    for (const tx of txs) {
      const time = tx.status?.block_time ? new Date(tx.status.block_time * 1000).toISOString() : 'mempool'
      const dep1Output = (tx.vout || []).find(v => v.scriptpubkey_address === DEPOSIT_1_ADDR)
      if (!dep1Output) continue
      const matchAmt = dep1Output.value === TARGET_AMOUNT
      console.log(`\n  ${tx.txid}  ← time ${time}  amount=${dep1Output.value} sats (${(dep1Output.value/1e8).toFixed(8)} BTC)  ${matchAmt ? '★ MATCH 0.00031227 BTC' : ''}`)
      if (matchAmt) {
        console.log('   INPUTS:')
        for (const vin of tx.vin || []) {
          console.log(`     - ${vin.prevout?.scriptpubkey_address}  ${vin.prevout?.value} sats`)
        }
        console.log('   ALL OUTPUTS:')
        for (const vout of tx.vout || []) {
          console.log(`     - ${vout.scriptpubkey_address}  ${vout.value} sats`)
        }
      }
    }
  } catch (e) {
    console.log('Error:', e?.response?.status, e?.message)
  }
})()
