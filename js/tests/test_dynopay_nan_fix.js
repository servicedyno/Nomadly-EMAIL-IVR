#!/usr/bin/env node
/*
 * DynoPay wallet NaN-poisoning fix verification (2026-07-15 @ciroovblzz LTC)
 * 
 * Verifies the fix for the production incident where BlockBee.getConvert()
 * returned HTML instead of JSON, causing convert() to return undefined,
 * which then poisoned walletOf with NaN via $inc.
 * 
 * Test coverage:
 *   [1] pay-blockbee.js convert() — null on error/non-finite
 *   [2] _index.js DynoPay webhook — guards + invoice fallback
 *   [3] _index.js addFundsTo() — refuses non-finite/non-positive
 *   [4] db.js atomicIncrement() — refuses non-finite at top
 *   [5] MongoDB data remediation — walletOf/walletAudit/depositFunnel/transactions
 *   [6] Cluster scan — no NaN/Infinity in walletOf
 */

require('dotenv').config()
const assert = require('assert')
const fs = require('fs')

let passCount = 0
let failCount = 0

function pass(msg) {
  passCount++
  console.log(`  ✅ ${msg}`)
}

function fail(msg) {
  failCount++
  console.error(`  ❌ ${msg}`)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// [1] pay-blockbee.js convert() — static source + behavioural
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log('\n[1] pay-blockbee.js convert() — null on error/non-finite')

const payBlockbeeSource = fs.readFileSync('/app/js/pay-blockbee.js', 'utf8')

// 1a. Check that convert() has explicit `return null` in catch block
if (payBlockbeeSource.includes('} catch (error) {') && 
    payBlockbeeSource.includes('return null')) {
  // Verify the return null is in the catch block
  const catchBlockMatch = payBlockbeeSource.match(/catch\s*\(error\)\s*\{[\s\S]*?\n\s*\}/m)
  if (catchBlockMatch && catchBlockMatch[0].includes('return null')) {
    pass('convert() has `return null` in catch block')
  } else {
    fail('convert() missing `return null` in catch block')
  }
} else {
  fail('convert() missing `return null` in catch block')
}

// 1b. Check that convert() has non-finite guard with `return null`
if (payBlockbeeSource.includes('!Number.isFinite(result)')) {
  // Find the if block and check it has return null
  const lines = payBlockbeeSource.split('\n')
  let foundGuard = false
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('!Number.isFinite(result)')) {
      // Check next few lines for return null
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].includes('return null')) {
          foundGuard = true
          break
        }
      }
      break
    }
  }
  if (foundGuard) {
    pass('convert() has non-finite guard with `return null`')
  } else {
    fail('convert() missing `return null` after non-finite check')
  }
} else {
  fail('convert() missing non-finite guard')
}

// 1c. Behavioural test — mock BlockBee.getConvert
console.log('  [Behavioural] Mocking BlockBee.getConvert...')
const BlockBee = require('@blockbee/api')
const originalGetConvert = BlockBee.getConvert

// Test case (i): getConvert throws
BlockBee.getConvert = async () => { throw new Error('Simulated API error') }
const { convert } = require('/app/js/pay-blockbee.js')

;(async () => {
  try {
    const result1 = await convert(0.22179053, 'ltc', 'usd')
    if (result1 === null) {
      pass('convert() returns null when getConvert throws')
    } else {
      fail(`convert() returned ${result1} (expected null) when getConvert throws`)
    }
  } catch (e) {
    fail(`convert() threw error instead of returning null: ${e.message}`)
  }

  // Test case (ii): getConvert returns HTML (non-JSON)
  BlockBee.getConvert = async () => ({ value_coin: '<!DOCTYPE html>' })
  try {
    const result2 = await convert(0.22179053, 'ltc', 'usd')
    if (result2 === null) {
      pass('convert() returns null when getConvert returns HTML')
    } else {
      fail(`convert() returned ${result2} (expected null) when getConvert returns HTML`)
    }
  } catch (e) {
    fail(`convert() threw error instead of returning null: ${e.message}`)
  }

  // Test case (iii): getConvert returns valid number
  BlockBee.getConvert = async () => ({ value_coin: '10.5' })
  try {
    const result3 = await convert(0.22179053, 'ltc', 'usd')
    if (typeof result3 === 'number' && Number.isFinite(result3) && result3 === 10.5) {
      pass('convert() returns 10.5 when getConvert returns valid number')
    } else {
      fail(`convert() returned ${result3} (expected 10.5) when getConvert returns valid number`)
    }
  } catch (e) {
    fail(`convert() threw error: ${e.message}`)
  }

  // Restore original
  BlockBee.getConvert = originalGetConvert

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // [2] _index.js DynoPay wallet webhook — static source checks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n[2] _index.js DynoPay wallet webhook — guards + invoice fallback')

  const indexSource = fs.readFileSync('/app/js/_index.js', 'utf8')

  // 2a. Check for conversionOk guard
  if (indexSource.includes('const conversionOk = Number.isFinite(convertedValue) && convertedValue > 0')) {
    pass('DynoPay webhook has conversionOk guard')
  } else {
    fail('DynoPay webhook missing conversionOk guard')
  }

  // 2b. Check for invoiceOk guard
  if (indexSource.includes('const invoiceOk = Number.isFinite(invoiceUsdFromBase) && invoiceUsdFromBase > 0')) {
    pass('DynoPay webhook has invoiceOk guard')
  } else {
    fail('DynoPay webhook missing invoiceOk guard')
  }

  // 2c. Check for invoice fallback logic
  if (indexSource.includes('if (!conversionOk && !invoiceOk)') &&
      indexSource.includes('Credit deferred — manual review')) {
    pass('DynoPay webhook has invoice fallback logic with abort on both failures')
  } else {
    fail('DynoPay webhook missing invoice fallback logic')
  }

  // 2d. Check for notifyGroup call on failure
  if (indexSource.match(/notifyGroup\([^)]*Wallet credit BLOCKED[^)]*\)/s)) {
    pass('DynoPay webhook calls notifyGroup on credit failure')
  } else {
    fail('DynoPay webhook missing notifyGroup call on credit failure')
  }

  // 2e. Check for final invariant guard
  if (indexSource.includes('if (!Number.isFinite(usdIn) || usdIn <= 0)')) {
    // Check that there's a log message about refusing to write NaN
    const lines = indexSource.split('\n')
    let foundInvariant = false
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('!Number.isFinite(usdIn) || usdIn <= 0')) {
        // Check next few lines for the refusing message
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].includes('refusing to write') || lines[j].includes('SANITY-CHECK FAILED')) {
            foundInvariant = true
            break
          }
        }
        break
      }
    }
    if (foundInvariant) {
      pass('DynoPay webhook has final invariant guard before DB write')
    } else {
      fail('DynoPay webhook has guard but missing proper error message')
    }
  } else {
    fail('DynoPay webhook missing final invariant guard')
  }

  // 2f. Check that Math.max is only used when conversionOk
  const mathMaxMatch = indexSource.match(/usdIn = conversionOk \? Math\.max\(invoice, convertedValue\) : invoice/)
  if (mathMaxMatch) {
    pass('DynoPay webhook only uses Math.max when conversionOk')
  } else {
    fail('DynoPay webhook Math.max usage not properly guarded')
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // [3] _index.js addFundsTo() — refuses non-finite/non-positive
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n[3] _index.js addFundsTo() — refuses non-finite/non-positive')

  // 3a. Check for non-finite guard
  if (indexSource.includes('if (typeof valueIn !== \'number\' || !Number.isFinite(valueIn))') &&
      indexSource.match(/REFUSING non-finite valueIn/)) {
    pass('addFundsTo() refuses non-finite valueIn')
  } else {
    fail('addFundsTo() missing non-finite guard')
  }

  // 3b. Check for non-positive guard
  if (indexSource.includes('if (valueIn <= 0)') &&
      indexSource.match(/Skipping non-positive valueIn/)) {
    pass('addFundsTo() refuses non-positive valueIn')
  } else {
    fail('addFundsTo() missing non-positive guard')
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // [4] db.js atomicIncrement() — refuses non-finite at top
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n[4] db.js atomicIncrement() — refuses non-finite at top')

  const dbSource = fs.readFileSync('/app/js/db.js', 'utf8')

  // 4a. Check for non-finite guard at the top of atomicIncrement
  const atomicIncrementMatch = dbSource.match(/const atomicIncrement = async \(c, key, field, amount\) => \{([\s\S]*?)(?=\n\nconst |module\.exports)/m)
  if (atomicIncrementMatch) {
    const funcBody = atomicIncrementMatch[1]
    // Check that the guard is before the walletOf check
    const guardIndex = funcBody.indexOf('if (typeof amount !== \'number\' || !Number.isFinite(amount))')
    const walletOfIndex = funcBody.indexOf('if (c.collectionName === \'walletOf\'')
    
    if (guardIndex !== -1 && guardIndex < walletOfIndex) {
      pass('atomicIncrement() has non-finite guard at the top (before walletOf fork)')
    } else {
      fail('atomicIncrement() non-finite guard not at the top')
    }
  } else {
    fail('Could not parse atomicIncrement() function')
  }

  // 4b. Check for REFUSING log message
  if (dbSource.includes('REFUSING non-finite amount') && 
      dbSource.includes('return false')) {
    pass('atomicIncrement() returns false and logs on non-finite amount')
  } else {
    fail('atomicIncrement() missing proper error handling for non-finite')
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // [5] MongoDB data remediation verification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n[5] MongoDB data remediation verification')

  const { MongoClient } = require('mongodb')
  const MONGO_URL = process.env.MONGO_URL
  const DB_NAME = process.env.DB_NAME || 'test'

  if (!MONGO_URL) {
    fail('MONGO_URL not found in environment')
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`SUMMARY: ${passCount} passed, ${failCount} failed`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
    process.exit(failCount > 0 ? 1 : 0)
    return
  }

  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)

    // 5a. Check walletOf._id='8625434794'
    const wallet = await db.collection('walletOf').findOne({ _id: '8625434794' })
    if (wallet) {
      if (Number.isFinite(wallet.usdIn) && wallet.usdIn === 1060.9) {
        pass(`walletOf._id='8625434794' has usdIn=1060.9 (finite, not NaN)`)
      } else {
        fail(`walletOf._id='8625434794' usdIn=${wallet.usdIn} (expected 1060.9)`)
      }

      if (Number.isFinite(wallet.usdOut) && wallet.usdOut === 1050.9) {
        pass(`walletOf._id='8625434794' has usdOut=1050.9`)
      } else {
        fail(`walletOf._id='8625434794' usdOut=${wallet.usdOut} (expected 1050.9)`)
      }

      const balance = wallet.usdIn - wallet.usdOut
      if (Math.abs(balance - 10.0) < 0.01) {
        pass(`walletOf._id='8625434794' net balance=$10.00`)
      } else {
        fail(`walletOf._id='8625434794' net balance=$${balance.toFixed(2)} (expected $10.00)`)
      }
    } else {
      fail(`walletOf._id='8625434794' not found`)
    }

    // 5b. Check walletAudit for nan_repair
    const auditEntry = await db.collection('walletAudit').findOne({ 
      chatId: '8625434794', 
      type: 'nan_repair' 
    })
    if (auditEntry) {
      pass(`walletAudit has {chatId:'8625434794', type:'nan_repair'} entry`)
    } else {
      fail(`walletAudit missing nan_repair entry for chatId='8625434794'`)
    }

    // 5c. Check depositFunnel._id='La52K'
    const funnel = await db.collection('depositFunnel').findOne({ _id: 'La52K' })
    if (funnel) {
      if (funnel.creditedUsd === 10) {
        pass(`depositFunnel._id='La52K' has creditedUsd=10`)
      } else {
        fail(`depositFunnel._id='La52K' creditedUsd=${funnel.creditedUsd} (expected 10)`)
      }
    } else {
      fail(`depositFunnel._id='La52K' not found`)
    }

    // 5d. Check transactions._id='TXN-20260715-CCF50'
    const txn = await db.collection('transactions').findOne({ _id: 'TXN-20260715-CCF50' })
    if (txn) {
      if (txn.amount === 10) {
        pass(`transactions._id='TXN-20260715-CCF50' has amount=10`)
      } else {
        fail(`transactions._id='TXN-20260715-CCF50' amount=${txn.amount} (expected 10)`)
      }
    } else {
      fail(`transactions._id='TXN-20260715-CCF50' not found`)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // [6] Cluster scan — no NaN/Infinity in walletOf
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n[6] Cluster scan — no NaN/Infinity in walletOf')

    const allWallets = await db.collection('walletOf').find({}).toArray()
    let nanCount = 0
    const poisonedWallets = []

    for (const w of allWallets) {
      const fields = ['usdIn', 'usdOut', 'ngnIn', 'ngnOut']
      for (const field of fields) {
        if (w[field] !== undefined && w[field] !== null) {
          if (!Number.isFinite(w[field])) {
            nanCount++
            poisonedWallets.push({ _id: w._id, field, value: w[field] })
          }
        }
      }
    }

    if (nanCount === 0) {
      pass(`Cluster scan: 0 wallets with NaN/Infinity (scanned ${allWallets.length} wallets)`)
    } else {
      fail(`Cluster scan: ${nanCount} fields with NaN/Infinity found:`)
      poisonedWallets.forEach(p => {
        console.error(`    - walletOf._id='${p._id}' ${p.field}=${p.value}`)
      })
    }

  } catch (error) {
    fail(`MongoDB connection/query error: ${error.message}`)
  } finally {
    await client.close()
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Final summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`SUMMARY: ${passCount} passed, ${failCount} failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  process.exit(failCount > 0 ? 1 : 0)
})()
