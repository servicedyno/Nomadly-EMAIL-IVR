// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test: Fix trial IVR call consumed on busy/no-answer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

console.log('🔍 Testing Fix trial IVR call consumed on busy/no-answer...\n');

async function runTests() {
  const results = {
    healthCheck: false,
    errorLogCheck: false,
    codeVerification: {
      indexJsTrialRemoved: false,
      indexJsStateInDeps: false,
      voiceServiceStateVar: false,
      voiceServiceInitState: false,
      voiceServiceCallWasAnswered: false,
      voiceServiceUserBusyHandling: false,
      voiceServiceTrialLogic: false,
    },
    databaseVerification: false,
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Health Check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('1. 🏥 Health Check...');
  try {
    const response = await fetch('http://localhost:5000/health');
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      console.log('   ✅ Health endpoint returns 200 with healthy status');
      results.healthCheck = true;
    } else {
      console.log('   ❌ Health endpoint failed or not healthy');
    }
  } catch (e) {
    console.log('   ❌ Health endpoint unreachable:', e.message);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Error Log Check  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n2. 📋 Error Log Check...');
  try {
    const logPath = '/var/log/supervisor/nodejs.err.log';
    const stats = fs.statSync(logPath);
    
    if (stats.size === 0) {
      console.log('   ✅ nodejs.err.log is 0 bytes (no errors)');
      results.errorLogCheck = true;
    } else {
      console.log('   ❌ nodejs.err.log has content (possible errors)');
      console.log('   📄 First 500 chars:', fs.readFileSync(logPath, 'utf8').substring(0, 500));
    }
  } catch (e) {
    console.log('   ⚠️  Could not check error log:', e.message);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Code Verification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n3. 💻 Code Verification...');
  
  // Check _index.js changes
  console.log('   📁 Checking /app/js/_index.js...');
  try {
    const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
    
    // Check around line 11984 for removed trial marking
    const lines = indexContent.split('\n');
    const targetLineIdx = 11984;  // 0-based index would be 11983
    const contextLines = lines.slice(targetLineIdx - 5, targetLineIdx + 5);
    
    if (contextLines.some(line => line.includes('Trial marking moved to voice-service.js handleOutboundIvrHangup'))) {
      console.log('   ✅ Old trial marking block removed and replaced with comment');
      results.codeVerification.indexJsTrialRemoved = true;
    } else {
      console.log('   ❌ Trial marking comment not found around expected location');
    }

    // Check initVoiceService call includes state
    const initVoiceMatch = indexContent.match(/initVoiceService\(\{[^}]*state[^}]*\}/s);
    if (initVoiceMatch) {
      console.log('   ✅ initVoiceService call includes state in dependencies');
      results.codeVerification.indexJsStateInDeps = true;
    } else {
      console.log('   ❌ initVoiceService call does not include state in dependencies');
    }
    
  } catch (e) {
    console.log('   ❌ Error reading _index.js:', e.message);
  }

  // Check voice-service.js changes
  console.log('   📁 Checking /app/js/voice-service.js...');
  try {
    const voiceContent = fs.readFileSync('/app/js/voice-service.js', 'utf8');
    
    // Check for _state variable
    if (voiceContent.includes('let _state = null')) {
      console.log('   ✅ _state variable declared');
      results.codeVerification.voiceServiceStateVar = true;
    } else {
      console.log('   ❌ _state variable not found');
    }

    // Check initVoiceService sets _state
    if (voiceContent.includes('_state = deps.state')) {
      console.log('   ✅ initVoiceService sets _state from deps.state');
      results.codeVerification.voiceServiceInitState = true;
    } else {
      console.log('   ❌ initVoiceService does not set _state from deps.state');
    }

    // Check callWasAnswered flag
    if (voiceContent.includes('callWasAnswered = session.phase !== \'ringing\' && session.phase !== \'initiated\'')) {
      console.log('   ✅ callWasAnswered flag implemented correctly');
      results.codeVerification.voiceServiceCallWasAnswered = true;
    } else {
      console.log('   ❌ callWasAnswered flag not found or incorrectly implemented');
    }

    // Check user_busy handling
    if (voiceContent.includes('hangupCause === \'user_busy\'')) {
      console.log('   ✅ user_busy hangup cause handling added');
      results.codeVerification.voiceServiceUserBusyHandling = true;
    } else {
      console.log('   ❌ user_busy hangup cause handling not found');
    }

    // Check trial logic
    if (voiceContent.includes('if (callWasAnswered)') && 
        voiceContent.includes('set(_state, trialKey, true)') &&
        voiceContent.includes('Your free trial call is still available')) {
      console.log('   ✅ Trial logic implemented correctly (only marked used if answered)');
      results.codeVerification.voiceServiceTrialLogic = true;
    } else {
      console.log('   ❌ Trial logic not correctly implemented');
    }
    
  } catch (e) {
    console.log('   ❌ Error reading voice-service.js:', e.message);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Database Verification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n4. 🗄️  Database Verification...');
  try {
    const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
    const client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db();
    const state = db.collection('state');
    
    const trialRecord = await state.findOne({ _id: 'ivrTrialUsed_8737445617' });
    
    if (!trialRecord) {
      console.log('   ✅ ivrTrialUsed_8737445617 successfully deleted from state collection');
      results.databaseVerification = true;
    } else {
      console.log('   ❌ ivrTrialUsed_8737445617 still exists in state collection');
    }
    
    await client.close();
    
  } catch (e) {
    console.log('   ❌ Database verification error:', e.message);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  console.log('\n🔍 TEST SUMMARY:');
  console.log('================');
  
  const allPassed = results.healthCheck && 
                   results.errorLogCheck && 
                   Object.values(results.codeVerification).every(v => v) && 
                   results.databaseVerification;

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - Fix trial IVR call consumed on busy/no-answer working correctly!');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  
  console.log('\nDetailed Results:');
  console.log('• Health Check:', results.healthCheck ? '✅ PASS' : '❌ FAIL');
  console.log('• Error Log Check:', results.errorLogCheck ? '✅ PASS' : '❌ FAIL');
  console.log('• Code Verification:');
  console.log('  - _index.js trial removal:', results.codeVerification.indexJsTrialRemoved ? '✅ PASS' : '❌ FAIL');
  console.log('  - _index.js state in deps:', results.codeVerification.indexJsStateInDeps ? '✅ PASS' : '❌ FAIL');
  console.log('  - voice-service.js _state var:', results.codeVerification.voiceServiceStateVar ? '✅ PASS' : '❌ FAIL');
  console.log('  - voice-service.js init _state:', results.codeVerification.voiceServiceInitState ? '✅ PASS' : '❌ FAIL');
  console.log('  - voice-service.js callWasAnswered:', results.codeVerification.voiceServiceCallWasAnswered ? '✅ PASS' : '❌ FAIL');
  console.log('  - voice-service.js user_busy handling:', results.codeVerification.voiceServiceUserBusyHandling ? '✅ PASS' : '❌ FAIL');
  console.log('  - voice-service.js trial logic:', results.codeVerification.voiceServiceTrialLogic ? '✅ PASS' : '❌ FAIL');
  console.log('• Database Verification:', results.databaseVerification ? '✅ PASS' : '❌ FAIL');
  
  return allPassed;
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});