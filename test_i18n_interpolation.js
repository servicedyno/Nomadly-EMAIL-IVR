#!/usr/bin/env node

const { translation } = require('./js/translation.js');

// Test cases as specified in the review request
const testCases = [
  {
    key: 't.vs_outboundCallFailed',
    args: ['+15550001', '+16660002', 'busy'],
    expectedContains: ['+15550001', '+16660002', 'busy']
  },
  {
    key: 't.vs_callDisconnectedWallet',
    args: ['0.15', '0.03'],
    expectedContains: ['$0.15', '$0.03']
  },
  {
    key: 't.vs_callForwarded',
    args: ['+1TO', '+1FWD', '+1FROM', '3m', 'planL', '12:00'],
    expectedContains: ['+1TO', '+1FWD', '+1FROM', '3m', '12:00']
  },
  {
    key: 't.vs_planMinutesExhausted',
    args: ['+1PH', '90', '100', 'ovr'],
    expectedContains: ['+1PH', '90', '100', 'ovr']
  },
  {
    key: 't.vs_newVoicemail',
    args: ['+1TO', '+1FROM', '15s', '13:00'],
    expectedContains: ['+1TO', '+1FROM', '15s', '13:00']
  }
];

const languages = ['en', 'fr', 'zh', 'hi'];

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

console.log('='.repeat(80));
console.log('Testing i18n interpolation for vs_* notification strings');
console.log('='.repeat(80));
console.log('');

for (const lang of languages) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`LANGUAGE: ${lang.toUpperCase()}`);
  console.log('='.repeat(80));
  
  for (const testCase of testCases) {
    totalTests++;
    const { key, args, expectedContains } = testCase;
    
    try {
      const result = translation(key, lang, ...args);
      
      // Check (a): result contains every passed argument value
      let allArgsPresent = true;
      let missingArgs = [];
      for (const expected of expectedContains) {
        if (!result.includes(expected)) {
          allArgsPresent = false;
          missingArgs.push(expected);
        }
      }
      
      // Check (b): result contains NO literal substring "${"
      const hasLiteralPlaceholder = result.includes('${');
      
      if (allArgsPresent && !hasLiteralPlaceholder) {
        passedTests++;
        console.log(`✅ PASS: ${key}`);
        console.log(`   Args: [${args.join(', ')}]`);
        console.log(`   Result: ${result.substring(0, 150)}${result.length > 150 ? '...' : ''}`);
      } else {
        const failureReasons = [];
        if (!allArgsPresent) {
          failureReasons.push(`Missing args: ${missingArgs.join(', ')}`);
        }
        if (hasLiteralPlaceholder) {
          failureReasons.push('Contains literal "${" placeholder');
        }
        
        failedTests.push({
          lang,
          key,
          args,
          result,
          reasons: failureReasons
        });
        
        console.log(`❌ FAIL: ${key}`);
        console.log(`   Reasons: ${failureReasons.join('; ')}`);
        console.log(`   Result: ${result}`);
      }
    } catch (error) {
      failedTests.push({
        lang,
        key,
        args,
        error: error.message
      });
      console.log(`❌ ERROR: ${key}`);
      console.log(`   Error: ${error.message}`);
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests.length}`);
console.log(`Pass rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests.length > 0) {
  console.log('\n' + '='.repeat(80));
  console.log('FAILED TESTS DETAILS');
  console.log('='.repeat(80));
  for (const failure of failedTests) {
    console.log(`\nLanguage: ${failure.lang}`);
    console.log(`Key: ${failure.key}`);
    console.log(`Args: [${failure.args ? failure.args.join(', ') : 'N/A'}]`);
    if (failure.error) {
      console.log(`Error: ${failure.error}`);
    } else {
      console.log(`Reasons: ${failure.reasons.join('; ')}`);
      console.log(`Result: ${failure.result}`);
    }
  }
  process.exit(1);
} else {
  console.log('\n🎉 ALL TESTS PASSED! The i18n interpolation bug is FIXED.');
  process.exit(0);
}
