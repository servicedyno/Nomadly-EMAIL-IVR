#!/usr/bin/env node

/**
 * Backend Test for Nomadly Telegram Bot
 * Tests the two specific fixes:
 * 1. showDepositCryptoInfo wallet template USD amount fix
 * 2. Bidirectional crypto payment fallback system
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

// Test configuration
const CONFIG = {
  nodeServicePort: 5000,
  baseUrl: 'http://localhost:5000',
  testTimeout: 30000
};

class TelegramBotTester {
  constructor() {
    this.results = {
      fix1: { passed: 0, failed: 0, tests: [] },
      fix2: { passed: 0, failed: 0, tests: [] },
      service: { passed: 0, failed: 0, tests: [] }
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  addResult(category, testName, passed, details = '') {
    const result = { testName, passed, details };
    this.results[category].tests.push(result);
    
    if (passed) {
      this.results[category].passed++;
      this.log(`✅ ${testName}: ${details}`, 'success');
    } else {
      this.results[category].failed++;
      this.log(`❌ ${testName}: ${details}`, 'error');
    }
  }

  // Test 1: Verify language file signatures have been updated
  testLanguageFileSignatures() {
    this.log('Testing FIX 1: Language file showDepositCryptoInfo signatures...');
    
    const langFiles = [
      '/app/js/lang/en.js',
      '/app/js/lang/fr.js', 
      '/app/js/lang/zh.js',
      '/app/js/lang/hi.js'
    ];

    langFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(/showDepositCryptoInfo:\s*\(([^)]+)\)\s*=>/);
        
        if (matches && matches[1]) {
          const signature = matches[1].trim();
          const expectedSignature = 'priceUsd, priceCrypto, tickerView, address';
          
          if (signature === expectedSignature) {
            this.addResult('fix1', `${path.basename(filePath)} signature`, true, `Correct signature: (${signature})`);
          } else {
            this.addResult('fix1', `${path.basename(filePath)} signature`, false, `Expected (${expectedSignature}) but got (${signature})`);
          }
        } else {
          this.addResult('fix1', `${path.basename(filePath)} signature`, false, 'showDepositCryptoInfo function not found');
        }
      } catch (error) {
        this.addResult('fix1', `${path.basename(filePath)} signature`, false, `Error reading file: ${error.message}`);
      }
    });
  }

  // Test 2: Verify priceUsd is referenced in template body
  testLanguageFilePriceUsdUsage() {
    this.log('Testing FIX 1: Language files reference priceUsd in template body...');
    
    const langFiles = [
      '/app/js/lang/en.js',
      '/app/js/lang/fr.js', 
      '/app/js/lang/zh.js',
      '/app/js/lang/hi.js'
    ];

    langFiles.forEach(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find the showDepositCryptoInfo function and extract its body
        const functionMatch = content.match(/showDepositCryptoInfo:\s*\(priceUsd,\s*priceCrypto,\s*tickerView,\s*address\)\s*=>\s*`([^`]+)`/s);
        
        if (functionMatch && functionMatch[1]) {
          const functionBody = functionMatch[1];
          
          if (functionBody.includes('Number(priceUsd).toFixed(2)')) {
            this.addResult('fix1', `${path.basename(filePath)} priceUsd usage`, true, 'Uses Number(priceUsd).toFixed(2) in template');
          } else {
            this.addResult('fix1', `${path.basename(filePath)} priceUsd usage`, false, 'Does not use Number(priceUsd).toFixed(2) in template');
          }
        } else {
          this.addResult('fix1', `${path.basename(filePath)} priceUsd usage`, false, 'showDepositCryptoInfo template body not found');
        }
      } catch (error) {
        this.addResult('fix1', `${path.basename(filePath)} priceUsd usage`, false, `Error reading file: ${error.message}`);
      }
    });
  }

  // Test 3: Verify callers in _index.js pass 4 arguments
  testIndexJsCallers() {
    this.log('Testing FIX 1: _index.js callers use 4-argument pattern...');
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      // Find all showDepositCryptoInfo calls (excluding InfoPlan, InfoDomain, etc.)
      const callerMatches = [...content.matchAll(/\.showDepositCryptoInfo\(([^)]+)\)/g)];
      
      if (callerMatches.length === 4) {
        this.addResult('fix1', '_index.js caller count', true, `Found ${callerMatches.length} showDepositCryptoInfo calls`);
        
        callerMatches.forEach((match, index) => {
          const args = match[1].split(',').map(arg => arg.trim());
          if (args.length === 4) {
            // Check if first arg is 'amount' and pattern matches expected: amount, usdIn, tickerView, address
            const expectedPattern = ['amount', 'usdIn', 'tickerView'];
            const matches = args.slice(0, 3).every((arg, i) => arg === expectedPattern[i]);
            
            if (matches) {
              this.addResult('fix1', `_index.js caller ${index + 1}`, true, `Correct 4-arg pattern: ${match[1]}`);
            } else {
              this.addResult('fix1', `_index.js caller ${index + 1}`, false, `Incorrect pattern: ${match[1]}`);
            }
          } else {
            this.addResult('fix1', `_index.js caller ${index + 1}`, false, `Expected 4 args, got ${args.length}: ${match[1]}`);
          }
        });
      } else {
        this.addResult('fix1', '_index.js caller count', false, `Expected 4 showDepositCryptoInfo calls, found ${callerMatches.length}`);
      }
    } catch (error) {
      this.addResult('fix1', '_index.js caller count', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 4: Verify no old 3-arg calls remain
  testNoOldThreeArgCalls() {
    this.log('Testing FIX 1: No old 3-arg calls remain...');
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      // Look for patterns that would indicate old 3-arg calls (usdIn as first arg)
      const oldPatternMatches = [...content.matchAll(/\.showDepositCryptoInfo\(usdIn,\s*tickerView/g)];
      
      if (oldPatternMatches.length === 0) {
        this.addResult('fix1', '_index.js no old calls', true, 'No old 3-argument pattern found');
      } else {
        this.addResult('fix1', '_index.js no old calls', false, `Found ${oldPatternMatches.length} old 3-argument patterns`);
      }
    } catch (error) {
      this.addResult('fix1', '_index.js no old calls', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 5: Verify exactly 20 CryptoFallback log lines
  testCryptoFallbackLogLines() {
    this.log('Testing FIX 2: Exactly 20 CryptoFallback log lines...');
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      const fallbackMatches = [...content.matchAll(/\[CryptoFallback\]/g)];
      
      if (fallbackMatches.length === 20) {
        this.addResult('fix2', 'CryptoFallback log count', true, `Found exactly 20 [CryptoFallback] log lines`);
        
        // Verify 10 BlockBee and 10 DynoPay messages
        const blockbeeMatches = [...content.matchAll(/\[CryptoFallback\] BlockBee unavailable/g)];
        const dynopayMatches = [...content.matchAll(/\[CryptoFallback\] DynoPay unavailable/g)];
        
        if (blockbeeMatches.length === 10 && dynopayMatches.length === 10) {
          this.addResult('fix2', 'CryptoFallback distribution', true, '10 BlockBee + 10 DynoPay fallback messages');
        } else {
          this.addResult('fix2', 'CryptoFallback distribution', false, `Expected 10 BlockBee + 10 DynoPay, got ${blockbeeMatches.length} + ${dynopayMatches.length}`);
        }
      } else {
        this.addResult('fix2', 'CryptoFallback log count', false, `Expected 20 [CryptoFallback] lines, found ${fallbackMatches.length}`);
      }
    } catch (error) {
      this.addResult('fix2', 'CryptoFallback log count', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 6: Verify all 10 payment types have fallback support
  testPaymentTypesFallback() {
    this.log('Testing FIX 2: All 10 payment types have bidirectional fallback...');
    
    const expectedPaymentTypes = [
      'wallet', 'digital product', 'virtual card', 'domain', 'hosting', 
      'VPS', 'VPS upgrade', 'plan', 'phone', 'leads'
    ];
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      expectedPaymentTypes.forEach(paymentType => {
        const blockbeePattern = `[CryptoFallback] BlockBee unavailable for ${paymentType}`;
        const dynopayPattern = `[CryptoFallback] DynoPay unavailable for ${paymentType}`;
        
        const hasBlockbeeFallback = content.includes(blockbeePattern);
        const hasDynopayFallback = content.includes(dynopayPattern);
        
        if (hasBlockbeeFallback && hasDynopayFallback) {
          this.addResult('fix2', `${paymentType} fallback`, true, 'Both BlockBee->DynoPay and DynoPay->BlockBee fallbacks present');
        } else {
          this.addResult('fix2', `${paymentType} fallback`, false, `Missing fallback: BlockBee=${hasBlockbeeFallback}, DynoPay=${hasDynopayFallback}`);
        }
      });
    } catch (error) {
      this.addResult('fix2', 'payment types fallback', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 7: Verify no broken generateBlockBeeAddress references
  testNoGenerateBlockBeeAddress() {
    this.log('Testing FIX 2: No broken generateBlockBeeAddress references...');
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      const brokenReferences = [...content.matchAll(/generateBlockBeeAddress/g)];
      
      if (brokenReferences.length === 0) {
        this.addResult('fix2', 'no generateBlockBeeAddress', true, 'No references to broken generateBlockBeeAddress function');
      } else {
        this.addResult('fix2', 'no generateBlockBeeAddress', false, `Found ${brokenReferences.length} references to generateBlockBeeAddress`);
      }
    } catch (error) {
      this.addResult('fix2', 'no generateBlockBeeAddress', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 8: Verify bbResult and dynoResult patterns
  testResultPatterns() {
    this.log('Testing FIX 2: Correct bbResult and dynoResult patterns...');
    
    try {
      const content = fs.readFileSync('/app/js/_index.js', 'utf8');
      
      // Check for bbResult?.address pattern
      const bbResultMatches = [...content.matchAll(/bbResult\?\.address/g)];
      const dynoResultMatches = [...content.matchAll(/dynoResult\?\.address/g)];
      
      if (bbResultMatches.length > 0) {
        this.addResult('fix2', 'bbResult pattern', true, `Found ${bbResultMatches.length} bbResult?.address patterns`);
      } else {
        this.addResult('fix2', 'bbResult pattern', false, 'No bbResult?.address patterns found');
      }
      
      if (dynoResultMatches.length > 0) {
        this.addResult('fix2', 'dynoResult pattern', true, `Found ${dynoResultMatches.length} dynoResult?.address patterns`);
      } else {
        this.addResult('fix2', 'dynoResult pattern', false, 'No dynoResult?.address patterns found');
      }
    } catch (error) {
      this.addResult('fix2', 'result patterns', false, `Error reading file: ${error.message}`);
    }
  }

  // Test 9: Service health check
  async testServiceHealth() {
    this.log('Testing service health check...');
    
    try {
      const response = await axios.get(`${CONFIG.baseUrl}/health`, {
        timeout: CONFIG.testTimeout
      });
      
      if (response.status === 200) {
        this.addResult('service', 'health endpoint', true, `Service responding on port ${CONFIG.nodeServicePort}`);
        
        if (response.data && response.data.status) {
          this.addResult('service', 'health status', true, `Status: ${response.data.status}`);
        } else {
          this.addResult('service', 'health status', false, 'No status in health response');
        }
      } else {
        this.addResult('service', 'health endpoint', false, `Unexpected status code: ${response.status}`);
      }
    } catch (error) {
      this.addResult('service', 'health endpoint', false, `Service not responding: ${error.message}`);
    }
  }

  // Run all tests
  async runAllTests() {
    this.log('🚀 Starting Nomadly Telegram Bot Test Suite...');
    this.log(`Testing Node.js service on port ${CONFIG.nodeServicePort}`);
    
    // FIX 1 Tests: showDepositCryptoInfo wallet template USD amount
    this.testLanguageFileSignatures();
    this.testLanguageFilePriceUsdUsage();
    this.testIndexJsCallers();
    this.testNoOldThreeArgCalls();
    
    // FIX 2 Tests: Bidirectional crypto payment fallback
    this.testCryptoFallbackLogLines();
    this.testPaymentTypesFallback();
    this.testNoGenerateBlockBeeAddress();
    this.testResultPatterns();
    
    // Service Tests
    await this.testServiceHealth();
    
    this.printSummary();
  }

  printSummary() {
    this.log('\n=================== TEST SUMMARY ===================');
    
    ['fix1', 'fix2', 'service'].forEach(category => {
      const { passed, failed, tests } = this.results[category];
      const total = passed + failed;
      const categoryName = {
        fix1: 'FIX 1: showDepositCryptoInfo USD Amount',
        fix2: 'FIX 2: Bidirectional Crypto Fallback', 
        service: 'Service Health'
      }[category];
      
      console.log(`\n${categoryName}:`);
      console.log(`  ✅ Passed: ${passed}/${total}`);
      console.log(`  ❌ Failed: ${failed}/${total}`);
      
      if (failed > 0) {
        console.log(`  Failed tests:`);
        tests.filter(t => !t.passed).forEach(t => {
          console.log(`    - ${t.testName}: ${t.details}`);
        });
      }
    });
    
    const totalPassed = Object.values(this.results).reduce((sum, cat) => sum + cat.passed, 0);
    const totalFailed = Object.values(this.results).reduce((sum, cat) => sum + cat.failed, 0);
    const totalTests = totalPassed + totalFailed;
    
    console.log(`\n📊 OVERALL: ${totalPassed}/${totalTests} tests passed`);
    
    if (totalFailed === 0) {
      console.log('🎉 All tests PASSED! Both fixes verified successfully.');
    } else {
      console.log(`⚠️  ${totalFailed} test(s) FAILED. Please review the issues above.`);
    }
  }
}

// Run the tests
(async () => {
  const tester = new TelegramBotTester();
  await tester.runAllTests();
  
  process.exit(0);
})().catch(error => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});