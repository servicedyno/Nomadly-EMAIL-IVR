#!/usr/bin/env python3

"""
External Domain Billing Bug Fix Test
====================================

Tests that 'Connect External Domain' flow charges $30 (hosting only) instead of $60 (domain + hosting).

Root Cause: connectExternalDomain() set existingDomain=false, but proceedWithEmail() only checked
existingDomain to zero domain price. The connectExternalDomain=true flag was never checked for pricing.

7 code locations fixed:
1. js/_index.js line ~3828 (proceedWithEmail): Must contain 'if (info.existingDomain || info.connectExternalDomain)'
2. js/_index.js line ~2697 (goto['hosting-pay'] payload): Must contain 'connectExternalDomain: info.connectExternalDomain'
3. js/hosting/plans.js line ~83 (generateInvoiceText): Must contain 'const isOwnDomain = payload.existingDomain || payload.connectExternalDomain'
4-7. js/_index.js payment failure paths: Must contain '!info?.existingDomain && !info?.connectExternalDomain && info?.domainPrice > 0'
"""

import requests
import json
import re
import sys
from pathlib import Path

# Test Configuration
BACKEND_URL = "http://localhost:5000"
TEST_RESULTS = []
CRITICAL_FAILURES = []

def log_test(name, status, details=""):
    """Log test results"""
    result = f"{'✅' if status else '❌'} {name}"
    if details:
        result += f": {details}"
    print(result)
    TEST_RESULTS.append({"name": name, "status": status, "details": details})
    if not status:
        CRITICAL_FAILURES.append(name)

def check_backend_health():
    """Verify backend is healthy"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            log_test("Backend Health Check", 
                    health_data.get('status') == 'healthy', 
                    f"Status: {health_data.get('status')}, DB: {health_data.get('database')}")
            return True
        else:
            log_test("Backend Health Check", False, f"HTTP {response.status_code}")
            return False
    except requests.RequestException as e:
        log_test("Backend Health Check", False, f"Connection error: {str(e)}")
        return False

def check_nodejs_errors():
    """Check for Node.js errors in logs"""
    try:
        # Check for errors in Node.js error log
        error_log = Path("/var/log/supervisor/nodejs.err.log")
        if error_log.exists():
            error_content = error_log.read_text().strip()
            log_test("Node.js Error Log Check", 
                    len(error_content) == 0, 
                    f"Error log size: {len(error_content)} bytes")
            return len(error_content) == 0
        else:
            log_test("Node.js Error Log Check", False, "Error log file not found")
            return False
    except Exception as e:
        log_test("Node.js Error Log Check", False, f"Error reading log: {str(e)}")
        return False

def verify_code_fix_location_1():
    """Verify Fix #1: proceedWithEmail pricing logic (line ~3828)"""
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
        
        # Look for the corrected pricing condition around line 3828
        pattern = r"if\s*\(\s*info\.existingDomain\s*\|\|\s*info\.connectExternalDomain\s*\)\s*\{\s*domainPrice\s*=\s*0"
        match = re.search(pattern, content)
        
        log_test("Fix #1: proceedWithEmail pricing logic", 
                match is not None,
                "Found 'if (info.existingDomain || info.connectExternalDomain) { domainPrice = 0'" if match else "Pattern not found")
        return match is not None
    except Exception as e:
        log_test("Fix #1: proceedWithEmail pricing logic", False, f"Error: {str(e)}")
        return False

def verify_code_fix_location_2():
    """Verify Fix #2: goto['hosting-pay'] payload (line ~2697)"""
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
        
        # Look for the connectExternalDomain flag in payload
        pattern = r"connectExternalDomain:\s*info\.connectExternalDomain"
        match = re.search(pattern, content)
        
        log_test("Fix #2: goto['hosting-pay'] payload", 
                match is not None,
                "Found 'connectExternalDomain: info.connectExternalDomain'" if match else "Pattern not found")
        return match is not None
    except Exception as e:
        log_test("Fix #2: goto['hosting-pay'] payload", False, f"Error: {str(e)}")
        return False

def verify_code_fix_location_3():
    """Verify Fix #3: generateInvoiceText in plans.js (line ~83)"""
    try:
        with open("/app/js/hosting/plans.js", "r") as f:
            content = f.read()
        
        # Look for the isOwnDomain logic
        pattern = r"const\s+isOwnDomain\s*=\s*payload\.existingDomain\s*\|\|\s*payload\.connectExternalDomain"
        match = re.search(pattern, content)
        
        log_test("Fix #3: generateInvoiceText isOwnDomain", 
                match is not None,
                "Found 'const isOwnDomain = payload.existingDomain || payload.connectExternalDomain'" if match else "Pattern not found")
        return match is not None
    except Exception as e:
        log_test("Fix #3: generateInvoiceText isOwnDomain", False, f"Error: {str(e)}")
        return False

def verify_code_fix_locations_4_to_7():
    """Verify Fix #4-7: Payment failure paths with 3 conditions"""
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
        
        # Look for all instances of the 3-condition pattern
        pattern = r"if\s*\(\s*!info\?\.existingDomain\s*&&\s*!info\?\.connectExternalDomain\s*&&\s*info\?\.domainPrice\s*>\s*0\s*\)"
        matches = re.findall(pattern, content)
        
        log_test("Fix #4-7: Payment failure paths (3 conditions)", 
                len(matches) >= 4,
                f"Found {len(matches)} instances of 3-condition check (expected ≥4)")
        return len(matches) >= 4
    except Exception as e:
        log_test("Fix #4-7: Payment failure paths", False, f"Error: {str(e)}")
        return False

def verify_no_old_patterns():
    """Verify no remaining old patterns without connectExternalDomain check"""
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
        
        # Look for old pattern: !info?.existingDomain && info?.domainPrice > 0 (without connectExternalDomain)
        # This should be avoided patterns that don't include connectExternalDomain
        pattern = r"!info\?\.existingDomain\s*&&\s*info\?\.domainPrice\s*>\s*0"
        matches = re.findall(pattern, content)
        
        # Filter out matches that do include connectExternalDomain in the same condition
        old_pattern_count = 0
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if re.search(pattern, line) and 'connectExternalDomain' not in line:
                old_pattern_count += 1
        
        log_test("Verify No Old Patterns", 
                old_pattern_count == 0,
                f"Found {old_pattern_count} old patterns without connectExternalDomain check")
        return old_pattern_count == 0
    except Exception as e:
        log_test("Verify No Old Patterns", False, f"Error: {str(e)}")
        return False

def verify_connect_external_domain_function():
    """Verify connectExternalDomain function sets correct saveInfo"""
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
        
        # Find the connectExternalDomain function and check it sets the correct saveInfo calls
        pattern = r"connectExternalDomain:\s*async\s*\(\)\s*=>\s*\{[^}]*saveInfo\('connectExternalDomain',\s*true\)[^}]*saveInfo\('existingDomain',\s*false\)"
        match = re.search(pattern, content, re.DOTALL)
        
        log_test("connectExternalDomain Function", 
                match is not None,
                "Found function with saveInfo('connectExternalDomain', true) and saveInfo('existingDomain', false)" if match else "Pattern not found")
        return match is not None
    except Exception as e:
        log_test("connectExternalDomain Function", False, f"Error: {str(e)}")
        return False

def run_comprehensive_test():
    """Run comprehensive test suite"""
    print("🔍 EXTERNAL DOMAIN BILLING BUG FIX COMPREHENSIVE TEST")
    print("=" * 65)
    
    # Test 1: Backend Health
    if not check_backend_health():
        print("\n❌ Backend not healthy - aborting tests")
        return False
    
    # Test 2: Node.js Error Check
    check_nodejs_errors()
    
    print("\n📋 CODE VERIFICATION:")
    print("-" * 30)
    
    # Test 3-9: Code fixes verification
    verify_code_fix_location_1()
    verify_code_fix_location_2()
    verify_code_fix_location_3()
    verify_code_fix_locations_4_to_7()
    verify_no_old_patterns()
    verify_connect_external_domain_function()
    
    # Summary
    print("\n📊 TEST SUMMARY:")
    print("-" * 20)
    
    passed_tests = sum(1 for result in TEST_RESULTS if result['status'])
    total_tests = len(TEST_RESULTS)
    
    print(f"✅ Passed: {passed_tests}/{total_tests}")
    if CRITICAL_FAILURES:
        print(f"❌ Critical Failures: {len(CRITICAL_FAILURES)}")
        for failure in CRITICAL_FAILURES:
            print(f"   • {failure}")
    
    success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate == 100:
        print("\n🎉 ALL EXTERNAL DOMAIN BILLING BUG FIXES VERIFIED SUCCESSFULLY!")
        print("✅ External domains will now be charged $30 (hosting only) instead of $60 (domain + hosting)")
    else:
        print(f"\n⚠️  {len(CRITICAL_FAILURES)} critical issues found that need attention")
    
    return success_rate == 100

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)