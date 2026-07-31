#!/usr/bin/env python3
"""
Backend test for Outbound-call [BillingLeak] fix
Tests the /api/dev/outbound-billing-leak-test endpoint
"""

import requests
import json
import sys

# Read backend URL from frontend/.env
BACKEND_URL = "https://7b4407e6-eb4c-4661-af92-5701e1e9dc92.preview.emergentagent.com"

def test_primary_billing_leak():
    """
    PRIMARY TEST: Insufficient funds scenario
    - Start with $0.10 balance
    - 2-minute call costs $0.30
    - Should force-settle as debt (balance goes negative)
    - Should be idempotent (no double-charge)
    """
    print("\n" + "="*80)
    print("PRIMARY TEST: Outbound-call billing leak fix (insufficient funds)")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/outbound-billing-leak-test"
    headers = {"Content-Type": "application/json"}
    body = {}
    
    print(f"\nPOST {url}")
    print(f"Body: {json.dumps(body)}")
    
    try:
        response = requests.post(url, json=body, headers=headers, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"\nFull Response JSON:")
        print(json.dumps(data, indent=2))
        
        # Check top-level pass
        if not data.get("pass"):
            print(f"\n❌ FAILED: Top-level 'pass' is not true")
            return False
        
        # Check all 4 required checks
        checks = data.get("checks", {})
        required_checks = {
            "chargeCaptured": "A walletLedger row of type 'outbound_call' with settledAsDebt:true was written",
            "noLegacyLeakRow": "NO walletLedger row of type 'billing_failed' (old $0 revenue-leak row is gone)",
            "balanceWentNegative": "Balance went negative (0.10 - 0.30 = -0.20)",
            "idempotent": "Duplicate settlement with same callRef did NOT double-charge"
        }
        
        all_passed = True
        print("\n" + "-"*80)
        print("CHECKING REQUIRED ASSERTIONS:")
        print("-"*80)
        
        for check_name, description in required_checks.items():
            check_value = checks.get(check_name)
            status = "✅ PASS" if check_value is True else "❌ FAIL"
            print(f"{status}: {check_name} = {check_value}")
            print(f"     ({description})")
            if check_value is not True:
                all_passed = False
        
        # Print additional details
        print("\n" + "-"*80)
        print("ADDITIONAL DETAILS:")
        print("-"*80)
        print(f"Start Balance: ${data.get('startBalance', 'N/A')}")
        print(f"Expected Charge: ${data.get('expectedCharge', 'N/A')}")
        print(f"Balance After First: ${data.get('balanceAfterFirst', 'N/A')}")
        print(f"Balance After Second: ${data.get('balanceAfterSecond', 'N/A')}")
        print(f"Debit Rows Count: {data.get('debitRowsCount', 'N/A')}")
        
        if all_passed:
            print("\n" + "="*80)
            print("✅ PRIMARY TEST PASSED - All 4 checks are TRUE")
            print("="*80)
            return True
        else:
            print("\n" + "="*80)
            print("❌ PRIMARY TEST FAILED - Some checks are not TRUE")
            print("="*80)
            return False
            
    except requests.exceptions.Timeout:
        print(f"❌ FAILED: Request timeout after 30 seconds")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: Invalid JSON response: {e}")
        print(f"Response text: {response.text}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False


def test_secondary_sufficient_funds():
    """
    SECONDARY TEST: Sufficient funds scenario
    - Start with $5.00 balance
    - 1-minute call costs less than $5
    - Should bill normally (balance stays positive)
    - Should NOT create billing_failed leak row
    """
    print("\n" + "="*80)
    print("SECONDARY TEST: Sufficient funds scenario (normal billing path)")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/outbound-billing-leak-test"
    headers = {"Content-Type": "application/json"}
    body = {"startBalance": 5, "minutes": 1}
    
    print(f"\nPOST {url}")
    print(f"Body: {json.dumps(body)}")
    
    try:
        response = requests.post(url, json=body, headers=headers, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"\nFull Response JSON:")
        print(json.dumps(data, indent=2))
        
        # NOTE: For sufficient funds scenario, the endpoint's "pass" field may be false
        # because it's designed for the PRIMARY insufficient-funds test.
        # What matters here is: balance >= 0 and no billing_failed leak row.
        
        # For sufficient funds, we expect:
        # - Balance should remain >= 0
        # - No billing_failed row (noLegacyLeakRow should be true)
        # - balanceWentNegative may be false (that's expected and fine)
        
        checks = data.get("checks", {})
        balance_after_first = data.get("balanceAfterFirst", 0)
        
        print("\n" + "-"*80)
        print("CHECKING SUFFICIENT FUNDS SCENARIO:")
        print("-"*80)
        
        # Check no legacy leak row
        no_leak = checks.get("noLegacyLeakRow")
        print(f"{'✅ PASS' if no_leak else '❌ FAIL'}: noLegacyLeakRow = {no_leak}")
        print(f"     (NO billing_failed leak row should exist)")
        
        # Check balance stayed positive
        balance_positive = balance_after_first >= 0
        print(f"{'✅ PASS' if balance_positive else '❌ FAIL'}: Balance >= 0 = {balance_positive}")
        print(f"     (Balance after first: ${balance_after_first})")
        
        # Note about balanceWentNegative
        balance_went_negative = checks.get("balanceWentNegative")
        print(f"ℹ️  INFO: balanceWentNegative = {balance_went_negative}")
        print(f"     (Expected to be false with sufficient funds - this is normal)")
        
        print("\n" + "-"*80)
        print("ADDITIONAL DETAILS:")
        print("-"*80)
        print(f"Start Balance: ${data.get('startBalance', 'N/A')}")
        print(f"Expected Charge: ${data.get('expectedCharge', 'N/A')}")
        print(f"Balance After First: ${data.get('balanceAfterFirst', 'N/A')}")
        print(f"Balance After Second: ${data.get('balanceAfterSecond', 'N/A')}")
        
        if no_leak and balance_positive:
            print("\n" + "="*80)
            print("✅ SECONDARY TEST PASSED - Normal billing path works correctly")
            print("="*80)
            return True
        else:
            print("\n" + "="*80)
            print("❌ SECONDARY TEST FAILED")
            print("="*80)
            return False
            
    except requests.exceptions.Timeout:
        print(f"❌ FAILED: Request timeout after 30 seconds")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: Invalid JSON response: {e}")
        print(f"Response text: {response.text}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False


def main():
    print("\n" + "="*80)
    print("OUTBOUND-CALL [BillingLeak] FIX VERIFICATION")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test Endpoint: /api/dev/outbound-billing-leak-test")
    print("\nThis endpoint uses a synthetic DEVLEAK-* chatId and cleans up all test data.")
    print("No production data is affected.")
    
    # Run tests
    primary_passed = test_primary_billing_leak()
    secondary_passed = test_secondary_sufficient_funds()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"PRIMARY TEST (insufficient funds):   {'✅ PASSED' if primary_passed else '❌ FAILED'}")
    print(f"SECONDARY TEST (sufficient funds):   {'✅ PASSED' if secondary_passed else '❌ FAILED'}")
    print("="*80)
    
    if primary_passed and secondary_passed:
        print("\n✅ ALL TESTS PASSED - BillingLeak fix is working correctly")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED - BillingLeak fix has issues")
        sys.exit(1)


if __name__ == "__main__":
    main()
