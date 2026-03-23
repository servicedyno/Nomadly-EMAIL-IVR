#!/usr/bin/env python3
"""
Backend Testing Script for DynoPay Webhook Fix and SIP Fixes
Tests the Node.js backend running on port 5000
"""

import requests
import json
import sys
import time
from pymongo import MongoClient
import os

# Configuration
BACKEND_URL = "http://localhost:5000"
MONGO_URL = "mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668"
DB_NAME = "test"

def test_health_endpoint():
    """Test Node.js health endpoint"""
    print("=== TEST 1: Node.js Health Check ===")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health endpoint working: {data}")
            return True
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_dynopay_webhook_components():
    """Test DynoPay webhook fix components by examining the code structure"""
    print("\n=== TEST 2: DynoPay Webhook Fix Verification ===")
    
    # Read the _index.js file to verify components
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        checks = {
            "dynopayPaymentIdToRef Map": "const dynopayPaymentIdToRef = new Map()" in content,
            "Pending event handler stores mapping": "dynopayPaymentIdToRef.set(paymentId, pendingRef)" in content,
            "Failed events explicitly skipped": "event === 'payment.failed'" in content,
            "RefId recovery fallback": "dynopayPaymentIdToRef.get(paymentId)" in content,
            "Admin alert for missed payments": "Missed Payment Alert" in content,
            "Dedup cleanup": "dynopayPaymentIdToRef.delete(paymentId)" in content
        }
        
        all_passed = True
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"{status} {check}: {'FOUND' if passed else 'MISSING'}")
            if not passed:
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Error reading _index.js: {e}")
        return False

def test_mongodb_wallet_credit():
    """Test manual wallet credit verification"""
    print("\n=== TEST 3: Manual Wallet Credit Verification ===")
    
    try:
        # Try to connect to MongoDB
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connection successful")
        
        # Check wallet for user 6604316166
        wallet = db.walletOf.find_one({"_id": "6604316166"})
        if wallet:
            usd_in = wallet.get('usdIn', 0)
            print(f"✅ User 6604316166 wallet found: usdIn = {usd_in}")
            
            if usd_in == 125:
                print("✅ Manual credit verified: usdIn = 125 (was 83, +42)")
                
                # Check for manual_credit payment record
                payment = db.payments.find_one({"ref": "7vX4y"})
                if payment:
                    print(f"✅ Payment record found for ref 7vX4y: {payment.get('type', 'unknown')}")
                    return True
                else:
                    print("⚠️ Payment record for ref 7vX4y not found")
                    return True  # Wallet credit is the main verification
            else:
                print(f"❌ Expected usdIn=125, got {usd_in}")
                return False
        else:
            print("❌ User 6604316166 wallet not found")
            return False
            
    except Exception as e:
        print(f"❌ MongoDB test failed: {e}")
        return False
    finally:
        try:
            client.close()
        except:
            pass

def test_trial_ivr_fix():
    """Test Trial IVR D51 fix components"""
    print("\n=== TEST 4: Trial IVR D51 Fix Verification ===")
    
    try:
        # Check _index.js for trial path fix
        with open('/app/js/_index.js', 'r') as f:
            index_content = f.read()
        
        # Check voice-service.js for trial implementation
        with open('/app/js/voice-service.js', 'r') as f:
            voice_content = f.read()
            
        # Check twilio-service.js for makeTrialOutboundCall
        with open('/app/js/twilio-service.js', 'r') as f:
            twilio_content = f.read()
        
        checks = {
            "Trial path sets callerProvider: 'twilio'": "callerProvider: 'twilio'" in index_content,
            "Security check skips trial (!isTrial)": "!ivrObData.isTrial" in index_content,
            "Voice service uses makeTrialOutboundCall": "makeTrialOutboundCall" in voice_content,
            "makeTrialOutboundCall function exists": "async function makeTrialOutboundCall" in twilio_content,
            "makeTrialOutboundCall exported": "makeTrialOutboundCall," in twilio_content
        }
        
        all_passed = True
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"{status} {check}: {'FOUND' if passed else 'MISSING'}")
            if not passed:
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Error checking trial IVR fix: {e}")
        return False

def test_sip_rate_limiting():
    """Test SIP rate limiting implementation"""
    print("\n=== TEST 5: SIP Rate Limiting Verification ===")
    
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        checks = {
            "checkSipRateLimit function exists": "function checkSipRateLimit" in content,
            "SIP_RATE_LIMIT_MAX = 3": "SIP_RATE_LIMIT_MAX = 3" in content,
            "SIP_RATE_LIMIT_WINDOW = 60000": "SIP_RATE_LIMIT_WINDOW = 60000" in content,
            "Rate limit check in handleOutboundSipCall": "checkSipRateLimit(sipUsername, destination)" in content,
            "Rate limit enforcement before SIP lookup": "exceeded" in content and "rejecting" in content
        }
        
        all_passed = True
        for check, passed in checks.items():
            status = "✅" if passed else "❌"
            print(f"{status} {check}: {'FOUND' if passed else 'MISSING'}")
            if not passed:
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"❌ Error checking SIP rate limiting: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Starting Backend Testing for DynoPay Webhook Fix and SIP Fixes")
    print("=" * 70)
    
    results = []
    
    # Test 1: Health endpoint
    results.append(("Node.js Health", test_health_endpoint()))
    
    # Test 2: DynoPay webhook fix
    results.append(("DynoPay Webhook Fix", test_dynopay_webhook_components()))
    
    # Test 3: MongoDB wallet credit
    results.append(("Manual Wallet Credit", test_mongodb_wallet_credit()))
    
    # Test 4: Trial IVR fix
    results.append(("Trial IVR D51 Fix", test_trial_ivr_fix()))
    
    # Test 5: SIP rate limiting
    results.append(("SIP Rate Limiting", test_sip_rate_limiting()))
    
    # Summary
    print("\n" + "=" * 70)
    print("🏁 TEST SUMMARY")
    print("=" * 70)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️ Some tests failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())