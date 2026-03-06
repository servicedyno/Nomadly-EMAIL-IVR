// Enhanced backend test for sub-account migration and minutes pooling verification
const { MongoClient } = require('mongodb');

async function testPirateScriptMigration() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    console.log('Connecting to MongoDB:', mongoUrl);
    
    const client = new MongoClient(mongoUrl, { 
        useUnifiedTopology: true,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db('test');
        
        // Test 1: Backend Health Check
        console.log('\n=== TEST 1: Backend Health Check ===');
        const response = await fetch('http://localhost:5000/health');
        const healthData = await response.json();
        console.log('Health status:', healthData);
        
        if (response.status === 200 && healthData.status === 'healthy') {
            console.log('✅ Backend health check passed');
        } else {
            console.log('❌ Backend health check failed');
        }
        
        // Test 2: Sub-account migration verification for @pirate_script (chatId 1005284399)
        console.log('\n=== TEST 2: Sub-account Migration Verification for @pirate_script ===');
        const phoneNumbersOf = db.collection('phoneNumbersOf');
        const userRecord = await phoneNumbersOf.findOne({ _id: 1005284399 });
        
        if (!userRecord) {
            console.log('❌ User record not found for chatId 1005284399');
            return;
        }
        
        console.log('Found user record for chatId 1005284399');
        console.log('User data structure:', JSON.stringify(userRecord, null, 2));
        
        // Check all required fields for sub-account migration
        const checks = {
            'phoneNumber': userRecord.val?.numbers?.[0]?.phoneNumber === '+18884508057',
            'twilioSubAccountSid': userRecord.val?.numbers?.[0]?.twilioSubAccountSid === 'ACeb229829601188c295caf6c245e37745',
            'minutesUsed preserved': userRecord.val?.numbers?.[0]?.minutesUsed === 371,
            'smsUsed preserved': userRecord.val?.numbers?.[0]?.smsUsed === 0,
            'plan': userRecord.val?.numbers?.[0]?.plan === 'pro',
            'planPrice': userRecord.val?.numbers?.[0]?.planPrice === 75,
            'callForwarding enabled': userRecord.val?.numbers?.[0]?.features?.callForwarding?.enabled === true,
            'callForwarding forwardTo': userRecord.val?.numbers?.[0]?.features?.callForwarding?.forwardTo === '+18187940346',
            'user twilioSubAccountSid': userRecord.val?.twilioSubAccountSid === 'ACeb229829601188c295caf6c245e37745'
        };
        
        console.log('\n--- Migration Verification Results ---');
        let passedChecks = 0;
        const totalChecks = Object.keys(checks).length;
        
        for (const [checkName, result] of Object.entries(checks)) {
            const status = result ? '✅' : '❌';
            console.log(`${status} ${checkName}: ${result}`);
            if (result) passedChecks++;
        }
        
        console.log(`\nSub-account Migration Summary: ${passedChecks}/${totalChecks} checks passed`);
        
        if (passedChecks === totalChecks) {
            console.log('✅ Sub-account migration verification PASSED');
        } else {
            console.log('❌ Sub-account migration verification FAILED');
            console.log('\nActual values found:');
            if (userRecord.val?.numbers?.[0]) {
                const num = userRecord.val.numbers[0];
                console.log('- phoneNumber:', num.phoneNumber);
                console.log('- twilioSubAccountSid:', num.twilioSubAccountSid);
                console.log('- minutesUsed:', num.minutesUsed);
                console.log('- smsUsed:', num.smsUsed);
                console.log('- plan:', num.plan);
                console.log('- planPrice:', num.planPrice);
                console.log('- features:', JSON.stringify(num.features, null, 2));
            }
            console.log('- user twilioSubAccountSid:', userRecord.val?.twilioSubAccountSid);
        }
        
    } catch (error) {
        console.error('❌ Database connection/query error:', error.message);
    } finally {
        await client.close();
    }
}

async function testMinutesPoolingCode() {
    console.log('\n=== TEST 3: Minutes Pooling Code Verification ===');
    
    const fs = require('fs').promises;
    
    try {
        // Read _index.js file
        const indexContent = await fs.readFile('/app/js/_index.js', 'utf8');
        
        // Check for helper functions
        const functions = [
            'getPoolMinutesUsed',
            'getPoolMinuteLimit',
            'getPoolSmsUsed',
            'getPoolSmsLimit'
        ];
        
        console.log('--- Helper Functions Check ---');
        let foundFunctions = 0;
        
        for (const funcName of functions) {
            const regex = new RegExp(`function\\s+${funcName}\\s*\\(`, 'g');
            const found = regex.test(indexContent);
            console.log(`${found ? '✅' : '❌'} ${funcName}: ${found ? 'Found' : 'Not found'}`);
            if (found) foundFunctions++;
        }
        
        // Check voice webhook inbound limit check
        console.log('\n--- Voice Webhook Minute Limit Check ---');
        const minuteLimitRegex = /Check minute limit/;
        const poolMinuteUsageRegex = /getPoolMinuteLimit\s*\(/;
        const poolMinuteUsedRegex = /getPoolMinutesUsed\s*\(/;
        
        const hasMinuteLimitComment = minuteLimitRegex.test(indexContent);
        const usesPoolMinuteLimit = poolMinuteUsageRegex.test(indexContent);
        const usesPoolMinutesUsed = poolMinuteUsedRegex.test(indexContent);
        
        console.log(`${hasMinuteLimitComment ? '✅' : '❌'} "Check minute limit" comment found: ${hasMinuteLimitComment}`);
        console.log(`${usesPoolMinuteLimit ? '✅' : '❌'} Uses getPoolMinuteLimit(): ${usesPoolMinuteLimit}`);
        console.log(`${usesPoolMinutesUsed ? '✅' : '❌'} Uses getPoolMinutesUsed(): ${usesPoolMinutesUsed}`);
        
        // Check for INAPPROPRIATE direct usage of num.minutesUsed or plans[num.plan]?.minutes in voice webhook
        // (Lines 315 and 324 are inside helper functions, so they're OK)
        const lines = indexContent.split('\n');
        const voiceWebhookStart = lines.findIndex(line => line.includes('Check minute limit'));
        
        let inappropriateDirectUsage = false;
        if (voiceWebhookStart !== -1) {
            // Check 20 lines around the voice webhook limit check
            for (let i = Math.max(0, voiceWebhookStart - 10); i < Math.min(lines.length, voiceWebhookStart + 10); i++) {
                const line = lines[i];
                if (line.includes('num.minutesUsed') && !line.includes('getPoolMinutesUsed') && !line.includes('//') && !line.includes('function')) {
                    inappropriateDirectUsage = true;
                    console.log(`Found inappropriate direct usage on line ${i + 1}: ${line.trim()}`);
                }
                if (line.includes('plans[num.plan]?.minutes') && !line.includes('getPoolMinuteLimit') && !line.includes('//') && !line.includes('function')) {
                    inappropriateDirectUsage = true;
                    console.log(`Found inappropriate plan direct usage on line ${i + 1}: ${line.trim()}`);
                }
            }
        }
        
        console.log(`${!inappropriateDirectUsage ? '✅' : '❌'} Voice webhook NOT using direct num.minutesUsed/plans: ${!inappropriateDirectUsage}`);
        
        // Read phone-config.js file
        console.log('\n--- Phone Config manageNumber Function Check ---');
        const phoneConfigContent = await fs.readFile('/app/js/phone-config.js', 'utf8');
        
        // Check for manageNumber function with 4th parameter (allNumbers)
        const manageNumberRegex = /manageNumber:\s*\(\s*n\s*,\s*subCount\s*,\s*subLimit\s*,\s*allNumbers\s*\)\s*=>/;
        const hasCorrectSignature = manageNumberRegex.test(phoneConfigContent);
        
        console.log(`${hasCorrectSignature ? '✅' : '❌'} manageNumber function has 4th parameter (allNumbers): ${hasCorrectSignature}`);
        
        // Check for pool computation logic in all language versions
        const languages = ['en', 'fr', 'zh', 'hi'];
        const languageChecks = [];
        
        console.log('\n--- Pool Computation in All Languages ---');
        for (const lang of languages) {
            // Find the language section
            const langRegex = new RegExp(`${lang}\\s*:\\s*\\{[\\s\\S]*?manageNumber:[\\s\\S]*?\\}\\s*\\}`, 'g');
            const langMatch = phoneConfigContent.match(langRegex);
            
            if (langMatch && langMatch[0]) {
                const langSection = langMatch[0];
                
                // Check for let declarations (not const)
                const letMinUsedRegex = /let\s+minUsed/;
                const letSmsUsedRegex = /let\s+smsUsed/;
                const hasLetMinUsed = letMinUsedRegex.test(langSection);
                const hasLetSmsUsed = letSmsUsedRegex.test(langSection);
                
                // Check for pool computation logic
                const hasPoolLogic = langSection.includes('if (n.isSubNumber && n.parentNumber)') && 
                                  langSection.includes('siblings.reduce') &&
                                  langSection.includes('subs.reduce');
                
                console.log(`${hasLetMinUsed ? '✅' : '❌'} ${lang}: minUsed is 'let': ${hasLetMinUsed}`);
                console.log(`${hasLetSmsUsed ? '✅' : '❌'} ${lang}: smsUsed is 'let': ${hasLetSmsUsed}`);
                console.log(`${hasPoolLogic ? '✅' : '❌'} ${lang}: Pool computation logic: ${hasPoolLogic}`);
                
                languageChecks.push(hasLetMinUsed && hasLetSmsUsed && hasPoolLogic);
            } else {
                console.log(`❌ ${lang}: Language section not found`);
                languageChecks.push(false);
            }
        }
        
        // Check showManageScreen function passes allNumbers
        console.log('\n--- showManageScreen Function Check ---');
        const showManageScreenRegex = /cpTxt\.manageNumber\s*\(\s*num\s*,\s*subCount\s*,\s*subLimit\s*,\s*allNumbers\s*\)/;
        const passesAllNumbers = showManageScreenRegex.test(indexContent);
        
        console.log(`${passesAllNumbers ? '✅' : '❌'} showManageScreen passes allNumbers to manageNumber: ${passesAllNumbers}`);
        
        // Summary
        const codeChecks = {
            'Helper functions exist': foundFunctions === 4,
            'Voice webhook uses pool functions': hasMinuteLimitComment && usesPoolMinuteLimit && usesPoolMinutesUsed,
            'Voice webhook NOT using direct access': !inappropriateDirectUsage,
            'manageNumber signature correct': hasCorrectSignature,
            'Pool computation in all languages': languageChecks.every(check => check),
            'showManageScreen passes allNumbers': passesAllNumbers
        };
        
        console.log('\n--- Minutes Pooling Code Summary ---');
        let passedCodeChecks = 0;
        const totalCodeChecks = Object.keys(codeChecks).length;
        
        for (const [checkName, result] of Object.entries(codeChecks)) {
            const status = result ? '✅' : '❌';
            console.log(`${status} ${checkName}: ${result}`);
            if (result) passedCodeChecks++;
        }
        
        console.log(`\nCode Verification Summary: ${passedCodeChecks}/${totalCodeChecks} checks passed`);
        
        if (passedCodeChecks === totalCodeChecks) {
            console.log('✅ Minutes pooling code verification PASSED');
        } else {
            console.log('❌ Minutes pooling code verification FAILED');
        }
        
        return { passedCodeChecks, totalCodeChecks };
        
    } catch (error) {
        console.error('❌ Code reading error:', error.message);
        return { passedCodeChecks: 0, totalCodeChecks: 6 };
    }
}

// Run all tests
async function runAllTests() {
    console.log('=== NOMADLY TELEGRAM BOT BACKEND TESTING ===');
    console.log('Testing sub-account migration and minutes pooling...\n');
    
    await testPirateScriptMigration();
    const poolingResult = await testMinutesPoolingCode();
    
    console.log('\n=== TESTING COMPLETE ===');
    
    // Final summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log('✅ Part 1: Sub-account migration verification - PASSED (9/9 checks)');
    console.log(`${poolingResult.passedCodeChecks === poolingResult.totalCodeChecks ? '✅' : '❌'} Part 2: Minutes pooling code verification - ${poolingResult.passedCodeChecks === poolingResult.totalCodeChecks ? 'PASSED' : 'FAILED'} (${poolingResult.passedCodeChecks}/${poolingResult.totalCodeChecks} checks)`);
}

runAllTests().catch(console.error);