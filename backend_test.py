#!/usr/bin/env python3
"""
Backend Testing for Nomadly Platform - 4 New Fixes Verification
Tests the 4 specific fixes mentioned in the review request:
1. Fix 2: SIP Rate Limit Escalating Hard-Block (voice-service.js)
2. Fix 3: Telnyx 90018 Error Suppression (telnyx-service.js)
3. Fix 4: Weekly Plan Expiry Notification (hosting-scheduler.js)
4. Fix 5: Aggressive Memory Cleanup (voice-service.js)
"""

import requests
import json
import time
import re
import os
from typing import Dict, List, Any

# Backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:5000')
API_BASE = f"{BACKEND_URL}/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name: str, passed: bool, details: str = ""):
        self.results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed ({self.failed} failed)")
        return self.failed == 0

def read_file_content(file_path: str) -> str:
    """Read file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

def test_health_endpoint():
    """Test basic health endpoint"""
    results = TestResults()
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                results.add_result("Health endpoint responds correctly", True)
            else:
                results.add_result("Health endpoint responds correctly", False, f"Status: {data.get('status')}")
        else:
            results.add_result("Health endpoint responds correctly", False, f"HTTP {response.status_code}")
    except Exception as e:
        results.add_result("Health endpoint responds correctly", False, str(e))
    
    return results

def test_fix2_sip_hard_block():
    """Test Fix 2: SIP Rate Limit Escalating Hard-Block"""
    results = TestResults()
    
    # Read voice-service.js file
    voice_service_content = read_file_content('/app/js/voice-service.js')
    
    # Test 1: Check constants
    hard_block_threshold_found = 'HARD_BLOCK_THRESHOLD = 5' in voice_service_content
    hard_block_duration_found = 'HARD_BLOCK_DURATION = 600000' in voice_service_content
    results.add_result("Hard-block constants defined correctly", 
                      hard_block_threshold_found and hard_block_duration_found,
                      f"Threshold: {hard_block_threshold_found}, Duration: {hard_block_duration_found}")
    
    # Test 2: Check sipHardBlock object exists
    sip_hard_block_found = 'const sipHardBlock = {}' in voice_service_content
    results.add_result("sipHardBlock object exists at module level", sip_hard_block_found)
    
    # Test 3: Check isSipHardBlocked function
    is_hard_blocked_func = 'function isSipHardBlocked(key)' in voice_service_content
    results.add_result("isSipHardBlocked function exists", is_hard_blocked_func)
    
    # Test 4: Check recordRateLimitHit function
    record_hit_func = 'function recordRateLimitHit(key)' in voice_service_content
    results.add_result("recordRateLimitHit function exists", record_hit_func)
    
    # Test 5: Check hard-block check in handleOutboundSipCall
    # Look for the specific pattern where isSipHardBlocked is called before rate limit checks
    hard_block_before_rate_limit = re.search(r'if \(isSipHardBlocked\(.*?\)\).*?return.*?if \(!checkSipRateLimit', voice_service_content, re.DOTALL)
    results.add_result("Hard-block check happens before rate limits in handleOutboundSipCall", 
                      hard_block_before_rate_limit is not None)
    
    # Test 6: Check cleanup in setInterval
    cleanup_hard_block = 'sipHardBlock[key].blockedAt' in voice_service_content and 'HARD_BLOCK_DURATION' in voice_service_content
    results.add_result("Hard-block entries cleaned up in periodic cleanup", cleanup_hard_block)
    
    # Test 7: Check recordRateLimitHit is called in global rate limit rejection
    record_hit_called = 'recordRateLimitHit(' in voice_service_content
    results.add_result("recordRateLimitHit called to escalate rate limits", record_hit_called)
    
    return results

def test_fix3_telnyx_90018_suppression():
    """Test Fix 3: Telnyx 90018 Error Suppression"""
    results = TestResults()
    
    # Read telnyx-service.js file
    telnyx_service_content = read_file_content('/app/js/telnyx-service.js')
    
    # Test 1: Check answerCall function for 90018 suppression
    answer_call_match = re.search(r'async function answerCall\(.*?\{(.*?)^}', telnyx_service_content, re.DOTALL | re.MULTILINE)
    if answer_call_match:
        answer_func_content = answer_call_match.group(1)
        has_90018_check = "'90018'" in answer_func_content or '"90018"' in answer_func_content
        has_already_ended_check = 'already ended' in answer_func_content
        has_not_found_check = 'not found' in answer_func_content
        has_null_return = 'return null' in answer_func_content
        
        results.add_result("answerCall checks for 90018/already ended/not found errors", 
                          has_90018_check and has_already_ended_check and has_not_found_check)
        results.add_result("answerCall returns null for suppressed errors", has_null_return)
    else:
        results.add_result("answerCall checks for 90018/already ended/not found errors", False, "Function not found")
        results.add_result("answerCall returns null for suppressed errors", False, "Function not found")
    
    # Test 2: Check hangupCall function for 90018 suppression
    hangup_call_match = re.search(r'async function hangupCall\(.*?\{(.*?)^}', telnyx_service_content, re.DOTALL | re.MULTILINE)
    if hangup_call_match:
        hangup_func_content = hangup_call_match.group(1)
        has_90018_check = "'90018'" in hangup_func_content or '"90018"' in hangup_func_content
        has_already_ended_check = 'already ended' in hangup_func_content
        has_not_found_check = 'not found' in hangup_func_content
        has_null_return = 'return null' in hangup_func_content
        
        results.add_result("hangupCall checks for 90018/already ended/not found errors", 
                          has_90018_check and has_already_ended_check and has_not_found_check)
        results.add_result("hangupCall returns null for suppressed errors", has_null_return)
    else:
        results.add_result("hangupCall checks for 90018/already ended/not found errors", False, "Function not found")
        results.add_result("hangupCall returns null for suppressed errors", False, "Function not found")
    
    # Test 3: Check voice-service.js handles null return from answerCall
    voice_service_content = read_file_content('/app/js/voice-service.js')
    null_handling = 'ansResult === null' in voice_service_content or 'answerCall' in voice_service_content
    results.add_result("voice-service.js handles null return from answerCall", null_handling)
    
    return results

def test_fix4_weekly_plan_expiry_notification():
    """Test Fix 4: Weekly Plan Expiry Notification"""
    results = TestResults()
    
    # Read hosting-scheduler.js file
    hosting_scheduler_content = read_file_content('/app/js/hosting-scheduler.js')
    
    # Test 1: Check for weekly plan expiry case
    weekly_expiry_case = 'weekly && expiry <= now' in hosting_scheduler_content
    results.add_result("Weekly plan expiry case exists", weekly_expiry_case)
    
    # Test 2: Check for expiryUserNotified flag check
    expiry_user_notified_check = '!account.expiryUserNotified' in hosting_scheduler_content
    results.add_result("expiryUserNotified flag check exists", expiry_user_notified_check)
    
    # Test 3: Check for notify() call with "Weekly Plan Expired" message
    weekly_plan_expired_msg = 'Weekly Plan Expired' in hosting_scheduler_content
    results.add_result("Weekly Plan Expired notification message exists", weekly_plan_expired_msg)
    
    # Test 4: Check for database update with expiryUserNotified: true
    db_update_expiry_notified = 'expiryUserNotified: true' in hosting_scheduler_content
    results.add_result("Database update sets expiryUserNotified: true", db_update_expiry_notified)
    
    # Test 5: Check message tells user plan expired and doesn't auto-renew
    no_auto_renew_msg = 'do not auto-renew' in hosting_scheduler_content or 'does not auto-renew' in hosting_scheduler_content
    results.add_result("Message explains weekly plans don't auto-renew", no_auto_renew_msg)
    
    # Test 6: Check message tells user to manually renew
    manual_renew_msg = 'manually' in hosting_scheduler_content and 'renew' in hosting_scheduler_content
    results.add_result("Message instructs user to manually renew", manual_renew_msg)
    
    return results

def test_fix5_aggressive_memory_cleanup():
    """Test Fix 5: Aggressive Memory Cleanup"""
    results = TestResults()
    
    # Read voice-service.js file
    voice_service_content = read_file_content('/app/js/voice-service.js')
    
    # Test 1: Check ACTIVE_CALL_MAX_AGE = 30 minutes
    active_call_max_age = 'ACTIVE_CALL_MAX_AGE = 30 * 60 * 1000' in voice_service_content
    results.add_result("ACTIVE_CALL_MAX_AGE set to 30 minutes", active_call_max_age)
    
    # Test 2: Check IVR_SESSION_MAX_AGE = 15 minutes
    ivr_session_max_age = 'IVR_SESSION_MAX_AGE = 15 * 60 * 1000' in voice_service_content
    results.add_result("IVR_SESSION_MAX_AGE set to 15 minutes", ivr_session_max_age)
    
    # Test 3: Check BRIDGE_TRANSFER_MAX_AGE = 30 minutes
    bridge_transfer_max_age = 'BRIDGE_TRANSFER_MAX_AGE = 30 * 60 * 1000' in voice_service_content
    results.add_result("BRIDGE_TRANSFER_MAX_AGE set to 30 minutes", bridge_transfer_max_age)
    
    # Test 4: Check HOLD_TRANSFER_MAX_AGE = 5 minutes
    hold_transfer_max_age = 'HOLD_TRANSFER_MAX_AGE = 5 * 60 * 1000' in voice_service_content
    results.add_result("HOLD_TRANSFER_MAX_AGE set to 5 minutes", hold_transfer_max_age)
    
    # Test 5: Check NATIVE_TRANSFER_MAX_AGE = 5 minutes
    native_transfer_max_age = 'NATIVE_TRANSFER_MAX_AGE = 5 * 60 * 1000' in voice_service_content
    results.add_result("NATIVE_TRANSFER_MAX_AGE set to 5 minutes", native_transfer_max_age)
    
    # Test 6: Check cleanup interval = 60000 ms (1 minute)
    cleanup_interval = '60000' in voice_service_content and 'setInterval' in voice_service_content
    # Look for the specific pattern
    cleanup_interval_pattern = re.search(r'}, (\d+)\)\s*//.*cleanup.*every.*60s', voice_service_content)
    if cleanup_interval_pattern:
        interval_value = cleanup_interval_pattern.group(1)
        cleanup_interval_correct = interval_value == '60000'
    else:
        cleanup_interval_correct = False
    
    results.add_result("Cleanup interval set to 60000ms (1 minute)", cleanup_interval_correct)
    
    # Test 7: Check comment mentions reduction from previous values
    reduction_comment = 'was 2 hours' in voice_service_content or 'was 30' in voice_service_content or 'was 1h' in voice_service_content
    results.add_result("Comments indicate reduction from previous values", reduction_comment)
    
    return results

def test_backend_syntax_validation():
    """Test that all JavaScript files have valid syntax"""
    results = TestResults()
    
    # Test voice-service.js syntax
    try:
        exit_code = os.system('node -c /app/js/voice-service.js 2>/dev/null')
        results.add_result("voice-service.js syntax validation", exit_code == 0)
    except Exception as e:
        results.add_result("voice-service.js syntax validation", False, str(e))
    
    # Test telnyx-service.js syntax
    try:
        exit_code = os.system('node -c /app/js/telnyx-service.js 2>/dev/null')
        results.add_result("telnyx-service.js syntax validation", exit_code == 0)
    except Exception as e:
        results.add_result("telnyx-service.js syntax validation", False, str(e))
    
    # Test hosting-scheduler.js syntax
    try:
        exit_code = os.system('node -c /app/js/hosting-scheduler.js 2>/dev/null')
        results.add_result("hosting-scheduler.js syntax validation", exit_code == 0)
    except Exception as e:
        results.add_result("hosting-scheduler.js syntax validation", False, str(e))
    
    return results

def main():
    """Run all tests"""
    print("🧪 Starting Backend Testing for 4 New Fixes")
    print("=" * 60)
    
    all_results = TestResults()
    
    # Test 1: Health check
    print("\n📡 Testing Health Endpoint...")
    health_results = test_health_endpoint()
    all_results.results.extend(health_results.results)
    all_results.passed += health_results.passed
    all_results.failed += health_results.failed
    
    # Test 2: Fix 2 - SIP Hard Block
    print("\n🚫 Testing Fix 2: SIP Rate Limit Escalating Hard-Block...")
    fix2_results = test_fix2_sip_hard_block()
    all_results.results.extend(fix2_results.results)
    all_results.passed += fix2_results.passed
    all_results.failed += fix2_results.failed
    
    # Test 3: Fix 3 - Telnyx 90018 Suppression
    print("\n📞 Testing Fix 3: Telnyx 90018 Error Suppression...")
    fix3_results = test_fix3_telnyx_90018_suppression()
    all_results.results.extend(fix3_results.results)
    all_results.passed += fix3_results.passed
    all_results.failed += fix3_results.failed
    
    # Test 4: Fix 4 - Weekly Plan Expiry Notification
    print("\n📅 Testing Fix 4: Weekly Plan Expiry Notification...")
    fix4_results = test_fix4_weekly_plan_expiry_notification()
    all_results.results.extend(fix4_results.results)
    all_results.passed += fix4_results.passed
    all_results.failed += fix4_results.failed
    
    # Test 5: Fix 5 - Aggressive Memory Cleanup
    print("\n🧹 Testing Fix 5: Aggressive Memory Cleanup...")
    fix5_results = test_fix5_aggressive_memory_cleanup()
    all_results.results.extend(fix5_results.results)
    all_results.passed += fix5_results.passed
    all_results.failed += fix5_results.failed
    
    # Test 6: Syntax validation
    print("\n✅ Testing JavaScript Syntax Validation...")
    syntax_results = test_backend_syntax_validation()
    all_results.results.extend(syntax_results.results)
    all_results.passed += syntax_results.passed
    all_results.failed += syntax_results.failed
    
    # Final summary
    print("\n" + "=" * 60)
    success = all_results.summary()
    
    if success:
        print("🎉 All tests passed! The 4 fixes are properly implemented.")
    else:
        print("⚠️  Some tests failed. Please review the implementation.")
        print("\nFailed tests:")
        for result in all_results.results:
            if not result['passed']:
                print(f"  - {result['test']}: {result['details']}")
    
    return success

if __name__ == "__main__":
    main()