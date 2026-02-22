/*global process */
require('dotenv').config()
const BlockBee = require('@blockbee/api')
const API_KEY_BLOCKBEE = process.env.API_KEY_BLOCKBEE

const convert = async (value, from_coin, to_coin) => {
  try {
    const conversion = await BlockBee.getConvert(to_coin, value, from_coin, API_KEY_BLOCKBEE)
    return Number(conversion?.value_coin)
  } catch (error) {
    console.log(error)
    console.log(
      'Error is:',
      error?.message,
      error?.response?.data,
      error?.cause,
      JSON.stringify(error?.response?.data, null, 2),
    )
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
