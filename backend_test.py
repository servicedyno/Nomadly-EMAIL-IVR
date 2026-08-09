#!/usr/bin/env python3
"""
Backend regression test after cleanup (360 scripts + 50 dead functions removed).
Tests read-only endpoints to verify no runtime business logic was broken.
"""

import requests
import json
import sys
from typing import Dict, Any, List, Tuple

# Load backend URL from frontend/.env
def get_backend_url() -> str:
    """Read REACT_APP_BACKEND_URL from frontend/.env"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"❌ Failed to read REACT_APP_BACKEND_URL: {e}")
        sys.exit(1)
    return ""

BASE_URL = get_backend_url()
print(f"🔗 Testing backend at: {BASE_URL}")
print(f"📋 Scope: Verify NO regression after cleanup (360 scripts + 50 dead functions removed)\n")

# Test results tracking
results: List[Tuple[str, bool, str]] = []

def test_endpoint(name: str, method: str, path: str, expected_status: int = 200, 
                  body: Dict[Any, Any] = None, check_fields: List[str] = None) -> bool:
    """Test a single endpoint and track results"""
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=body or {}, timeout=30)
        else:
            results.append((name, False, f"Unsupported method: {method}"))
            return False
        
        # Check status code
        if response.status_code != expected_status:
            results.append((name, False, f"Expected {expected_status}, got {response.status_code}"))
            return False
        
        # Check response fields if specified
        if check_fields:
            try:
                data = response.json()
                for field in check_fields:
                    if field not in data:
                        results.append((name, False, f"Missing field: {field}"))
                        return False
            except Exception as e:
                results.append((name, False, f"JSON parse error: {e}"))
                return False
        
        results.append((name, True, "PASSED"))
        return True
        
    except requests.exceptions.Timeout:
        results.append((name, False, "Request timeout (30s)"))
        return False
    except requests.exceptions.ConnectionError as e:
        results.append((name, False, f"Connection error: {e}"))
        return False
    except Exception as e:
        results.append((name, False, f"Unexpected error: {e}"))
        return False

def test_health_endpoint() -> bool:
    """Test 1: Health check endpoint"""
    print("🏥 TEST 1: Health Check")
    success = test_endpoint(
        "Health Check",
        "GET",
        "/api/health",
        expected_status=200,
        check_fields=["status", "database"]
    )
    
    if success:
        # Get the actual response to verify values
        response = requests.get(f"{BASE_URL}/api/health", timeout=30)
        data = response.json()
        if data.get("status") == "healthy" and data.get("database") == "connected":
            print(f"   ✅ Health: {data.get('status')}, Database: {data.get('database')}")
            return True
        else:
            print(f"   ❌ Unexpected values: {data}")
            results[-1] = ("Health Check", False, f"status={data.get('status')}, database={data.get('database')}")
            return False
    else:
        print(f"   ❌ Health check failed")
        return False

def test_dev_endpoints() -> Dict[str, bool]:
    """Test 2-7: Dev diagnostic endpoints (read-only, self-cleaning)"""
    print("\n🔬 TEST 2-7: Dev Diagnostic Endpoints (read-only)")
    
    dev_tests = {
        "UX Fixes Audit": {
            "method": "GET",
            "path": "/api/dev/ux-fixes-audit",
            "check_field": "ok"
        },
        "Call Reconciler": {
            "method": "POST",
            "path": "/api/dev/call-reconciler-test",
            "check_field": "pass"
        },
        "OTP Voice Match": {
            "method": "POST",
            "path": "/api/dev/otp-voice-match-test",
            "check_field": "pass"
        },
        "Twilio IVR Transfer Billing": {
            "method": "POST",
            "path": "/api/dev/twilio-ivr-transfer-billing-test",
            "check_field": "pass"
        },
        "Dial Rate Guard": {
            "method": "POST",
            "path": "/api/dev/dial-rate-guard-test",
            "check_field": "pass"
        },
        "IVR Rate Policy": {
            "method": "POST",
            "path": "/api/dev/ivr-rate-policy-test",
            "check_field": "pass"
        }
    }
    
    test_results = {}
    for name, config in dev_tests.items():
        success = test_endpoint(
            name,
            config["method"],
            config["path"],
            expected_status=200
        )
        
        if success:
            # Verify the pass/ok field
            try:
                if config["method"] == "GET":
                    response = requests.get(f"{BASE_URL}{config['path']}", timeout=30)
                else:
                    response = requests.post(f"{BASE_URL}{config['path']}", json={}, timeout=30)
                
                data = response.json()
                check_field = config["check_field"]
                
                if data.get(check_field) == True:
                    print(f"   ✅ {name}: {check_field}=true")
                    test_results[name] = True
                else:
                    print(f"   ❌ {name}: {check_field}={data.get(check_field)}")
                    results[-1] = (name, False, f"{check_field}={data.get(check_field)}")
                    test_results[name] = False
            except Exception as e:
                print(f"   ❌ {name}: Failed to verify response - {e}")
                results[-1] = (name, False, f"Response verification failed: {e}")
                test_results[name] = False
        else:
            print(f"   ❌ {name}: Request failed")
            test_results[name] = False
    
    return test_results

def print_summary():
    """Print test summary"""
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if total - passed > 0:
        print("\n❌ FAILED TESTS:")
        for name, success, message in results:
            if not success:
                print(f"   • {name}: {message}")
    
    print("\n" + "="*70)
    
    if passed == total:
        print("✅ ALL TESTS PASSED - No regression detected")
        print("="*70)
        return True
    else:
        print("❌ SOME TESTS FAILED - Regression detected")
        print("="*70)
        return False

def main():
    """Run all tests"""
    print("="*70)
    print("🧪 BACKEND REGRESSION TEST AFTER CLEANUP")
    print("="*70)
    print("Cleanup performed:")
    print("  • 360 unused one-off ops/forensic script files removed")
    print("  • 50 genuinely-dead exported functions removed from 28 modules")
    print("="*70)
    print()
    
    # Test 1: Health check
    health_ok = test_health_endpoint()
    
    # Test 2-7: Dev endpoints
    dev_results = test_dev_endpoints()
    
    # Print summary
    all_passed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
