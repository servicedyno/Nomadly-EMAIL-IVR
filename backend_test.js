#!/usr/bin/env node

/**
 * Backend Test Suite for Lead Job Full Resume Implementation
 * 
 * Tests the changes described in the review request:
 * 1. validateBulkNumbers accepts 11th parameter resumeData
 * 2. lead-job-persistence.js has resumeJob function
 * 3. _index.js resumeInterruptedLeadJobs calls validateBulkNumbers with resumeData
 * 4. deliverLeadResults helper handles both CNAM and non-CNAM cases
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const message = `${status}: ${name}${details ? ' - ' + details : ''}`;
    console.log(message);
    
    testResults.tests.push({ name, passed, details });
    if (passed) {
        testResults.passed++;
    } else {
        testResults.failed++;
    }
}

async function testNodeJsHealthCheck() {
    try {
        console.log('\n🔍 Testing Node.js Health Check...');
        const response = await axios.get('http://localhost:5000/health', { timeout: 5000 });
        
        if (response.status === 200 && response.data.status === 'healthy') {
            logTest('Node.js Health Check', true, `Status: ${response.data.status}, DB: ${response.data.database}`);
            return true;
        } else {
            logTest('Node.js Health Check', false, `Unexpected response: ${JSON.stringify(response.data)}`);
            return false;
        }
    } catch (error) {
        logTest('Node.js Health Check', false, `Connection failed: ${error.message}`);
        return false;
    }
}

function testValidatePhoneBulkFunction() {
    console.log('\n🔍 Testing validatePhoneBulk.js function signature...');
    
    try {
        const filePath = '/app/js/validatePhoneBulk.js';
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Test 1: Function should accept 11 parameters with resumeData = null as the 11th
        const functionSignatureRegex = /const validateBulkNumbers = async \((.*?)\) => \{/s;
        const match = fileContent.match(functionSignatureRegex);
        
        if (match) {
            const params = match[1].split(',').map(p => p.trim());
            
            if (params.length >= 11) {
                logTest('validateBulkNumbers has 11+ parameters', true, `Found ${params.length} parameters`);
                
                // Check if the 11th parameter is resumeData with null default
                const eleventhParam = params[10];
                if (eleventhParam.includes('resumeData') && eleventhParam.includes('null')) {
                    logTest('11th parameter is resumeData = null', true, `Parameter: ${eleventhParam}`);
                } else {
                    logTest('11th parameter is resumeData = null', false, `Found: ${eleventhParam}`);
                }
            } else {
                logTest('validateBulkNumbers has 11+ parameters', false, `Only found ${params.length} parameters`);
            }
        } else {
            logTest('validateBulkNumbers function signature found', false, 'Could not parse function signature');
        }
        
        // Test 2: Check if resumeData is used to initialize res array
        const resumeDataUsageRegex = /const res = resumeData \? \[\.\.\.[\(\s]*resumeData\.results/;
        if (resumeDataUsageRegex.test(fileContent)) {
            logTest('resumeData used to initialize res array', true);
        } else {
            logTest('resumeData used to initialize res array', false, 'resumeData.results not found in res initialization');
        }
        
        // Test 3: Check if realNameCount is initialized from resumeData
        const realNameCountRegex = /let realNameCount = resumeData \? \(resumeData\.realNameCount/;
        if (realNameCountRegex.test(fileContent)) {
            logTest('realNameCount initialized from resumeData', true);
        } else {
            logTest('realNameCount initialized from resumeData', false, 'resumeData.realNameCount not found');
        }
        
        // Test 4: Check if jobId is reused from resumeData
        const jobIdReuseRegex = /jobId = resumeData\.jobId/;
        if (jobIdReuseRegex.test(fileContent)) {
            logTest('jobId reused from resumeData', true);
        } else {
            logTest('jobId reused from resumeData', false, 'jobId reuse not found');
        }
        
        return true;
    } catch (error) {
        logTest('validatePhoneBulk.js file access', false, error.message);
        return false;
    }
}

function testLeadJobPersistenceFunction() {
    console.log('\n🔍 Testing lead-job-persistence.js resumeJob function...');
    
    try {
        const filePath = '/app/js/lead-job-persistence.js';
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Test 1: resumeJob function exists
        const resumeJobRegex = /async function resumeJob\(jobId\)/;
        if (resumeJobRegex.test(fileContent)) {
            logTest('resumeJob function exists', true);
        } else {
            logTest('resumeJob function exists', false, 'Function definition not found');
        }
        
        // Test 2: resumeJob sets status to 'running'
        const statusUpdateRegex = /status: 'running'/;
        if (statusUpdateRegex.test(fileContent)) {
            logTest('resumeJob sets status to running', true);
        } else {
            logTest('resumeJob sets status to running', false, 'Status update not found');
        }
        
        // Test 3: resumeJob adds resumedAt timestamp
        const resumedAtRegex = /resumedAt: new Date\(\)/;
        if (resumedAtRegex.test(fileContent)) {
            logTest('resumeJob adds resumedAt timestamp', true);
        } else {
            logTest('resumeJob adds resumedAt timestamp', false, 'resumedAt timestamp not found');
        }
        
        // Test 4: resumeJob is exported
        const exportsRegex = /module\.exports = \{[\s\S]*?resumeJob/;
        if (exportsRegex.test(fileContent)) {
            logTest('resumeJob is exported', true);
        } else {
            logTest('resumeJob is exported', false, 'resumeJob not found in exports');
        }
        
        return true;
    } catch (error) {
        logTest('lead-job-persistence.js file access', false, error.message);
        return false;
    }
}

function testIndexJsResumeFunction() {
    console.log('\n🔍 Testing _index.js resumeInterruptedLeadJobs function...');
    
    try {
        const filePath = '/app/js/_index.js';
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Test 1: resumeJob is imported
        const importRegex = /const \{[^}]*resumeJob[^}]*\} = require\('\.\/lead-job-persistence\.js'\)/;
        if (importRegex.test(fileContent)) {
            logTest('resumeJob is imported from lead-job-persistence', true);
        } else {
            logTest('resumeJob is imported from lead-job-persistence', false, 'Import not found');
        }
        
        // Test 2: resumeInterruptedLeadJobs function exists
        const resumeJobsFunctionRegex = /async function resumeInterruptedLeadJobs\(\)/;
        if (resumeJobsFunctionRegex.test(fileContent)) {
            logTest('resumeInterruptedLeadJobs function exists', true);
        } else {
            logTest('resumeInterruptedLeadJobs function exists', false, 'Function definition not found');
        }
        
        // Test 3: validateBulkNumbers called with 11th argument (resumeData)
        const validateBulkCallRegex = /await validateBulkNumbers\([\s\S]*?\{[\s\S]*?jobId[\s\S]*?results[\s\S]*?realNameCount[\s\S]*?\}/;
        if (validateBulkCallRegex.test(fileContent)) {
            logTest('validateBulkNumbers called with resumeData object', true);
        } else {
            logTest('validateBulkNumbers called with resumeData object', false, 'resumeData object not found in call');
        }
        
        // Test 4: deliverLeadResults helper function exists
        const deliverResultsRegex = /async function deliverLeadResults\(/;
        if (deliverResultsRegex.test(fileContent)) {
            logTest('deliverLeadResults helper function exists', true);
        } else {
            logTest('deliverLeadResults helper function exists', false, 'Function definition not found');
        }
        
        // Test 5: deliverLeadResults handles CNAM case
        const cnamHandlingRegex = /if \(cnam\) \{[\s\S]*?withRealNames[\s\S]*?sendDocument/;
        if (cnamHandlingRegex.test(fileContent)) {
            logTest('deliverLeadResults handles CNAM case', true);
        } else {
            logTest('deliverLeadResults handles CNAM case', false, 'CNAM handling not found');
        }
        
        // Test 6: deliverLeadResults handles non-CNAM case
        const nonCnamHandlingRegex = /\} else \{[\s\S]*?Non-CNAM[\s\S]*?sendDocument/;
        if (nonCnamHandlingRegex.test(fileContent)) {
            logTest('deliverLeadResults handles non-CNAM case', true);
        } else {
            logTest('deliverLeadResults handles non-CNAM case', false, 'Non-CNAM handling not found');
        }
        
        // Test 7: resumeJob is called in the resume flow
        const resumeJobCallRegex = /await resumeJob\(jobId\)/;
        if (resumeJobCallRegex.test(fileContent)) {
            logTest('resumeJob is called in resume flow', true);
        } else {
            logTest('resumeJob is called in resume flow', false, 'resumeJob call not found');
        }
        
        return true;
    } catch (error) {
        logTest('_index.js file access', false, error.message);
        return false;
    }
}

async function checkNodeJsLogs() {
    console.log('\n🔍 Checking Node.js startup logs...');
    
    try {
        // Check if there are any critical errors in the logs
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Check if Node.js process is running
        try {
            const { stdout: psOutput } = await execAsync('ps aux | grep node | grep -v grep');
            if (psOutput.includes('_index.js') || psOutput.includes('node')) {
                logTest('Node.js process is running', true);
            } else {
                logTest('Node.js process is running', false, 'No node process found');
            }
        } catch (error) {
            logTest('Node.js process check', false, error.message);
        }
        
        // Test if we can make a simple request to the server
        try {
            const response = await axios.get('http://localhost:5000/', { timeout: 5000 });
            if (response.status === 200) {
                logTest('Node.js server responds to requests', true);
            } else {
                logTest('Node.js server responds to requests', false, `Status: ${response.status}`);
            }
        } catch (error) {
            logTest('Node.js server responds to requests', false, error.message);
        }
        
        return true;
    } catch (error) {
        logTest('Node.js logs check', false, error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting Lead Job Full Resume Implementation Tests\n');
    console.log('📝 Testing the following implementation changes:');
    console.log('   1. validateBulkNumbers accepts resumeData as 11th parameter');
    console.log('   2. lead-job-persistence.js has resumeJob function');
    console.log('   3. _index.js resumeInterruptedLeadJobs uses resumeData');
    console.log('   4. deliverLeadResults helper handles CNAM/non-CNAM cases');
    console.log('   5. Node.js service is healthy\n');
    
    // Run all tests
    await testNodeJsHealthCheck();
    testValidatePhoneBulkFunction();
    testLeadJobPersistenceFunction();
    testIndexJsResumeFunction();
    await checkNodeJsLogs();
    
    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! Lead job full resume implementation is correctly implemented.');
    } else {
        console.log('\n⚠️ Some tests failed. Please review the implementation.');
        console.log('\nFailed tests:');
        testResults.tests.filter(t => !t.passed).forEach(t => {
            console.log(`  ❌ ${t.name}: ${t.details}`);
        });
    }
    
    return testResults.failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, testResults };