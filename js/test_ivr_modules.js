#!/usr/bin/env node
/**
 * IVR Outbound Module Tests - runs from /app/js directory
 */

console.log("🚀 Testing IVR Outbound Call Modules from js directory...\n");

let totalTests = 0;
let passedTests = 0;

function runTest(testName, testFunction) {
  totalTests++;
  console.log(`🔍 ${testName}`);
  
  try {
    const result = testFunction();
    if (result) {
      passedTests++;
      console.log(`✅ PASSED\n`);
      return true;
    } else {
      console.log(`❌ FAILED\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAILED - Error: ${error.message}\n`);
    return false;
  }
}

// Test 1: ivr-outbound.js comprehensive functionality
function testIvrOutbound() {
  const ivrOutbound = require('./ivr-outbound.js');
  
  console.log("  Testing ivr-outbound.js exports and functions...");
  
  // Test getCategoryButtons
  const categoryButtons = ivrOutbound.getCategoryButtons();
  if (!Array.isArray(categoryButtons) || categoryButtons.length !== 4) {
    console.log(`  ❌ getCategoryButtons: expected 4 buttons, got ${categoryButtons?.length}`);
    return false;
  }
  console.log(`  ✅ getCategoryButtons: ${categoryButtons.length} category buttons`);

  // Test getCategoryByButton
  const paymentButton = "💳 Payment Alerts";
  const categoryKey = ivrOutbound.getCategoryByButton(paymentButton);
  if (categoryKey !== 'payment') {
    console.log(`  ❌ getCategoryByButton: expected 'payment', got '${categoryKey}'`);
    return false;
  }
  console.log(`  ✅ getCategoryByButton: correctly maps "${paymentButton}" → "${categoryKey}"`);

  // Test getTemplateButtons
  const templates = ivrOutbound.getTemplateButtons('payment');
  if (!Array.isArray(templates) || templates.length === 0) {
    console.log(`  ❌ getTemplateButtons: no payment templates found`);
    return false;
  }
  console.log(`  ✅ getTemplateButtons: found ${templates.length} payment templates`);

  // Test getTemplateByButton
  const firstTemplate = templates[0];
  const templateData = ivrOutbound.getTemplateByButton('payment', firstTemplate);
  if (!templateData || !templateData.key || !templateData.text) {
    console.log(`  ❌ getTemplateByButton: invalid template data`);
    return false;
  }
  console.log(`  ✅ getTemplateByButton: returns template "${templateData.key}" with text`);

  // Test fillTemplate
  const testText = "Hello [Name]. Payment of $[Amount] to [Company].";
  const values = {Name: 'Alice', Amount: '250.50', Company: 'TestBank'};
  const filled = ivrOutbound.fillTemplate(testText, values);
  const expected = "Hello Alice. Payment of $250.50 to TestBank.";
  if (filled !== expected) {
    console.log(`  ❌ fillTemplate: expected "${expected}", got "${filled}"`);
    return false;
  }
  console.log(`  ✅ fillTemplate: correctly replaces all placeholders`);

  // Test extractPlaceholders
  const placeholders = ivrOutbound.extractPlaceholders(testText);
  const expectedPlaceholders = ['Name', 'Amount', 'Company'];
  if (!expectedPlaceholders.every(p => placeholders.includes(p))) {
    console.log(`  ❌ extractPlaceholders: expected [${expectedPlaceholders.join(', ')}], got [${placeholders.join(', ')}]`);
    return false;
  }
  console.log(`  ✅ extractPlaceholders: found [${placeholders.join(', ')}]`);

  // Test formatCallPreview
  const previewData = {
    targetNumber: '+1555123456',
    callerId: '+18556820054',
    ivrNumber: '+1555987654',
    templateName: 'Payment Notification',
    placeholderValues: {Name: 'Bob', Bank: 'TestBank', Amount: '75.00'},
    voiceName: 'Rachel',
    activeKeys: ['1']
  };
  const preview = ivrOutbound.formatCallPreview(previewData);
  if (!preview.includes('Review Your Call') || !preview.includes('+1555123456') || !preview.includes('Bob')) {
    console.log(`  ❌ formatCallPreview: missing required elements`);
    return false;
  }
  console.log(`  ✅ formatCallPreview: generates complete call preview`);

  // Test formatCallNotification
  const answerNotif = ivrOutbound.formatCallNotification('answered', {targetNumber: '+1555123456'});
  if (!answerNotif.includes('Call answered')) {
    console.log(`  ❌ formatCallNotification: 'answered' type doesn't work`);
    return false;
  }
  
  const keyNotif = ivrOutbound.formatCallNotification('key_pressed', {digit: '1', ivrNumber: '+1555987654'});
  if (!keyNotif.includes('pressed 1')) {
    console.log(`  ❌ formatCallNotification: 'key_pressed' type doesn't work`);
    return false;
  }
  console.log(`  ✅ formatCallNotification: handles multiple notification types`);

  return true;
}

// Test 2: telnyx-service.js specific exports
function testTelnyxService() {
  const telnyxService = require('./telnyx-service.js');
  
  console.log("  Testing telnyx-service.js required exports...");
  
  const requiredFunctions = [
    'createOutboundCall',
    'gatherDTMFWithAudio',
    'playbackStart'
  ];

  let functionsPassed = 0;

  requiredFunctions.forEach(fn => {
    if (typeof telnyxService[fn] === 'function') {
      console.log(`  ✅ ${fn}: function exported`);
      functionsPassed++;
    } else {
      console.log(`  ❌ ${fn}: missing or not a function (type: ${typeof telnyxService[fn]})`);
    }
  });

  return functionsPassed === requiredFunctions.length;
}

// Test 3: voice-service.js specific exports
function testVoiceService() {
  const voiceService = require('./voice-service.js');
  
  console.log("  Testing voice-service.js required exports...");
  
  let passed = 0;
  let total = 0;

  // Test initiateOutboundIvrCall function
  total++;
  if (typeof voiceService.initiateOutboundIvrCall === 'function') {
    console.log(`  ✅ initiateOutboundIvrCall: function exported`);
    passed++;
  } else {
    console.log(`  ❌ initiateOutboundIvrCall: missing or not a function`);
  }

  // Test outboundIvrCalls store
  total++;
  if (typeof voiceService.outboundIvrCalls === 'object' && voiceService.outboundIvrCalls !== null) {
    console.log(`  ✅ outboundIvrCalls: store exported as object`);
    passed++;
  } else {
    console.log(`  ❌ outboundIvrCalls: missing or not an object`);
  }

  return passed === total;
}

// Run all tests
runTest("ivr-outbound.js module functions", testIvrOutbound);
runTest("telnyx-service.js exports", testTelnyxService);  
runTest("voice-service.js exports", testVoiceService);

// Print results
console.log(`${'='.repeat(70)}`);
console.log("Final Test Results");
console.log(`${'='.repeat(70)}`);
console.log(`📊 Tests passed: ${passedTests}/${totalTests}`);

if (passedTests === totalTests) {
  console.log("🎉 ALL IVR OUTBOUND MODULE TESTS PASSED!");
  process.exit(0);
} else {
  console.log("⚠️ Some tests failed.");
  process.exit(1);
}