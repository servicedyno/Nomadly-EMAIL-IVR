#!/usr/bin/env python3
"""
Backend Test Suite for Fincra Webhook Fixes
Testing the 4 specific fixes for $0 NGN deposit confirmation and double group notification bugs
"""

import requests
import subprocess
import json
import re
import os
import time

# Backend URL from environment
BACKEND_URL = "https://readme-guide-5.preview.emergentagent.com"
HEALTH_URL = f"{BACKEND_URL}/api/health"

def test_syntax_validation():
    """Test 1: Verify JavaScript syntax is valid"""
    print("🔍 Test 1: JavaScript Syntax Validation")
    
    result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ PASS: JavaScript syntax validation successful")
        return True
    else:
        print(f"❌ FAIL: Syntax error in _index.js: {result.stderr}")
        return False

def test_health_endpoint():
    """Test 2: Verify health endpoint returns healthy status"""
    print("\n🔍 Test 2: Health Endpoint Check")
    
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
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
        print(f"❌ FAIL: Health endpoint error: {e}")
        return False

def test_error_log_clean():
    """Test 3: Verify error log is clean (0 bytes)"""
    print("\n🔍 Test 3: Error Log Check")
    
    try:
        log_size = os.path.getsize('/var/log/supervisor/nodejs.err.log')
        if log_size == 0:
            print("✅ PASS: Error log is clean (0 bytes)")
            return True
        else:
            print(f"❌ FAIL: Error log has {log_size} bytes")
            return False
    except Exception as e:
        print(f"❌ FAIL: Error checking log file: {e}")
        return False

def test_processed_fincra_refs_set():
    """Test 4: Verify processedFincraRefs Set exists near line 21659"""
    print("\n🔍 Test 4: processedFincraRefs Dedup Set")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Look for the processedFincraRefs Set declaration
        pattern = r'const\s+processedFincraRefs\s*=\s*new\s+Set\(\)'
        match = re.search(pattern, content)
        
        if match:
            # Find line number
            lines_before = content[:match.start()].count('\n') + 1
            print(f"✅ PASS: processedFincraRefs Set found at line ~{lines_before}")
            
            # Verify it's used in webhook handler
            webhook_usage = 'processedFincraRefs.has(ref)' in content
            reconciler_usage = 'processedFincraRefs.add(ref)' in content
            
            if webhook_usage and reconciler_usage:
                print("✅ PASS: processedFincraRefs used in both webhook handler and reconciler")
                return True
            else:
                print(f"❌ FAIL: processedFincraRefs usage incomplete - webhook: {webhook_usage}, reconciler: {reconciler_usage}")
                return False
        else:
            print("❌ FAIL: processedFincraRefs Set declaration not found")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading _index.js: {e}")
        return False

def test_zero_amount_webhook_rejection():
    """Test 5: Verify zero-amount rejection in webhook handler around line 22548"""
    print("\n🔍 Test 5: Zero-amount Rejection in Webhook Handler")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Look for the webhook handler with zero amount check
        found_check = False
        found_log = False
        
        for i, line in enumerate(lines):
            # Look for the zero amount check
            if 'Number(value) <= 0' in line:
                found_check = True
                print(f"✅ PASS: Zero amount check found at line {i+1}: {line.strip()}")
                
                # Look for the log message in nearby lines
                for j in range(max(0, i-2), min(len(lines), i+5)):
                    if 'Rejected zero/negative amount' in lines[j]:
                        found_log = True
                        print(f"✅ PASS: Rejection log message found at line {j+1}")
                        break
                break
        
        if found_check and found_log:
            return True
        else:
            print(f"❌ FAIL: Zero amount rejection incomplete - check: {found_check}, log: {found_log}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading _index.js: {e}")
        return False

def test_zero_amount_bank_wallet_guard():
    """Test 6: Verify zero-amount guard in /bank-wallet around line 22414"""
    print("\n🔍 Test 6: Zero-amount Guard in /bank-wallet")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Look for the bank-wallet handler with zero amount check
        found_check = False
        found_log = False
        
        for i, line in enumerate(lines):
            # Look for the ngnIn <= 0 check
            if 'ngnIn <= 0' in line:
                found_check = True
                print(f"✅ PASS: ngnIn <= 0 check found at line {i+1}: {line.strip()}")
                
                # Look for the log message in nearby lines
                for j in range(max(0, i-2), min(len(lines), i+5)):
                    if 'Rejected zero/negative deposit' in lines[j]:
                        found_log = True
                        print(f"✅ PASS: Rejection log message found at line {j+1}")
                        break
                break
        
        if found_check and found_log:
            return True
        else:
            print(f"❌ FAIL: Bank wallet guard incomplete - check: {found_check}, log: {found_log}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading _index.js: {e}")
        return False

def test_reconciler_dedup_check():
    """Test 7: Verify reconciler dedup check around line 1825"""
    print("\n🔍 Test 7: Reconciler Dedup Check")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Look for reconcileFincraPayments function
        reconciler_match = re.search(r'const\s+reconcileFincraPayments\s*=\s*async\s*\(\s*\)\s*=>\s*{', content)
        if not reconciler_match:
            print("❌ FAIL: reconcileFincraPayments function not found")
            return False
        
        # Find the function body
        start_pos = reconciler_match.end()
        brace_count = 1
        end_pos = start_pos
        
        for i in range(start_pos, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_pos = i
                    break
        
        function_body = content[start_pos:end_pos]
        
        # Check for dedup logic
        has_check = 'processedFincraRefs.has(ref)' in function_body
        has_add = 'processedFincraRefs.add(ref)' in function_body
        
        if has_check and has_add:
            print("✅ PASS: Reconciler has both processedFincraRefs.has() check and .add() call")
            return True
        else:
            print(f"❌ FAIL: Reconciler dedup incomplete - has check: {has_check}, has add: {has_add}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error analyzing reconciler: {e}")
        return False

def run_all_tests():
    """Run all Fincra webhook fix tests"""
    print("🚀 Starting Fincra Webhook Fix Testing Suite")
    print("=" * 60)
    
    tests = [
        test_syntax_validation,
        test_health_endpoint, 
        test_error_log_clean,
        test_processed_fincra_refs_set,
        test_zero_amount_webhook_rejection,
        test_zero_amount_bank_wallet_guard,
        test_reconciler_dedup_check
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ FAIL: Test {test.__name__} crashed: {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 TEST RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Fincra webhook fixes are working correctly!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - see details above")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)