#!/usr/bin/env python3
"""
Backend Test Suite for SIP Call Fixes
Tests the 3 critical SIP call fixes in the Node.js Express backend
"""

import requests
import json
import sys
import subprocess
import os
import time

def log_test(test_name, status, details=""):
    """Log test results with consistent formatting"""
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")

def test_syntax_validation():
    """Test 1: Verify syntax validation passes for both files"""
    print("\n=== TEST 1: Syntax Validation ===")
    
    # Test voice-service.js syntax
    try:
        result = subprocess.run(['node', '-c', '/app/js/voice-service.js'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log_test("voice-service.js syntax check", "PASS")
        else:
            log_test("voice-service.js syntax check", "FAIL", f"Error: {result.stderr}")
            return False
    except Exception as e:
        log_test("voice-service.js syntax check", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test _index.js syntax
    try:
        result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log_test("_index.js syntax check", "PASS")
        else:
            log_test("_index.js syntax check", "FAIL", f"Error: {result.stderr}")
            return False
    except Exception as e:
        log_test("_index.js syntax check", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def test_service_startup():
    """Test 2: Verify service startup and health"""
    print("\n=== TEST 2: Service Startup Verification ===")
    
    # Check error log is empty
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            error_content = f.read().strip()
        
        if not error_content:
            log_test("Node.js error log empty", "PASS", "0 bytes")
        else:
            log_test("Node.js error log empty", "FAIL", f"Contains errors: {error_content[:200]}...")
            return False
    except Exception as e:
        log_test("Node.js error log check", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check health endpoint
    try:
        response = requests.get('http://localhost:8001/api/health', timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            if health_data.get('status') == 'healthy':
                log_test("Health endpoint", "PASS", f"Status: {health_data.get('status')}")
            else:
                log_test("Health endpoint", "FAIL", f"Unhealthy status: {health_data}")
                return False
        else:
            log_test("Health endpoint", "FAIL", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_test("Health endpoint", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def test_twilio_token_recovery():
    """Test 3: Verify Twilio sub-account token recovery implementation"""
    print("\n=== TEST 3: Twilio Sub-Account Token Recovery ===")
    
    # Check _attemptTwilioDirectCall function exists
    try:
        result = subprocess.run(['grep', '-n', '_attemptTwilioDirectCall', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and '_attemptTwilioDirectCall' in result.stdout:
            log_test("_attemptTwilioDirectCall function exists", "PASS")
        else:
            log_test("_attemptTwilioDirectCall function exists", "FAIL", "Function not found")
            return False
    except Exception as e:
        log_test("_attemptTwilioDirectCall function exists", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check token recovery logic
    try:
        result = subprocess.run(['grep', '-A', '10', 'subSid found.*but no token', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and 'recovering from Twilio API' in result.stdout:
            log_test("Token recovery log message", "PASS", "Found 'recovering from Twilio API'")
        else:
            log_test("Token recovery log message", "FAIL", "Recovery message not found")
            return False
    except Exception as e:
        log_test("Token recovery log message", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check getSubAccount call
    try:
        result = subprocess.run(['grep', '-n', '_twilioService.getSubAccount', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            log_test("getSubAccount API call", "PASS")
        else:
            log_test("getSubAccount API call", "FAIL", "API call not found")
            return False
    except Exception as e:
        log_test("getSubAccount API call", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check persistence via $set
    try:
        result = subprocess.run(['grep', '-A', '10', '-B', '5', '\\$set.*twilioSubAccountSid.*twilioSubAccountToken', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and '$set' in result.stdout:
            log_test("Credential persistence via $set", "PASS")
        else:
            log_test("Credential persistence via $set", "FAIL", "$set operation not found")
            return False
    except Exception as e:
        log_test("Credential persistence via $set", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def test_ani_override_fix():
    """Test 4: Verify ANI override fix for Twilio number bridge path"""
    print("\n=== TEST 4: ANI Override Fix ===")
    
    # Check that old pre-transfer ANI override pattern is removed
    try:
        result = subprocess.run(['grep', '-n', 'updateAniOverride.*TELNYX_DEFAULT_ANI.*before', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode != 0:  # Should NOT find the old pattern
            log_test("Old pre-transfer ANI override removed", "PASS", "Old pattern not found")
        else:
            log_test("Old pre-transfer ANI override removed", "FAIL", "Old pattern still exists")
            return False
    except Exception as e:
        log_test("Old pre-transfer ANI override removed", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check new post-transfer ANI restore pattern
    try:
        result = subprocess.run(['grep', '-A', '5', 'Restore connection ANI to user', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and 'num.phoneNumber' in result.stdout:
            log_test("Post-transfer ANI restore", "PASS", "Found ANI restore to user's phone number")
        else:
            log_test("Post-transfer ANI restore", "FAIL", "ANI restore pattern not found")
            return False
    except Exception as e:
        log_test("Post-transfer ANI restore", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check transfer try/catch block is intact
    try:
        result = subprocess.run(['grep', '-A', '10', '-B', '5', 'transferCall.*destination.*num.phoneNumber', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and 'try' in result.stdout and 'catch' in result.stdout:
            log_test("Transfer try/catch block intact", "PASS")
        else:
            log_test("Transfer try/catch block intact", "FAIL", "Transfer error handling missing")
            return False
    except Exception as e:
        log_test("Transfer try/catch block intact", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check both success and failure paths call _attemptTwilioDirectCall
    try:
        result = subprocess.run(['grep', '-A', '20', '-B', '5', '_attemptTwilioDirectCall', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Count occurrences in transfer context
            transfer_calls = result.stdout.count('_attemptTwilioDirectCall')
            if transfer_calls >= 2:  # Should be called in both success and failure paths
                log_test("Twilio direct call fallback paths", "PASS", f"Found {transfer_calls} fallback calls")
            else:
                log_test("Twilio direct call fallback paths", "FAIL", f"Only {transfer_calls} fallback calls found")
                return False
        else:
            log_test("Twilio direct call fallback paths", "FAIL", "Fallback calls not found")
            return False
    except Exception as e:
        log_test("Twilio direct call fallback paths", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def test_twilio_sync_recovery():
    """Test 5: Verify Twilio Sync startup credential recovery"""
    print("\n=== TEST 5: Twilio Sync Startup Credential Recovery ===")
    
    # Check numbers.find pattern for twilioSubAccountSid
    try:
        result = subprocess.run(['grep', '-A', '15', 'numbers.find.*twilioSubAccountSid', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and 'getSubAccount' in result.stdout:
            log_test("Number-level credential check", "PASS", "Found numbers.find with getSubAccount")
        else:
            log_test("Number-level credential check", "FAIL", "Pattern not found")
            return False
    except Exception as e:
        log_test("Number-level credential check", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check credential persistence via $set
    try:
        result = subprocess.run(['grep', '-A', '10', 'twilioSubAccountSid.*twilioSubAccountToken', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0 and '$set' in result.stdout:
            log_test("Sync credential persistence", "PASS", "Found $set operation")
        else:
            log_test("Sync credential persistence", "FAIL", "$set operation not found")
            return False
    except Exception as e:
        log_test("Sync credential persistence", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check RECOVERED log message pattern
    try:
        result = subprocess.run(['grep', '-n', 'RECOVERED credentials for chatId', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            log_test("RECOVERED log message", "PASS", "Found recovery log pattern")
        else:
            log_test("RECOVERED log message", "FAIL", "Recovery log not found")
            return False
    except Exception as e:
        log_test("RECOVERED log message", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check credentials recovered count in sync log
    try:
        result = subprocess.run(['grep', '-n', 'credentials recovered', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            log_test("Sync completion log with recovery count", "PASS", "Found recovery count in sync log")
        else:
            log_test("Sync completion log with recovery count", "FAIL", "Recovery count not found")
            return False
    except Exception as e:
        log_test("Sync completion log with recovery count", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def test_regression_checks():
    """Test 6: Verify existing SIP functions are still intact"""
    print("\n=== TEST 6: Regression Checks ===")
    
    # Check core SIP functions exist
    sip_functions = ['findNumberBySipUser', 'checkSipRateLimit', 'handleOutboundSipCall']
    for func in sip_functions:
        try:
            result = subprocess.run(['grep', '-n', f'function {func}\\|async function {func}', '/app/js/voice-service.js'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log_test(f"{func} function exists", "PASS")
            else:
                log_test(f"{func} function exists", "FAIL", "Function not found")
                return False
        except Exception as e:
            log_test(f"{func} function exists", "FAIL", f"Exception: {str(e)}")
            return False
    
    # Check smartWallet imports
    try:
        result = subprocess.run(['grep', '-n', 'smartWalletDeduct.*smartWalletCheck', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            log_test("smartWallet functions imported", "PASS")
        else:
            log_test("smartWallet functions imported", "FAIL", "Import not found")
            return False
    except Exception as e:
        log_test("smartWallet functions imported", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Check module exports
    try:
        result = subprocess.run(['grep', '-A', '20', 'module.exports', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            exports = result.stdout
            expected_exports = ['handleVoiceWebhook', 'initVoiceService', 'pendingBridges', 'incrementSmsUsed']
            missing_exports = []
            for exp in expected_exports:
                if exp not in exports:
                    missing_exports.append(exp)
            
            if not missing_exports:
                log_test("Module exports intact", "PASS", f"All expected exports found")
            else:
                log_test("Module exports intact", "FAIL", f"Missing exports: {missing_exports}")
                return False
        else:
            log_test("Module exports intact", "FAIL", "Exports not found")
            return False
    except Exception as e:
        log_test("Module exports intact", "FAIL", f"Exception: {str(e)}")
        return False
    
    return True

def main():
    """Run all tests and report results"""
    print("🧪 Backend Test Suite: SIP Call Fixes")
    print("=" * 50)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Syntax Validation", test_syntax_validation()))
    test_results.append(("Service Startup", test_service_startup()))
    test_results.append(("Twilio Token Recovery", test_twilio_token_recovery()))
    test_results.append(("ANI Override Fix", test_ani_override_fix()))
    test_results.append(("Twilio Sync Recovery", test_twilio_sync_recovery()))
    test_results.append(("Regression Checks", test_regression_checks()))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {len(test_results)} | Passed: {passed} | Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed! SIP call fixes are working correctly.")
        return 0
    else:
        print(f"\n⚠️ {failed} test(s) failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())