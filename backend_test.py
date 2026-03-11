#!/usr/bin/env python3
"""
Backend test for Nomadly Telegram Bot hosting plan purchase flow fixes
Testing 7 critical bug fixes related to stale connectExternalDomain flags and domain validation
"""
import requests
import subprocess
import sys
import os
import re

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    print("=" * 60)
    print("TEST 1: NODE.JS HEALTH CHECK")
    print("=" * 60)
    
    try:
        # Test health endpoint
        response = requests.get("http://localhost:5000/health", timeout=10)
        health_data = response.json()
        
        print(f"✅ Health endpoint status: {response.status_code}")
        print(f"✅ Response: {health_data}")
        
        # Check required fields
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert health_data["status"] == "healthy", f"Expected healthy, got {health_data.get('status')}"
        assert health_data["database"] == "connected", f"Expected connected, got {health_data.get('database')}"
        
        # Check error log is empty
        result = subprocess.run(["ls", "-la", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True)
        assert result.returncode == 0, "Error log file not found"
        
        # Parse file size from ls output
        ls_output = result.stdout.strip()
        size = int(ls_output.split()[4])  # 5th column is file size
        
        print(f"✅ Error log size: {size} bytes (expected: 0)")
        assert size == 0, f"Error log should be empty, but has {size} bytes"
        
        print("✅ NODE.JS HEALTH CHECK PASSED")
        return True
        
    except Exception as e:
        print(f"❌ NODE.JS HEALTH CHECK FAILED: {e}")
        return False

def check_code_pattern(filepath, pattern, description, required=True):
    """Helper function to check if code pattern exists in file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if re.search(pattern, content, re.MULTILINE | re.DOTALL):
            print(f"✅ {description}")
            return True
        else:
            if required:
                print(f"❌ {description} - PATTERN NOT FOUND")
                print(f"   Pattern: {pattern}")
                return False
            else:
                print(f"⚠️  {description} - OPTIONAL PATTERN NOT FOUND")
                return True
    except Exception as e:
        print(f"❌ {description} - ERROR: {e}")
        return False

def test_buyplan_domain_state_reset():
    """Test 2: Verify buyPlan function resets domain state"""
    print("\n" + "=" * 60)
    print("TEST 2: BUYPLAN RESETS DOMAIN STATE")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    all_passed = True
    
    # Check for buyPlan function with correct domain state resets
    patterns_to_check = [
        (r"saveInfo\('processingPayment',\s*false\)", "processingPayment reset found"),
        (r"saveInfo\('connectExternalDomain',\s*false\)", "connectExternalDomain reset to false"),
        (r"saveInfo\('existingDomain',\s*false\)", "existingDomain reset to false"),
        (r"saveInfo\('website_name',\s*null\)", "website_name reset to null"),
        (r"saveInfo\('price',\s*null\)", "price reset to null"),
        (r"saveInfo\('continue_domain_last_state',\s*null\)", "continue_domain_last_state reset to null")
    ]
    
    for pattern, description in patterns_to_check:
        if not check_code_pattern(filepath, pattern, description):
            all_passed = False
    
    # Verify these resets happen AFTER processingPayment reset in buyPlan function
    buyplan_pattern = r"buyPlan:\s*async\s*\([^)]*\)\s*=>\s*{.*?saveInfo\('processingPayment',\s*false\).*?saveInfo\('connectExternalDomain',\s*false\).*?saveInfo\('existingDomain',\s*false\).*?saveInfo\('website_name',\s*null\).*?saveInfo\('price',\s*null\).*?saveInfo\('continue_domain_last_state',\s*null\)"
    
    if not check_code_pattern(filepath, buyplan_pattern, "All 5 saveInfo calls found AFTER processingPayment reset in buyPlan"):
        all_passed = False
    
    if all_passed:
        print("✅ BUYPLAN DOMAIN STATE RESET TEST PASSED")
    else:
        print("❌ BUYPLAN DOMAIN STATE RESET TEST FAILED")
    
    return all_passed

def test_register_new_domain_fix():
    """Test 3: Verify registerNewDomain clears connectExternalDomain"""
    print("\n" + "=" * 60)
    print("TEST 3: REGISTERNEWDOMAIN CLEARS CONNECTEXTERNALDOMAIN")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check registerNewDomain function has both saveInfo calls
    pattern = r"registerNewDomain:\s*async\s*\(\)\s*=>\s*{.*?saveInfo\('existingDomain',\s*false\).*?saveInfo\('connectExternalDomain',\s*false\)"
    
    if check_code_pattern(filepath, pattern, "registerNewDomain clears both existingDomain and connectExternalDomain"):
        print("✅ REGISTERNEWDOMAIN FIX TEST PASSED")
        return True
    else:
        print("❌ REGISTERNEWDOMAIN FIX TEST FAILED")
        return False

def test_use_my_domain_fix():
    """Test 4: Verify useMyDomain clears connectExternalDomain"""
    print("\n" + "=" * 60)
    print("TEST 4: USEMYDOMAIN CLEARS CONNECTEXTERNALDOMAIN")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check useMyDomain function sets existingDomain true and connectExternalDomain false
    pattern = r"useMyDomain:\s*async\s*\(\)\s*=>.*?saveInfo\('existingDomain',\s*true\).*?saveInfo\('connectExternalDomain',\s*false\)"
    
    if check_code_pattern(filepath, pattern, "useMyDomain sets existingDomain=true and connectExternalDomain=false"):
        print("✅ USEMYDOMAIN FIX TEST PASSED")
        return True
    else:
        print("❌ USEMYDOMAIN FIX TEST FAILED")
        return False

def test_use_existing_domain_fix():
    """Test 5: Verify useExistingDomain clears connectExternalDomain"""
    print("\n" + "=" * 60)
    print("TEST 5: USEEXISTINGDOMAIN CLEARS CONNECTEXTERNALDOMAIN")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check useExistingDomain function sets existingDomain true and connectExternalDomain false
    pattern = r"useExistingDomain:\s*async\s*\(\)\s*=>.*?saveInfo\('existingDomain',\s*true\).*?saveInfo\('connectExternalDomain',\s*false\)"
    
    if check_code_pattern(filepath, pattern, "useExistingDomain sets existingDomain=true and connectExternalDomain=false"):
        print("✅ USEEXISTINGDOMAIN FIX TEST PASSED")
        return True
    else:
        print("❌ USEEXISTINGDOMAIN FIX TEST FAILED")
        return False

def test_enter_your_email_guard():
    """Test 6: Verify enterYourEmail has website_name guard"""
    print("\n" + "=" * 60)
    print("TEST 6: ENTERYOUREMAIL WEBSITE_NAME GUARD")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check enterYourEmail function has the guard
    pattern = r"enterYourEmail:\s*async\s*\(\)\s*=>.*?if\s*\(\s*!info\.website_name\s*\).*?log\(.*?\[Hosting\].*?enterYourEmail called without website_name.*?\).*?return\s+goto\.buyPlan\(a\.premiumWeekly\)"
    
    if check_code_pattern(filepath, pattern, "enterYourEmail has website_name guard with log message and buyPlan redirect"):
        print("✅ ENTERYOUREMAIL GUARD TEST PASSED")
        return True
    else:
        print("❌ ENTERYOUREMAIL GUARD TEST FAILED")
        return False

def test_hosting_pay_guard():
    """Test 7: Verify hosting-pay handler has website_name guard"""
    print("\n" + "=" * 60)
    print("TEST 7: HOSTING-PAY WEBSITE_NAME GUARD")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check hosting-pay handler has the guard
    pattern = r"'hosting-pay':\s*async\s*\(\)\s*=>.*?if\s*\(\s*!info\.website_name\s*\).*?log\(.*?\[Hosting\].*?hosting-pay called without website_name.*?\).*?saveInfo\('processingPayment',\s*false\).*?return\s+goto\.buyPlan\(a\.premiumWeekly\)"
    
    if check_code_pattern(filepath, pattern, "hosting-pay has website_name guard with log message, processingPayment reset, and buyPlan redirect"):
        print("✅ HOSTING-PAY GUARD TEST PASSED")
        return True
    else:
        print("❌ HOSTING-PAY GUARD TEST FAILED")
        return False

def test_connect_external_domain_cancel():
    """Test 8: Verify connectExternalDomain handler checks for cancel"""
    print("\n" + "=" * 60)
    print("TEST 8: CONNECTEXTERNALDOMAIN CANCEL HANDLING")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check connectExternalDomain handler has cancel check
    pattern = r"if\s*\(\s*action\s*===\s*a\.connectExternalDomain\s*\).*?if\s*\(\s*message\s*===\s*t\.back.*?message\s*===\s*t\.cancel.*?\)"
    
    if check_code_pattern(filepath, pattern, "connectExternalDomain handler checks for t.cancel in back/cancel condition"):
        print("✅ CONNECTEXTERNALDOMAIN CANCEL TEST PASSED")
        return True
    else:
        print("❌ CONNECTEXTERNALDOMAIN CANCEL TEST FAILED")
        return False

def test_use_existing_domain_cancel():
    """Test 9: Verify useExistingDomain handler checks for cancel"""
    print("\n" + "=" * 60)
    print("TEST 9: USEEXISTINGDOMAIN CANCEL HANDLING")
    print("=" * 60)
    
    filepath = "/app/js/_index.js"
    
    # Check useExistingDomain handler has cancel check
    pattern = r"if\s*\(\s*action\s*===\s*a\.useExistingDomain\s*\).*?if\s*\(\s*message\s*===\s*t\.back.*?message\s*===\s*t\.cancel.*?\)"
    
    if check_code_pattern(filepath, pattern, "useExistingDomain handler checks for t.cancel in back condition"):
        print("✅ USEEXISTINGDOMAIN CANCEL TEST PASSED")
        return True
    else:
        print("❌ USEEXISTINGDOMAIN CANCEL TEST FAILED")
        return False

def main():
    """Run all backend tests for hosting plan purchase flow fixes"""
    print("NOMADLY TELEGRAM BOT - HOSTING PLAN PURCHASE FLOW BUG FIXES")
    print("Testing 7 critical fixes for stale connectExternalDomain flag and domain validation")
    print("File: js/_index.js")
    print("\n")
    
    tests = [
        test_nodejs_health,
        test_buyplan_domain_state_reset,
        test_register_new_domain_fix,
        test_use_my_domain_fix,
        test_use_existing_domain_fix,
        test_enter_your_email_guard,
        test_hosting_pay_guard,
        test_connect_external_domain_cancel,
        test_use_existing_domain_cancel
    ]
    
    results = []
    
    for test_func in tests:
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"❌ Test {test_func.__name__} crashed: {e}")
            results.append(False)
    
    # Summary
    print("\n" + "=" * 60)
    print("HOSTING PLAN PURCHASE FLOW BUG FIXES - TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    test_names = [
        "Node.js Health Check",
        "buyPlan Domain State Reset",
        "registerNewDomain Clear Flag",
        "useMyDomain Clear Flag", 
        "useExistingDomain Clear Flag",
        "enterYourEmail Guard",
        "hosting-pay Guard",
        "connectExternalDomain Cancel",
        "useExistingDomain Cancel"
    ]
    
    for i, (test_name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1:2d}. {test_name:.<45} {status}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL HOSTING PLAN PURCHASE FLOW BUG FIXES VERIFIED SUCCESSFULLY!")
        print("✅ All 7 bug fixes are working correctly:")
        print("   - buyPlan resets all domain state flags")  
        print("   - registerNewDomain clears connectExternalDomain")
        print("   - useMyDomain clears connectExternalDomain")
        print("   - useExistingDomain clears connectExternalDomain")
        print("   - enterYourEmail validates website_name exists")
        print("   - hosting-pay validates website_name exists")
        print("   - Cancel handling added to both domain handlers")
        return True
    else:
        print("❌ SOME HOSTING PLAN PURCHASE FLOW BUG FIXES FAILED VERIFICATION")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)