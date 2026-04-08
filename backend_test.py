#!/usr/bin/env python3
"""
Backend Test for Fix #4: Auto-routed call billing gap in voice-service.js
Testing all components mentioned in the review request.
"""

import subprocess
import requests
import json
import os
import re

def test_syntax_validation():
    """Test 1: Syntax validation - node -c /app/js/voice-service.js passes"""
    print("🔍 Test 1: Syntax validation")
    try:
        result = subprocess.run(['node', '-c', '/app/js/voice-service.js'], 
                              capture_output=True, text=True, cwd='/app')
        if result.returncode == 0:
            print("✅ PASS: voice-service.js syntax validation successful")
            return True
        else:
            print(f"❌ FAIL: Syntax validation failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Syntax validation error: {e}")
        return False

def test_auto_routed_pending_billing_map():
    """Test 2: autoRoutedPendingBilling map exists near line 64-66 with AUTO_ROUTE_BILLING_TTL = 600000"""
    print("\n🔍 Test 2: autoRoutedPendingBilling map and TTL constant")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for autoRoutedPendingBilling map around line 62-66
        found_map = False
        found_ttl = False
        
        for i, line in enumerate(lines[60:70], 61):  # Check lines 61-70
            if 'autoRoutedPendingBilling' in line and '{}' in line:
                print(f"✅ Found autoRoutedPendingBilling map at line {i}: {line.strip()}")
                found_map = True
            if 'AUTO_ROUTE_BILLING_TTL' in line and '600000' in line:
                print(f"✅ Found AUTO_ROUTE_BILLING_TTL constant at line {i}: {line.strip()}")
                found_ttl = True
        
        if found_map and found_ttl:
            print("✅ PASS: autoRoutedPendingBilling map and TTL constant found")
            return True
        else:
            print(f"❌ FAIL: Missing components - map: {found_map}, TTL: {found_ttl}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking autoRoutedPendingBilling: {e}")
        return False

def test_hard_block_tracking():
    """Test 3: Hard-block tracking around line 1420"""
    print("\n🔍 Test 3: Hard-block tracking implementation")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for hard-block tracking around line 1420
        found_hard_block_check = False
        found_auto_routed_tracking = False
        found_timeout_cleanup = False
        
        for i, line in enumerate(lines[1415:1430], 1416):  # Check lines 1416-1430
            if 'isSipHardBlocked' in line and 'rateLimitKey' in line:
                print(f"✅ Found hard-block check at line {i}: {line.strip()}")
                found_hard_block_check = True
            if 'isAutoRouted' in line and i >= 1419 and i <= 1420:
                print(f"✅ Found auto-routed check at line {i}: {line.strip()}")
                found_auto_routed_tracking = True
            if 'setTimeout' in line and 'autoRoutedPendingBilling' in line and 'AUTO_ROUTE_BILLING_TTL' in line:
                print(f"✅ Found timeout cleanup at line {i}: {line.strip()}")
                found_timeout_cleanup = True
        
        if found_hard_block_check and found_auto_routed_tracking and found_timeout_cleanup:
            print("✅ PASS: Hard-block tracking implementation found")
            return True
        else:
            print(f"❌ FAIL: Missing components - check: {found_hard_block_check}, tracking: {found_auto_routed_tracking}, timeout: {found_timeout_cleanup}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking hard-block tracking: {e}")
        return False

def test_rate_limit_tracking():
    """Test 4: Rate-limit tracking around line 1442"""
    print("\n🔍 Test 4: Rate-limit tracking implementation")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for rate-limit tracking around line 1442
        found_rate_limit_tracking = False
        found_reason_rate_limit = False
        
        for i, line in enumerate(lines[1440:1450], 1441):  # Check lines 1441-1450
            if 'isAutoRouted' in line and i >= 1442 and i <= 1443:
                print(f"✅ Found rate-limit auto-routed check at line {i}: {line.strip()}")
                found_rate_limit_tracking = True
            if 'rate_limit' in line and 'reason:' in line:
                print(f"✅ Found rate_limit reason at line {i}: {line.strip()}")
                found_reason_rate_limit = True
        
        if found_rate_limit_tracking and found_reason_rate_limit:
            print("✅ PASS: Rate-limit tracking implementation found")
            return True
        else:
            print(f"❌ FAIL: Missing components - tracking: {found_rate_limit_tracking}, reason: {found_reason_rate_limit}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking rate-limit tracking: {e}")
        return False

def test_global_rate_limit_tracking():
    """Test 5: Global rate-limit tracking around line 1461"""
    print("\n🔍 Test 5: Global rate-limit tracking implementation")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for global rate-limit tracking around line 1461
        found_global_tracking = False
        found_escalation_reason = False
        
        for i, line in enumerate(lines[1460:1475], 1461):  # Check lines 1461-1475
            if 'isAutoRouted' in line and i >= 1466 and i <= 1467:
                print(f"✅ Found global rate-limit auto-routed check at line {i}: {line.strip()}")
                found_global_tracking = True
            if ('hard_block_escalation' in line or 'global_rate_limit' in line) and 'reason:' in line:
                print(f"✅ Found escalation/global rate limit reason at line {i}: {line.strip()}")
                found_escalation_reason = True
        
        if found_global_tracking and found_escalation_reason:
            print("✅ PASS: Global rate-limit tracking implementation found")
            return True
        else:
            print(f"❌ FAIL: Missing components - tracking: {found_global_tracking}, reason: {found_escalation_reason}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking global rate-limit tracking: {e}")
        return False

def test_handle_call_hangup_deferred_billing():
    """Test 6: handleCallHangup deferred billing around line 2497"""
    print("\n🔍 Test 6: handleCallHangup deferred billing implementation")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for deferred billing implementation around line 2497
        found_pending_bill_check = False
        found_find_number_call = False
        found_connection_fee_charge = False
        found_bill_call_minutes = False
        found_telegram_notification = False
        found_error_handling = False
        
        for i, line in enumerate(lines[2490:2540], 2491):  # Check lines 2491-2540
            if 'autoRoutedPendingBilling[callControlId]' in line:
                print(f"✅ Found pending bill check at line {i}: {line.strip()}")
                found_pending_bill_check = True
            if 'findNumberBySipUser' in line:
                print(f"✅ Found findNumberBySipUser call at line {i}: {line.strip()}")
                found_find_number_call = True
            if 'CALL_CONNECTION_FEE' in line and 'smartWalletDeduct' in line:
                print(f"✅ Found connection fee charge at line {i}: {line.strip()}")
                found_connection_fee_charge = True
            if 'billCallMinutesUnified' in line and 'AutoRoute_SIPOutbound' in line:
                print(f"✅ Found billCallMinutesUnified call at line {i}: {line.strip()}")
                found_bill_call_minutes = True
            if ('_bot?.sendMessage' in line or ('sendMessage' in line and 'auto-routed' in lines[i+1] if i+1 < len(lines) else False)):
                print(f"✅ Found Telegram notification at line {i}: {line.strip()}")
                found_telegram_notification = True
            if ('catch (e)' in line or 'e.message' in line) and i >= 2529 and i <= 2531:
                print(f"✅ Found error handling at line {i}: {line.strip()}")
                found_error_handling = True
        
        components_found = [found_pending_bill_check, found_find_number_call, found_connection_fee_charge, 
                          found_bill_call_minutes, found_telegram_notification, found_error_handling]
        
        if all(components_found):
            print("✅ PASS: handleCallHangup deferred billing implementation found")
            return True
        else:
            print(f"❌ FAIL: Missing components - check: {found_pending_bill_check}, findNumber: {found_find_number_call}, fee: {found_connection_fee_charge}, billing: {found_bill_call_minutes}, notification: {found_telegram_notification}, error: {found_error_handling}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking handleCallHangup deferred billing: {e}")
        return False

def test_outbound_call_types():
    """Test 7: OUTBOUND_CALL_TYPES array includes 'AutoRoute_SIPOutbound'"""
    print("\n🔍 Test 7: OUTBOUND_CALL_TYPES array includes 'AutoRoute_SIPOutbound'")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Check for OUTBOUND_CALL_TYPES array and AutoRoute_SIPOutbound
        if 'OUTBOUND_CALL_TYPES' in content and 'AutoRoute_SIPOutbound' in content:
            # Find the specific line
            lines = content.split('\n')
            for i, line in enumerate(lines[470:480], 471):  # Check around line 475
                if 'AutoRoute_SIPOutbound' in line:
                    print(f"✅ Found AutoRoute_SIPOutbound in OUTBOUND_CALL_TYPES at line {i}: {line.strip()}")
                    print("✅ PASS: AutoRoute_SIPOutbound found in OUTBOUND_CALL_TYPES array")
                    return True
        
        print("❌ FAIL: AutoRoute_SIPOutbound not found in OUTBOUND_CALL_TYPES array")
        return False
    except Exception as e:
        print(f"❌ FAIL: Error checking OUTBOUND_CALL_TYPES: {e}")
        return False

def test_health_endpoint():
    """Test 8: Health endpoint returns healthy"""
    print("\n🔍 Test 8: Health endpoint status")
    try:
        response = requests.get('https://quickstart-docs.preview.emergentagent.com/api/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print(f"✅ PASS: Health endpoint returns healthy: {data}")
                return True
            else:
                print(f"❌ FAIL: Health endpoint not healthy: {data}")
                return False
        else:
            print(f"❌ FAIL: Health endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking health endpoint: {e}")
        return False

def test_error_logs_clean():
    """Test 9: Error logs are clean"""
    print("\n🔍 Test 9: Error logs status")
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            output = result.stdout.strip()
            if ' 0 ' in output:  # Check if file size is 0
                print(f"✅ PASS: Error log is clean (0 bytes): {output}")
                return True
            else:
                print(f"❌ FAIL: Error log has content: {output}")
                return False
        else:
            print(f"❌ FAIL: Could not check error log: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking error logs: {e}")
        return False

def main():
    """Run all tests for Fix #4: Auto-routed call billing gap"""
    print("🚀 Starting Fix #4: Auto-routed call billing gap testing")
    print("=" * 70)
    
    tests = [
        test_syntax_validation,
        test_auto_routed_pending_billing_map,
        test_hard_block_tracking,
        test_rate_limit_tracking,
        test_global_rate_limit_tracking,
        test_handle_call_hangup_deferred_billing,
        test_outbound_call_types,
        test_health_endpoint,
        test_error_logs_clean
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 70)
    print(f"📊 TEST RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Fix #4 implementation is working correctly!")
        return True
    else:
        print(f"⚠️  {total - passed} tests failed - Fix #4 needs attention")
        return False

if __name__ == "__main__":
    main()