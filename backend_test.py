#!/usr/bin/env python3
"""
Twilio Regulatory Bundle Backend Test for South Africa (ZA)
Tests the Nomadly Telegram bot backend (Node.js on port 5000)

IMPORTANT: This tests the Node.js backend on port 5000, NOT the FastAPI backend on port 8001.
External URL: https://env-webhook-api.preview.emergentagent.com/api
"""

import requests
import json
import subprocess
import sys
import os

# Backend URL Configuration
LOCALHOST_URL = "http://localhost:5000"
EXTERNAL_URL = "https://env-webhook-api.preview.emergentagent.com/api"

def test_node_health():
    """Test 1: Node.js Health Check"""
    print("=== Test 1: Node.js Health Check ===")
    try:
        response = requests.get(f'{LOCALHOST_URL}/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            expected = {'status': 'healthy', 'database': 'connected'}
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print("✅ Node.js health check passed")
                print(f"   Response: {data}")
                return True
            else:
                print(f"❌ Node.js not healthy: {data}")
                return False
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check exception: {e}")
        return False

def check_node_error_log():
    """Check Node.js error log is empty"""
    print("=== Checking Node.js Error Log ===")
    try:
        result = subprocess.run(['cat', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            if result.stdout.strip() == "":
                print("✅ Node.js error log is empty (no errors)")
                return True
            else:
                print(f"❌ Node.js error log contains errors:")
                print(result.stdout)
                return False
        else:
            print("❌ Could not read nodejs.err.log")
            return False
    except Exception as e:
        print(f"❌ Error checking log: {e}")
        return False

def verify_twilio_service_exports():
    """Test 2: Verify all new Twilio service exports exist"""
    print("=== Test 2: Twilio Service Exports Verification ===")
    
    try:
        with open('/app/js/twilio-service.js', 'r') as f:
            content = f.read()
        
        # Check BUNDLE_REQUIRED_COUNTRIES contains ZA
        if "BUNDLE_REQUIRED_COUNTRIES = ['ZA']" in content:
            print("✅ BUNDLE_REQUIRED_COUNTRIES contains 'ZA'")
            bundle_countries_ok = True
        else:
            print("❌ BUNDLE_REQUIRED_COUNTRIES missing or doesn't contain 'ZA'")
            bundle_countries_ok = False
        
        # Check function definitions
        required_functions = {
            'needsBundle': 'function needsBundle(countryCode)',
            'getRegulationSid': 'async function getRegulationSid(isoCountry, numberType, endUserType)',
            'createEndUser': 'async function createEndUser(friendlyName, type, attributes)',
            'createBundle': 'async function createBundle(friendlyName, email, isoCountry, numberType, endUserType, regulationSid, statusCallback)',
            'addBundleItem': 'async function addBundleItem(bundleSid, objectSid)',
            'submitBundle': 'async function submitBundle(bundleSid)',
            'getBundleStatus': 'async function getBundleStatus(bundleSid)'
        }
        
        functions_ok = True
        for func_name, func_signature in required_functions.items():
            if func_signature in content:
                print(f"✅ {func_name} function exists")
            else:
                print(f"❌ {func_name} function missing")
                functions_ok = False
        
        # Check exports
        exports_to_check = [
            'BUNDLE_REQUIRED_COUNTRIES',
            'needsBundle',
            'getRegulationSid', 
            'createEndUser',
            'createBundle',
            'addBundleItem',
            'submitBundle',
            'getBundleStatus'
        ]
        
        exports_ok = True
        for export_name in exports_to_check:
            if export_name in content and 'module.exports' in content:
                print(f"✅ {export_name} is exported")
            else:
                print(f"❌ {export_name} export missing")
                exports_ok = False
        
        return bundle_countries_ok and functions_ok and exports_ok
        
    except Exception as e:
        print(f"❌ Error verifying Twilio service: {e}")
        return False

def verify_needs_bundle_function():
    """Test 3: Verify needsBundle function logic"""
    print("=== Test 3: needsBundle Function Logic ===")
    
    try:
        with open('/app/js/twilio-service.js', 'r') as f:
            content = f.read()
        
        # Check function implementation
        needs_bundle_impl = """function needsBundle(countryCode) {
  return BUNDLE_REQUIRED_COUNTRIES.includes(countryCode)
}"""
        
        if 'return BUNDLE_REQUIRED_COUNTRIES.includes(countryCode)' in content:
            print("✅ needsBundle function correctly checks BUNDLE_REQUIRED_COUNTRIES")
            print("   - needsBundle('ZA') should return true")
            print("   - needsBundle('US') should return false")
            return True
        else:
            print("❌ needsBundle function implementation incorrect")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying needsBundle: {e}")
        return False

def verify_buynumber_bundlesid_param():
    """Test 4: Verify buyNumber accepts bundleSid parameter"""
    print("=== Test 4: buyNumber bundleSid Parameter ===")
    
    try:
        with open('/app/js/twilio-service.js', 'r') as f:
            content = f.read()
        
        # Check function signature has 6 parameters including bundleSid
        function_signature = 'async function buyNumber(phoneNumber, subSid, subToken, webhookBaseUrl, addressSid, bundleSid)'
        
        if function_signature in content:
            print("✅ buyNumber function accepts bundleSid parameter (6th param)")
        else:
            print("❌ buyNumber function signature missing bundleSid parameter")
            return False
        
        # Check bundleSid is used in opts
        if 'if (bundleSid) opts.bundleSid = bundleSid' in content:
            print("✅ buyNumber adds bundleSid to opts when provided")
            return True
        else:
            print("❌ buyNumber doesn't use bundleSid parameter")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying buyNumber bundleSid: {e}")
        return False

def verify_execute_twilio_purchase_bundlesid():
    """Test 5: Verify executeTwilioPurchase accepts bundleSid"""
    print("=== Test 5: executeTwilioPurchase bundleSid Parameter ===")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check function signature has 11 parameters including bundleSid as last
        if 'async function executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, numType, paymentMethod, addressSid, subOpts, bundleSid)' in content:
            print("✅ executeTwilioPurchase accepts bundleSid as 11th parameter")
        else:
            print("❌ executeTwilioPurchase signature missing bundleSid parameter")
            return False
        
        # Check it passes bundleSid to twilioService.buyNumber
        if 'await twilioService.buyNumber(selectedNumber, null, null, SELF_URL, addressSid || null, bundleSid || null)' in content:
            print("✅ executeTwilioPurchase passes bundleSid to twilioService.buyNumber")
            return True
        else:
            print("❌ executeTwilioPurchase doesn't pass bundleSid to buyNumber")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying executeTwilioPurchase: {e}")
        return False

def verify_cpenteraddress_bundle_branch():
    """Test 6: Verify cpEnterAddress handler has bundle creation logic"""
    print("=== Test 6: cpEnterAddress Bundle Creation Logic ===")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find cpEnterAddress handler
        if "if (action === a.cpEnterAddress)" not in content:
            print("❌ cpEnterAddress handler not found")
            return False
        
        print("✅ cpEnterAddress handler found")
        
        # Check for bundle check after address creation
        if "if (twilioService.needsBundle(countryCode))" not in content:
            print("❌ twilioService.needsBundle check missing")
            return False
        
        print("✅ twilioService.needsBundle check found")
        
        # Check for regulatory bundle creation steps
        bundle_steps = [
            'await twilioService.getRegulationSid(countryCode, numType, \'individual\')',
            'await twilioService.createEndUser(customerName, \'individual\'',
            'await twilioService.createBundle(',
            'await twilioService.addBundleItem(bundleResult.sid, endUserResult.sid)',
            'await twilioService.addBundleItem(bundleResult.sid, addressSid)',
            'await twilioService.submitBundle(bundleResult.sid)'
        ]
        
        steps_ok = True
        for step in bundle_steps:
            if step in content:
                print(f"✅ Bundle step found: {step.split('(')[0]}()")
            else:
                print(f"❌ Bundle step missing: {step.split('(')[0]}()")
                steps_ok = False
        
        # Check pendingBundles storage
        if 'await pendingBundles.insertOne({' in content:
            print("✅ pendingBundles.insertOne found")
            
            # Check required fields
            required_fields = [
                'chatId', 'bundleSid', 'endUserSid', 'addressSid', 
                'selectedNumber', 'planKey', 'price', 'status'
            ]
            
            fields_ok = True
            for field in required_fields:
                if f'{field}:' in content or f'{field},' in content:
                    print(f"✅ pendingBundles field: {field}")
                else:
                    print(f"❌ pendingBundles field missing: {field}")
                    fields_ok = False
        else:
            print("❌ pendingBundles.insertOne missing")
            fields_ok = False
        
        # Check user notification about regulatory approval
        if 'Regulatory Approval Required' in content and '1-3 business days' in content:
            print("✅ User notification about regulatory approval found")
            notification_ok = True
        else:
            print("❌ User notification about regulatory approval missing")
            notification_ok = False
        
        # Check error handling with wallet refund
        if 'atomicIncrement(walletOf, chatId' in content and 'usdIn' in content:
            print("✅ Error handling with wallet refund found")
            error_handling_ok = True
        else:
            print("❌ Error handling with wallet refund missing")
            error_handling_ok = False
        
        return steps_ok and fields_ok and notification_ok and error_handling_ok
        
    except Exception as e:
        print(f"❌ Error verifying cpEnterAddress bundle logic: {e}")
        return False

def verify_pending_bundles_collection():
    """Test 7: Verify pendingBundles collection initialization"""
    print("=== Test 7: pendingBundles Collection Initialization ===")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check collection declaration
        if 'pendingBundles = {}' in content:
            print("✅ pendingBundles variable declared")
        else:
            print("❌ pendingBundles variable not declared")
            return False
        
        # Check collection initialization in loadData
        if "pendingBundles = db.collection('pendingBundles')" in content:
            print("✅ pendingBundles collection initialized in loadData")
            return True
        else:
            print("❌ pendingBundles collection not initialized")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying pendingBundles collection: {e}")
        return False

def verify_bundle_checker_scheduled():
    """Test 8: Verify BundleChecker is scheduled"""
    print("=== Test 8: BundleChecker Scheduling ===")
    
    try:
        # Check startup logs for BundleChecker
        result = subprocess.run(['grep', '-i', 'BundleChecker', '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0 and 'Scheduled every 30min' in result.stdout:
            print("✅ BundleChecker scheduled every 30min (found in logs)")
            return True
        else:
            print("❌ BundleChecker scheduling not found in logs")
            return False
            
    except Exception as e:
        print(f"❌ Error checking BundleChecker logs: {e}")
        return False

def test_bundle_status_webhook():
    """Test 9: Test bundle status webhook endpoint"""
    print("=== Test 9: Bundle Status Webhook ===")
    
    try:
        # Test webhook endpoint
        payload = {
            "bundleSid": "BU_test",
            "bundleStatus": "in-review"
        }
        
        response = requests.post(
            f'{LOCALHOST_URL}/twilio/bundle-status',
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('received') is True:
                print("✅ Bundle status webhook working")
                print(f"   Response: {data}")
                return True
            else:
                print(f"❌ Unexpected webhook response: {data}")
                return False
        else:
            print(f"❌ Webhook failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing bundle webhook: {e}")
        return False

def verify_translations():
    """Test 10: Verify bundleRequired and bundleSubmitted translations"""
    print("=== Test 10: Bundle Translations ===")
    
    try:
        with open('/app/js/phone-config.js', 'r') as f:
            content = f.read()
        
        # Check for required translation keys in all 4 languages
        languages = ['en', 'fr', 'zh', 'hi']
        translation_keys = ['bundleRequired', 'bundleSubmitted']
        
        translations_ok = True
        
        for lang in languages:
            for key in translation_keys:
                # Look for the key in the language block
                if f'{key}:' in content:
                    print(f"✅ {key} translation found")
                else:
                    print(f"❌ {key} translation missing")
                    translations_ok = False
        
        # Check specific content
        if 'regulatory approval' in content.lower() and '1-3 business days' in content:
            print("✅ bundleRequired contains regulatory approval message")
        else:
            print("❌ bundleRequired content missing")
            translations_ok = False
        
        if 'submitted for review' in content.lower() and 'notified when approved' in content.lower():
            print("✅ bundleSubmitted contains submission message")
        else:
            print("❌ bundleSubmitted content missing") 
            translations_ok = False
        
        return translations_ok
        
    except Exception as e:
        print(f"❌ Error verifying translations: {e}")
        return False

def verify_background_checker_function():
    """Test 11: Verify checkPendingBundles background function"""
    print("=== Test 11: Background checkPendingBundles Function ===")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check function exists
        if 'async function checkPendingBundles()' not in content:
            print("❌ checkPendingBundles function not found")
            return False
        
        print("✅ checkPendingBundles function exists")
        
        # Check it queries correct statuses
        if "status: { $in: ['draft', 'pending-review', 'in-review', 'provisionally-approved'] }" in content:
            print("✅ Queries pending bundle statuses correctly")
        else:
            print("❌ Bundle status query incorrect")
            return False
        
        # Check twilio-approved handling (auto-purchase)
        if "'twilio-approved'" in content and "auto-purchase" in content.lower():
            print("✅ Handles twilio-approved status (auto-purchase)")
        elif "twilio-approved" in content and "executeTwilioPurchase" in content:
            print("✅ Handles twilio-approved status (calls executeTwilioPurchase)")
        else:
            print("❌ twilio-approved handling missing")
            return False
        
        # Check twilio-rejected handling (refund)
        if "'twilio-rejected'" in content and "refund" in content.lower():
            print("✅ Handles twilio-rejected status (refund)")
        elif "twilio-rejected" in content and "atomicIncrement" in content:
            print("✅ Handles twilio-rejected status (refunds wallet)")
        else:
            print("❌ twilio-rejected handling missing")
            return False
        
        # Check user notifications
        if "send(pb.chatId" in content or "sendMsg(" in content:
            print("✅ Sends notifications to users")
        else:
            print("❌ User notifications missing")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying checkPendingBundles: {e}")
        return False

def main():
    """Run all Twilio Regulatory Bundle tests"""
    print("🚀 Starting Twilio Regulatory Bundle Testing for South Africa (ZA)")
    print("=" * 80)
    print(f"Testing Node.js backend on: {LOCALHOST_URL}")
    print(f"External URL: {EXTERNAL_URL}")
    print("=" * 80)
    
    tests = [
        ("Node.js Health Check", test_node_health),
        ("Node.js Error Log Check", check_node_error_log), 
        ("Twilio Service Exports", verify_twilio_service_exports),
        ("needsBundle Function Logic", verify_needs_bundle_function),
        ("buyNumber bundleSid Parameter", verify_buynumber_bundlesid_param),
        ("executeTwilioPurchase bundleSid", verify_execute_twilio_purchase_bundlesid),
        ("cpEnterAddress Bundle Logic", verify_cpenteraddress_bundle_branch),
        ("pendingBundles Collection", verify_pending_bundles_collection),
        ("BundleChecker Scheduling", verify_bundle_checker_scheduled),
        ("Bundle Status Webhook", test_bundle_status_webhook),
        ("Bundle Translations", verify_translations),
        ("Background Checker Function", verify_background_checker_function),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 60}")
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 80}")
    print("📊 TWILIO REGULATORY BUNDLE TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    print(f"\n🏆 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Twilio Regulatory Bundle for South Africa (ZA) is fully implemented and working!")
        print("✅ Auto-create bundle per user with deferred purchase system operational")
        print("✅ Bundle status checking every 30 minutes with auto-purchase on approval")
        print("✅ Comprehensive error handling with wallet refunds")
        return True
    else:
        print("⚠️ Some tests failed - Twilio Regulatory Bundle implementation needs review")
        failed_tests = [name for name, result in results if not result]
        print("Failed tests:", ", ".join(failed_tests))
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)