// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Nomadly Telegram Bot - Real-Time IVR, Bulk Call & SIP Testing
// Testing: Bulk IVR, Quick IVR, and Outbound SIP functionality
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios')
const crypto = require('crypto')
require('dotenv').config()

// Test Configuration
const BASE_URL = 'http://localhost:5000' // Direct Node.js backend
const PROXY_URL = 'https://webhook-pod-setup.preview.emergentagent.com/api' // Proxied via FastAPI
const DB_URL = 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668'
const DB_NAME = 'test'

// Test User Context
const TEST_USER = {
  chatId: 1005284399,
  phoneNumber: '+18669834855',
  twilioSubAccountSid: 'ACc5889c54b04c6505f1509325122fa7f1',
  twilioSubAccountToken: 'ca1565c21e62df769b87ccdb4db89949',
  sipUsername: 'test_4c9839ef32fa9673',
  sipPassword: 'nhTzexC3Aa17c298e4c',
  sipDomain: 'sip.speechcue.com'
}

// MongoDB connection
let dbConnection = null
let bulkCallCampaignsCollection = null
let phoneNumbersOfCollection = null

// Test Results Storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
}

// Utility Functions
function log(message) {
  console.log(`[TEST] ${message}`)
}

function logError(message) {
  console.log(`[ERROR] ${message}`)
  testResults.errors.push(message)
}

async function logTest(testName, passed, details = '') {
  testResults.total++
  if (passed) {
    testResults.passed++
    log(`✅ ${testName} - PASSED ${details}`)
  } else {
    testResults.failed++
    logError(`❌ ${testName} - FAILED ${details}`)
  }
}

// MongoDB Connection
async function connectToDatabase() {
  try {
    const { MongoClient } = require('mongodb')
    const client = new MongoClient(DB_URL)
    await client.connect()
    dbConnection = client.db(DB_NAME)
    bulkCallCampaignsCollection = dbConnection.collection('bulkCallCampaigns')
    phoneNumbersOfCollection = dbConnection.collection('phoneNumbersOf')
    log('Connected to MongoDB successfully')
    return true
  } catch (error) {
    logError(`MongoDB connection failed: ${error.message}`)
    return false
  }
}

// HTTP Request Helper
async function makeRequest(method, url, data = null, params = {}) {
  try {
    const config = {
      method,
      url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    if (data) config.data = data
    if (Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params)
      config.url += '?' + searchParams.toString()
    }
    
    const response = await axios(config)
    return { success: true, data: response.data, status: response.status }
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    }
  }
}

// TEST 1: SERVICE HEALTH VERIFICATION
async function testServiceHealth() {
  log('=== TEST 1: SERVICE HEALTH VERIFICATION ===')
  
  // Test direct backend health
  const healthDirect = await makeRequest('GET', `${BASE_URL}/health`)
  await logTest('Direct Backend Health Check', 
    healthDirect.success && healthDirect.data?.status === 'healthy',
    `Status: ${healthDirect.data?.status}, Database: ${healthDirect.data?.database}`)
  
  // Test proxied backend health
  const healthProxy = await makeRequest('GET', `${PROXY_URL}/health`)
  await logTest('Proxied Backend Health Check', 
    healthProxy.success && healthProxy.data?.status === 'healthy',
    `Status: ${healthProxy.data?.status}, Database: ${healthProxy.data?.database}`)
}

// TEST 2: BULK IVR CAMPAIGN TESTING
async function testBulkIVRCampaign() {
  log('=== TEST 2: BULK IVR CAMPAIGN TESTING ===')
  
  let campaignId = null
  
  try {
    // Create test campaign in database
    const campaign = {
      id: crypto.randomUUID(),
      chatId: TEST_USER.chatId,
      callerId: TEST_USER.phoneNumber,
      audioUrl: 'https://api.twilio.com/cowbell.mp3', // Public test audio
      audioName: 'Test Audio',
      mode: 'report_only',
      activeKeys: ['1'],
      concurrency: 1,
      leads: [{
        number: '+12025551234', // Test number
        name: 'Test Lead',
        index: 0,
        status: 'pending',
        digitPressed: null,
        transferred: false,
        transferConnected: false,
        duration: 0,
        callSid: null,
        startedAt: null,
        answeredAt: null,
        completedAt: null,
        hangupCause: null
      }],
      twilioSubAccountSid: TEST_USER.twilioSubAccountSid,
      twilioSubAccountToken: TEST_USER.twilioSubAccountToken,
      status: 'created',
      stats: {
        total: 1,
        completed: 0,
        answered: 0,
        keyPressed: 0,
        transferred: 0,
        noAnswer: 0,
        busy: 0,
        failed: 0,
        hungUp: 0
      },
      startedAt: null,
      completedAt: null,
      createdAt: new Date()
    }
    
    campaignId = campaign.id
    
    // Insert campaign into database
    await bulkCallCampaignsCollection.insertOne(campaign)
    await logTest('Create Campaign in Database', true, `Campaign ID: ${campaignId}`)
    
    // Verify campaign exists in database
    const savedCampaign = await bulkCallCampaignsCollection.findOne({ id: campaignId })
    await logTest('Verify Campaign in Database', 
      savedCampaign !== null,
      `Found campaign with ${savedCampaign?.leads?.length} leads`)
    
    // Test bulk IVR TwiML endpoint
    const bulkIvrTwiml = await makeRequest('POST', `${BASE_URL}/twilio/bulk-ivr`, null, {
      campaignId: campaignId,
      leadIndex: 0
    })
    
    const isTwimlValid = bulkIvrTwiml.success && 
      typeof bulkIvrTwiml.data === 'string' &&
      bulkIvrTwiml.data.includes('<Response>') &&
      bulkIvrTwiml.data.includes('<Gather>') &&
      bulkIvrTwiml.data.includes('<Play>')
    
    await logTest('Bulk IVR TwiML Endpoint', isTwimlValid, 
      `Response contains TwiML with Gather and Play elements`)
    
    // Test bulk IVR gather endpoint
    const bulkIvrGather = await makeRequest('POST', `${BASE_URL}/twilio/bulk-ivr-gather`, 
      { Digits: '1' }, {
        campaignId: campaignId,
        leadIndex: 0
      })
    
    const isGatherValid = bulkIvrGather.success &&
      typeof bulkIvrGather.data === 'string' &&
      bulkIvrGather.data.includes('<Response>')
    
    await logTest('Bulk IVR Gather Endpoint', isGatherValid,
      'Returns valid TwiML response for digit processing')
    
    // Test bulk status endpoint
    const bulkStatus = await makeRequest('POST', `${BASE_URL}/twilio/bulk-status`, 
      {
        CallSid: 'test123',
        CallStatus: 'completed',
        CallDuration: '10'
      }, {
        campaignId: campaignId,
        leadIndex: 0
      })
    
    await logTest('Bulk Status Endpoint', 
      bulkStatus.success && bulkStatus.status === 200,
      'Processes call status updates correctly')
    
    // Test campaign start functionality (this will make actual Twilio calls)
    log('Attempting to start campaign - This will make real Twilio API calls...')
    
    // Load the bulk call service module to test startCampaign
    const bulkCallService = require('/app/js/bulk-call-service.js')
    
    // Initialize the bulk call service (mock dependencies for testing)
    const mockBot = {
      sendMessage: (chatId, message) => {
        log(`Bot message to ${chatId}: ${message}`)
        return Promise.resolve()
      }
    }
    
    const mockTwilioService = require('/app/js/twilio-service.js')
    await bulkCallService.initBulkCallService(dbConnection, mockBot, mockTwilioService)
    
    // Attempt to start the campaign
    try {
      const startResult = await bulkCallService.startCampaign(campaignId)
      await logTest('Start Campaign', 
        startResult.success === true,
        'Campaign started successfully - real Twilio calls initiated')
    } catch (error) {
      await logTest('Start Campaign', false, `Error: ${error.message}`)
    }
    
  } catch (error) {
    await logTest('Bulk IVR Campaign Setup', false, `Error: ${error.message}`)
  }
}

// TEST 3: QUICK IVR TESTING
async function testQuickIVR() {
  log('=== TEST 3: QUICK IVR TESTING ===')
  
  try {
    // Load voice service to access twilioIvrSessions
    const voiceService = require('/app/js/voice-service.js')
    
    // Create test IVR session directly
    const sessionId = 'test-session-123'
    const testSession = {
      chatId: TEST_USER.chatId,
      callerId: TEST_USER.phoneNumber,
      targetNumber: '+12025551234', // Test number
      audioUrl: 'https://api.twilio.com/cowbell.mp3',
      activeKeys: ['1'],
      phase: 'initiated',
      createdAt: new Date(),
      mode: 'report_only'
    }
    
    // Add session to the twilioIvrSessions map
    if (voiceService.twilioIvrSessions) {
      voiceService.twilioIvrSessions[sessionId] = testSession
      await logTest('Create IVR Session', true, `Session ID: ${sessionId}`)
    } else {
      await logTest('Create IVR Session', false, 'twilioIvrSessions not accessible')
      return
    }
    
    // Test single IVR TwiML endpoint
    const singleIvrTwiml = await makeRequest('POST', `${BASE_URL}/twilio/single-ivr`, null, {
      sessionId: sessionId
    })
    
    const isTwimlValid = singleIvrTwiml.success &&
      typeof singleIvrTwiml.data === 'string' &&
      singleIvrTwiml.data.includes('<Response>') &&
      singleIvrTwiml.data.includes('<Gather>') &&
      singleIvrTwiml.data.includes('<Play>')
    
    await logTest('Single IVR TwiML Endpoint', isTwimlValid,
      'Returns valid TwiML with Gather and Play elements')
    
    // Test single IVR gather endpoint
    const singleIvrGather = await makeRequest('POST', `${BASE_URL}/twilio/single-ivr-gather`,
      { Digits: '1' }, {
        sessionId: sessionId
      })
    
    const isGatherValid = singleIvrGather.success &&
      typeof singleIvrGather.data === 'string' &&
      singleIvrGather.data.includes('<Response>')
    
    await logTest('Single IVR Gather Endpoint', isGatherValid,
      'Processes digit input correctly')
    
    // Test single IVR status endpoint
    const singleIvrStatus = await makeRequest('POST', `${BASE_URL}/twilio/single-ivr-status`,
      {
        CallSid: 'test456',
        CallStatus: 'completed',
        CallDuration: '15'
      }, {
        sessionId: sessionId
      })
    
    await logTest('Single IVR Status Endpoint',
      singleIvrStatus.success && singleIvrStatus.status === 200,
      'Handles call status updates')
    
    // Test actual Twilio outbound call
    log('Testing actual Twilio outbound call...')
    
    const twilioService = require('/app/js/twilio-service.js')
    
    try {
      const callResult = await twilioService.makeOutboundCall(
        TEST_USER.phoneNumber, // from
        '+15590563715', // to (using a test number)
        `${BASE_URL}/twilio/single-ivr?sessionId=${sessionId}`, // TwiML URL
        TEST_USER.twilioSubAccountSid,
        TEST_USER.twilioSubAccountToken
      )
      
      await logTest('Twilio Outbound Call',
        callResult.callSid && !callResult.error,
        `Call SID: ${callResult.callSid}, Status: ${callResult.status}`)
      
    } catch (error) {
      await logTest('Twilio Outbound Call', false, `Error: ${error.message}`)
    }
    
  } catch (error) {
    await logTest('Quick IVR Setup', false, `Error: ${error.message}`)
  }
}

// TEST 4: OUTBOUND SIP TESTING
async function testOutboundSIP() {
  log('=== TEST 4: OUTBOUND SIP TESTING ===')
  
  // Test voice webhook endpoint
  const voiceWebhook = await makeRequest('POST', `${BASE_URL}/twilio/voice-webhook`, {
    To: TEST_USER.phoneNumber,
    From: '+12025551234',
    CallSid: 'test789'
  })
  
  const isTwimlValid = voiceWebhook.success &&
    typeof voiceWebhook.data === 'string' &&
    voiceWebhook.data.includes('<Response>') &&
    voiceWebhook.data.includes('<Dial>') &&
    voiceWebhook.data.includes('<Sip>')
  
  await logTest('Voice Webhook Endpoint', isTwimlValid,
    'Returns TwiML with Dial and SIP routing')
  
  // Verify SIP URI format in response
  if (voiceWebhook.success) {
    const expectedSipUri = `sip:${TEST_USER.sipUsername}@${TEST_USER.sipDomain}`
    const containsCorrectSip = voiceWebhook.data.includes(expectedSipUri)
    await logTest('SIP URI Routing', containsCorrectSip,
      `Contains correct SIP URI: ${expectedSipUri}`)
  }
  
  // Test SIP ring result endpoint
  const sipRingResult = await makeRequest('POST', `${BASE_URL}/twilio/sip-ring-result`, 
    {
      DialCallStatus: 'no-answer',
      DialCallDuration: '0'
    }, {
      chatId: TEST_USER.chatId,
      from: encodeURIComponent('+12025551234'),
      to: encodeURIComponent(TEST_USER.phoneNumber)
    })
  
  await logTest('SIP Ring Result Endpoint',
    sipRingResult.success && typeof sipRingResult.data === 'string',
    'Handles SIP call results (voicemail/missed call)')
  
  // Verify SIP credentials in database
  try {
    const phoneDoc = await phoneNumbersOfCollection.findOne({ _id: TEST_USER.chatId })
    const hasPhoneNumbers = phoneDoc && phoneDoc.val && phoneDoc.val.numbers
    
    if (hasPhoneNumbers) {
      const phoneNumber = phoneDoc.val.numbers.find(n => 
        n.phoneNumber === TEST_USER.phoneNumber
      )
      
      if (phoneNumber) {
        const hasSipCredentials = phoneNumber.sipUsername === TEST_USER.sipUsername &&
          phoneNumber.sipPassword === TEST_USER.sipPassword &&
          phoneNumber.sipDomain === TEST_USER.sipDomain
        
        await logTest('SIP Credentials in Database', hasSipCredentials,
          `Username: ${phoneNumber.sipUsername}, Domain: ${phoneNumber.sipDomain}`)
      } else {
        await logTest('SIP Credentials in Database', false, 
          `Phone number ${TEST_USER.phoneNumber} not found in user's numbers`)
      }
    } else {
      await logTest('SIP Credentials in Database', false,
        `No phone numbers found for user ${TEST_USER.chatId}`)
    }
  } catch (error) {
    await logTest('SIP Credentials in Database', false, `Error: ${error.message}`)
  }
}

// TEST 5: INTEGRATION TESTING
async function testIntegration() {
  log('=== TEST 5: INTEGRATION TESTING ===')
  
  // Check that bulk call service is properly initialized
  try {
    const { execSync } = require('child_process')
    const logOutput = execSync('tail -n 100 /var/log/supervisor/nodejs.out.log', { encoding: 'utf8' })
    
    const hasBulkCallInit = logOutput.includes('[BulkCall] Service initialized')
    await logTest('Bulk Call Service Initialization', hasBulkCallInit,
      'Service initialization logged in supervisor output')
    
    const hasVoiceServiceInit = logOutput.includes('[VoiceService] Initialized')
    await logTest('Voice Service Initialization', hasVoiceServiceInit,
      'Voice service initialization with IVR + SIP support')
    
  } catch (error) {
    await logTest('Service Initialization Check', false, `Error: ${error.message}`)
  }
  
  // Test that all required modules are loadable
  try {
    const bulkCallService = require('/app/js/bulk-call-service.js')
    const voiceService = require('/app/js/voice-service.js')
    const twilioService = require('/app/js/twilio-service.js')
    
    await logTest('Module Loading', true,
      'All IVR and SIP modules loaded successfully')
    
    // Verify bulk call service exports
    const hasRequiredExports = bulkCallService.initBulkCallService &&
      bulkCallService.createCampaign &&
      bulkCallService.startCampaign &&
      bulkCallService.parseLeadsFile
    
    await logTest('Bulk Call Service Exports', hasRequiredExports,
      'All required functions exported')
    
    // Verify voice service exports
    const hasVoiceExports = voiceService.twilioIvrSessions &&
      voiceService.findNumberOwner
    
    await logTest('Voice Service Exports', hasVoiceExports,
      'IVR sessions and number lookup functions available')
    
  } catch (error) {
    await logTest('Module Loading', false, `Error: ${error.message}`)
  }
}

// Main Test Runner
async function runAllTests() {
  log('🚀 Starting Real-Time Bulk IVR, Quick IVR, and Outbound SIP Testing')
  log('=' .repeat(80))
  
  // Connect to database
  if (!(await connectToDatabase())) {
    logError('Cannot proceed without database connection')
    return
  }
  
  // Run test suites
  await testServiceHealth()
  await testBulkIVRCampaign()
  await testQuickIVR()
  await testOutboundSIP()
  await testIntegration()
  
  // Print summary
  log('=' .repeat(80))
  log('🏁 TEST SUMMARY')
  log(`Total Tests: ${testResults.total}`)
  log(`✅ Passed: ${testResults.passed}`)
  log(`❌ Failed: ${testResults.failed}`)
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`)
  
  if (testResults.errors.length > 0) {
    log('\n🔍 ERRORS ENCOUNTERED:')
    testResults.errors.forEach((error, index) => {
      log(`${index + 1}. ${error}`)
    })
  }
  
  // Close database connection
  if (dbConnection) {
    await dbConnection.client.close()
    log('Database connection closed')
  }
  
  log('Testing completed!')
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0)
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(error => {
    logError(`Test execution failed: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  runAllTests,
  testResults
}