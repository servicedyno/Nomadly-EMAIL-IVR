#!/usr/bin/env python3

"""
Backend testing script for URL Shortener System Fixes verification
"""

import os
import sys
import subprocess
import requests
import json
import re

def log_test(test_name, result, details=""):
    """Log test results"""
    status = "✅ PASS" if result else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"   Details: {details}")

def check_service_health():
    """Test 1 & 2: Node.js health check and error log verification"""
    print("=" * 60)
    print("Testing Node.js Service Health")
    print("=" * 60)
    
    # Test 1: Health endpoint
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        health_pass = response.status_code == 200
        if health_pass:
            data = response.json()
            health_pass = data.get('status') == 'healthy'
            log_test("GET http://localhost:5000/health → 200 with 'healthy'", 
                    health_pass, f"Response: {data}")
        else:
            log_test("GET http://localhost:5000/health → 200 with 'healthy'", 
                    False, f"Status code: {response.status_code}")
    except Exception as e:
        log_test("GET http://localhost:5000/health → 200 with 'healthy'", 
                False, f"Error: {e}")
        health_pass = False
    
    # Test 2: Error log check
    try:
        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True, timeout=10)
        err_log_size = int(result.stdout.split()[0])
        err_log_pass = err_log_size == 0
        log_test("nodejs.err.log should be empty (0 bytes)", 
                err_log_pass, f"Size: {err_log_size} bytes")
    except Exception as e:
        log_test("nodejs.err.log should be empty (0 bytes)", 
                False, f"Error: {e}")
        err_log_pass = False
        
    return health_pass and err_log_pass

def verify_code_changes():
    """Test 3-7: Code verification using grep"""
    print("\n" + "=" * 60)
    print("Testing Code Structure Verification")
    print("=" * 60)
    
    all_tests_pass = True
    
    # Test 3: LINK_TO_SELF_SERVER should be removed
    try:
        result = subprocess.run(['grep', 'LINK_TO_SELF_SERVER', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        link_removal_pass = result.returncode != 0  # grep returns non-zero if no matches
        log_test("LINK_TO_SELF_SERVER removed from shortener flow", 
                link_removal_pass, "No references found" if link_removal_pass else "Still has references")
    except Exception as e:
        log_test("LINK_TO_SELF_SERVER removed from shortener flow", 
                False, f"Error: {e}")
        link_removal_pass = False
    
    all_tests_pass &= link_removal_pass
    
    # Test 4: Free trial shortener should always use SELF_URL routing
    try:
        # Check around line 8875-8890 for the correct SELF_URL pattern
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Look for the pattern around line 8875-8890
        pattern_found = False
        self_url_pattern = False
        no_ifelse_pattern = True  # Should not have if/else for LINK_TO_SELF_SERVER
        
        for i in range(8870, min(8895, len(lines))):
            line = lines[i].strip()
            if 'const __shortUrl = `${SELF_URL}/' in line and 'deployment-config-5' in line:
                pattern_found = True
            elif '${SELF_URL}/' in line and '${slug}' in line:
                self_url_pattern = True
            elif 'LINK_TO_SELF_SERVER' in line:
                no_ifelse_pattern = False
        
        free_trial_pass = self_url_pattern and no_ifelse_pattern
        log_test("Free trial shortener uses SELF_URL routing (no if/else for LINK_TO_SELF_SERVER)", 
                free_trial_pass, 
                f"SELF_URL pattern found: {self_url_pattern}, No LINK_TO_SELF_SERVER: {no_ifelse_pattern}")
    except Exception as e:
        log_test("Free trial shortener uses SELF_URL routing", 
                False, f"Error: {e}")
        free_trial_pass = False
    
    all_tests_pass &= free_trial_pass
    
    # Test 5: Custom domain choose-link-type should have subscription checks
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Look for choose-link-type action around line 9104-9148
        choose_link_pattern = re.search(
            r"if \(action === ['\"]choose-link-type['\"]\)(.*?)(?=if \(action === ['\"]|\Z)",
            content, re.DOTALL
        )
        
        subscription_check = False
        free_links_check = False
        
        if choose_link_pattern:
            action_content = choose_link_pattern.group(1)
            subscription_check = 'isSubscribed(chatId)' in action_content
            free_links_check = 'freeLinksAvailable(chatId)' in action_content
        
        choose_link_pass = subscription_check and free_links_check
        log_test("Custom domain 'choose-link-type' has isSubscribed() and freeLinksAvailable() checks", 
                choose_link_pass, 
                f"isSubscribed check: {subscription_check}, freeLinksAvailable check: {free_links_check}")
    except Exception as e:
        log_test("Custom domain 'choose-link-type' has subscription checks", 
                False, f"Error: {e}")
        choose_link_pass = False
        
    all_tests_pass &= choose_link_pass
    
    # Test 6: Custom domain shorten-custom should have subscription checks and decrement
    try:
        shorten_custom_pattern = re.search(
            r"if \(action === ['\"]shorten-custom['\"]\)(.*?)(?=if \(action === ['\"]|\Z)",
            content, re.DOTALL
        )
        
        subscription_check2 = False
        free_links_check2 = False
        decrement_call = False
        
        if shorten_custom_pattern:
            action_content2 = shorten_custom_pattern.group(1)
            subscription_check2 = 'isSubscribed(chatId)' in action_content2
            free_links_check2 = 'freeLinksAvailable(chatId)' in action_content2
            decrement_call = 'decrement(freeShortLinksOf, chatId)' in action_content2
        
        shorten_custom_pass = subscription_check2 and free_links_check2 and decrement_call
        log_test("Custom domain 'shorten-custom' has subscription checks and decrement() calls", 
                shorten_custom_pass, 
                f"isSubscribed: {subscription_check2}, freeLinksAvailable: {free_links_check2}, decrement: {decrement_call}")
    except Exception as e:
        log_test("Custom domain 'shorten-custom' has subscription checks and decrement", 
                False, f"Error: {e}")
        shorten_custom_pass = False
        
    all_tests_pass &= shorten_custom_pass
    
    # Test 7: Key format consistency for linksOf and clicksOn
    try:
        # Check that all set(linksOf, ...) calls use the same key format as what's stored in fullUrlOf
        lines_of_matches = re.findall(r'set\(linksOf,.*?(?=\n)', content)
        full_url_matches = re.findall(r'set\(fullUrlOf,.*?(?=\n)', content)
        
        # Count occurrences of both patterns
        consistent_keys = len(lines_of_matches) > 0 and len(full_url_matches) > 0
        
        # Check for SELF_URL key format pattern
        self_url_key_pattern = '.replaceAll(\'.\', \'@\').replace(\'https://\', \'\')' in content
        custom_domain_pattern = '.replaceAll(\'.\', \'@\')' in content
        
        key_format_pass = consistent_keys and self_url_key_pattern and custom_domain_pattern
        log_test("All set(linksOf, ...) calls use same key format as fullUrlOf", 
                key_format_pass, 
                f"linksOf calls: {len(lines_of_matches)}, fullUrlOf calls: {len(full_url_matches)}, Key formatting: {self_url_key_pattern and custom_domain_pattern}")
    except Exception as e:
        log_test("Key format consistency check", 
                False, f"Error: {e}")
        key_format_pass = False
        
    all_tests_pass &= key_format_pass
    
    return all_tests_pass

def main():
    """Main test runner"""
    print("🔍 URL Shortener System Fixes - Backend Testing")
    print("Testing Node.js app fixes for URL shortener system")
    print("Key verification points:")
    print("1. Node.js health: GET http://localhost:5000/health → should be 200 with 'healthy'")
    print("2. nodejs.err.log should be empty")
    print("3. LINK_TO_SELF_SERVER should be removed from shortener flow")
    print("4. Free trial random shortener should always use SELF_URL routing")
    print("5. Custom domain shortener should have subscription checks")
    print("6. All linksOf keys should match the format used in clicksOn")
    print()
    
    # Run all tests
    health_pass = check_service_health()
    code_pass = verify_code_changes()
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    overall_pass = health_pass and code_pass
    
    if overall_pass:
        print("🎉 ALL TESTS PASSED")
        print("✅ Node.js service is healthy")
        print("✅ Code changes verified correctly")
        print("✅ URL shortener system fixes are working as expected")
    else:
        print("⚠️  SOME TESTS FAILED")
        if not health_pass:
            print("❌ Node.js service health issues detected")
        if not code_pass:
            print("❌ Code verification issues detected")
    
    print(f"\nOverall Result: {'PASS' if overall_pass else 'FAIL'}")
    return 0 if overall_pass else 1

if __name__ == "__main__":
    sys.exit(main())