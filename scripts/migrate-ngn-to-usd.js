#!/usr/bin/env node
/**
 * ONE-TIME MIGRATION: Convert existing NGN wallet balances to USD
 * 
 * This script:
 * 1. Fetches the current NGN→USD exchange rate
 * 2. Finds all users with positive NGN balances (ngnIn > ngnOut)
 * 3. Converts their NGN balance to USD and adds to usdIn
 * 4. Zeroes out NGN fields (sets ngnIn = ngnOut = 0)
 * 5. Logs every conversion for audit
 *
 * Usage: node scripts/migrate-ngn-to-usd.js
 * Safe to run multiple times (skips users with zero NGN balance)
 */

require('dotenv').config()
const { MongoClient } = require('mongodb')
const axios = require('axios')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'nomadly'
const API_KEY_CURRENCY_EXCHANGE = process.env.API_KEY_CURRENCY_EXCHANGE
const PERCENT_INCREASE_USD_TO_NAIRA = Number(process.env.PERCENT_INCREASE_USD_TO_NAIRA || 0)

async function fetchNgnRate() {
  const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${API_KEY_CURRENCY_EXCHANGE}`
  const response = await axios.get(apiUrl, { timeout: 10000 })
  if (!response?.data?.rates?.['NGN']) throw new Error('NGN rate not found in API response')
  return response.data.rates['NGN']
}

function ngnToUsd(ngn, rate) {
  return Number(ngn) / (rate * (1 + PERCENT_INCREASE_USD_TO_NAIRA))
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔄 NGN → USD Wallet Migration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Get exchange rate
  console.log('\n📡 Fetching exchange rate...')
  const rate = await fetchNgnRate()
  console.log(`   NGN rate: ${rate} (with ${PERCENT_INCREASE_USD_TO_NAIRA * 100}% markup)`)

  // 2. Connect to MongoDB
  const client = new MongoClient(MONGO_URL)
  await client.connect()
  const db = client.db(DB_NAME)
  const walletOf = db.collection('walletOf')

  // 3. Find users with positive NGN balance
  const usersWithNgn = await walletOf.find({
    $expr: {
      $gt: [
        { $subtract: [{ $ifNull: ['$ngnIn', 0] }, { $ifNull: ['$ngnOut', 0] }] },
        0
      ]
    }
  }).toArray()

  console.log(`\n👥 Found ${usersWithNgn.length} user(s) with positive NGN balance\n`)

  if (usersWithNgn.length === 0) {
    console.log('✅ Nothing to migrate — no NGN balances found.')
    await client.close()
    return
  }

  // 4. Migrate each user
  let totalNgnConverted = 0
  let totalUsdCredited = 0
  let migrated = 0

  for (const wallet of usersWithNgn) {
    const chatId = wallet._id
    const ngnIn = Number(wallet.ngnIn || 0)
    const ngnOut = Number(wallet.ngnOut || 0)
    const ngnBal = ngnIn - ngnOut

    if (ngnBal <= 0) continue // safety check

    const usdEquivalent = Number(ngnToUsd(ngnBal, rate).toFixed(2))

    console.log(`   ${chatId}: ₦${ngnBal.toFixed(2)} → $${usdEquivalent} USD`)

    // Atomic update: add USD equivalent to usdIn, zero out NGN
    await walletOf.updateOne(
      { _id: chatId },
      {
        $inc: { usdIn: usdEquivalent },
        $set: { ngnIn: 0, ngnOut: 0 }
      }
    )

    totalNgnConverted += ngnBal
    totalUsdCredited += usdEquivalent
    migrated++
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Migration complete!`)
  console.log(`   Users migrated: ${migrated}`)
  console.log(`   Total NGN converted: ₦${totalNgnConverted.toFixed(2)}`)
  console.log(`   Total USD credited: $${totalUsdCredited.toFixed(2)}`)
  console.log(`   Exchange rate used: ${rate}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await client.close()
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
