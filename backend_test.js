// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Backend Test for Nomadly Telegram Bot - Bulk Call Campaign and Audio Library Features
// Testing Node.js Express Backend on Port 5000
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get backend URL from environment
const BACKEND_URL = 'http://localhost:5000';

// Test counter
let testCount = 0;
let passedCount = 0;

function log(message) {
  console.log(`[TEST] ${message}`);
}

function test(description, result) {
  testCount++;
  const status = result ? '✅ PASS' : '❌ FAIL';
  log(`${testCount}. ${description}: ${status}`);
  if (result) passedCount++;
  return result;
}

async function runTests() {
  log('Starting Nomadly Telegram Bot Backend Tests...');
  log(`Backend URL: ${BACKEND_URL}`);
  log('');

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 1: Node.js Health Check
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== HEALTH CHECKS ===');
    
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/api/health`);
      const healthData = healthResponse.data;
      
      test('Node.js starts cleanly and responds to health check', 
        healthResponse.status === 200 && 
        healthData.status === 'healthy' && 
        healthData.database === 'connected'
      );
    } catch (error) {
      test('Node.js starts cleanly and responds to health check', false);
      log(`Health check error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 2: Check Service Logs for Initialization
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== SERVICE INITIALIZATION ===');
    
    try {
      const { spawn } = require('child_process');
      const grep = spawn('grep', ['-i', '\\[AudioLibrary\\] Initialized\\|\\[BulkCall\\] Service initialized', '/var/log/supervisor/nodejs.out.log']);
      
      let output = '';
      grep.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve) => {
        grep.on('close', () => resolve());
      });
      
      const hasAudioLibInit = output.includes('[AudioLibrary] Initialized');
      const hasBulkCallInit = output.includes('[BulkCall] Service initialized');
      
      test('Audio Library Service initializes correctly', hasAudioLibInit);
      test('Bulk Call Service initializes correctly', hasBulkCallInit);
      
    } catch (error) {
      test('Audio Library Service initializes correctly', false);
      test('Bulk Call Service initializes correctly', false);
      log(`Log check error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 3: Audio Library Service Exports
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== AUDIO LIBRARY SERVICE VERIFICATION ===');
    
    try {
      const audioLibraryService = require('/app/js/audio-library-service.js');
      const expectedExports = [
        'initAudioLibrary',
        'downloadAndSave', 
        'saveAudio',
        'listAudios',
        'getAudio',
        'deleteAudio',
        'renameAudio',
        'getAudioUrl',
        'AUDIO_DIR'
      ];
      
      const hasAllExports = expectedExports.every(exportName => 
        typeof audioLibraryService[exportName] !== 'undefined'
      );
      
      test('Audio Library Service has all required exports', hasAllExports);
      
      if (!hasAllExports) {
        const missing = expectedExports.filter(name => !audioLibraryService[name]);
        log(`Missing exports: ${missing.join(', ')}`);
      }
      
    } catch (error) {
      test('Audio Library Service has all required exports', false);
      log(`Audio Library Service error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 4: Bulk Call Service Exports
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== BULK CALL SERVICE VERIFICATION ===');
    
    try {
      const bulkCallService = require('/app/js/bulk-call-service.js');
      const expectedExports = [
        'initBulkCallService',
        'parseLeadsFile',
        'createCampaign',
        'startCampaign',
        'onCallComplete',
        'cancelCampaign',
        'pauseCampaign',
        'getCampaign',
        'getUserCampaigns',
        'isBulkCall',
        'getCampaignMapping'
      ];
      
      const hasAllExports = expectedExports.every(exportName => 
        typeof bulkCallService[exportName] !== 'undefined'
      );
      
      test('Bulk Call Service has all required exports', hasAllExports);
      
      if (!hasAllExports) {
        const missing = expectedExports.filter(name => !bulkCallService[name]);
        log(`Missing exports: ${missing.join(', ')}`);
      }
      
    } catch (error) {
      test('Bulk Call Service has all required exports', false);
      log(`Bulk Call Service error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 5: parseLeadsFile Function Testing
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== PARSE LEADS FILE TESTING ===');
    
    try {
      const bulkCallService = require('/app/js/bulk-call-service.js');
      
      // Test 1: Simple phone numbers
      const testInput1 = "+41791234567\n+33612345678";
      const result1 = bulkCallService.parseLeadsFile(testInput1);
      test('parseLeadsFile handles simple phone numbers', 
        result1.leads.length === 2 && 
        result1.leads[0].number === '+41791234567' &&
        result1.leads[1].number === '+33612345678' &&
        result1.errors.length === 0
      );
      
      // Test 2: CSV with names
      const testInput2 = "+41791234567,John\n+33612345678,Marie";
      const result2 = bulkCallService.parseLeadsFile(testInput2);
      test('parseLeadsFile handles CSV with names', 
        result2.leads.length === 2 && 
        result2.leads[0].name === 'John' &&
        result2.leads[1].name === 'Marie' &&
        result2.errors.length === 0
      );
      
      // Test 3: Invalid input
      const testInput3 = "invalid";
      const result3 = bulkCallService.parseLeadsFile(testInput3);
      test('parseLeadsFile handles invalid input correctly', 
        result3.leads.length === 0 && 
        result3.errors.length === 1
      );
      
      // Test 4: Duplicate numbers (should be deduplicated)
      const testInput4 = "+41791234567\n+41791234567\n+33612345678";
      const result4 = bulkCallService.parseLeadsFile(testInput4);
      test('parseLeadsFile deduplicates numbers', 
        result4.leads.length === 2 &&
        result4.leads.every(lead => ['+41791234567', '+33612345678'].includes(lead.number))
      );
      
    } catch (error) {
      test('parseLeadsFile handles simple phone numbers', false);
      test('parseLeadsFile handles CSV with names', false);
      test('parseLeadsFile handles invalid input correctly', false);
      test('parseLeadsFile deduplicates numbers', false);
      log(`parseLeadsFile testing error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 6: Voice Service Changes
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== VOICE SERVICE INTEGRATION ===');
    
    try {
      const voiceServicePath = '/app/js/voice-service.js';
      const voiceServiceContent = fs.readFileSync(voiceServicePath, 'utf8');
      
      // Check initiateOutboundIvrCall function signature
      const hasInitiateOutboundIvrCall = voiceServiceContent.includes('initiateOutboundIvrCall') &&
        voiceServiceContent.includes('campaignId') &&
        voiceServiceContent.includes('leadIndex') &&
        voiceServiceContent.includes('bulkMode');
      
      test('initiateOutboundIvrCall supports bulk campaign parameters', hasInitiateOutboundIvrCall);
      
      // Check handleOutboundIvrGatherEnded has report_only mode
      const hasReportOnlyMode = voiceServiceContent.includes('handleOutboundIvrGatherEnded') &&
        voiceServiceContent.includes('report_only') &&
        voiceServiceContent.includes('Thank you. Goodbye');
      
      test('handleOutboundIvrGatherEnded has report_only mode', hasReportOnlyMode);
      
      // Check handleOutboundIvrHangup calls bulkCallService.onCallComplete
      const hasOnCallComplete = voiceServiceContent.includes('handleOutboundIvrHangup') &&
        voiceServiceContent.includes('bulkCallService.onCallComplete');
      
      test('handleOutboundIvrHangup calls bulkCallService.onCallComplete', hasOnCallComplete);
      
    } catch (error) {
      test('initiateOutboundIvrCall supports bulk campaign parameters', false);
      test('handleOutboundIvrGatherEnded has report_only mode', false);
      test('handleOutboundIvrHangup calls bulkCallService.onCallComplete', false);
      log(`Voice service verification error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 7: Phone Config Buttons
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== PHONE CONFIG VERIFICATION ===');
    
    try {
      const phoneConfig = require('/app/js/phone-config.js');
      
      const hasBulkCallButton = phoneConfig.btn.bulkCallCampaign === '📞 Bulk Call Campaign';
      const hasAudioLibraryButton = phoneConfig.btn.audioLibrary === '🎵 Audio Library';
      
      test('Phone config has bulkCallCampaign button', hasBulkCallButton);
      test('Phone config has audioLibrary button', hasAudioLibraryButton);
      
    } catch (error) {
      test('Phone config has bulkCallCampaign button', false);
      test('Phone config has audioLibrary button', false);
      log(`Phone config verification error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 8: Action Constants in _index.js
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== ACTION CONSTANTS VERIFICATION ===');
    
    try {
      const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      const requiredActions = [
        'bulkSelectCaller',
        'bulkUploadLeads', 
        'bulkSelectAudio',
        'bulkUploadAudio',
        'bulkNameAudio',
        'bulkSelectMode',
        'bulkEnterTransfer',
        'bulkSetConcurrency',
        'bulkConfirm',
        'bulkRunning',
        'audioLibMenu',
        'audioLibUpload',
        'audioLibName'
      ];
      
      const hasAllActions = requiredActions.every(action => 
        indexContent.includes(action)
      );
      
      test('_index.js contains all required action constants', hasAllActions);
      
      if (!hasAllActions) {
        const missing = requiredActions.filter(action => !indexContent.includes(action));
        log(`Missing actions: ${missing.join(', ')}`);
      }
      
    } catch (error) {
      test('_index.js contains all required action constants', false);
      log(`Action constants verification error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 9: Cloud Phone Hub Menu Integration
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== CLOUD PHONE HUB MENU VERIFICATION ===');
    
    try {
      const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      // Check if submenu5 function includes the new buttons
      const hasHubMenuIntegration = indexContent.includes('pc.bulkCallCampaign') &&
        indexContent.includes('pc.audioLibrary') &&
        indexContent.includes('submenu5');
      
      test('Cloud Phone hub menu includes bulk campaign and audio library buttons', hasHubMenuIntegration);
      
    } catch (error) {
      test('Cloud Phone hub menu includes bulk campaign and audio library buttons', false);
      log(`Hub menu verification error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 10: User-Audio Directory
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== USER-AUDIO DIRECTORY VERIFICATION ===');
    
    try {
      const userAudioDir = '/app/js/assets/user-audio/';
      const dirExists = fs.existsSync(userAudioDir);
      const isDirectory = dirExists && fs.statSync(userAudioDir).isDirectory();
      
      test('User-audio directory exists and is accessible', dirExists && isDirectory);
      
    } catch (error) {
      test('User-audio directory exists and is accessible', false);
      log(`User-audio directory verification error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 11: Static Assets Serving
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== STATIC ASSETS SERVING VERIFICATION ===');
    
    try {
      // Check if the static route is configured
      const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
      const hasStaticRoute = indexContent.includes('/assets') && 
        indexContent.includes('express.static') &&
        indexContent.includes('assets');
      
      test('Static assets serving route is configured', hasStaticRoute);
      
      // Try to access the assets endpoint (should return directory listing or 404, but not error)
      try {
        const assetsResponse = await axios.get(`${BACKEND_URL}/assets/`);
        test('Assets endpoint is accessible', true);
      } catch (error) {
        // 404 is acceptable for directory listing, but connection errors are not
        const is404 = error.response && error.response.status === 404;
        test('Assets endpoint is accessible', is404);
        if (!is404) {
          log(`Assets endpoint error: ${error.message}`);
        }
      }
      
    } catch (error) {
      test('Static assets serving route is configured', false);
      test('Assets endpoint is accessible', false);
      log(`Static assets verification error: ${error.message}`);
    }

  } catch (error) {
    log(`Overall test error: ${error.message}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  log('');
  log('=== TEST SUMMARY ===');
  log(`Total Tests: ${testCount}`);
  log(`Passed: ${passedCount}`);
  log(`Failed: ${testCount - passedCount}`);
  log(`Success Rate: ${((passedCount / testCount) * 100).toFixed(1)}%`);
  
  if (passedCount === testCount) {
    log('🎉 ALL TESTS PASSED!');
  } else {
    log(`⚠️  ${testCount - passedCount} tests failed. See details above.`);
  }
  
  return { total: testCount, passed: passedCount, failed: testCount - passedCount };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };