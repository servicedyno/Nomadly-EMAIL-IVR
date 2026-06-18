/* global process */
/**
 * READ-ONLY: Verify two DynoPay transactions for user 7191777173.
 * No mutations. Just prints the raw payload + key fields.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })

const { fetchDynoPayTransaction } = require('../pay-dynopay')

const TXS = [
  { ref: 'z02SZ', paymentId: '2fd3c05b-0654-48b1-a201-f165e587dcb8', userClaim: 'first deposit' },
  { ref: 'drKee', paymentId: 'a2b3a5a8-c103-4d63-bf89-8df4e5c1aadd', userClaim: '$60 claim / actually 0.00031227 BTC' },
]

;(async () => {
  console.log('=== DynoPay verification for chatId 7191777173 ===')
  console.log('Base URL:', process.env.DYNO_PAY_BASE_URL)
  console.log('API key present:', !!process.env.DYNO_PAY_API_KEY)
  console.log('Wallet token present:', !!process.env.DYNO_PAY_WALLET_TOKEN)
  console.log('')

  for (const tx of TXS) {
    console.log(`--- ref ${tx.ref} (${tx.userClaim}) ---`)
    console.log(`payment_id: ${tx.paymentId}`)
    try {
      const data = await fetchDynoPayTransaction(tx.paymentId)
      if (!data) {
        console.log('NO DATA (api returned false / error)')
      } else {
        console.log(JSON.stringify(data, null, 2))
      }
    } catch (e) {
      console.error('Exception:', e?.message)
    }
    console.log('')
  }
  console.log('=== done ===')
})()
