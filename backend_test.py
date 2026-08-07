#!/usr/bin/env python3
"""
Backend API Testing for Call-Billing Revenue-Leak Fixes
Tests the 5 verification checks for the Nomadly Telegram-bot platform
"""

import requests
import json
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://390e6ff0-6afa-45a4-a8ca-64792be6b7f1.preview.emergentagent.com"
ADMIN_KEY = "o%2FQb8ArGahlquhCQ"  # URL-encoded

def print_test_header(test_num, description):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print(f"{'='*80}")

def print_result(passed, message):
    """Print test result with color coding"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")

def print_json_response(response):
    """Pretty print JSON response"""
    try:
        json_data = response.json()
        print(f"\nResponse JSON:")
        print(json.dumps(json_data, indent=2))
        return json_data
    except Exception:
        print(f"\nResponse Text: {response.text[:500]}")
        return None

def test_1_leak_fix_unit_test():
    """
    TEST 1: LEAK-FIX UNIT TEST (both fixes)
    POST /api/dev/call-reconciler-test with body {}
    """
    print_test_header(1, "LEAK-FIX UNIT TEST (both fixes)")
    
    url = f"{BACKEND_URL}/api/dev/call-reconciler-test"
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {{}}")
    
    try:
        response = requests.post(url, json={}, headers={"Content-Type": "application/json"}, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        json_data = print_json_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected HTTP 200, got {response.status_code}")
            return False
        
        if not json_data:
            print_result(False, "No JSON response received")
            return False
        
        # Check top-level pass field
        if json_data.get("pass") != True:
            print_result(False, f"Expected pass === true, got {json_data.get('pass')}")
            return False
        
        # Check all checks fields
        checks = json_data.get("checks", {})
        required_checks = [
            "drift_strict_would_miss",
            "drift_resolver_recovers", 
            "drift_clean_match_not_flagged",
            "billed_row_reconciled",
            "leak_row_detected",
            "dryrun_left_pending"
        ]
        
        all_checks_pass = True
        for check in required_checks:
            if checks.get(check) != True:
                print_result(False, f"Check '{check}' expected true, got {checks.get(check)}")
                all_checks_pass = False
        
        if not all_checks_pass:
            return False
        
        # Check summary fields
        summary = json_data.get("summary", {})
        if summary.get("scanned") != 2:
            print_result(False, f"Expected scanned === 2, got {summary.get('scanned')}")
            return False
        
        if summary.get("reconciledByWebhook") != 1:
            print_result(False, f"Expected reconciledByWebhook === 1, got {summary.get('reconciledByWebhook')}")
            return False
        
        leaks_and_review = summary.get("leaksFound", 0) + summary.get("needsReview", 0)
        if leaks_and_review < 1:
            print_result(False, f"Expected (leaksFound + needsReview) >= 1, got {leaks_and_review}")
            return False
        
        if summary.get("dryRun") != True:
            print_result(False, f"Expected dryRun === true, got {summary.get('dryRun')}")
            return False
        
        print_result(True, "All checks passed: pass=true, all checks.* === true, summary fields correct")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_2_admin_dry_run_report():
    """
    TEST 2: ADMIN DRY-RUN REPORT
    GET /api/admin/reconcile-call-billing?key=o%2FQb8ArGahlquhCQ&dryRun=true
    """
    print_test_header(2, "ADMIN DRY-RUN REPORT")
    
    url = f"{BACKEND_URL}/api/admin/reconcile-call-billing?key={ADMIN_KEY}&dryRun=true"
    print(f"URL: {url}")
    print(f"Method: GET")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        json_data = print_json_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected HTTP 200, got {response.status_code}")
            return False
        
        if not json_data:
            print_result(False, "No JSON response received")
            return False
        
        # Check required fields
        if json_data.get("status") != "ok":
            print_result(False, f"Expected status === 'ok', got {json_data.get('status')}")
            return False
        
        if json_data.get("dryRun") != True:
            print_result(False, f"Expected dryRun === true, got {json_data.get('dryRun')}")
            return False
        
        # Check numeric fields exist (may be 0)
        required_fields = ["scanned", "leaksFound", "leakedUsd"]
        for field in required_fields:
            if field not in json_data or not isinstance(json_data[field], (int, float)):
                print_result(False, f"Expected numeric field '{field}', got {json_data.get(field)}")
                return False
        
        # Check details is an array
        if "details" not in json_data or not isinstance(json_data["details"], list):
            print_result(False, f"Expected 'details' array, got {type(json_data.get('details'))}")
            return False
        
        print_result(True, f"All checks passed: status='ok', dryRun=true, scanned={json_data['scanned']}, leaksFound={json_data['leaksFound']}, leakedUsd={json_data['leakedUsd']}, details array present")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_3_auth_guard():
    """
    TEST 3: AUTH GUARD
    GET /api/admin/reconcile-call-billing (NO key param)
    """
    print_test_header(3, "AUTH GUARD")
    
    url = f"{BACKEND_URL}/api/admin/reconcile-call-billing"
    print(f"URL: {url}")
    print(f"Method: GET (no key parameter)")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        json_data = print_json_response(response)
        
        if response.status_code != 403:
            print_result(False, f"Expected HTTP 403, got {response.status_code}")
            return False
        
        if not json_data:
            print_result(False, "No JSON response received")
            return False
        
        if "error" not in json_data or json_data["error"] != "forbidden":
            print_result(False, f"Expected error='forbidden', got {json_data.get('error')}")
            return False
        
        print_result(True, "Auth guard working: HTTP 403 with error='forbidden'")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_4_sandbox_settle_guard():
    """
    TEST 4: SANDBOX SETTLE-GUARD
    GET /api/admin/reconcile-call-billing?key=o%2FQb8ArGahlquhCQ&dryRun=false
    """
    print_test_header(4, "SANDBOX SETTLE-GUARD (must refuse settlement on dev pod)")
    
    url = f"{BACKEND_URL}/api/admin/reconcile-call-billing?key={ADMIN_KEY}&dryRun=false"
    print(f"URL: {url}")
    print(f"Method: GET")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        json_data = print_json_response(response)
        
        if response.status_code != 400:
            print_result(False, f"Expected HTTP 400, got {response.status_code}")
            return False
        
        if not json_data:
            print_result(False, "No JSON response received")
            return False
        
        error_msg = json_data.get("error", "")
        if "settlement disabled" not in error_msg.lower() or "dev sandbox" not in error_msg.lower():
            print_result(False, f"Expected error mentioning 'settlement disabled on dev sandbox', got: {error_msg}")
            return False
        
        print_result(True, "Sandbox settle-guard working: HTTP 400 with settlement disabled message")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_5_regression_health():
    """
    TEST 5: REGRESSION / HEALTH
    GET /api/health
    """
    print_test_header(5, "REGRESSION / HEALTH CHECK")
    
    url = f"{BACKEND_URL}/api/health"
    print(f"URL: {url}")
    print(f"Method: GET")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        json_data = print_json_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected HTTP 200, got {response.status_code}")
            return False
        
        if not json_data:
            print_result(False, "No JSON response received")
            return False
        
        if json_data.get("status") != "healthy":
            print_result(False, f"Expected status='healthy', got {json_data.get('status')}")
            return False
        
        if json_data.get("database") != "connected":
            print_result(False, f"Expected database='connected', got {json_data.get('database')}")
            return False
        
        print_result(True, "Health check passed: status='healthy', database='connected'")
        return True
        
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests and report results"""
    print("\n" + "="*80)
    print("CALL-BILLING REVENUE-LEAK FIXES - VERIFICATION TESTS")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin Key: {ADMIN_KEY}")
    
    results = []
    
    # Run all tests
    results.append(("Test 1: Leak-Fix Unit Test", test_1_leak_fix_unit_test()))
    results.append(("Test 2: Admin Dry-Run Report", test_2_admin_dry_run_report()))
    results.append(("Test 3: Auth Guard", test_3_auth_guard()))
    results.append(("Test 4: Sandbox Settle-Guard", test_4_sandbox_settle_guard()))
    results.append(("Test 5: Regression/Health", test_5_regression_health()))
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({100*passed//total}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
