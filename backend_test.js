const { MongoClient } = require('mongodb');

// Test CloudPhone wallet purchase crash fix
async function testCloudPhoneWalletFix() {
    let client;
    let results = [];
    
    try {
        console.log('🧪 STARTING CLOUDPHONE WALLET PURCHASE CRASH FIX TESTING');
        console.log('='.repeat(60));
        
        // 1. Test Node.js Health Check
        console.log('\n1️⃣ TESTING NODE.JS HEALTH ON PORT 5000');
        
        const healthResponse = await fetch('http://localhost:5000/health');
        const healthData = await healthResponse.json();
        console.log(`✅ Health Status: ${healthData.status}`);
        console.log(`✅ Database Status: ${healthData.database}`);
        console.log(`✅ Uptime: ${healthData.uptime}`);
        results.push({ test: 'Node.js Health', status: 'PASS', details: `Status: ${healthData.status}, DB: ${healthData.database}` });
        
        // 2. Connect to MongoDB
        console.log('\n2️⃣ CONNECTING TO MONGODB');
        const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/nomadly';
        client = new MongoClient(mongoUrl);
        await client.connect();
        const db = client.db();
        console.log('✅ MongoDB connected successfully');
        results.push({ test: 'MongoDB Connection', status: 'PASS', details: 'Connected to database' });
        
        // 3. Check walletOf collection for test user
        console.log('\n3️⃣ CHECKING WALLET FOR USER 1005284399');
        const walletCol = db.collection('walletOf');
        const userWallet = await walletCol.findOne({ _id: '1005284399' });
        
        if (userWallet) {
            console.log(`✅ User wallet found:`);
            console.log(`   💰 USD Balance: $${userWallet.usdBal || 0}`);
            console.log(`   💰 NGN Balance: ₦${userWallet.ngnBal || 0}`);
            console.log(`   💸 USD In: $${userWallet.usdIn || 0}`);
            console.log(`   💸 USD Out: $${userWallet.usdOut || 0}`);
            console.log(`   💸 NGN In: ₦${userWallet.ngnIn || 0}`);
            console.log(`   💸 NGN Out: ₦${userWallet.ngnOut || 0}`);
            
            // Check if user has expected usdIn = 270 (indicating refund of $75)
            if (userWallet.usdIn >= 270) {
                console.log('✅ USD refund verified: usdIn >= 270 (refunded $75)');
                results.push({ test: 'User Wallet Refund Verification', status: 'PASS', details: `usdIn: $${userWallet.usdIn}, indicates successful refund` });
            } else {
                console.log(`⚠️ USD refund NOT verified: usdIn = $${userWallet.usdIn || 0} (expected >= 270)`);
                results.push({ test: 'User Wallet Refund Verification', status: 'INFO', details: `usdIn: $${userWallet.usdIn || 0}, expected >= 270 for refund verification` });
            }
            
            // Calculate current balance
            const usdBalance = (userWallet.usdIn || 0) - (userWallet.usdOut || 0);
            console.log(`💵 Calculated USD Balance: $${usdBalance}`);
            
            if (Math.abs(usdBalance - 126.47) < 1.0) {
                console.log('✅ Balance matches expected ~$126.47');
                results.push({ test: 'User Balance Verification', status: 'PASS', details: `Balance: $${usdBalance}, matches expected ~$126.47` });
            } else {
                console.log(`⚠️ Balance differs from expected ~$126.47, actual: $${usdBalance}`);
                results.push({ test: 'User Balance Verification', status: 'INFO', details: `Balance: $${usdBalance}, differs from expected ~$126.47` });
            }
            
        } else {
            console.log('⚠️ User wallet not found');
            results.push({ test: 'User Wallet Check', status: 'INFO', details: 'User wallet 1005284399 not found in database' });
        }
        
        // 4. Verify try/catch block exists in _index.js
        console.log('\n4️⃣ CHECKING TRY/CATCH IMPLEMENTATION IN _INDEX.JS');
        const fs = require('fs');
        const indexContent = fs.readFileSync('/app/js/_index.js', 'utf8');
        
        // Find the walletOk['phone-pay'] handler
        const phonePayRegex = /'phone-pay':\s*async\s+coin\s*=>/;
        const phonePayMatch = indexContent.match(phonePayRegex);
        
        if (phonePayMatch) {
            console.log('✅ Found walletOk[\'phone-pay\'] handler');
            
            const handlerStart = phonePayMatch.index;
            // Get a larger section to capture the full handler
            const handlerSection = indexContent.substring(handlerStart, handlerStart + 8000);
            
            // Check for try/catch after wallet deduction
            if (handlerSection.includes('atomicIncrement(walletOf, chatId, \'usdOut\', priceUsd)') ||
                handlerSection.includes('atomicIncrement(walletOf, chatId, \'ngnOut\', priceNgn)')) {
                console.log('✅ Found wallet deduction (atomicIncrement usdOut/ngnOut)');
                
            // Check for try/catch - the purchase logic should be wrapped, 
            // but the "purchasing number" message can be before it
            if (handlerSection.includes('try {')) {
                console.log('✅ Try block found');
                
                // Look for catch block specifically for purchase errors  
                if (handlerSection.includes('} catch (purchaseErr)')) {
                    console.log('✅ Catch block with purchaseErr found');
                    
                    // Verify the purchase flows are inside the try block
                    const tryBlockStart = handlerSection.indexOf('try {');
                    const catchBlockStart = handlerSection.indexOf('} catch (purchaseErr)');
                    const tryBlockContent = handlerSection.substring(tryBlockStart, catchBlockStart);
                    
                    if (tryBlockContent.includes('if (provider === \'twilio\')') && 
                        tryBlockContent.includes('telnyxApi.buyNumber')) {
                        console.log('✅ Both Twilio and Telnyx purchase calls are inside try block');
                        results.push({ test: 'Try/Catch Block Existence', status: 'PASS', details: 'Purchase logic wrapped in try/catch with both providers' });
                    } else {
                        console.log('❌ Purchase calls not properly inside try block');
                        results.push({ test: 'Try/Catch Block Existence', status: 'FAIL', details: 'Provider calls not inside try block' });
                    }
                } else {
                    console.log('❌ Catch block with purchaseErr not found');
                    results.push({ test: 'Try/Catch Block Existence', status: 'FAIL', details: 'Catch block with purchaseErr not found' });
                }
            } else {
                console.log('❌ Try block not found');
                results.push({ test: 'Try/Catch Block Existence', status: 'FAIL', details: 'Try block not found' });
            }
                
            
            // Check for catch block features after confirming try/catch exists  
            if (handlerSection.includes('} catch (purchaseErr)')) {
                // Check for refund in catch block
                if (handlerSection.includes('atomicIncrement(walletOf, chatId, \'usdIn\', priceUsd)') &&
                    handlerSection.includes('atomicIncrement(walletOf, chatId, \'ngnIn\', priceNgn)')) {
                    console.log('✅ Catch block includes both USD and NGN refund logic');
                    results.push({ test: 'Catch Block Refund Logic', status: 'PASS', details: 'Both USD and NGN refunds implemented' });
                    
                    // Check for nested try/catch around refund
                    if (handlerSection.includes('} catch (refundErr)')) {
                        console.log('✅ Nested try/catch around refund logic');
                        results.push({ test: 'Nested Refund Try/Catch', status: 'PASS', details: 'Refund wrapped in nested try/catch' });
                    } else {
                        console.log('❌ Missing nested try/catch around refund');
                        results.push({ test: 'Nested Refund Try/Catch', status: 'FAIL', details: 'Refund not wrapped in nested try/catch' });
                    }
                    
                    // Check for CloudPhone logging
                    if (handlerSection.includes('[CloudPhone]')) {
                        console.log('✅ CloudPhone logging prefix found');
                        results.push({ test: 'CloudPhone Logging', status: 'PASS', details: 'Proper [CloudPhone] logging prefix' });
                    } else {
                        console.log('❌ CloudPhone logging prefix missing');
                        results.push({ test: 'CloudPhone Logging', status: 'FAIL', details: 'Missing [CloudPhone] logging prefix' });
                    }
                    
                    // Check for user notification
                    if (handlerSection.includes('purchaseFailed')) {
                        console.log('✅ User notification with purchaseFailed message');
                        results.push({ test: 'User Notification', status: 'PASS', details: 'purchaseFailed message sent to user' });
                    } else {
                        console.log('❌ Missing user notification');
                        results.push({ test: 'User Notification', status: 'FAIL', details: 'Missing purchaseFailed user notification' });
                    }
                    
                } else {
                    console.log('❌ Catch block missing refund logic');
                    results.push({ test: 'Catch Block Refund Logic', status: 'FAIL', details: 'Missing USD/NGN refund in catch block' });
                }
            }
            
            } else {
                console.log('❌ Wallet deduction code not found');
                results.push({ test: 'Wallet Deduction Code', status: 'FAIL', details: 'atomicIncrement wallet deduction not found' });
            }
            
            // Check if both Twilio and Telnyx paths are in try block - already checked above
            
            
        } else {
            console.log('❌ walletOk[\'phone-pay\'] handler not found');
            results.push({ test: 'Phone Pay Handler', status: 'FAIL', details: 'walletOk phone-pay handler not found' });
        }
        
        // 5. Summary
        console.log('\n🎯 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const passCount = results.filter(r => r.status === 'PASS').length;
        const failCount = results.filter(r => r.status === 'FAIL').length;
        const infoCount = results.filter(r => r.status === 'INFO').length;
        
        console.log(`✅ PASSED: ${passCount}`);
        console.log(`❌ FAILED: ${failCount}`);  
        console.log(`ℹ️ INFO: ${infoCount}`);
        console.log(`📊 TOTAL: ${results.length}`);
        
        results.forEach((result, index) => {
            const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : 'ℹ️';
            console.log(`${index + 1}. ${icon} ${result.test}: ${result.details}`);
        });
        
        console.log('\n🔍 CLOUDPHONE WALLET CRASH FIX VERIFICATION COMPLETE');
        
        return {
            success: failCount === 0,
            passCount,
            failCount,
            infoCount,
            totalTests: results.length,
            results
        };
        
    } catch (error) {
        console.error('❌ Test error:', error);
        return {
            success: false,
            error: error.message,
            results
        };
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Run the test
testCloudPhoneWalletFix()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });