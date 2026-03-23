#!/usr/bin/env python3
"""
Backend Test Suite for Credential-Clobbering Fix Verification
Tests the Nomadly Telegram bot application credential-clobbering fixes.
"""

import requests
import json
import sys
import re
import subprocess
import os

# Test configuration
BASE_URL = "http://localhost:5000"

def run_test(test_name, test_func):
    """Run a single test and report results"""
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print('='*60)
    try:
        result = test_func()
        if result:
            print(f"✅ PASSED: {test_name}")
            return True
        else:
            print(f"❌ FAILED: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR in {test_name}: {str(e)}")
        return False

def test_health_endpoint():
    """Test 1: Verify health endpoint is working"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"Health status: {data.get('status')}")
            print(f"Database: {data.get('database')}")
            print(f"Uptime: {data.get('uptime')}")
            return data.get('status') == 'healthy'
        else:
            print(f"Health endpoint returned status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Health endpoint error: {e}")
        return False

def test_setfields_function_exists():
    """Test 2: Verify setFields function exists in db.js and is exported"""
    try:
        with open('/app/js/db.js', 'r') as f:
            content = f.read()
        
        # Check if setFields function exists
        setfields_pattern = r'async function setFields\s*\([^)]+\)\s*{'
        if not re.search(setfields_pattern, content):
            print("❌ setFields function not found in db.js")
            return False
        print("✅ setFields function found in db.js")
        
        # Check if it uses $set with dot notation
        if '$set: fields' not in content:
            print("❌ setFields function doesn't use $set with fields parameter")
            return False
        print("✅ setFields function uses $set with dot notation")
        
        # Check if it's exported
        if 'setFields' not in content.split('module.exports')[1]:
            print("❌ setFields function not exported from db.js")
            return False
        print("✅ setFields function is exported from db.js")
        
        return True
    except Exception as e:
        print(f"Error checking setFields function: {e}")
        return False

def test_update_phone_number_functions_use_setfields():
    """Test 3: Verify updatePhoneNumberFeature and updatePhoneNumberField use setFields"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find updatePhoneNumberFeature function
        feature_func_match = re.search(r'async function updatePhoneNumberFeature\([^{]+\{.*?\n\}', content, re.DOTALL)
        if not feature_func_match:
            print("❌ updatePhoneNumberFeature function not found")
            return False
        
        feature_func = feature_func_match.group(0)
        if "await setFields(col, chatId, { 'val.numbers': nums })" not in feature_func:
            print("❌ updatePhoneNumberFeature doesn't use setFields with val.numbers")
            print("Function content:", feature_func[-300:])  # Show last 300 chars
            return False
        print("✅ updatePhoneNumberFeature uses setFields with val.numbers")
        
        # Find updatePhoneNumberField function
        field_func_match = re.search(r'async function updatePhoneNumberField\([^{]+\{.*?\n\}', content, re.DOTALL)
        if not field_func_match:
            print("❌ updatePhoneNumberField function not found")
            return False
        
        field_func = field_func_match.group(0)
        if "await setFields(col, chatId, { 'val.numbers': nums })" not in field_func:
            print("❌ updatePhoneNumberField doesn't use setFields with val.numbers")
            print("Function content:", field_func[-300:])  # Show last 300 chars
            return False
        print("✅ updatePhoneNumberField uses setFields with val.numbers")
        
        return True
    except Exception as e:
        print(f"Error checking update functions: {e}")
        return False

def test_purchase_paths_preserve_full_object():
    """Test 4: Verify purchase paths preserve full existing object"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find all instances of "await set(phoneNumbersOf, chatId, existing)"
        purchase_patterns = re.findall(r'await set\(phoneNumbersOf, chatId, existing\)', content)
        
        if len(purchase_patterns) < 4:
            print(f"❌ Expected 4 purchase paths using 'existing', found {len(purchase_patterns)}")
            return False
        print(f"✅ Found {len(purchase_patterns)} purchase paths using full 'existing' object")
        
        # Check that no remaining "{ numbers: existing.numbers }" patterns exist
        bad_patterns = re.findall(r'\{\s*numbers:\s*existing\.numbers\s*\}', content)
        if bad_patterns:
            print(f"❌ Found {len(bad_patterns)} instances of credential-clobbering pattern '{{ numbers: existing.numbers }}'")
            return False
        print("✅ No credential-clobbering patterns '{ numbers: existing.numbers }' found")
        
        # Verify the specific lines mentioned in the review
        lines_to_check = [5255, 18717, 19357, 19966]
        for line_num in lines_to_check:
            lines = content.split('\n')
            if line_num < len(lines):
                line = lines[line_num - 1]  # Convert to 0-based index
                if 'await set(phoneNumbersOf, chatId, existing)' in line:
                    print(f"✅ Line {line_num}: Uses full 'existing' object")
                else:
                    print(f"❌ Line {line_num}: Does not use full 'existing' object")
                    print(f"   Content: {line.strip()}")
                    return False
        
        return True
    except Exception as e:
        print(f"Error checking purchase paths: {e}")
        return False

def test_proactive_credential_recovery():
    """Test 5: Verify proactive credential recovery in voice-service.js"""
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Check for pre-flight credential check block
        if 'PRE-FLIGHT: Ensure sub-account credentials are available' not in content:
            print("❌ Pre-flight credential check comment not found")
            return False
        print("✅ Pre-flight credential check comment found")
        
        # Check for the specific credential recovery logic
        if '!num.twilioSubAccountToken' not in content:
            print("❌ twilioSubAccountToken check not found")
            return False
        print("✅ twilioSubAccountToken check found")
        
        # Check for getSubAccount call
        if '_twilioService.getSubAccount(subSid)' not in content:
            print("❌ _twilioService.getSubAccount call not found")
            return False
        print("✅ _twilioService.getSubAccount call found")
        
        # Check for atomic persistence via $set
        if '$set: { \'val.twilioSubAccountSid\': subSid, \'val.twilioSubAccountToken\': subToken }' not in content:
            print("❌ Atomic credential persistence via $set not found")
            return False
        print("✅ Atomic credential persistence via $set found")
        
        # Check for injection into num object
        if 'num.subAccountSid = subSid' not in content or 'num.subAccountAuthToken = subToken' not in content:
            print("❌ Credential injection into num object not found")
            return False
        print("✅ Credential injection into num object found")
        
        return True
    except Exception as e:
        print(f"Error checking proactive credential recovery: {e}")
        return False

def test_setfields_import():
    """Test 6: Verify setFields is imported in _index.js"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check if setFields is imported from db.js
        import_pattern = r'const\s*\{[^}]*setFields[^}]*\}\s*=\s*require\([\'"]\.\/db\.js[\'"]\)'
        if not re.search(import_pattern, content):
            print("❌ setFields not imported from db.js in _index.js")
            return False
        print("✅ setFields imported from db.js in _index.js")
        
        return True
    except Exception as e:
        print(f"Error checking setFields import: {e}")
        return False

def test_syntax_validation():
    """Test 7: Verify JavaScript syntax is valid"""
    try:
        # Test db.js syntax
        result = subprocess.run(['node', '-c', '/app/js/db.js'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print(f"❌ db.js syntax error: {result.stderr}")
            return False
        print("✅ db.js syntax is valid")
        
        # Test _index.js syntax
        result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print(f"❌ _index.js syntax error: {result.stderr}")
            return False
        print("✅ _index.js syntax is valid")
        
        # Test voice-service.js syntax
        result = subprocess.run(['node', '-c', '/app/js/voice-service.js'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print(f"❌ voice-service.js syntax error: {result.stderr}")
            return False
        print("✅ voice-service.js syntax is valid")
        
        return True
    except Exception as e:
        print(f"Error checking syntax: {e}")
        return False

def test_no_remaining_credential_clobbering_patterns():
    """Test 8: Comprehensive check for any remaining credential-clobbering patterns"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for any remaining dangerous patterns
        dangerous_patterns = [
            r'await set\([^,]+,\s*[^,]+,\s*\{\s*numbers:\s*[^}]+\.numbers\s*\}',  # { numbers: something.numbers }
            r'updateOne\([^,]+,\s*\{\s*\$set:\s*\{\s*val:\s*\{\s*numbers:',  # Direct val replacement
        ]
        
        found_issues = []
        for pattern in dangerous_patterns:
            matches = re.findall(pattern, content)
            if matches:
                found_issues.extend(matches)
        
        if found_issues:
            print(f"❌ Found {len(found_issues)} potential credential-clobbering patterns:")
            for issue in found_issues[:3]:  # Show first 3
                print(f"   - {issue}")
            return False
        
        print("✅ No credential-clobbering patterns found")
        return True
    except Exception as e:
        print(f"Error checking for credential-clobbering patterns: {e}")
        return False

def main():
    """Run all tests and report results"""
    print("🧪 CREDENTIAL-CLOBBERING FIX VERIFICATION TEST SUITE")
    print("=" * 60)
    
    tests = [
        ("Health Endpoint", test_health_endpoint),
        ("setFields Function Exists", test_setfields_function_exists),
        ("setFields Import", test_setfields_import),
        ("Update Functions Use setFields", test_update_phone_number_functions_use_setfields),
        ("Purchase Paths Preserve Full Object", test_purchase_paths_preserve_full_object),
        ("Proactive Credential Recovery", test_proactive_credential_recovery),
        ("JavaScript Syntax Validation", test_syntax_validation),
        ("No Remaining Credential-Clobbering Patterns", test_no_remaining_credential_clobbering_patterns),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
    
    print(f"\n{'='*60}")
    print(f"TEST RESULTS: {passed}/{total} PASSED")
    print('='*60)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Credential-clobbering fixes are working correctly.")
        return 0
    else:
        print(f"⚠️  {total - passed} TESTS FAILED. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())