// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Plan Gating Test for IVR Outbound Call and Bulk Call Campaign Features
// Testing Node.js Express Backend on Port 5000
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get backend URL from environment (check for production first, fallback to localhost)
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

// Test counter
let testCount = 0;
let passedCount = 0;

function log(message) {
  console.log(`[PLAN-GATING-TEST] ${message}`);
}

function test(description, result) {
  testCount++;
  const status = result ? '✅ PASS' : '❌ FAIL';
  log(`${testCount}. ${description}: ${status}`);
  if (result) passedCount++;
  return result;
}

async function runPlanGatingTests() {
  log('Starting Plan Gating Tests for IVR Outbound Call and Bulk Call Campaign...');
  log(`Backend URL: ${BACKEND_URL}`);
  log('');

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 1: Service Startup
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== SERVICE STARTUP ===');
    
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/health`);
      const healthData = healthResponse.data;
      
      test('Node.js service is healthy and running', 
        healthResponse.status === 200 && 
        (healthData.status === 'healthy' || healthData.status === 'starting')
      );
      
      if (healthData.database) {
        test('Database connection is working', healthData.database === 'connected');
      }
    } catch (error) {
      test('Node.js service is healthy and running', false);
      log(`Health check error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 2: Feature Access Matrix (CRITICAL)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== FEATURE ACCESS MATRIX VERIFICATION ===');
    
    try {
      // Load phone-config.js module directly
      const phoneConfigPath = '/app/js/phone-config.js';
      delete require.cache[require.resolve(phoneConfigPath)]; // Clear cache
      const phoneConfig = require(phoneConfigPath);
      
      // Expected feature access matrix
      const expectedMatrix = {
        starter: {
          callForwarding: true,
          smsToTelegram: true,
          smsToEmail: false,
          smsWebhook: false,
          voicemail: false,
          sipCredentials: false,
          callRecording: false,
          ivr: false,
          ivrOutbound: false,
          bulkCall: false
        },
        pro: {
          callForwarding: true,
          smsToTelegram: true,
          smsToEmail: true,
          smsWebhook: true,
          voicemail: true,
          sipCredentials: true,
          callRecording: false,
          ivr: false,
          ivrOutbound: true,
          bulkCall: true
        },
        business: {
          callForwarding: true,
          smsToTelegram: true,
          smsToEmail: true,
          smsWebhook: true,
          voicemail: true,
          sipCredentials: true,
          callRecording: true,
          ivr: true,
          ivrOutbound: true,
          bulkCall: true
        }
      };
      
      // Test each plan/feature combination
      let matrixCorrect = true;
      let matrixErrors = [];
      
      for (const [plan, features] of Object.entries(expectedMatrix)) {
        for (const [feature, expected] of Object.entries(features)) {
          const actual = phoneConfig.canAccessFeature(plan, feature);
          if (actual !== expected) {
            matrixCorrect = false;
            matrixErrors.push(`${plan}.${feature}: expected ${expected}, got ${actual}`);
          }
        }
      }
      
      test('Feature access matrix matches specification', matrixCorrect);
      
      if (!matrixCorrect) {
        log(`Matrix errors: ${matrixErrors.join(', ')}`);
      }
      
      // Test specific cases mentioned in review
      test('starter.ivrOutbound = false', phoneConfig.canAccessFeature('starter', 'ivrOutbound') === false);
      test('starter.bulkCall = false', phoneConfig.canAccessFeature('starter', 'bulkCall') === false);
      test('pro.ivrOutbound = true', phoneConfig.canAccessFeature('pro', 'ivrOutbound') === true);
      test('pro.bulkCall = true', phoneConfig.canAccessFeature('pro', 'bulkCall') === true);
      test('business.ivrOutbound = true', phoneConfig.canAccessFeature('business', 'ivrOutbound') === true);
      test('business.bulkCall = true', phoneConfig.canAccessFeature('business', 'bulkCall') === true);
      
    } catch (error) {
      test('Feature access matrix matches specification', false);
      test('starter.ivrOutbound = false', false);
      test('starter.bulkCall = false', false);
      test('pro.ivrOutbound = true', false);
      test('pro.bulkCall = true', false);
      test('business.ivrOutbound = true', false);
      test('business.bulkCall = true', false);
      log(`Feature access matrix error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 3: Upgrade Messages
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== UPGRADE MESSAGES VERIFICATION ===');
    
    try {
      const phoneConfig = require('/app/js/phone-config.js');
      
      // Test ivrOutbound upgrade message
      const ivrOutboundMsg = phoneConfig.upgradeMessage('ivrOutbound', 'Starter');
      const hasIvrOutboundFeature = ivrOutboundMsg.includes('IVR Outbound Call');
      const hasIvrOutboundPro = ivrOutboundMsg.includes('Pro');
      test('upgradeMessage for ivrOutbound contains feature name and Pro plan', 
        hasIvrOutboundFeature && hasIvrOutboundPro);
      
      // Test bulkCall upgrade message  
      const bulkCallMsg = phoneConfig.upgradeMessage('bulkCall', 'Starter');
      const hasBulkCallFeature = bulkCallMsg.includes('Bulk Call Campaign');
      const hasBulkCallPro = bulkCallMsg.includes('Pro');
      test('upgradeMessage for bulkCall contains feature name and Pro plan',
        hasBulkCallFeature && hasBulkCallPro);
      
      // Test ivr upgrade message (should require Business)
      const ivrMsg = phoneConfig.upgradeMessage('ivr', 'Pro');
      const hasIvrFeature = ivrMsg.includes('IVR / Auto-attendant');
      const hasIvrBusiness = ivrMsg.includes('Business');
      test('upgradeMessage for ivr contains feature name and Business plan',
        hasIvrFeature && hasIvrBusiness);
      
      // Test sipCredentials upgrade message
      const sipMsg = phoneConfig.upgradeMessage('sipCredentials', 'Starter');
      const hasSipFeature = sipMsg.includes('SIP Credentials');
      const hasSipPro = sipMsg.includes('Pro');
      test('upgradeMessage for sipCredentials contains feature name and Pro plan',
        hasSipFeature && hasSipPro);
      
    } catch (error) {
      test('upgradeMessage for ivrOutbound contains feature name and Pro plan', false);
      test('upgradeMessage for bulkCall contains feature name and Pro plan', false);
      test('upgradeMessage for ivr contains feature name and Business plan', false);
      test('upgradeMessage for sipCredentials contains feature name and Pro plan', false);
      log(`Upgrade messages error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 4: planFeatureAccess Structure
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== PLAN FEATURE ACCESS STRUCTURE ===');
    
    try {
      const phoneConfig = require('/app/js/phone-config.js');
      
      const expectedKeys = [
        'callForwarding', 'smsToTelegram', 'smsToEmail', 'smsWebhook', 
        'voicemail', 'sipCredentials', 'callRecording', 'ivr', 'ivrOutbound', 'bulkCall'
      ];
      
      // Check starter plan (should have 2 true values)
      const starterKeys = Object.keys(phoneConfig.planFeatureAccess.starter);
      const starterHasAllKeys = expectedKeys.every(key => starterKeys.includes(key));
      const starterTrueCount = Object.values(phoneConfig.planFeatureAccess.starter).filter(v => v === true).length;
      
      test('Starter plan has exactly 10 feature keys', starterKeys.length === 10);
      test('Starter plan has all expected feature keys', starterHasAllKeys);
      test('Starter plan has exactly 2 true values', starterTrueCount === 2);
      
      // Check pro plan (should have 8 true values: callForwarding, smsToTelegram + smsToEmail, smsWebhook, voicemail, sipCredentials, ivrOutbound, bulkCall)
      const proKeys = Object.keys(phoneConfig.planFeatureAccess.pro);
      const proHasAllKeys = expectedKeys.every(key => proKeys.includes(key));
      const proTrueCount = Object.values(phoneConfig.planFeatureAccess.pro).filter(v => v === true).length;
      
      test('Pro plan has exactly 10 feature keys', proKeys.length === 10);
      test('Pro plan has all expected feature keys', proHasAllKeys);
      test('Pro plan has exactly 8 true values', proTrueCount === 8);
      
      // Check business plan (should have 10 true values - all)
      const businessKeys = Object.keys(phoneConfig.planFeatureAccess.business);
      const businessHasAllKeys = expectedKeys.every(key => businessKeys.includes(key));
      const businessTrueCount = Object.values(phoneConfig.planFeatureAccess.business).filter(v => v === true).length;
      
      test('Business plan has exactly 10 feature keys', businessKeys.length === 10);
      test('Business plan has all expected feature keys', businessHasAllKeys);
      test('Business plan has exactly 10 true values (all)', businessTrueCount === 10);
      
    } catch (error) {
      test('Starter plan has exactly 10 feature keys', false);
      test('Starter plan has all expected feature keys', false);
      test('Starter plan has exactly 2 true values', false);
      test('Pro plan has exactly 10 feature keys', false);
      test('Pro plan has all expected feature keys', false);
      test('Pro plan has exactly 7 true values', false);
      test('Business plan has exactly 10 feature keys', false);
      test('Business plan has all expected feature keys', false);
      test('Business plan has exactly 10 true values (all)', false);
      log(`Plan structure error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 5: Bot Flow Gating (Code Analysis)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== BOT FLOW GATING CODE ANALYSIS ===');
    
    try {
      const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      // Find IVR Outbound handler
      const ivrOutboundHandler = indexContent.includes('message === pc.ivrOutboundCall');
      const ivrOutboundCheck = indexContent.includes('phoneConfig.canAccessFeature(n.plan, \'ivrOutbound\')') ||
                              indexContent.includes('phoneConfig.canAccessFeature(n.plan, "ivrOutbound")');
      const ivrOutboundUpgrade = indexContent.includes('phoneConfig.upgradeMessage(\'ivrOutbound\'') ||
                               indexContent.includes('phoneConfig.upgradeMessage("ivrOutbound"');
      
      test('IVR Outbound handler exists in _index.js', ivrOutboundHandler);
      test('IVR Outbound handler calls canAccessFeature with ivrOutbound', ivrOutboundCheck);
      test('IVR Outbound handler calls upgradeMessage for plan restrictions', ivrOutboundUpgrade);
      
      // Find Bulk Call handler
      const bulkCallHandler = indexContent.includes('message === pc.bulkCallCampaign');
      const bulkCallCheck = indexContent.includes('phoneConfig.canAccessFeature(n.plan, \'bulkCall\')') ||
                           indexContent.includes('phoneConfig.canAccessFeature(n.plan, "bulkCall")');
      const bulkCallUpgrade = indexContent.includes('phoneConfig.upgradeMessage(\'bulkCall\'') ||
                            indexContent.includes('phoneConfig.upgradeMessage("bulkCall"');
      
      test('Bulk Call handler exists in _index.js', bulkCallHandler);  
      test('Bulk Call handler calls canAccessFeature with bulkCall', bulkCallCheck);
      test('Bulk Call handler calls upgradeMessage for plan restrictions', bulkCallUpgrade);
      
    } catch (error) {
      test('IVR Outbound handler exists in _index.js', false);
      test('IVR Outbound handler calls canAccessFeature with ivrOutbound', false);
      test('IVR Outbound handler calls upgradeMessage for plan restrictions', false);
      test('Bulk Call handler exists in _index.js', false);
      test('Bulk Call handler calls canAccessFeature with bulkCall', false);
      test('Bulk Call handler calls upgradeMessage for plan restrictions', false);
      log(`Bot flow gating error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 6: Existing Features Still Work
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== EXISTING FEATURES VERIFICATION ===');
    
    try {
      const phoneConfig = require('/app/js/phone-config.js');
      
      // Test existing feature access patterns
      test('Business plan can access callRecording', 
        phoneConfig.canAccessFeature('business', 'callRecording') === true);
      test('Pro plan cannot access callRecording', 
        phoneConfig.canAccessFeature('pro', 'callRecording') === false);
      test('Pro plan can access voicemail', 
        phoneConfig.canAccessFeature('pro', 'voicemail') === true);
      test('Starter plan cannot access voicemail', 
        phoneConfig.canAccessFeature('starter', 'voicemail') === false);
      test('Starter plan can access callForwarding', 
        phoneConfig.canAccessFeature('starter', 'callForwarding') === true);
      test('Starter plan can access smsToTelegram', 
        phoneConfig.canAccessFeature('starter', 'smsToTelegram') === true);
      
    } catch (error) {
      test('Business plan can access callRecording', false);
      test('Pro plan cannot access callRecording', false);
      test('Pro plan can access voicemail', false);
      test('Starter plan cannot access voicemail', false);
      test('Starter plan can access callForwarding', false);
      test('Starter plan can access smsToTelegram', false);
      log(`Existing features error: ${error.message}`);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 7: Final Health Check
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    log('=== FINAL SERVICE HEALTH CHECK ===');
    
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/health`);
      test('Service remains healthy after tests', healthResponse.status === 200);
    } catch (error) {
      test('Service remains healthy after tests', false);
      log(`Final health check error: ${error.message}`);
    }

  } catch (error) {
    log(`Overall test error: ${error.message}`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Test Summary
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  log('');
  log('=== PLAN GATING TEST SUMMARY ===');
  log(`Total Tests: ${testCount}`);
  log(`Passed: ${passedCount}`);
  log(`Failed: ${testCount - passedCount}`);
  log(`Success Rate: ${((passedCount / testCount) * 100).toFixed(1)}%`);
  
  if (passedCount === testCount) {
    log('🎉 ALL PLAN GATING TESTS PASSED!');
    log('✅ IVR Outbound Call and Bulk Call Campaign plan gating is working correctly');
  } else {
    log(`⚠️  ${testCount - passedCount} tests failed. See details above.`);
  }
  
  return { total: testCount, passed: passedCount, failed: testCount - passedCount };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runPlanGatingTests().catch(console.error);
}

module.exports = { runPlanGatingTests };