#!/usr/bin/env python3
"""
Email Validation Free Trial Fixes - Verification Test
Tests the atomic trial claim fixes and updated messaging
"""

import subprocess
import requests
import json
import os
import re
from pathlib import Path

def test_syntax_check():
    """Test 1: Syntax check with node -c"""
    print("🔍 Test 1: Syntax Check")
    try:
        result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ PASS: node -c /app/js/_index.js - No syntax errors")
            return True
        else:
            print(f"❌ FAIL: Syntax errors found: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Syntax check exception: {e}")
        return False

def test_nodejs_clean_running():
    """Test 2: Node.js running clean - check error log and health endpoint"""
    print("\n🔍 Test 2: Node.js Clean Running")
    
    # Check error log is 0 bytes
    try:
        error_log_path = "/var/log/supervisor/nodejs.err.log"
        if os.path.exists(error_log_path):
            size = os.path.getsize(error_log_path)
            if size == 0:
                print("✅ PASS: nodejs.err.log is 0 bytes (clean)")
                log_check = True
            else:
                print(f"❌ FAIL: nodejs.err.log is {size} bytes (has errors)")
                log_check = False
        else:
            print("❌ FAIL: nodejs.err.log not found")
            log_check = False
    except Exception as e:
        print(f"❌ FAIL: Error checking log file: {e}")
        log_check = False
    
    # Check health endpoint
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print("✅ PASS: Health endpoint returns healthy with database connected")
                health_check = True
            else:
                print(f"❌ FAIL: Health endpoint unhealthy: {data}")
                health_check = False
        else:
            print(f"❌ FAIL: Health endpoint returned {response.status_code}")
            health_check = False
    except Exception as e:
        print(f"❌ FAIL: Health endpoint error: {e}")
        health_check = False
    
    return log_check and health_check

def test_atomic_trial_claim():
    """Test 3: Verify atomic trial claim pattern exists"""
    print("\n🔍 Test 3: Atomic Trial Claim Pattern")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for findOneAndUpdate pattern
        findone_pattern = r'findOneAndUpdate\s*\(\s*{\s*_id:\s*parseFloat\(chatId\),\s*\$or:\s*\[\s*{\s*evFreeTrialUsed:\s*{\s*\$ne:\s*true\s*}\s*},\s*{\s*evFreeTrialUsed:\s*{\s*\$exists:\s*false\s*}\s*}\s*\]\s*},\s*{\s*\$set:\s*{\s*evFreeTrialUsed:\s*true\s*}\s*}'
        
        if re.search(findone_pattern, content, re.MULTILINE | re.DOTALL):
            print("✅ PASS: findOneAndUpdate atomic pattern found with correct filter")
            atomic_pattern = True
        else:
            print("❌ FAIL: findOneAndUpdate atomic pattern not found or incorrect")
            atomic_pattern = False
        
        # Check for trialClaim.value check (not just trialClaim)
        value_check_pattern = r'if\s*\(\s*!\s*trialClaim\s*\|\|\s*!\s*trialClaim\.value\s*\)'
        if re.search(value_check_pattern, content):
            print("✅ PASS: trialClaim.value check found (correct findOneAndUpdate result handling)")
            value_check = True
        else:
            print("❌ FAIL: trialClaim.value check not found")
            value_check = False
        
        # Check for 🎁 Start Free Trial handler
        trial_handler = '🎁 Start Free Trial' in content
        if trial_handler:
            print("✅ PASS: '🎁 Start Free Trial' handler found")
        else:
            print("❌ FAIL: '🎁 Start Free Trial' handler not found")
        
        return atomic_pattern and value_check and trial_handler
        
    except Exception as e:
        print(f"❌ FAIL: Error reading _index.js: {e}")
        return False

def test_updated_ev_welcome():
    """Test 4: Check updated EV welcome message mentions required providers"""
    print("\n🔍 Test 4: Updated EV Welcome Message")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find evWelcome object
        evwelcome_match = re.search(r'const evWelcome = \{(.*?)\}', content, re.DOTALL)
        if not evwelcome_match:
            print("❌ FAIL: evWelcome object not found")
            return False
        
        evwelcome_content = evwelcome_match.group(1)
        
        # Check for required email providers in English version
        required_providers = ['Gmail', 'Yahoo', 'Hotmail', 'MSN', 'Outlook']
        providers_found = []
        providers_missing = []
        
        for provider in required_providers:
            if provider in evwelcome_content:
                providers_found.append(provider)
            else:
                providers_missing.append(provider)
        
        # Check for private domain mention
        private_domain_check = 'private domain' in evwelcome_content.lower() or 'company' in evwelcome_content.lower()
        
        if len(providers_found) == len(required_providers):
            print(f"✅ PASS: All required providers found: {', '.join(providers_found)}")
            providers_check = True
        else:
            print(f"❌ FAIL: Missing providers: {', '.join(providers_missing)}")
            print(f"Found providers: {', '.join(providers_found)}")
            providers_check = False
        
        if private_domain_check:
            print("✅ PASS: Private domain emails mentioned")
            domain_check = True
        else:
            print("❌ FAIL: Private domain emails not mentioned")
            domain_check = False
        
        return providers_check and domain_check
        
    except Exception as e:
        print(f"❌ FAIL: Error checking evWelcome: {e}")
        return False

def test_old_vulnerable_pattern_removed():
    """Test 5: Confirm old vulnerable pattern removed"""
    print("\n🔍 Test 5: Old Vulnerable Pattern Removed")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for old saveInfo('evFreeTrialUsed', true) pattern
        old_pattern = re.search(r'saveInfo\s*\(\s*[\'"]evFreeTrialUsed[\'"],\s*true\s*\)', content)
        
        if not old_pattern:
            print("✅ PASS: Old vulnerable saveInfo('evFreeTrialUsed', true) pattern not found")
            return True
        else:
            print("❌ FAIL: Old vulnerable saveInfo('evFreeTrialUsed', true) pattern still exists")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error checking for old pattern: {e}")
        return False

def test_ev_config_free_trial():
    """Test 6: Check EV_CONFIG.freeTrialEmails defaults to 50"""
    print("\n🔍 Test 6: EV_CONFIG.freeTrialEmails Configuration")
    
    try:
        with open('/app/js/email-validation-config.js', 'r') as f:
            content = f.read()
        
        # Check for EV_FREE_TRIAL default of 50
        pattern = re.search(r'freeTrialEmails:\s*parseInt\s*\(\s*process\.env\.EV_FREE_TRIAL\s*\|\|\s*[\'"]50[\'"],\s*10\s*\)', content)
        
        if pattern:
            print("✅ PASS: EV_CONFIG.freeTrialEmails defaults to 50")
            return True
        else:
            print("❌ FAIL: EV_CONFIG.freeTrialEmails default not found or incorrect")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error checking EV_CONFIG: {e}")
        return False

def test_regression_email_validation_flow():
    """Test 7: Regression test - email validation flow compilation"""
    print("\n🔍 Test 7: Regression - Email Validation Flow Compilation")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for required action patterns
        required_patterns = ['evMenu', 'evUploadList', 'evConfirmPay', 'evPasteEmails']
        pattern_counts = {}
        
        for pattern in required_patterns:
            count = len(re.findall(pattern, content))
            pattern_counts[pattern] = count
        
        # Verify minimum expected occurrences
        expected_minimums = {
            'evMenu': 3,      # enum, action check, set action
            'evUploadList': 3, # enum, action check, set action  
            'evConfirmPay': 3, # enum, action check, set action
            'evPasteEmails': 3 # enum, action check, set action
        }
        
        all_good = True
        for pattern, expected_min in expected_minimums.items():
            actual = pattern_counts[pattern]
            if actual >= expected_min:
                print(f"✅ PASS: {pattern} found {actual} times (>= {expected_min})")
            else:
                print(f"❌ FAIL: {pattern} found {actual} times (< {expected_min})")
                all_good = False
        
        return all_good
        
    except Exception as e:
        print(f"❌ FAIL: Error checking email validation patterns: {e}")
        return False

def main():
    """Run all tests and provide summary"""
    print("=" * 60)
    print("EMAIL VALIDATION FREE TRIAL FIXES - VERIFICATION TEST")
    print("=" * 60)
    
    tests = [
        ("Syntax Check", test_syntax_check),
        ("Node.js Clean Running", test_nodejs_clean_running), 
        ("Atomic Trial Claim", test_atomic_trial_claim),
        ("Updated EV Welcome Message", test_updated_ev_welcome),
        ("Old Vulnerable Pattern Removed", test_old_vulnerable_pattern_removed),
        ("EV_CONFIG.freeTrialEmails", test_ev_config_free_trial),
        ("Regression - Email Validation Flow", test_regression_email_validation_flow),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ FAIL: {test_name} - Exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed ({passed/total*100:.0f}% success rate)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - Email validation free trial fixes verified!")
        return True
    else:
        print(f"\n⚠️  {total-passed} test(s) failed - Issues need attention")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)