#!/usr/bin/env node

/**
 * Enhanced CloudPhone Test - Focus on failing tests
 */

const axios = require('axios');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function testMissingEndpoint() {
  log('=== TESTING MISSING ENDPOINT ===');
  
  // Test POST to /bank-pay-phone (the endpoint that returned 404)
  const testData = {
    chatId: '1005284399',
    price: '10.00',
    test: true
  };
  
  try {
    const response = await axios.post(`${BASE_URL}/bank-pay-phone`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    log(`✅ /bank-pay-phone endpoint exists: Status ${response.status}`);
    log(`Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    log(`❌ /bank-pay-phone endpoint issue: Status ${error.response?.status} - ${error.message}`);
    if (error.response?.data) {
      log(`Error details: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  // Test crypto endpoint that is working
  try {
    const response = await axios.post(`${BASE_URL}/dynopay/crypto-pay-phone`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    log(`✅ /dynopay/crypto-pay-phone exists: Status ${response.status}`);
  } catch (error) {
    log(`❌ /dynopay/crypto-pay-phone issue: Status ${error.response?.status} - ${error.message}`);
  }
}

async function analyzeWalletFlow() {
  log('=== ANALYZING WALLET FLOW ===');
  
  const content = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  // Search for walletOk object/function
  const walletOkMatches = content.match(/walletOk\s*[=:]\s*{[\s\S]*?}/);
  if (walletOkMatches) {
    log('✅ Found walletOk object definition');
    const walletOkContent = walletOkMatches[0];
    
    // Check for phone-pay in walletOk
    if (walletOkContent.includes("'phone-pay'")) {
      log('✅ Found phone-pay in walletOk');
      
      // Extract the phone-pay function
      const phonePayStart = content.indexOf("'phone-pay': async");
      if (phonePayStart !== -1) {
        const phonePaySection = content.substring(phonePayStart, phonePayStart + 2000);
        log('✅ Found phone-pay function');
        
        // Check for wallet balance operations
        const hasAtomicIncrement = phonePaySection.includes('atomicIncrement');
        const hasUsdOut = phonePaySection.includes('usdOut');
        const hasProviderCheck = phonePaySection.includes('provider');
        const hasTwilio = phonePaySection.includes('twilio');
        
        log(`Wallet operations: atomicIncrement=${hasAtomicIncrement}, usdOut=${hasUsdOut}`);
        log(`Provider checks: provider=${hasProviderCheck}, twilio=${hasTwilio}`);
        
        if (hasAtomicIncrement && hasUsdOut && hasProviderCheck) {
          log('✅ Wallet flow structure looks correct');
        } else {
          log('❌ Wallet flow structure incomplete');
        }
      }
    } else {
      log('❌ phone-pay not found in walletOk');
    }
  } else {
    log('❌ walletOk object not found');
  }
}

async function analyzeTryCatchBlocks() {
  log('=== ANALYZING TRY/CATCH BLOCKS ===');
  
  const content = fs.readFileSync('/app/js/_index.js', 'utf8');
  const lines = content.split('\n');
  
  // Find all executeTwilioPurchase calls
  const calls = [];
  lines.forEach((line, index) => {
    if (line.includes('executeTwilioPurchase(') && !line.includes('async function')) {
      calls.push({ line: index + 1, content: line.trim() });
    }
  });
  
  log(`Found ${calls.length} calls to executeTwilioPurchase`);
  
  let tryCatchAnalysis = [];
  
  for (const call of calls) {
    let hasTry = false;
    let hasCatch = false;
    let catchDetails = {};
    
    // Look backwards for try block
    for (let i = call.line - 1; i >= Math.max(0, call.line - 50); i--) {
      if (lines[i].includes('try {')) {
        hasTry = true;
        
        // Look forwards for catch block
        for (let j = call.line; j < Math.min(lines.length, call.line + 50); j++) {
          if (lines[j].includes('} catch')) {
            hasCatch = true;
            
            // Analyze catch block content (next 20 lines)
            let catchContent = [];
            for (let k = j; k < Math.min(lines.length, j + 20); k++) {
              catchContent.push(lines[k]);
              if (lines[k].includes('}') && k > j) break;
            }
            
            const catchText = catchContent.join('\n');
            catchDetails = {
              hasCloudPhoneLog: catchText.includes('[CloudPhone]'),
              hasRefundLogic: catchText.includes('atomicIncrement') || catchText.includes('addFundsTo'),
              hasErrorMessage: catchText.includes('purchaseFailed') || catchText.includes('send('),
              startLine: j + 1
            };
            break;
          }
        }
        break;
      }
    }
    
    tryCatchAnalysis.push({
      callLine: call.line,
      callContent: call.content,
      hasTry,
      hasCatch,
      ...catchDetails
    });
  }
  
  const withTryCatch = tryCatchAnalysis.filter(a => a.hasTry && a.hasCatch);
  const withCompleteHandling = tryCatchAnalysis.filter(a => 
    a.hasTry && a.hasCatch && a.hasCloudPhoneLog && a.hasRefundLogic && a.hasErrorMessage
  );
  
  log(`Try/catch analysis:`);
  log(`- ${calls.length} total calls`);
  log(`- ${withTryCatch.length} have try/catch blocks`);
  log(`- ${withCompleteHandling.length} have complete error handling`);
  
  tryCatchAnalysis.forEach(analysis => {
    const status = analysis.hasTry && analysis.hasCatch ? '✅' : '❌';
    log(`${status} Line ${analysis.callLine}: try=${analysis.hasTry}, catch=${analysis.hasCatch}, complete=${analysis.hasCloudPhoneLog && analysis.hasRefundLogic && analysis.hasErrorMessage}`);
  });
}

async function main() {
  log('Starting enhanced CloudPhone analysis...');
  
  await testMissingEndpoint();
  await analyzeWalletFlow();
  await analyzeTryCatchBlocks();
  
  log('Analysis complete.');
}

main().catch(console.error);