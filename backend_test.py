#!/usr/bin/env python3
"""
Backend API Test Suite for Nomadly Telegram Bot
Testing OTP Plan Gate Bug Fix
"""

import requests
import json
import sys
from typing import Dict, Any, List, Tuple

# Read backend URL from frontend/.env
BACKEND_URL = "https://f06fe503-30a9-4c4e-a049-cc26f354ea86.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"✅ PASS: {test_name}")
    
    def add_fail(self, test_name: str, reason: str):
        self.failed += 1
        error_msg = f"❌ FAIL: {test_name} - {reason}"
        self.errors.append(error_msg)
        print(error_msg)
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
        print(f"{'='*80}")
        if self.errors:
            print("\nFAILED TESTS:")
            for error in self.errors:
                print(f"  {error}")
        return self.failed == 0


def test_otp_plan_gate_check(result: TestResult):
    """
    Test the OTP Plan Gate Check endpoint
    Verifies the fix for @Padrino_voodoo's "OTP mode not working" bug
    """
    print("\n" + "="*80)
    print("TEST SUITE: OTP Plan Gate Check (Bug Fix Verification)")
    print("="*80)
    
    endpoint = f"{API_BASE}/dev/otp-plan-gate-check"
    
    # Test 1: Basic endpoint availability
    print(f"\n[TEST 1] GET {endpoint}")
    try:
        response = requests.get(endpoint, timeout=10)
        
        if response.status_code != 200:
            result.add_fail(
                "Endpoint availability",
                f"Expected HTTP 200, got {response.status_code}"
            )
            print(f"Response body: {response.text[:500]}")
            return
        
        result.add_pass("Endpoint returns HTTP 200")
        
        # Parse JSON
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            result.add_fail("JSON parsing", f"Invalid JSON response: {e}")
            print(f"Response body: {response.text[:500]}")
            return
        
        print(f"\nResponse structure:")
        print(json.dumps(data, indent=2)[:1000])
        
        # Test 2: Verify matrix.starter.otpCollection === false
        if data.get("matrix", {}).get("starter", {}).get("otpCollection") == False:
            result.add_pass("matrix.starter.otpCollection === false")
        else:
            result.add_fail(
                "matrix.starter.otpCollection === false",
                f"Got {data.get('matrix', {}).get('starter', {}).get('otpCollection')}"
            )
        
        # Test 3: Verify matrix.pro.otpCollection === true (THE FIX)
        if data.get("matrix", {}).get("pro", {}).get("otpCollection") == True:
            result.add_pass("matrix.pro.otpCollection === true (THE FIX - was false before)")
        else:
            result.add_fail(
                "matrix.pro.otpCollection === true (THE FIX)",
                f"Got {data.get('matrix', {}).get('pro', {}).get('otpCollection')} - THIS IS THE CRITICAL BUG"
            )
        
        # Test 4: Verify matrix.business.otpCollection === true
        if data.get("matrix", {}).get("business", {}).get("otpCollection") == True:
            result.add_pass("matrix.business.otpCollection === true")
        else:
            result.add_fail(
                "matrix.business.otpCollection === true",
                f"Got {data.get('matrix', {}).get('business', {}).get('otpCollection')}"
            )
        
        # Test 5: Verify matrix.pro.otpCustomMessages === false (Business-only differentiator)
        if data.get("matrix", {}).get("pro", {}).get("otpCustomMessages") == False:
            result.add_pass("matrix.pro.otpCustomMessages === false (Business-only preserved)")
        else:
            result.add_fail(
                "matrix.pro.otpCustomMessages === false",
                f"Got {data.get('matrix', {}).get('pro', {}).get('otpCustomMessages')}"
            )
        
        # Test 6: Verify matrix.business.otpCustomMessages === true
        if data.get("matrix", {}).get("business", {}).get("otpCustomMessages") == True:
            result.add_pass("matrix.business.otpCustomMessages === true")
        else:
            result.add_fail(
                "matrix.business.otpCustomMessages === true",
                f"Got {data.get('matrix', {}).get('business', {}).get('otpCustomMessages')}"
            )
        
        # Test 7: Verify gateDecisions.pro.allowed === true (REGRESSION TARGET)
        if data.get("gateDecisions", {}).get("pro", {}).get("allowed") == True:
            result.add_pass("gateDecisions.pro.allowed === true (Pro user can NOW select OTP mode)")
        else:
            result.add_fail(
                "gateDecisions.pro.allowed === true (REGRESSION TARGET)",
                f"Got {data.get('gateDecisions', {}).get('pro', {}).get('allowed')} - Pro users still blocked!"
            )
        
        # Test 8: Verify gateDecisions.business.allowed === true
        if data.get("gateDecisions", {}).get("business", {}).get("allowed") == True:
            result.add_pass("gateDecisions.business.allowed === true")
        else:
            result.add_fail(
                "gateDecisions.business.allowed === true",
                f"Got {data.get('gateDecisions', {}).get('business', {}).get('allowed')}"
            )
        
        # Test 9: Verify gateDecisions.starter.allowed === false
        if data.get("gateDecisions", {}).get("starter", {}).get("allowed") == False:
            result.add_pass("gateDecisions.starter.allowed === false")
        else:
            result.add_fail(
                "gateDecisions.starter.allowed === false",
                f"Got {data.get('gateDecisions', {}).get('starter', {}).get('allowed')}"
            )
        
        # Test 10: Verify gateDecisions.starter.requiredTier === "Pro"
        if data.get("gateDecisions", {}).get("starter", {}).get("requiredTier") == "Pro":
            result.add_pass("gateDecisions.starter.requiredTier === 'Pro'")
        else:
            result.add_fail(
                "gateDecisions.starter.requiredTier === 'Pro'",
                f"Got {data.get('gateDecisions', {}).get('starter', {}).get('requiredTier')}"
            )
        
        # Test 11: Verify gateDecisions.trial.allowed === false
        if data.get("gateDecisions", {}).get("trial", {}).get("allowed") == False:
            result.add_pass("gateDecisions.trial.allowed === false")
        else:
            result.add_fail(
                "gateDecisions.trial.allowed === false",
                f"Got {data.get('gateDecisions', {}).get('trial', {}).get('allowed')}"
            )
        
        # Test 12: Verify gateDecisions.trial.reason === "trial"
        if data.get("gateDecisions", {}).get("trial", {}).get("reason") == "trial":
            result.add_pass("gateDecisions.trial.reason === 'trial'")
        else:
            result.add_fail(
                "gateDecisions.trial.reason === 'trial'",
                f"Got {data.get('gateDecisions', {}).get('trial', {}).get('reason')}"
            )
        
    except requests.exceptions.RequestException as e:
        result.add_fail("Endpoint availability", f"Request failed: {e}")
        return


def test_otp_plan_gate_check_with_plan_param(result: TestResult):
    """
    Test the OTP Plan Gate Check endpoint with plan=pro query parameter
    """
    print("\n" + "="*80)
    print("TEST SUITE: OTP Plan Gate Check with ?plan=pro (Optional Spot Check)")
    print("="*80)
    
    endpoint = f"{API_BASE}/dev/otp-plan-gate-check?plan=pro"
    
    print(f"\n[TEST 2] GET {endpoint}")
    try:
        response = requests.get(endpoint, timeout=10)
        
        if response.status_code != 200:
            result.add_fail(
                "Endpoint with plan=pro",
                f"Expected HTTP 200, got {response.status_code}"
            )
            return
        
        result.add_pass("Endpoint with plan=pro returns HTTP 200")
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            result.add_fail("JSON parsing (plan=pro)", f"Invalid JSON response: {e}")
            return
        
        print(f"\nResponse structure (plan=pro):")
        print(json.dumps(data, indent=2)[:500])
        
        # Test 13: Verify requested.decision.allowed === true for Pro plan
        if data.get("requested", {}).get("decision", {}).get("allowed") == True:
            result.add_pass("requested.decision.allowed === true (Pro plan can access OTP)")
        else:
            result.add_fail(
                "requested.decision.allowed === true (plan=pro)",
                f"Got {data.get('requested', {}).get('decision', {}).get('allowed')}"
            )
        
    except requests.exceptions.RequestException as e:
        result.add_fail("Endpoint with plan=pro", f"Request failed: {e}")


def main():
    print("\n" + "="*80)
    print("NOMADLY TELEGRAM BOT - OTP PLAN GATE BUG FIX VERIFICATION")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Testing endpoint: /api/dev/otp-plan-gate-check")
    print(f"Bug: @Padrino_voodoo (chatId 7706898844) - 'OTP mode not working'")
    print(f"Root cause: planFeatureAccess.pro.otpCollection was false (should be true)")
    print("="*80)
    
    result = TestResult()
    
    # Run test suites
    test_otp_plan_gate_check(result)
    test_otp_plan_gate_check_with_plan_param(result)
    
    # Print summary
    success = result.summary()
    
    if success:
        print("\n✅ ALL TESTS PASSED - OTP Plan Gate bug fix is VERIFIED")
        print("\nKEY FIX CONFIRMED:")
        print("  • matrix.pro.otpCollection is now TRUE (was false)")
        print("  • gateDecisions.pro.allowed is TRUE (Pro users can now select OTP mode)")
        print("  • Business-only differentiator preserved (otpCustomMessages)")
        print("\n@Padrino_voodoo's bug is FIXED - Pro users can now use OTP Collection mode")
        sys.exit(0)
    else:
        print("\n❌ TESTS FAILED - OTP Plan Gate bug fix has issues")
        sys.exit(1)


if __name__ == "__main__":
    main()
