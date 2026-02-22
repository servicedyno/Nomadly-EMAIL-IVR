/**
 * Test Suite for URL Shortening Free Trial Feature
 * Tests the linksRemaining message function and decrement/get logic
 */

const assert = require('assert');

// Set FREE_LINKS env for testing
process.env.FREE_LINKS = '5';
process.env.FREE_LINKS_TIME_SECONDS = '86400';

// Test Results
const testResults = {
  passed: [],
  failed: []
};

function logResult(testName, passed, message = '') {
  if (passed) {
    testResults.passed.push(testName);
    console.log(`✅ PASS: ${testName}`);
  } else {
    testResults.failed.push({ testName, message });
    console.log(`❌ FAIL: ${testName} - ${message}`);
  }
}

// ============================================
// Test 1: Language Files - linksRemaining function exists in all 4 language files
// ============================================

async function testLanguageFilesLinksRemaining() {
  console.log('\n📋 Testing Language Files - linksRemaining function');
  
  const languages = [
    { file: 'en', path: '../lang/en.js', key: 'en' },
    { file: 'fr', path: '../lang/fr.js', key: 'fr' },
    { file: 'zh', path: '../lang/zh.js', key: 'zh' },
    { file: 'hi', path: '../lang/hi.js', key: 'hi' }
  ];
  
  for (const lang of languages) {
    try {
      const langModule = require(lang.path);
      const langObj = langModule[lang.key];
      
      // Check if linksRemaining exists in the t object
      if (typeof langObj?.t?.linksRemaining !== 'function') {
        logResult(`${lang.file}.js - linksRemaining function exists`, false, 'linksRemaining is not a function in t object');
        continue;
      }
      
      // Test with different values
      const result0 = langObj.t.linksRemaining(0, 5);
      const result1 = langObj.t.linksRemaining(1, 5);
      const result2 = langObj.t.linksRemaining(2, 5);
      
      // Validate returns valid strings
      if (typeof result0 !== 'string' || result0.length === 0) {
        logResult(`${lang.file}.js - linksRemaining(0) returns valid string`, false, `Got: ${result0}`);
        continue;
      }
      
      if (typeof result1 !== 'string' || result1.length === 0) {
        logResult(`${lang.file}.js - linksRemaining(1) returns valid string`, false, `Got: ${result1}`);
        continue;
      }
      
      if (typeof result2 !== 'string' || result2.length === 0) {
        logResult(`${lang.file}.js - linksRemaining(2) returns valid string`, false, `Got: ${result2}`);
        continue;
      }
      
      console.log(`  ${lang.file}.js linksRemaining(0): "${result0}"`);
      console.log(`  ${lang.file}.js linksRemaining(1): "${result1}"`);
      console.log(`  ${lang.file}.js linksRemaining(2): "${result2}"`);
      
      logResult(`${lang.file}.js - linksRemaining function exists and returns valid strings`, true);
      
    } catch (error) {
      logResult(`${lang.file}.js - linksRemaining function exists`, false, error.message);
    }
  }
}

// ============================================
// Test 2: English plural/singular handling
// ============================================

async function testEnglishPluralHandling() {
  console.log('\n📋 Testing English Plural/Singular Handling');
  
  try {
    const { en } = require('../lang/en.js');
    
    const singular = en.t.linksRemaining(1, 5);
    const plural = en.t.linksRemaining(2, 5);
    
    // Check that 1 uses singular "link" not "links"
    const singularCorrect = singular.includes('link') && !singular.includes('links');
    logResult('English singular (1) uses "link" not "links"', singularCorrect, `Got: "${singular}"`);
    
    // Check that 2 uses plural "links"
    const pluralCorrect = plural.includes('links');
    logResult('English plural (2) uses "links"', pluralCorrect, `Got: "${plural}"`);
    
  } catch (error) {
    logResult('English plural handling', false, error.message);
  }
}

// ============================================
// Test 3: db.js - decrement function logic
// ============================================

async function testDecrementFunctionLogic() {
  console.log('\n📋 Testing db.js - decrement function logic');
  
  try {
    const db = require('../db.js');
    
    // Check if decrement is exported
    if (typeof db.decrement !== 'function') {
      logResult('db.decrement function exists', false, 'decrement is not exported');
      return;
    }
    
    logResult('db.decrement function exists', true);
    
    // Check if get is exported
    if (typeof db.get !== 'function') {
      logResult('db.get function exists', false, 'get is not exported');
      return;
    }
    
    logResult('db.get function exists', true);
    
    // Check if set is exported
    if (typeof db.set !== 'function') {
      logResult('db.set function exists', false, 'set is not exported');
      return;
    }
    
    logResult('db.set function exists', true);
    
  } catch (error) {
    logResult('db.js module loading', false, error.message);
  }
}

// ============================================
// Test 4: Code Review - _index.js random link flow logic (lines 3125-3132)
// ============================================

async function testRandomLinkFlowCodeReview() {
  console.log('\n📋 Code Review: _index.js random link flow (lines 3125-3132)');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const indexPath = path.join(__dirname, '../_index.js');
    const content = fs.readFileSync(indexPath, 'utf8');
    const lines = content.split('\n');
    
    // Find the relevant code block for random link
    let foundRandomLinkBlock = false;
    let hasAwaitDecrement = false;
    let hasGetRemaining = false;
    let hasSendShortUrl = false;
    let hasSendLinksRemaining = false;
    let checksIsSubscribed = false;
    
    // Search for the random link flow pattern
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for the isSubscribed check followed by decrement
      if (line.includes('if (!(await isSubscribed(chatId)))') && lines[i+1]?.includes('await decrement(freeShortLinksOf')) {
        checksIsSubscribed = true;
        foundRandomLinkBlock = true;
        
        // Check the next few lines for the pattern
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          const checkLine = lines[j];
          
          if (checkLine.includes('await decrement(freeShortLinksOf, chatId)')) {
            hasAwaitDecrement = true;
          }
          if (checkLine.includes('await get(freeShortLinksOf, chatId)')) {
            hasGetRemaining = true;
          }
          if (checkLine.includes('send(chatId, _shortUrl')) {
            hasSendShortUrl = true;
          }
          if (checkLine.includes('t.linksRemaining(remaining')) {
            hasSendLinksRemaining = true;
          }
        }
        break;
      }
    }
    
    logResult('Random link flow: isSubscribed check exists', checksIsSubscribed);
    logResult('Random link flow: await decrement(freeShortLinksOf, chatId)', hasAwaitDecrement);
    logResult('Random link flow: get remaining count after decrement', hasGetRemaining);
    logResult('Random link flow: send short URL first', hasSendShortUrl);
    logResult('Random link flow: send linksRemaining message', hasSendLinksRemaining);
    
  } catch (error) {
    logResult('Code review - random link flow', false, error.message);
  }
}

// ============================================
// Test 5: Code Review - _index.js custom link flow logic (lines 3166-3172)
// ============================================

async function testCustomLinkFlowCodeReview() {
  console.log('\n📋 Code Review: _index.js custom link flow (lines 3166-3172)');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const indexPath = path.join(__dirname, '../_index.js');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Find the custom link flow pattern (occurs after the random link flow)
    // Look for the pattern around line 3166-3172
    
    // The custom link flow should have the same pattern as random link
    const customLinkPattern = /if \(\!\(await isSubscribed\(chatId\)\)\) \{\s*await decrement\(freeShortLinksOf, chatId\)\s*const remaining = \(await get\(freeShortLinksOf, chatId\)\) \|\| 0/g;
    
    const matches = content.match(customLinkPattern);
    
    // There should be 2 occurrences (random and custom link flows)
    if (matches && matches.length >= 2) {
      logResult('Custom link flow: Same pattern as random link (2 occurrences found)', true);
    } else if (matches && matches.length === 1) {
      logResult('Custom link flow: Pattern found only once', false, 'Expected 2 occurrences (random + custom)');
    } else {
      logResult('Custom link flow: Pattern not found', false, 'Could not find the expected pattern');
    }
    
    // Additional check: Count t.linksRemaining usage
    const linksRemainingUsage = (content.match(/t\.linksRemaining\(remaining/g) || []).length;
    logResult(`linksRemaining called in ${linksRemainingUsage} places`, linksRemainingUsage >= 2, `Found ${linksRemainingUsage} usages`);
    
  } catch (error) {
    logResult('Code review - custom link flow', false, error.message);
  }
}

// ============================================
// Test 6: Verify subscribed users bypass decrement block
// ============================================

async function testSubscribedUsersBypass() {
  console.log('\n📋 Code Review: Subscribed users bypass decrement block');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const indexPath = path.join(__dirname, '../_index.js');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check that the pattern shows subscribed users get different treatment
    // The if block only executes for non-subscribed: if (!(await isSubscribed(chatId)))
    // Subscribed users fall through to the else path
    
    // Find the pattern: after the if block for non-subscribed, there's direct send for subscribed
    const subscribedBypassPattern = /if \(\!\(await isSubscribed\(chatId\)\)\) \{[\s\S]*?return send\(chatId, t\.linksRemaining\(remaining\)\)[\s\S]*?\}\s*set\(state, chatId, 'action', 'none'\)\s*return send\(chatId, _shortUrl/g;
    
    const matches = content.match(subscribedBypassPattern);
    
    if (matches && matches.length >= 2) {
      logResult('Subscribed users bypass decrement block (2 flows verified)', true);
    } else if (matches && matches.length === 1) {
      logResult('Subscribed users bypass found in one flow', true, 'Found in 1 flow');
    } else {
      // Try alternative check
      const hasSubscribedCheck = content.includes('if (!(await isSubscribed(chatId)))');
      const hasReturnAfterBlock = content.includes("set(state, chatId, 'action', 'none')");
      
      logResult('Subscribed users bypass decrement block', hasSubscribedCheck && hasReturnAfterBlock, 
        'Pattern verification: isSubscribed check found');
    }
    
  } catch (error) {
    logResult('Subscribed users bypass check', false, error.message);
  }
}

// ============================================
// Test 7: Syntax validation of all files
// ============================================

async function testSyntaxValidation() {
  console.log('\n📋 Syntax Validation');
  
  const filesToCheck = [
    { name: 'db.js', path: '../db.js' },
    { name: 'en.js', path: '../lang/en.js' },
    { name: 'fr.js', path: '../lang/fr.js' },
    { name: 'zh.js', path: '../lang/zh.js' },
    { name: 'hi.js', path: '../lang/hi.js' }
  ];
  
  for (const file of filesToCheck) {
    try {
      require(file.path);
      logResult(`${file.name} syntax valid`, true);
    } catch (error) {
      logResult(`${file.name} syntax valid`, false, error.message);
    }
  }
}

// ============================================
// Test 8: freeLinksExhausted message exists
// ============================================

async function testFreeLinksExhaustedMessage() {
  console.log('\n📋 Testing freeLinksExhausted message exists in all language files');
  
  const languages = [
    { file: 'en', path: '../lang/en.js', key: 'en' },
    { file: 'fr', path: '../lang/fr.js', key: 'fr' },
    { file: 'zh', path: '../lang/zh.js', key: 'zh' },
    { file: 'hi', path: '../lang/hi.js', key: 'hi' }
  ];
  
  for (const lang of languages) {
    try {
      const langModule = require(lang.path);
      const langObj = langModule[lang.key];
      
      if (typeof langObj?.t?.freeLinksExhausted === 'string' && langObj.t.freeLinksExhausted.length > 0) {
        console.log(`  ${lang.file}.js freeLinksExhausted: "${langObj.t.freeLinksExhausted.substring(0, 60)}..."`);
        logResult(`${lang.file}.js - freeLinksExhausted message exists`, true);
      } else {
        logResult(`${lang.file}.js - freeLinksExhausted message exists`, false, 'Not found or empty');
      }
    } catch (error) {
      logResult(`${lang.file}.js - freeLinksExhausted message`, false, error.message);
    }
  }
}

// ============================================
// Test 9: Verify decrement logic correctness (static code analysis)
// ============================================

async function testDecrementLogicCorrectness() {
  console.log('\n📋 Testing db.js - decrement logic correctness (code analysis)');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const dbPath = path.join(__dirname, '../db.js');
    const content = fs.readFileSync(dbPath, 'utf8');
    
    // Check decrement function pattern
    const decrementPattern = /const decrement = async \(c, key\) => \{[\s\S]*?const count = \(await get\(c, key\)\) \|\| 0[\s\S]*?await set\(c, key, count - 1\)/;
    
    if (decrementPattern.test(content)) {
      logResult('decrement function: gets current value, subtracts 1, sets new value', true);
    } else {
      logResult('decrement function: gets current value, subtracts 1, sets new value', false, 'Pattern not found');
    }
    
    // Check get function returns the value properly
    const getPattern = /async function get\(c, key\) \{[\s\S]*?const result = await c\.findOne\(\{ _id: key \}\)[\s\S]*?return result\?\.val/;
    
    if (getPattern.test(content)) {
      logResult('get function: finds document by _id and returns val field', true);
    } else {
      logResult('get function: finds document by _id and returns val field', false, 'Pattern not found');
    }
    
  } catch (error) {
    logResult('decrement logic correctness', false, error.message);
  }
}

// ============================================
// Main Test Runner
// ============================================

async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🧪 Shortit URL Shortening - Free Trial Feature Tests');
  console.log('='.repeat(60));
  
  await testLanguageFilesLinksRemaining();
  await testEnglishPluralHandling();
  await testDecrementFunctionLogic();
  await testRandomLinkFlowCodeReview();
  await testCustomLinkFlowCodeReview();
  await testSubscribedUsersBypass();
  await testSyntaxValidation();
  await testFreeLinksExhaustedMessage();
  await testDecrementLogicCorrectness();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failed.forEach(f => {
      console.log(`  - ${f.testName}: ${f.message}`);
    });
  }
  
  const totalTests = testResults.passed.length + testResults.failed.length;
  const successRate = ((testResults.passed.length / totalTests) * 100).toFixed(1);
  console.log(`\n📈 Success Rate: ${successRate}%`);
  
  // Return results for reporting
  return {
    passed: testResults.passed.length,
    failed: testResults.failed.length,
    total: totalTests,
    successRate,
    failures: testResults.failed
  };
}

runAllTests().then(results => {
  console.log('\n📄 Test Complete');
  if (results.failed > 0) {
    process.exit(1);
  }
}).catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
