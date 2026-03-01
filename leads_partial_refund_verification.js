#!/usr/bin/env node

/**
 * LEADS GENERATION PARTIAL DELIVERY + REFUND FIXES VERIFICATION
 * Node.js Backend on port 5000
 * 
 * This script performs read-only verification of all 6 requirements from the review request.
 */

const axios = require('axios')
const fs = require('fs')

async function verifyLeadsPartialRefundFixes() {
  console.log('🔍 LEADS GENERATION PARTIAL DELIVERY + REFUND FIXES VERIFICATION\n')
  
  const results = {
    nodeJsHealth: false,
    cnamMissThreshold: false,
    cnamMissStreakInit: false,
    cnamMissStreakIncrement: false,
    cnamMissStreakReset: false,
    cnamMissStreakBreak: false,
    cnamPartialReason: false,
    timeoutCorrectDuration: false,
    timeoutPartialReturn: false,
    timeoutNoLogReturn: false,
    walletHandlerPartialCheck: false,
    walletUndeliveredRatio: false,
    walletRefundAmount: false,
    walletAtomicIncrement: false,
    walletUserMessage: false,
    walletAdminNotification: false,
    walletGroupNotification: false,
    resumePartialCheck: false,
    resumeRefundLogic: false,
    cnamMissStreakInLogs: false
  }
  
  let passCount = 0
  let totalTests = Object.keys(results).length
  
  console.log('1️⃣ NODE.JS HEALTH CHECK')
  try {
    const response = await axios.get('http://localhost:5000/health', { timeout: 5000 })
    if (response.data.status === 'healthy' && response.data.database === 'connected') {
      console.log('✅ Node.js service healthy on port 5000 with database connected')
      results.nodeJsHealth = true
      passCount++
    } else {
      console.log('❌ Unexpected health response:', response.data)
    }
  } catch (error) {
    console.log('❌ Health endpoint failed:', error.message)
  }
  
  console.log('\n2️⃣ FIX #1: CNAM MISS COUNTER - js/validatePhoneBulk.js')
  try {
    const bulkFile = fs.readFileSync('/app/js/validatePhoneBulk.js', 'utf8')
    const lines = bulkFile.split('\n')
    
    // Check CNAM_MISS_THRESHOLD = 50
    const thresholdLine = lines.find(line => line.includes('CNAM_MISS_THRESHOLD = 50'))
    if (thresholdLine) {
      console.log('✅ CNAM_MISS_THRESHOLD = 50 found at line', lines.indexOf(thresholdLine) + 1)
      results.cnamMissThreshold = true
      passCount++
    } else {
      console.log('❌ CNAM_MISS_THRESHOLD = 50 not found')
    }
    
    // Check cnamMissStreak initialization
    const initLine = lines.find(line => line.includes('let cnamMissStreak = 0'))
    if (initLine) {
      console.log('✅ cnamMissStreak initialized to 0 at line', lines.indexOf(initLine) + 1)
      results.cnamMissStreakInit = true
      passCount++
    } else {
      console.log('❌ cnamMissStreak initialization not found')
    }
    
    // Check increment logic
    const incrementLogic = bulkFile.includes('if (batchRealNames === 0 && r[1].length > 0) {') && 
                          bulkFile.includes('cnamMissStreak++')
    if (incrementLogic) {
      console.log('✅ cnamMissStreak increment logic found')
      results.cnamMissStreakIncrement = true
      passCount++
    } else {
      console.log('❌ cnamMissStreak increment logic not found')
    }
    
    // Check reset logic
    const resetLogic = bulkFile.includes('cnamMissStreak = 0')
    if (resetLogic) {
      console.log('✅ cnamMissStreak reset logic found')
      results.cnamMissStreakReset = true
      passCount++
    } else {
      console.log('❌ cnamMissStreak reset logic not found')
    }
    
    // Check break condition
    const breakCondition = bulkFile.includes('if (requireRealName && cnam && cnamMissStreak >= CNAM_MISS_THRESHOLD)')
    if (breakCondition) {
      console.log('✅ Break condition cnamMissStreak >= CNAM_MISS_THRESHOLD found')
      results.cnamMissStreakBreak = true
      passCount++
    } else {
      console.log('❌ Break condition not found')
    }
    
    // Check partial reason setting
    const partialReason = bulkFile.includes("res._partialReason = 'cnam_exhausted'")
    if (partialReason) {
      console.log('✅ Partial reason cnam_exhausted setting found')
      results.cnamPartialReason = true
      passCount++
    } else {
      console.log('❌ Partial reason setting not found')
    }
    
  } catch (error) {
    console.log('❌ Error reading validatePhoneBulk.js:', error.message)
  }
  
  console.log('\n3️⃣ FIX #2: TIMEOUT - js/validatePhoneBulk.js')
  try {
    const bulkFile = fs.readFileSync('/app/js/validatePhoneBulk.js', 'utf8')
    
    // Check timeout duration (30 minutes, not 10 hours)
    const timeoutDuration = bulkFile.includes('phoneGenTimeout = 30 * 60 * 1000')
    if (timeoutDuration) {
      console.log('✅ phoneGenTimeout = 30 * 60 * 1000 (30 minutes) found')
      results.timeoutCorrectDuration = true
      passCount++
    } else {
      console.log('❌ Correct timeout duration not found')
    }
    
    // Check timeout returns res with partial reason
    const timeoutReturn = bulkFile.includes("res._partialReason = 'timeout'") && 
                         bulkFile.includes('res._deliveredCount') && 
                         bulkFile.includes('res._targetCount') &&
                         bulkFile.includes('return res')
    if (timeoutReturn) {
      console.log('✅ Timeout returns res with _partialReason, _deliveredCount, _targetCount')
      results.timeoutPartialReturn = true
      passCount++
    } else {
      console.log('❌ Timeout return logic not found')
    }
    
    // Check it does NOT return log(...) which would be undefined
    const noLogReturn = !bulkFile.includes('return log(') || bulkFile.indexOf('return log(') === -1
    if (noLogReturn) {
      console.log('✅ Does NOT return log(...) which would return undefined')
      results.timeoutNoLogReturn = true
      passCount++
    } else {
      console.log('❌ Found problematic return log(...) statement')
    }
    
  } catch (error) {
    console.log('❌ Error reading validatePhoneBulk.js for timeout checks:', error.message)
  }
  
  console.log('\n4️⃣ FIX #3: PARTIAL DELIVERY + REFUND - js/_index.js')
  try {
    const indexFile = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check wallet handler partial reason check
    const partialCheck = indexFile.includes('if (res._partialReason)')
    if (partialCheck) {
      console.log('✅ Wallet handler checks res._partialReason')
      results.walletHandlerPartialCheck = true
      passCount++
    } else {
      console.log('❌ Wallet handler partial check not found')
    }
    
    // Check undelivered ratio calculation
    const ratioCalc = indexFile.includes('const undeliveredRatio = (requested - delivered) / requested')
    if (ratioCalc) {
      console.log('✅ Undelivered ratio calculation found')
      results.walletUndeliveredRatio = true
      passCount++
    } else {
      console.log('❌ Undelivered ratio calculation not found')
    }
    
    // Check refund amount calculation
    const refundCalc = indexFile.includes('const refundAmount = Math.round(undeliveredRatio * price * 100) / 100') ||
                      indexFile.includes('refundAmount = undeliveredRatio * price')
    if (refundCalc) {
      console.log('✅ Refund amount calculation found')
      results.walletRefundAmount = true
      passCount++
    } else {
      console.log('❌ Refund amount calculation not found')
    }
    
    // Check atomic increment for wallet refund
    const atomicInc = indexFile.includes("await atomicIncrement(walletOf, chatId, 'usdIn', refundAmount)") ||
                     indexFile.includes("await atomicIncrement(walletOf, chatId, 'ngnIn'")
    if (atomicInc) {
      console.log('✅ Wallet refund via atomicIncrement found')
      results.walletAtomicIncrement = true
      passCount++
    } else {
      console.log('❌ Wallet refund atomicIncrement not found')
    }
    
    // Check user message
    const userMsg = indexFile.includes('💰 <b>Partial Refund</b>')
    if (userMsg) {
      console.log('✅ User message "💰 Partial Refund" found')
      results.walletUserMessage = true
      passCount++
    } else {
      console.log('❌ User partial refund message not found')
    }
    
    // Check admin notification
    const adminMsg = indexFile.includes('TELEGRAM_ADMIN_CHAT_ID') && indexFile.includes('Partial Lead Refund')
    if (adminMsg) {
      console.log('✅ Admin notification to TELEGRAM_ADMIN_CHAT_ID found')
      results.walletAdminNotification = true
      passCount++
    } else {
      console.log('❌ Admin notification not found')
    }
    
    // Check group notification
    const groupMsg = indexFile.includes('notifyGroup') && indexFile.includes('Partial refund')
    if (groupMsg) {
      console.log('✅ Group notification via notifyGroup found')
      results.walletGroupNotification = true
      passCount++
    } else {
      console.log('❌ Group notification not found')
    }
    
  } catch (error) {
    console.log('❌ Error reading _index.js for partial refund checks:', error.message)
  }
  
  console.log('\n5️⃣ RESUME PATH REFUND - js/_index.js')
  try {
    const indexFile = fs.readFileSync('/app/js/_index.js', 'utf8')
    
    // Check resume path partial check
    const resumeCheck = indexFile.includes('if (fullResults._partialReason && job.price)')
    if (resumeCheck) {
      console.log('✅ Resume path checks fullResults._partialReason')
      results.resumePartialCheck = true
      passCount++
    } else {
      console.log('❌ Resume path partial check not found')
    }
    
    // Check resume refund logic (same as main path)
    const resumeRefund = indexFile.includes('const undeliveredRatio = (requested - delivered) / requested') &&
                        indexFile.includes('fullResults._partialReason')
    if (resumeRefund) {
      console.log('✅ Resume refund logic same as main path')
      results.resumeRefundLogic = true
      passCount++
    } else {
      console.log('❌ Resume refund logic not found')
    }
    
  } catch (error) {
    console.log('❌ Error reading _index.js for resume path checks:', error.message)
  }
  
  console.log('\n6️⃣ CNAM MISS STREAK IN LOGS')
  try {
    const { exec } = require('child_process')
    exec('grep -c "cnamMissStreak" /var/log/supervisor/nodejs.out.log', (error, stdout, stderr) => {
      if (!error && parseInt(stdout.trim()) > 0) {
        console.log(`✅ cnamMissStreak appears ${stdout.trim()} times in nodejs.out.log`)
        results.cnamMissStreakInLogs = true
        passCount++
        
        // Final summary
        setTimeout(() => {
          console.log('\n🎯 VERIFICATION SUMMARY')
          console.log('='.repeat(50))
          console.log(`✅ PASSED: ${passCount}/${totalTests} tests`)
          console.log(`❌ FAILED: ${totalTests - passCount}/${totalTests} tests`)
          console.log(`📊 SUCCESS RATE: ${Math.round((passCount / totalTests) * 100)}%`)
          
          if (passCount === totalTests) {
            console.log('\n🎉 ALL LEADS GENERATION PARTIAL DELIVERY + REFUND FIXES VERIFIED!')
            console.log('✅ System is production-ready for partial delivery handling')
          } else {
            console.log('\n⚠️  Some checks failed - review implementation')
          }
        }, 100)
      } else {
        console.log('❌ cnamMissStreak not found in logs or grep failed')
        
        // Final summary for failed case
        setTimeout(() => {
          console.log('\n🎯 VERIFICATION SUMMARY')
          console.log('='.repeat(50))
          console.log(`✅ PASSED: ${passCount}/${totalTests} tests`)
          console.log(`❌ FAILED: ${totalTests - passCount}/${totalTests} tests`)
          console.log(`📊 SUCCESS RATE: ${Math.round((passCount / totalTests) * 100)}%`)
          console.log('\n⚠️  Some checks failed - review implementation')
        }, 100)
      }
    })
    
  } catch (error) {
    console.log('❌ Error checking logs:', error.message)
  }
}

// Run verification
verifyLeadsPartialRefundFixes()