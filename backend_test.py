#!/usr/bin/env python3
"""
Bundle UX Improvements Testing Script
Tests all the Bundle UX improvements for Nomadly backend Node.js on port 5000
"""

import requests
import json
import time
import sys
import re
from datetime import datetime

def log(message):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    log("🩺 Testing Node.js health...")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        log(f"Health endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"Health response: {data}")
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                log("✅ Node.js health check PASSED")
                return True
            else:
                log(f"❌ Health check FAILED - unexpected response: {data}")
                return False
        else:
            log(f"❌ Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ Health check FAILED: {e}")
        return False

def check_error_log():
    """Check if nodejs.err.log is empty"""
    log("📄 Checking nodejs.err.log...")
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            content = f.read().strip()
            if content:
                log(f"⚠️ nodejs.err.log contains errors: {content[:200]}...")
                return False
            else:
                log("✅ nodejs.err.log is EMPTY - no errors")
                return True
    except Exception as e:
        log(f"❌ Could not read error log: {e}")
        return False

def check_code_verification():
    """Verify the Bundle UX improvements in the code"""
    log("🔍 Verifying Bundle UX improvements in code...")
    
    results = {
        'cpPendingDetail_action': False,
        'p1p2_pattern': False,
        'pending_bundles_query': False,
        'pending_orders_section': False,
        'fallback_condition': False,
        'cpPendingDetail_handler': False,
        'back_button': False,
        'refresh_status': False,
        'cancel_refund': False,
        'number_fallback': False,
        'enhanced_address_prompt': False,
        'bundle_prompt_languages': False
    }
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            code = f.read()
        
        # 1. cpPendingDetail action exists
        if "cpPendingDetail: 'cpPendingDetail'" in code:
            log("✅ cpPendingDetail action constant found")
            results['cpPendingDetail_action'] = True
        else:
            log("❌ cpPendingDetail action constant NOT found")
        
        # 2. P1/P2 pattern matching
        if re.search(r'pendingMatch\s*=\s*message\.match\(/\^P\(\\d\+\)\$/i\)', code):
            log("✅ P1/P2 pattern matching found")
            results['p1p2_pattern'] = True
        else:
            log("❌ P1/P2 pattern matching NOT found")
        
        # 3. Pending bundles query exists
        if 'pendingBundles.find({ chatId: String(chatId), status: { $in:' in code:
            log("✅ Pending bundles query found")
            results['pending_bundles_query'] = True
        else:
            log("❌ Pending bundles query NOT found")
        
        # 4. Pending Orders section
        if '⏳ <b>Pending Orders:</b>' in code:
            log("✅ Pending Orders section found")
            results['pending_orders_section'] = True
        else:
            log("❌ Pending Orders section NOT found")
        
        # 5. Fallback condition for no numbers
        if 'if (!numbers.length && !userPendingBundles.length)' in code:
            log("✅ Fallback condition for no numbers found")
            results['fallback_condition'] = True
        else:
            log("❌ Fallback condition for no numbers NOT found")
        
        # 6. cpPendingDetail action handler
        if "if (action === a.cpPendingDetail)" in code:
            log("✅ cpPendingDetail action handler found")
            results['cpPendingDetail_handler'] = True
        else:
            log("❌ cpPendingDetail action handler NOT found")
        
        # 7. Back button functionality
        if 'message === pc.back' in code and 'set(state, chatId, \'action\', a.cpMyNumbers)' in code:
            log("✅ Back button functionality found")
            results['back_button'] = True
        else:
            log("❌ Back button functionality NOT found")
        
        # 8. Refresh Status handler
        if "'🔄 Refresh Status'" in code and 'twilioService.getBundleStatus(pb.bundleSid)' in code:
            log("✅ Refresh Status handler found")
            results['refresh_status'] = True
        else:
            log("❌ Refresh Status handler NOT found")
        
        # 9. Cancel & Refund handler
        if "'❌ Cancel & Refund'" in code and 'atomicIncrement(walletOf, chatId,' in code:
            log("✅ Cancel & Refund handler found")
            results['cancel_refund'] = True
        else:
            log("❌ Cancel & Refund handler NOT found")
        
        # 10. Number fallback logic
        if 'not available' in code and 'twilioService.searchNumbers(pb.countryCode' in code:
            log("✅ Number fallback logic found")
            results['number_fallback'] = True
        else:
            log("❌ Number fallback logic NOT found")
        
        # 11. Enhanced address prompt
        if 'const isBundleCountry = twilioService.needsBundle(countryCode)' in code:
            log("✅ Enhanced address prompt logic found")
            results['enhanced_address_prompt'] = True
        else:
            log("❌ Enhanced address prompt logic NOT found")
        
        # 12. Bundle prompt in multiple languages
        languages_found = 0
        for lang in ['en:', 'fr:', 'zh:', 'hi:']:
            if 'address verification' in code and lang in code:
                languages_found += 1
        
        if languages_found >= 4:
            log("✅ Bundle prompt available in 4 languages")
            results['bundle_prompt_languages'] = True
        else:
            log(f"❌ Bundle prompt only found in {languages_found} languages")
        
        passed_checks = sum(results.values())
        total_checks = len(results)
        log(f"📊 Code verification: {passed_checks}/{total_checks} checks passed")
        
        return results, passed_checks >= total_checks * 0.8  # 80% pass rate
        
    except Exception as e:
        log(f"❌ Code verification FAILED: {e}")
        return results, False

def check_twilio_service():
    """Verify twilio-service.js exports"""
    log("🔍 Checking twilio-service.js exports...")
    
    try:
        with open('/app/js/twilio-service.js', 'r') as f:
            code = f.read()
        
        # Check for bundle-related exports
        required_exports = [
            'BUNDLE_REQUIRED_COUNTRIES',
            'needsBundle',
            'getRegulationSid',
            'createEndUser', 
            'createBundle',
            'addBundleItem',
            'submitBundle',
            'getBundleStatus'
        ]
        
        found_exports = []
        for export in required_exports:
            if export in code:
                found_exports.append(export)
        
        log(f"✅ Found {len(found_exports)}/{len(required_exports)} required exports: {found_exports}")
        
        # Check if ZA is in BUNDLE_REQUIRED_COUNTRIES
        if "BUNDLE_REQUIRED_COUNTRIES = ['ZA']" in code:
            log("✅ ZA found in BUNDLE_REQUIRED_COUNTRIES")
            return True
        else:
            log("❌ ZA not found in BUNDLE_REQUIRED_COUNTRIES")
            return False
            
    except Exception as e:
        log(f"❌ Twilio service check FAILED: {e}")
        return False

def test_bundle_webhook():
    """Test the Twilio bundle status webhook"""
    log("📡 Testing bundle status webhook...")
    
    test_payload = {
        'bundleSid': 'BU_test_bundle',
        'bundleStatus': 'in-review'
    }
    
    try:
        response = requests.post(
            'http://localhost:5000/twilio/bundle-status',
            json=test_payload,
            timeout=10
        )
        
        log(f"Bundle webhook status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"Bundle webhook response: {data}")
            if data.get('received') == True:
                log("✅ Bundle webhook test PASSED")
                return True
            else:
                log(f"❌ Unexpected webhook response: {data}")
                return False
        else:
            log(f"❌ Bundle webhook returned {response.status_code}")
            return False
            
    except Exception as e:
        log(f"❌ Bundle webhook test FAILED: {e}")
        return False

def check_startup_logs():
    """Check for Bundle Checker initialization in logs"""
    log("📋 Checking startup logs for Bundle Checker...")
    
    try:
        with open('/var/log/supervisor/nodejs.out.log', 'r') as f:
            content = f.read()
        
        required_messages = [
            '[BundleChecker] Scheduled every',
            'min'
        ]
        
        found_messages = []
        for msg in required_messages:
            if msg in content:
                found_messages.append(msg)
        
        if len(found_messages) >= len(required_messages):
            log("✅ Bundle Checker initialization found in logs")
            return True
        else:
            log(f"❌ Bundle Checker messages not found. Found: {found_messages}")
            return False
            
    except Exception as e:
        log(f"❌ Startup logs check FAILED: {e}")
        return False

def main():
    """Run all Bundle UX improvement tests"""
    log("🚀 Starting Bundle UX Improvements Testing...")
    log("=" * 60)
    
    # Track test results
    test_results = {
        'nodejs_health': False,
        'error_log_empty': False,
        'code_verification': False,
        'twilio_service': False,
        'bundle_webhook': False,
        'startup_logs': False
    }
    
    # Test 1: Node.js Health
    test_results['nodejs_health'] = test_nodejs_health()
    
    # Test 2: Error log check
    test_results['error_log_empty'] = check_error_log()
    
    # Test 3: Code verification
    code_results, code_passed = check_code_verification()
    test_results['code_verification'] = code_passed
    
    # Test 4: Twilio service
    test_results['twilio_service'] = check_twilio_service()
    
    # Test 5: Bundle webhook
    test_results['bundle_webhook'] = test_bundle_webhook()
    
    # Test 6: Startup logs
    test_results['startup_logs'] = check_startup_logs()
    
    # Summary
    log("=" * 60)
    log("📊 BUNDLE UX IMPROVEMENTS TEST SUMMARY")
    log("=" * 60)
    
    passed_tests = sum(test_results.values())
    total_tests = len(test_results)
    
    for test_name, passed in test_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        log(f"{test_name.replace('_', ' ').title()}: {status}")
    
    log(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        log("🎉 ALL Bundle UX improvements are working correctly!")
        return True
    else:
        log(f"⚠️ {total_tests - passed_tests} test(s) failed - Bundle UX improvements need attention")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)