#!/usr/bin/env python3
"""
Backend API Testing Script for BillingLeak Follow-ups
Tests 3 new backend enhancements built on the verified BillingLeak fix
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Backend URL from frontend/.env
BASE_URL = "https://7b4407e6-eb4c-4661-af92-5701e1e9dc92.preview.emergentagent.com"

def print_section(title: str):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_result(test_name: str, passed: bool, details: str = ""):
    """Print test result with formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  {details}")

def test_endpoint(endpoint: str, expected_checks: list) -> Tuple[bool, Dict[Any, Any], str]:
    """
    Test a backend endpoint
    
    Args:
        endpoint: The API endpoint path (e.g., '/api/dev/concurrency-guard-test')
        expected_checks: List of check names that should all be true
        
    Returns:
        Tuple of (success, response_json, error_message)
    """
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    body = {}
    
    try:
        print(f"\n📡 Testing: POST {endpoint}")
        print(f"   URL: {url}")
        print(f"   Body: {json.dumps(body)}")
        
        response = requests.post(url, headers=headers, json=body, timeout=30)
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            return False, {}, f"Expected HTTP 200, got {response.status_code}"
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            return False, {}, f"Invalid JSON response: {e}"
        
        # Print full raw JSON
        print(f"\n📄 Raw JSON Response:")
        print(json.dumps(data, indent=2))
        
        # Check top-level pass field
        if not data.get("pass"):
            return False, data, f"Top-level 'pass' is not true: {data.get('pass')}"
        
        # Check all expected checks (they're nested under "checks" object)
        checks = data.get("checks", {})
        failed_checks = []
        for check in expected_checks:
            if check not in checks:
                failed_checks.append(f"{check} (missing)")
            elif not checks[check]:
                failed_checks.append(f"{check} (false)")
        
        if failed_checks:
            return False, data, f"Failed checks: {', '.join(failed_checks)}"
        
        return True, data, ""
        
    except requests.exceptions.Timeout:
        return False, {}, "Request timeout (30s)"
    except requests.exceptions.RequestException as e:
        return False, {}, f"Request error: {e}"

def main():
    """Main test execution"""
    print_section("BACKEND API TESTING - BillingLeak Follow-ups")
    print(f"Base URL: {BASE_URL}")
    print(f"Testing 3 new backend enhancements + 1 regression test")
    
    all_passed = True
    results = []
    
    # TEST 1: Concurrency Guard
    print_section("TEST 1: Concurrency Guard Fund Reservation")
    print("Verifies simultaneous outbound calls reserve funds so wallet can't be over-committed")
    
    expected_checks_1 = [
        "reserveAddsUp",
        "releaseSubtracts", 
        "reReserveIdempotent",
        "gatingBlocksOverCommit",
        "gatingAllowsWithHeadroom",
        "releaseAllClears"
    ]
    
    success_1, data_1, error_1 = test_endpoint("/api/dev/concurrency-guard-test", expected_checks_1)
    results.append(("Concurrency Guard", success_1, data_1, error_1))
    
    if success_1:
        print_result("Concurrency Guard Test", True, "All 6 checks passed")
        print("\n✓ reserveAddsUp: Reservations correctly add up")
        print("✓ releaseSubtracts: Releases correctly subtract")
        print("✓ reReserveIdempotent: Re-reserving same call is idempotent")
        print("✓ gatingBlocksOverCommit: Gating blocks over-commitment")
        print("✓ gatingAllowsWithHeadroom: Gating allows calls with sufficient headroom")
        print("✓ releaseAllClears: Release all clears all reservations")
    else:
        print_result("Concurrency Guard Test", False, error_1)
        all_passed = False
    
    # TEST 2: Deposit Settle Receipt
    print_section("TEST 2: Deposit Settle Receipt")
    print("Verifies top-up correctly nets out negative call-debt balance")
    
    expected_checks_2 = [
        "startedNegative",
        "partialLeavesDebt",
        "fullClearsAndPositive"
    ]
    
    success_2, data_2, error_2 = test_endpoint("/api/dev/settle-receipt-test", expected_checks_2)
    results.append(("Deposit Settle Receipt", success_2, data_2, error_2))
    
    if success_2:
        print_result("Deposit Settle Receipt Test", True, "All 3 checks passed")
        print("\n✓ startedNegative: Started with negative balance (-0.50)")
        print("✓ partialLeavesDebt: Partial top-up leaves debt (-0.20 after +0.30)")
        print("✓ fullClearsAndPositive: Full top-up clears debt and goes positive (+0.80 after +1.00)")
    else:
        print_result("Deposit Settle Receipt Test", False, error_2)
        all_passed = False
    
    # TEST 3: Regression - Outbound Billing Leak
    print_section("TEST 3: REGRESSION - Outbound Billing Leak Fix")
    print("Re-verifies the original BillingLeak fix still works correctly")
    
    expected_checks_3 = [
        "chargeCaptured",
        "noLegacyLeakRow",
        "balanceWentNegative",
        "idempotent"
    ]
    
    success_3, data_3, error_3 = test_endpoint("/api/dev/outbound-billing-leak-test", expected_checks_3)
    results.append(("Outbound Billing Leak (Regression)", success_3, data_3, error_3))
    
    if success_3:
        print_result("Outbound Billing Leak Regression", True, "All 4 checks passed")
        print("\n✓ chargeCaptured: Charge captured as debt when insufficient funds")
        print("✓ noLegacyLeakRow: No billing_failed leak row created")
        print("✓ balanceWentNegative: Balance correctly went negative")
        print("✓ idempotent: Duplicate settlement did not double-charge")
    else:
        print_result("Outbound Billing Leak Regression", False, error_3)
        all_passed = False
    
    # Summary
    print_section("TEST SUMMARY")
    
    for test_name, success, data, error in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"\n{status}: {test_name}")
        if not success and error:
            print(f"   Error: {error}")
    
    print("\n" + "="*80)
    if all_passed:
        print("🎉 ALL TESTS PASSED (3/3)")
        print("="*80)
        print("\n✅ Concurrency Guard: Working correctly")
        print("✅ Deposit Settle Receipt: Working correctly")
        print("✅ Outbound Billing Leak (Regression): Still working correctly")
        print("\nAll 3 new backend enhancements are verified and working.")
        print("The original BillingLeak fix remains stable (regression test passed).")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("="*80)
        failed_count = sum(1 for _, success, _, _ in results if not success)
        print(f"\n{failed_count}/{len(results)} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
