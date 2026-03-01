// Quick verification of credential storage and billing functionality
const axios = require('axios')
const { MongoClient } = require('mongodb')

const BASE_URL = 'http://localhost:5000'
const DB_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668'
const TEST_CONTEXT = {
  chatId: 1005284399,
  phoneNumber: '+18669834855'
}

async function quickTest() {
  console.log('=== QUICK CREDENTIAL & BILLING VERIFICATION ===\n')
  
  // Connect to MongoDB
  const client = new MongoClient(DB_URL)
  await client.connect()
  const db = client.db('test')
  const phoneCol = db.collection('phoneNumbersOf')
  
  // 1. Check current credentials in DB
  console.log('1. Database Credential Check:')
  const phoneDoc = await phoneCol.findOne({ _id: TEST_CONTEXT.chatId })
  const phoneEntry = phoneDoc?.val?.numbers?.find(n => n.phoneNumber === TEST_CONTEXT.phoneNumber)
  
  if (phoneEntry) {
    console.log(`✅ telnyxSipUsername: ${phoneEntry.telnyxSipUsername}`)
    console.log(`✅ sipUsername: ${phoneEntry.sipUsername}`)
    console.log(`✅ telnyxCredentialId: ${phoneEntry.telnyxCredentialId}`)
    console.log(`   Minutes used: ${phoneEntry.minutesUsed || 0}`)
  }
  
  // 2. Test reset endpoint
  console.log('\n2. Credential Reset Endpoint:')
  const beforeReset = { ...phoneEntry }
  
  try {
    const resetResponse = await axios.post(`${BASE_URL}/phone/reset-credentials`, {
      chatId: TEST_CONTEXT.chatId,
      phoneNumber: TEST_CONTEXT.phoneNumber
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    })
    
    console.log('✅ Reset endpoint responded successfully')
    console.log(`   New sipUsername: ${resetResponse.data.sipUsername}`)
    console.log(`   New telnyxSipUsername: ${resetResponse.data.telnyxSipUsername}`)
    
    // Check if credentials changed
    await new Promise(r => setTimeout(r, 1000)) // Wait for DB update
    const afterDoc = await phoneCol.findOne({ _id: TEST_CONTEXT.chatId })
    const afterEntry = afterDoc?.val?.numbers?.find(n => n.phoneNumber === TEST_CONTEXT.phoneNumber)
    
    if (afterEntry.telnyxCredentialId !== beforeReset.telnyxCredentialId) {
      console.log('✅ Credential ID changed in database')
    } else {
      console.log('❌ Credential ID did not change')
    }
    
  } catch (error) {
    console.log(`❌ Reset failed: ${error.message}`)
  }
  
  // 3. Test voice webhook SIP routing
  console.log('\n3. Voice Webhook SIP Routing:')
  try {
    const webhookResponse = await axios.post(`${BASE_URL}/twilio/voice-webhook`, 
      new URLSearchParams({
        To: TEST_CONTEXT.phoneNumber,
        From: '+12025551234',
        CallSid: 'testSIProuting456'
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      })
    
    const twiml = webhookResponse.data
    const currentPhone = await phoneCol.findOne({ _id: TEST_CONTEXT.chatId })
    const currentEntry = currentPhone?.val?.numbers?.find(n => n.phoneNumber === TEST_CONTEXT.phoneNumber)
    
    if (twiml.includes(currentEntry.telnyxSipUsername)) {
      console.log('✅ TwiML uses telnyxSipUsername for SIP routing')
      console.log(`   Using: ${currentEntry.telnyxSipUsername}`)
    } else {
      console.log('❌ TwiML not using telnyxSipUsername')
    }
    
    if (!twiml.includes(currentEntry.sipUsername)) {
      console.log('✅ TwiML does NOT use sipUsername (correct)')
    } else {
      console.log('❌ TwiML incorrectly using sipUsername')
    }
    
  } catch (error) {
    console.log(`❌ Voice webhook failed: ${error.message}`)
  }
  
  // 4. Check module exports
  console.log('\n4. Module Exports:')
  try {
    const twilioService = require('/app/js/twilio-service.js')
    const telnyxService = require('/app/js/telnyx-service.js')
    
    console.log(`✅ Twilio removeSipCredential: ${typeof twilioService.removeSipCredential === 'function' ? 'EXISTS' : 'MISSING'}`)
    console.log(`✅ Telnyx deleteSIPCredential: ${typeof telnyxService.deleteSIPCredential === 'function' ? 'EXISTS' : 'MISSING'}`)
  } catch (error) {
    console.log(`❌ Module export check failed: ${error.message}`)
  }
  
  // 5. Check billing logs
  console.log('\n5. Billing Integration (from logs):')
  try {
    const { execSync } = require('child_process')
    const logs = execSync('tail -n 30 /var/log/supervisor/nodejs.out.log', { encoding: 'utf8' })
    
    if (logs.includes('[BulkCall] Billed')) {
      console.log('✅ Bulk call billing is working')
      const billingLines = logs.split('\n').filter(line => line.includes('[BulkCall] Billed'))
      if (billingLines.length > 0) {
        console.log(`   Latest: ${billingLines[billingLines.length - 1]}`)
      }
    } else {
      console.log('❌ No billing messages found in logs')
    }
  } catch (error) {
    console.log(`❌ Log check failed: ${error.message}`)
  }
  
  await client.close()
  console.log('\n=== VERIFICATION COMPLETE ===')
}

quickTest().catch(console.error)