#!/usr/bin/env python3
"""
Backend testing for Nomadly domain purchase provider name leak fix and OP false-negative protection
"""

import requests
import time
import os
import re
import json
import subprocess

# Test configuration
BASE_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{BASE_URL}/health"

def log_test_result(test_name, result, details=""):
    """Log test results in consistent format"""
    status = "✅ PASS" if result else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    return result

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        if response.status_code == 200:
            data = response.json()
            healthy = data.get('status') == 'healthy'
            return log_test_result("Node.js Health Check", healthy, f"Status: {data.get('status')}, DB: {data.get('database')}")
        else:
            return log_test_result("Node.js Health Check", False, f"HTTP {response.status_code}")
    except Exception as e:
        return log_test_result("Node.js Health Check", False, str(e))

def test_nodejs_error_log():
    """Test: Node.js error log should be empty"""
    try:
        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True, check=True)
        size = int(result.stdout.split()[0])
        is_empty = size == 0
        return log_test_result("Node.js Error Log Empty", is_empty, f"Log size: {size} bytes")
    except Exception as e:
        return log_test_result("Node.js Error Log Empty", False, str(e))

def check_file_content(filepath, description=""):
    """Helper to read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        log_test_result(f"Read {filepath} {description}", False, str(e))
        return None

def test_verify_registration_function():
    """Test 2: Check _verifyRegistration function in op-service.js"""
    content = check_file_content('/app/js/op-service.js', '(_verifyRegistration function)')
    if content is None:
        return False
    
    # Check if _verifyRegistration function exists
    has_function = '_verifyRegistration' in content and 'const _verifyRegistration = async (domainName) => {' in content
    
    # Check if it's called after 5xx errors
    has_500_check = 'statusCode >= 500' in content
    has_wait_call = 'setTimeout(r, 5000)' in content and '_verifyRegistration(domainName)' in content
    
    all_checks = has_function and has_500_check and has_wait_call
    details = f"Function exists: {has_function}, 5xx check: {has_500_check}, Wait+call: {has_wait_call}"
    
    return log_test_result("_verifyRegistration function implementation", all_checks, details)

def test_no_openprovider_error_leaks():
    """Test 3: No OpenProvider in error returns"""
    try:
        result = subprocess.run(['grep', '-rn', 'return.*error.*OpenProvider', '/app/js/'], 
                              capture_output=True, text=True)
        no_leaks = result.returncode != 0  # grep returns non-zero when no matches found
        return log_test_result("No OpenProvider in error returns", no_leaks, 
                             "Found leaks" if not no_leaks else "No leaks found")
    except Exception as e:
        return log_test_result("No OpenProvider in error returns", False, str(e))

def test_no_connectreseller_error_leaks():
    """Test 3b: No ConnectReseller in error returns"""
    try:
        result = subprocess.run(['grep', '-rn', 'return.*error.*ConnectReseller', '/app/js/'], 
                              capture_output=True, text=True)
        no_leaks = result.returncode != 0  # grep returns non-zero when no matches found
        return log_test_result("No ConnectReseller in error returns", no_leaks, 
                             "Found leaks" if not no_leaks else "No leaks found")
    except Exception as e:
        return log_test_result("No ConnectReseller in error returns", False, str(e))

def test_cr_domain_register_clean_errors():
    """Test 4: cr-domain-register.js clean error messages"""
    content = check_file_content('/app/js/cr-domain-register.js', '(clean error messages)')
    if content is None:
        return False
    
    # Check that JSON.stringify is only used for logging, not in error returns
    json_stringify_matches = re.findall(r'return.*JSON\.stringify', content, re.IGNORECASE)
    clean_errors = len(json_stringify_matches) == 0
    
    return log_test_result("cr-domain-register.js clean error messages", clean_errors,
                          f"JSON.stringify in returns: {len(json_stringify_matches)}")

def test_sanitize_error_function():
    """Test 5: sanitizeErrorForUser function in domain-service.js"""
    content = check_file_content('/app/js/domain-service.js', '(sanitizeErrorForUser)')
    if content is None:
        return False
    
    # Check function exists and is exported
    has_function = 'const sanitizeErrorForUser = (errorMsg) => {' in content
    is_exported = 'sanitizeErrorForUser,' in content or 'module.exports' in content and 'sanitizeErrorForUser' in content
    
    # Check it strips provider names
    strips_op = 'OpenProvider' in content and ('replace' in content or 'replaceAll' in content)
    strips_cr = 'ConnectReseller' in content and ('replace' in content or 'replaceAll' in content)
    
    # Check no error returns contain provider names
    op_in_returns = 'return { error:' in content and 'OpenProvider' in content
    cr_in_returns = 'return { error:' in content and 'ConnectReseller' in content
    
    # Check sanitizeErrorForUser is used in registerDomain
    is_used = 'sanitizeErrorForUser(result.error)' in content
    
    all_checks = has_function and is_exported and strips_op and strips_cr and not op_in_returns and not cr_in_returns and is_used
    details = f"Function: {has_function}, Exported: {is_exported}, Strips OP: {strips_op}, Strips CR: {strips_cr}, Used: {is_used}, Clean returns: {not op_in_returns and not cr_in_returns}"
    
    return log_test_result("sanitizeErrorForUser function", all_checks, details)

def test_buy_domain_full_process_error_handling():
    """Test 6: _index.js buyDomainFullProcess error handling"""
    content = check_file_content('/app/js/_index.js', '(buyDomainFullProcess)')
    if content is None:
        return False
    
    # Check that buyResult.error goes to admin only
    admin_error_msg = 'TELEGRAM_DEV_CHAT_ID' in content and 'buyResult.error' in content
    
    # Check user gets translation only (no raw error)
    user_gets_translation = "translation('t.domainPurchasedFailed', lang, domain)" in content
    
    # Check admin message contains "error:" for debugging
    admin_has_error_label = 'error: ${buyResult.error}' in content
    
    all_checks = admin_error_msg and user_gets_translation and admin_has_error_label
    details = f"Admin gets error: {admin_error_msg}, User gets translation: {user_gets_translation}, Admin has 'error:': {admin_has_error_label}"
    
    return log_test_result("buyDomainFullProcess error handling", all_checks, details)

def test_language_files_signatures():
    """Test 7: Language files domainPurchasedFailed signatures"""
    results = []
    languages = ['en', 'fr', 'zh', 'hi']
    
    for lang in languages:
        filepath = f'/app/js/lang/{lang}.js'
        content = check_file_content(filepath, f'({lang} language file)')
        if content is None:
            results.append(False)
            continue
        
        # Check function signature takes only domain parameter
        correct_signature = f'domainPurchasedFailed: (domain) =>' in content
        # Check it doesn't contain buyDomainError parameter
        no_error_param = 'buyDomainError' not in content or '(domain, buyDomainError)' not in content
        # Check template doesn't use ${buyDomainError}
        no_error_in_template = '${buyDomainError}' not in content
        
        lang_ok = correct_signature and no_error_param and no_error_in_template
        results.append(lang_ok)
        
        details = f"Signature OK: {correct_signature}, No error param: {no_error_param}, No error in template: {no_error_in_template}"
        log_test_result(f"Language {lang}.js domainPurchasedFailed signature", lang_ok, details)
    
    return all(results)

def run_all_tests():
    """Run all verification tests"""
    print("🔍 Starting Nomadly Domain Purchase Provider Leak Fix Verification")
    print("=" * 80)
    
    test_results = []
    
    # Node.js health checks
    test_results.append(test_nodejs_health())
    test_results.append(test_nodejs_error_log())
    
    # Core functionality tests
    test_results.append(test_verify_registration_function())
    test_results.append(test_no_openprovider_error_leaks())
    test_results.append(test_no_connectreseller_error_leaks())
    test_results.append(test_cr_domain_register_clean_errors())
    test_results.append(test_sanitize_error_function())
    test_results.append(test_buy_domain_full_process_error_handling())
    test_results.append(test_language_files_signatures())
    
    # Summary
    passed = sum(test_results)
    total = len(test_results)
    
    print("\n" + "=" * 80)
    print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ ALL TESTS PASSED - Provider name leak fix is working correctly!")
        return True
    else:
        print("❌ SOME TESTS FAILED - Issues need to be addressed")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)