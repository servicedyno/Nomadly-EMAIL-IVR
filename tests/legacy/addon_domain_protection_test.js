#!/usr/bin/env node

/**
 * Addon Domain Protection Gap Fixes Test Suite
 * Tests the 3 addon domain protection gap fixes for Node.js app on port 5000
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 ADDON DOMAIN PROTECTION GAP FIXES TEST SUITE');
console.log('='.repeat(60));

const tests = [];

// Test 1: verifyProtection() function exists and is exported
console.log('\n1. Testing verifyProtection() function export...');
try {
    require('dotenv').config({ path: '/app/backend/.env' });
    const ars = require('/app/js/anti-red-service.js');
    const result = typeof ars.verifyProtection === 'function';
    tests.push({
        name: 'verifyProtection() function exported',
        status: result ? 'PASS' : 'FAIL',
        details: result ? 'Function exists and is exported' : 'Function not found or not exported'
    });
    console.log(result ? '✅ verifyProtection exported' : '❌ verifyProtection NOT exported');
} catch (error) {
    tests.push({
        name: 'verifyProtection() function exported',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing verifyProtection:', error.message);
}

// Test 2: Retry logic in addon domain creation route
console.log('\n2. Testing retry logic in cpanel-routes.js...');
try {
    const retryPatterns = execSync('grep -c "MAX_RETRIES\\|RETRY_DELAYS\\|attempt.*MAX_RETRIES\\|protection deploy attempt" /app/js/cpanel-routes.js', { encoding: 'utf8' }).trim();
    const retryCount = parseInt(retryPatterns);
    const retryResult = retryCount >= 4;
    
    const notificationPatterns = execSync('grep -c "Anti-Red.*Failed\\|Anti-Red.*Warning\\|protection.*VERIFIED\\|protection.*NOT verified" /app/js/cpanel-routes.js', { encoding: 'utf8' }).trim();
    const notificationCount = parseInt(notificationPatterns);
    const notificationResult = notificationCount >= 4;
    
    tests.push({
        name: 'Retry logic patterns',
        status: retryResult ? 'PASS' : 'FAIL',
        details: `Found ${retryCount} retry patterns (expected >= 4)`
    });
    
    tests.push({
        name: 'User notification patterns',
        status: notificationResult ? 'PASS' : 'FAIL',
        details: `Found ${notificationCount} notification patterns (expected >= 4)`
    });
    
    console.log(retryResult ? `✅ Retry patterns: ${retryCount}` : `❌ Retry patterns: ${retryCount} (expected >= 4)`);
    console.log(notificationResult ? `✅ Notification patterns: ${notificationCount}` : `❌ Notification patterns: ${notificationCount} (expected >= 4)`);
} catch (error) {
    tests.push({
        name: 'Retry logic patterns',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing retry logic:', error.message);
}

// Test 3: Post-deployment verification check
console.log('\n3. Testing post-deployment verification...');
try {
    const verificationPatterns = execSync('grep -c "verifyProtection\\|verification.active\\|protection VERIFIED\\|protection.*NOT verified" /app/js/cpanel-routes.js', { encoding: 'utf8' }).trim();
    const verificationCount = parseInt(verificationPatterns);
    const verificationResult = verificationCount >= 4;
    
    tests.push({
        name: 'Post-deployment verification patterns',
        status: verificationResult ? 'PASS' : 'FAIL',
        details: `Found ${verificationCount} verification patterns (expected >= 4)`
    });
    
    console.log(verificationResult ? `✅ Verification patterns: ${verificationCount}` : `❌ Verification patterns: ${verificationCount} (expected >= 4)`);
} catch (error) {
    tests.push({
        name: 'Post-deployment verification patterns',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing verification patterns:', error.message);
}

// Test 4: upgradeSharedWorker on startup
console.log('\n4. Testing upgradeSharedWorker startup call...');
try {
    const startupCall = execSync('grep -n "upgradeSharedWorker" /app/js/_index.js', { encoding: 'utf8' }).trim();
    const hasStartupCall = startupCall.includes('upgradeSharedWorker');
    
    tests.push({
        name: 'upgradeSharedWorker startup call',
        status: hasStartupCall ? 'PASS' : 'FAIL',
        details: hasStartupCall ? `Found at: ${startupCall}` : 'upgradeSharedWorker call not found'
    });
    
    console.log(hasStartupCall ? `✅ upgradeSharedWorker found: ${startupCall}` : '❌ upgradeSharedWorker not found');
} catch (error) {
    tests.push({
        name: 'upgradeSharedWorker startup call',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing upgradeSharedWorker:', error.message);
}

// Test 5: Startup log verification
console.log('\n5. Testing startup log verification...');
try {
    const startupLog = execSync('grep "Startup worker upgrade" /var/log/supervisor/nodejs.out.log | tail -1', { encoding: 'utf8' }).trim();
    const hasCorrectLog = startupLog.includes('OK (KV: true)');
    
    tests.push({
        name: 'Startup log verification',
        status: hasCorrectLog ? 'PASS' : 'FAIL',
        details: hasCorrectLog ? `Log found: ${startupLog}` : `Unexpected log: ${startupLog}`
    });
    
    console.log(hasCorrectLog ? `✅ Startup log: ${startupLog}` : `❌ Startup log: ${startupLog}`);
} catch (error) {
    tests.push({
        name: 'Startup log verification',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing startup log:', error.message);
}

// Test 6: All previous changes still working
console.log('\n6. Testing all previous changes...');
const syntaxFiles = [
    '/app/js/anti-red-service.js',
    '/app/js/cpanel-routes.js',
    '/app/js/_index.js',
    '/app/js/utils.js'
];

for (const file of syntaxFiles) {
    try {
        execSync(`node -c ${file}`, { encoding: 'utf8' });
        tests.push({
            name: `Syntax check: ${file.split('/').pop()}`,
            status: 'PASS',
            details: 'Syntax validation passed'
        });
        console.log(`✅ Syntax check passed: ${file.split('/').pop()}`);
    } catch (error) {
        tests.push({
            name: `Syntax check: ${file.split('/').pop()}`,
            status: 'FAIL',
            details: `Syntax error: ${error.message}`
        });
        console.log(`❌ Syntax check failed: ${file.split('/').pop()}`);
    }
}

// Check error log size
try {
    const errorLogSize = execSync('wc -c /var/log/supervisor/nodejs.err.log', { encoding: 'utf8' }).trim();
    const isZeroBytes = errorLogSize.startsWith('0 ');
    
    tests.push({
        name: 'Error log size check',
        status: isZeroBytes ? 'PASS' : 'FAIL',
        details: `Error log: ${errorLogSize}`
    });
    
    console.log(isZeroBytes ? `✅ Error log: ${errorLogSize}` : `❌ Error log: ${errorLogSize}`);
} catch (error) {
    tests.push({
        name: 'Error log size check',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error checking error log:', error.message);
}

// Health endpoint check
try {
    const healthResponse = execSync('curl -s http://localhost:5000/health', { encoding: 'utf8' });
    const isHealthy = healthResponse.includes('"status": "healthy"');
    
    tests.push({
        name: 'Health endpoint check',
        status: isHealthy ? 'PASS' : 'FAIL',
        details: isHealthy ? 'Health endpoint returns healthy status' : `Unexpected response: ${healthResponse}`
    });
    
    console.log(isHealthy ? '✅ Health endpoint: healthy' : `❌ Health endpoint: ${healthResponse}`);
} catch (error) {
    tests.push({
        name: 'Health endpoint check',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error checking health endpoint:', error.message);
}

// Test 7: Worker script has all new features
console.log('\n7. Testing worker script features...');
try {
    require('dotenv').config({ path: '/app/backend/.env' });
    const { generateHardenedWorkerScript } = require('/app/js/anti-red-service.js');
    const s = generateHardenedWorkerScript();
    
    const checks = [
        ['PoI challenge', 'Continue to site'],
        ['Mandatory challenge for all', 'EVERYONE gets challenged'],
        ['No old vulnerable pattern', !s.includes('hasCookie || !needsChallenge')],
        ['PoI nonce computation', 'poiNonce'],
        ['SwiftShader detection', 'SwiftShader'],
        ['CDP detection', 'cdc_adoQpoasnfa76pfcZLmcfl'],
    ];
    
    for (const [name, check] of checks) {
        const ok = typeof check === 'boolean' ? check : s.includes(check);
        tests.push({
            name: `Worker script: ${name}`,
            status: ok ? 'PASS' : 'FAIL',
            details: ok ? 'Feature present in worker script' : 'Feature missing from worker script'
        });
        console.log(ok ? `✅ ${name}` : `❌ ${name}`);
    }
} catch (error) {
    tests.push({
        name: 'Worker script feature test',
        status: 'FAIL',
        details: `Error: ${error.message}`
    });
    console.log('❌ Error testing worker script features:', error.message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(60));

const passedTests = tests.filter(t => t.status === 'PASS').length;
const failedTests = tests.filter(t => t.status === 'FAIL').length;
const totalTests = tests.length;

console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests > 0) {
    console.log('\n❌ FAILED TESTS:');
    tests.filter(t => t.status === 'FAIL').forEach(test => {
        console.log(`  - ${test.name}: ${test.details}`);
    });
}

console.log('\n✅ PASSED TESTS:');
tests.filter(t => t.status === 'PASS').forEach(test => {
    console.log(`  - ${test.name}`);
});

// Export results for programmatic access
module.exports = {
    tests,
    summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1)
    }
};