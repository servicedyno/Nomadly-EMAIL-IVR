/*global process */
require('dotenv').config()
const BlockBee = require('@blockbee/api')
const API_KEY_BLOCKBEE = process.env.API_KEY_BLOCKBEE

// Convert `value` from `from_coin` to `to_coin` using BlockBee's live rate.
//
// BUG-FIX 2026-07-15 (ciroovblzz LTC → NaN wallet):
// This function used to silently `return undefined` on error (implicit
// bottom-of-function return, and `Number(undefined)` = NaN when the API
// returned a non-JSON body). Callers then did `Math.max(invoiceUsd, NaN)`
// which is NaN, and `$inc: { usdIn: NaN }` poisoned MongoDB with NaN.
//
// Contract now:
//   • Returns a finite positive Number on success.
//   • Returns `null` on ANY failure — API error, non-JSON body (Cloudflare
//     error page, upstream 5xx), non-finite result, or missing field.
// Callers MUST check for null and fall back to `base_amount` (invoice) or
// abort the credit — see js/_index.js DynoPay wallet webhook.
const convert = async (value, from_coin, to_coin) => {
  try {
    const conversion = await BlockBee.getConvert(to_coin, value, from_coin, API_KEY_BLOCKBEE)
    const result = Number(conversion?.value_coin)
    if (!Number.isFinite(result)) {
      console.log(
        `[BlockBee.convert] Non-finite result for ${value} ${from_coin} → ${to_coin}:`,
        'value_coin=', conversion?.value_coin,
        'raw=', JSON.stringify(conversion).slice(0, 300),
      )
      return null
    }
    return result
  } catch (error) {
    console.log(
      `[BlockBee.convert] Failed ${value} ${from_coin} → ${to_coin}:`,
      error?.message,
      error?.response?.status,
      typeof error?.response?.data === 'string' ? error.response.data.slice(0, 200) : error?.response?.data,
      error?.cause?.code,
    )
    return null
  }
}

// convert('10', 'usd', 'btc').then(console.log);
// convert('1', 'btc', 'usd').then(console.log);

const getCryptoDepositAddress = async (ticker, webhookParams, backendServer, redirectPath) => {
  const myAddress = '' // auto gen by BB
  const callbackUrl = `${backendServer}${redirectPath}`
  const blockbeeParams = {}

  const bb = new BlockBee(ticker, myAddress, callbackUrl, webhookParams, blockbeeParams, API_KEY_BLOCKBEE)

  const address = await bb.getAddress()

  return { address, bb }
}

// getCryptoDepositAddress('polygon_matic',  '6687923716', 'https://softgreen.com', "/crypto" ).then(a=> console.log(JSON.stringify(a)))

module.exports = { getCryptoDepositAddress, convert }
