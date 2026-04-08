#!/usr/bin/env python3
"""
Backend Test Suite for Fix #3b: Telnyx transferCall race condition log noise suppression
Testing the implementation in telnyx-service.js
"""

import subprocess
import sys
import re
import requests
import json

def test_syntax_validation():
    """Test 1: Syntax validation - node -c /app/js/telnyx-service.js passes"""
    print("🔍 Test 1: Syntax validation")
    try:
        result = subprocess.run(['node', '-c', '/app/js/telnyx-service.js'], 
                              capture_output=True, text=True, cwd='/app')
        if result.returncode == 0:
            print("✅ PASS: Syntax validation successful")
            return True
        else:
            print(f"❌ FAIL: Syntax error - {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception during syntax check - {e}")
        return False

def test_fix_3b_location():
    """Test 2: Fix #3b location - transferCall() catch block has suppression check"""
    print("\n🔍 Test 2: Fix #3b location and implementation")
    try:
        with open('/app/js/telnyx-service.js', 'r') as f:
            lines = f.readlines()
        
        # Find Fix #3b comment around line 387
        fix_3b_found = False
        transfer_catch_block = []
        in_transfer_catch = False
        
        for i, line in enumerate(lines):
            if 'Fix #3b' in line:
                fix_3b_found = True
                print(f"✅ Found Fix #3b comment at line {i+1}")
            
            # Look for transferCall catch block
            if 'async function transferCall' in line:
                in_transfer_catch = False
            if in_transfer_catch or ('} catch (e) {' in line and any('transferCall' in prev_line for prev_line in lines[max(0, i-20):i])):
                in_transfer_catch = True
                transfer_catch_block.append(line.strip())
        
        if not fix_3b_found:
            print("❌ FAIL: Fix #3b comment not found")
            return False
        
        # Check for errCode '90018' check
        catch_content = ' '.join(transfer_catch_block)
        if "errCode === '90018'" not in catch_content:
            print("❌ FAIL: errCode '90018' check not found")
            return False
        
        # Check for all required string patterns
        required_patterns = ['already ended', 'not found', 'no longer active']
        for pattern in required_patterns:
            if f"errDetail.includes('{pattern}')" not in catch_content:
                print(f"❌ FAIL: Missing pattern check for '{pattern}'")
                return False
        
        print("✅ PASS: Fix #3b properly implemented with all required checks")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception reading file - {e}")
        return False

def test_returns_null_silently():
    """Test 3: Returns null silently - suppression returns null BEFORE log() line"""
    print("\n🔍 Test 3: Returns null silently before log() line")
    try:
        with open('/app/js/telnyx-service.js', 'r') as f:
            lines = f.readlines()
        
        # Find the transferCall catch block and analyze order
        fix_3b_line = -1
        suppression_return_null_line = -1
        log_line = -1
        
        for i, line in enumerate(lines):
            if 'Fix #3b' in line:
                fix_3b_line = i
            # Look for the return null that's part of the suppression (within the if block after Fix #3b)
            if fix_3b_line != -1 and i > fix_3b_line and 'return null' in line and i < fix_3b_line + 5:
                # Make sure this is the suppression return null, not the final one
                if 'if (' in lines[i-1] or 'if (' in lines[i-2]:
                    suppression_return_null_line = i
            if 'transferCall error' in line and 'log(' in line:
                log_line = i
        
        if suppression_return_null_line == -1:
            print("❌ FAIL: suppression return null not found after Fix #3b")
            return False
        
        if log_line == -1:
            print("❌ FAIL: log() call not found")
            return False
        
        if suppression_return_null_line < log_line:
            print(f"✅ PASS: suppression return null (line {suppression_return_null_line+1}) comes before log() call (line {log_line+1})")
            return True
        else:
            print(f"❌ FAIL: suppression return null (line {suppression_return_null_line+1}) does not come before log() call (line {log_line+1})")
            return False
        
    except Exception as e:
        print(f"❌ FAIL: Exception analyzing code - {e}")
        return False

def test_consistency_with_fix_3():
    """Test 4: Consistency with Fix #3 - answerCall and hangupCall patterns intact"""
    print("\n🔍 Test 4: Consistency with existing Fix #3")
    try:
        with open('/app/js/telnyx-service.js', 'r') as f:
            content = f.read()
        
        # Check answerCall Fix #3 (around line 362)
        if 'async function answerCall' not in content:
            print("❌ FAIL: answerCall function not found")
            return False
        
        # Find Fix #3 in answerCall
        answer_start = content.find('async function answerCall')
        answer_end = content.find('async function', answer_start + 1)
        if answer_end == -1:
            answer_end = len(content)
        answer_func = content[answer_start:answer_end]
        
        if 'Fix #3:' not in answer_func or "errCode === '90018'" not in answer_func:
            print("❌ FAIL: Fix #3 not found in answerCall")
            return False
        
        # Check hangupCall Fix #3 (around line 467)
        if 'async function hangupCall' not in content:
            print("❌ FAIL: hangupCall function not found")
            return False
        
        hangup_start = content.find('async function hangupCall')
        hangup_end = content.find('async function', hangup_start + 1)
        if hangup_end == -1:
            hangup_end = len(content)
        hangup_func = content[hangup_start:hangup_end]
        
        if 'Fix #3:' not in hangup_func or "errCode === '90018'" not in hangup_func:
            print("❌ FAIL: Fix #3 not found in hangupCall")
            return False
        
        print("✅ PASS: Fix #3 patterns intact in answerCall and hangupCall")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception checking Fix #3 consistency - {e}")
        return False

def test_errdetail_string_coercion():
    """Test 5: errDetail is String - transferCall coerces errDetail to String()"""
    print("\n🔍 Test 5: errDetail String coercion")
    try:
        with open('/app/js/telnyx-service.js', 'r') as f:
            content = f.read()
        
        # Find transferCall function
        transfer_start = content.find('async function transferCall')
        transfer_end = content.find('async function', transfer_start + 1)
        if transfer_end == -1:
            transfer_end = len(content)
        transfer_func = content[transfer_start:transfer_end]
        
        # Check for String() coercion in errDetail assignment
        if 'const errDetail = String(' in transfer_func:
            print("✅ PASS: errDetail properly coerced to String()")
            return True
        else:
            print("❌ FAIL: errDetail not coerced to String()")
            return False
        
    except Exception as e:
        print(f"❌ FAIL: Exception checking String coercion - {e}")
        return False

def test_health_endpoint():
    """Test 6: Health check - Health endpoint returns healthy"""
    print("\n🔍 Test 6: Health endpoint check")
    try:
        response = requests.get('https://quickstart-docs.preview.emergentagent.com/api/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print(f"✅ PASS: Health endpoint healthy - {data}")
                return True
            else:
                print(f"❌ FAIL: Health endpoint not healthy - {data}")
                return False
        else:
            print(f"❌ FAIL: Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception checking health endpoint - {e}")
        return False

def test_error_log_clean():
    """Test 7: Error log clean - /var/log/supervisor/nodejs.err.log is 0 bytes"""
    print("\n🔍 Test 7: Error log check")
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            output = result.stdout.strip()
            # Check if file size is 0 bytes (look for " 0 " in ls -la output)
            if ' 0 ' in output:
                print("✅ PASS: Error log is 0 bytes (clean)")
                return True
            else:
                print(f"❌ FAIL: Error log is not empty - {output}")
                return False
        else:
            print(f"❌ FAIL: Could not check error log - {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception checking error log - {e}")
        return False

def main():
    """Run all tests for Fix #3b verification"""
    print("🚀 Starting Fix #3b: Telnyx transferCall race condition log noise suppression tests")
    print("=" * 80)
    
    tests = [
        test_syntax_validation,
        test_fix_3b_location,
        test_returns_null_silently,
        test_consistency_with_fix_3,
        test_errdetail_string_coercion,
        test_health_endpoint,
        test_error_log_clean
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 80)
    print(f"📊 RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}% success rate)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Fix #3b is working correctly!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - Fix #3b needs attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)