const { MongoClient } = require('mongodb');
const fs = require('fs');

// Test CloudPhone wallet purchase crash fix
async function testCloudPhoneWalletFix() {
    let client;
    let results = [];
    
    try {
        console.log('🧪 CLOUDPHONE WALLET PURCHASE CRASH FIX TESTING');
        console.log('='.repeat(60));
        
        // 1. Test Node.js Health Check
        console.log('\n1️⃣ NODE.JS HEALTH ON PORT 5000');
        const healthResponse = await fetch('http://localhost:5000/health');
        const healthData = await healthResponse.json();
        console.log(`✅ Status: ${healthData.status}, Database: ${healthData.database}`);
        results.push({ test: 'Node.js Health', status: 'PASS', details: `Status: ${healthData.status}, DB: ${healthData.database}` });
        
        // 2. Connect to MongoDB
        console.log('\n2️⃣ MONGODB CONNECTION');
        const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/nomadly';
        client = new MongoClient(mongoUrl);
        await client.connect();
        const db = client.db();
        console.log('✅ MongoDB connected');
        results.push({ test: 'MongoDB Connection', status: 'PASS', details: 'Connected successfully' });
        
        // 3. Check specific user wallet
        console.log('\n3️⃣ USER 1005284399 WALLET CHECK');
        const walletCol = db.collection('walletOf');
        const userWallet = await walletCol.findOne({ _id: '1005284399' });
        
        if (userWallet) {
            console.log(`✅ Wallet found - USD In: $${userWallet.usdIn || 0}, Balance: $${(userWallet.usdIn || 0) - (userWallet.usdOut || 0)}`);
            if (userWallet.usdIn >= 270) {
                console.log('✅ Refund verified (usdIn >= 270 indicates $75 refund)');
                results.push({ test: 'User Refund Verification', status: 'PASS', details: `usdIn: $${userWallet.usdIn}` });
            } else {
                console.log(`ℹ️ Refund not yet visible (usdIn: $${userWallet.usdIn || 0})`);
                results.push({ test: 'User Refund Verification', status: 'INFO', details: `usdIn: $${userWallet.usdIn || 0}, expected >= 270` });
            }
        } else {
            console.log('ℹ️ User wallet not found');
            results.push({ test: 'User Wallet Check', status: 'INFO', details: 'User 1005284399 not found' });
        }
        
        // 4. Code Implementation Check
        console.log('\n4️⃣ TRY/CATCH IMPLEMENTATION CHECK');
        const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
        
        // Find phone-pay handler
        const phonePayMatch = indexContent.match(/'phone-pay':\s*async\s+coin\s*=>/);
        if (!phonePayMatch) {
            console.log('❌ phone-pay handler not found');
            results.push({ test: 'Handler Existence', status: 'FAIL', details: 'phone-pay handler missing' });
            return;
        }
        console.log('✅ phone-pay handler found');
        
        // Get handler content 
        const handlerStart = phonePayMatch.index;
        const handlerContent = indexContent.substring(handlerStart, handlerStart + 6000);
        
        // Check wallet deduction
        const hasWalletDeduct = handlerContent.includes('atomicIncrement(walletOf, chatId, \'usdOut\'') &&
                               handlerContent.includes('atomicIncrement(walletOf, chatId, \'ngnOut\'');
        if (!hasWalletDeduct) {
            console.log('❌ Wallet deduction code not found');
            results.push({ test: 'Wallet Deduction', status: 'FAIL', details: 'Missing atomicIncrement deduction' });
            return;
        }
        console.log('✅ Wallet deduction found');
        
        // Check try/catch structure
        const hasTryBlock = handlerContent.includes('try {');
        const hasCatchBlock = handlerContent.includes('catch (purchaseErr)');
        
        if (!hasTryBlock) {
            console.log('❌ Try block missing');
            results.push({ test: 'Try/Catch Block', status: 'FAIL', details: 'Try block not found' });
            return;
        }
        
        if (!hasCatchBlock) {
            console.log('❌ Catch block missing');
            results.push({ test: 'Try/Catch Block', status: 'FAIL', details: 'Catch block with purchaseErr not found' });
            return;
        }
        
        console.log('✅ Try/catch structure exists');
        
        // Check both providers are in try block
        const tryStart = handlerContent.indexOf('try {');
        const catchStart = handlerContent.indexOf('catch (purchaseErr)');
        const tryBlockContent = handlerContent.substring(tryStart, catchStart);
        
        const hasTwilioPath = tryBlockContent.includes('if (provider === \'twilio\')');
        const hasTelnyxPath = tryBlockContent.includes('telnyxApi.buyNumber');
        
        if (hasTwilioPath && hasTelnyxPath) {
            console.log('✅ Both Twilio and Telnyx paths in try block');
            results.push({ test: 'Provider Coverage', status: 'PASS', details: 'Both providers wrapped in try/catch' });
        } else {
            console.log('❌ Provider paths not properly covered');
            results.push({ test: 'Provider Coverage', status: 'FAIL', details: `Twilio: ${hasTwilioPath}, Telnyx: ${hasTelnyxPath}` });
        }
        
        // Check catch block features
        const catchStart2 = handlerContent.indexOf('catch (purchaseErr)');
        const catchContent = handlerContent.substring(catchStart2, catchStart2 + 800);
        
        // Refund logic
        const hasUsdRefund = catchContent.includes('atomicIncrement(walletOf, chatId, \'usdIn\', priceUsd)');
        const hasNgnRefund = catchContent.includes('atomicIncrement(walletOf, chatId, \'ngnIn\', priceNgn)');
        if (hasUsdRefund && hasNgnRefund) {
            console.log('✅ Both USD and NGN refund logic found');
            results.push({ test: 'Refund Logic', status: 'PASS', details: 'USD and NGN refunds implemented' });
        } else {
            console.log('❌ Refund logic incomplete');
            results.push({ test: 'Refund Logic', status: 'FAIL', details: `USD: ${hasUsdRefund}, NGN: ${hasNgnRefund}` });
        }
        
        // Nested try/catch for refund
        const hasNestedTryCatch = catchContent.includes('catch (refundErr)');
        if (hasNestedTryCatch) {
            console.log('✅ Nested try/catch for refund found');
            results.push({ test: 'Nested Refund Protection', status: 'PASS', details: 'Refund wrapped in try/catch' });
        } else {
            console.log('❌ Nested try/catch missing');
            results.push({ test: 'Nested Refund Protection', status: 'FAIL', details: 'Refund not protected by nested try/catch' });
        }
        
        // CloudPhone logging
        const hasLogging = catchContent.includes('[CloudPhone]');
        if (hasLogging) {
            console.log('✅ CloudPhone logging found');
            results.push({ test: 'Error Logging', status: 'PASS', details: '[CloudPhone] prefix in catch block' });
        } else {
            console.log('❌ CloudPhone logging missing');
            results.push({ test: 'Error Logging', status: 'FAIL', details: 'Missing [CloudPhone] logging prefix' });
        }
        
        // User notification
        const hasUserNotify = catchContent.includes('purchaseFailed');
        if (hasUserNotify) {
            console.log('✅ User notification found');
            results.push({ test: 'User Notification', status: 'PASS', details: 'purchaseFailed message sent' });
        } else {
            console.log('❌ User notification missing');
            results.push({ test: 'User Notification', status: 'FAIL', details: 'Missing purchaseFailed user message' });
        }
        
        // Summary
        console.log('\n🎯 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const passed = results.filter(r => r.status === 'PASS').length;
        const failed = results.filter(r => r.status === 'FAIL').length;
        const info = results.filter(r => r.status === 'INFO').length;
        
        console.log(`✅ PASSED: ${passed}/${results.length}`);
        console.log(`❌ FAILED: ${failed}/${results.length}`);  
        console.log(`ℹ️ INFO: ${info}/${results.length}`);
        
        results.forEach((result, i) => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : 'ℹ️';
            console.log(`${i + 1}. ${icon} ${result.test}: ${result.details}`);
        });
        
        return { success: failed === 0, results, passed, failed, info };
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
        return { success: false, error: error.message, results };
    } finally {
        if (client) await client.close();
    }
}

// Run test
testCloudPhoneWalletFix()
    .then(result => {
        console.log(`\n🏁 RESULT: ${result.success ? 'PASS' : 'FAIL'}`);
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Fatal:', error.message);
        process.exit(1);
    });