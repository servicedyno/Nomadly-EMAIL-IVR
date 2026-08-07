#!/usr/bin/env python3
"""
Backend API Test Suite for NS Auto-Retry + Domain Status Check Feature
Tests the Node.js Express server running behind FastAPI proxy
"""

import requests
import json
import sys
from typing import Dict, Any, Tuple

# Read REACT_APP_BACKEND_URL from frontend/.env
def get_backend_url() -> str:
    """Read REACT_APP_BACKEND_URL from frontend/.env"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.strip().split('=', 1)[1]
    except Exception as e:
        print(f"❌ ERROR: Could not read REACT_APP_BACKEND_URL from /app/frontend/.env: {e}")
        sys.exit(1)
    return ""

BACKEND_URL = get_backend_url()
ADMIN_KEY_ENCODED = "o%2FQb8ArGahlquhCQ"  # URL-encoded version of o/Qb8ArGahlquhCQ
ADMIN_KEY_RAW = "o/Qb8ArGahlquhCQ"  # Raw version (fallback if %2F 403s)

print(f"🔍 Testing NS Auto-Retry + Domain Status Check Feature")
print(f"📍 Backend URL: {BACKEND_URL}")
print(f"🔑 Admin Key: {ADMIN_KEY_ENCODED} (URL-encoded) / {ADMIN_KEY_RAW} (raw)")
print("=" * 80)

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"   {details}")
    
    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1

def test_ns_activation_selftest_with_key():
    """TEST 1: NS Activation Self-Test with valid admin key"""
    print("\n" + "=" * 80)
    print("TEST 1: NS Activation Self-Test (with valid admin key)")
    print("=" * 80)
    
    # Try URL-encoded version first
    url = f"{BACKEND_URL}/api/admin/ns-activation-selftest?key={ADMIN_KEY_ENCODED}"
    print(f"🌐 GET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"📊 HTTP Status: {response.status_code}")
        
        # If 403 with encoded key, try raw key
        if response.status_code == 403:
            print(f"⚠️  URL-encoded key returned 403, trying raw key...")
            url_raw = f"{BACKEND_URL}/api/admin/ns-activation-selftest?key={ADMIN_KEY_RAW}"
            print(f"🌐 GET {url_raw}")
            response = requests.get(url_raw, timeout=30)
            print(f"📊 HTTP Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("TEST 1: HTTP 200 Status", False, f"Expected 200, got {response.status_code}")
            print(f"📄 Response Body: {response.text[:500]}")
            return False
        
        log_test("TEST 1: HTTP 200 Status", True, f"Got HTTP {response.status_code}")
        
        # Parse JSON response
        try:
            data = response.json()
            print(f"📄 Response JSON:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            log_test("TEST 1: Valid JSON Response", False, f"Failed to parse JSON: {e}")
            return False
        
        log_test("TEST 1: Valid JSON Response", True, "Response is valid JSON")
        
        # Check top-level 'ok' field
        if not data.get("ok"):
            log_test("TEST 1: Top-level 'ok' field", False, f"Expected ok:true, got ok:{data.get('ok')}")
            return False
        
        log_test("TEST 1: Top-level 'ok' field", True, "ok: true")
        
        # Check passed == total == 17
        passed = data.get("passed", 0)
        total = data.get("total", 0)
        
        if passed != 17:
            log_test("TEST 1: Passed count", False, f"Expected passed=17, got passed={passed}")
        else:
            log_test("TEST 1: Passed count", True, f"passed={passed}")
        
        if total != 17:
            log_test("TEST 1: Total count", False, f"Expected total=17, got total={total}")
        else:
            log_test("TEST 1: Total count", True, f"total={total}")
        
        if passed != total:
            log_test("TEST 1: All checks passed", False, f"passed={passed} != total={total}")
        else:
            log_test("TEST 1: All checks passed", True, f"All {total} checks passed")
        
        # Check individual checks
        checks = data.get("checks", [])
        print(f"\n📋 Individual Checks ({len(checks)} total):")
        
        failed_checks = []
        for check in checks:
            check_name = check.get("name", "unknown")
            check_pass = check.get("pass", False)
            check_detail = check.get("detail", "")
            
            status = "✅" if check_pass else "❌"
            print(f"   {status} {check_name}: {check_pass} (detail: {check_detail})")
            
            if not check_pass:
                failed_checks.append(check_name)
        
        if failed_checks:
            log_test("TEST 1: All individual checks pass", False, f"Failed checks: {', '.join(failed_checks)}")
            return False
        else:
            log_test("TEST 1: All individual checks pass", True, f"All {len(checks)} checks passed")
        
        # Verify expected check names are present
        expected_checks = [
            "classify_ACT_apply",
            "classify_REQ_wait",
            "classify_PEN_wait",
            "classify_FAI_giveup",
            "classify_old_escalate",
            "classify_maxattempts_escalate",
            "nextDelay_monotonic",
            "processOne_active_applies",
            "processOne_pending_waits",
            "processOne_failed_giveup",
            "map_ACT_active",
            "map_REQ_activating",
            "map_REQ_old_stuck",
            "map_FAI_failed",
            "nudge_activating_text",
            "nudge_active_null",
            "nudge_stuck_text"
        ]
        
        check_names = [c.get("name") for c in checks]
        missing_checks = [name for name in expected_checks if name not in check_names]
        
        if missing_checks:
            log_test("TEST 1: Expected checks present", False, f"Missing checks: {', '.join(missing_checks)}")
        else:
            log_test("TEST 1: Expected checks present", True, f"All {len(expected_checks)} expected checks present")
        
        return passed == total == 17 and not failed_checks and not missing_checks
        
    except requests.exceptions.Timeout:
        log_test("TEST 1: Request Timeout", False, "Request timed out after 30 seconds")
        return False
    except requests.exceptions.RequestException as e:
        log_test("TEST 1: Request Exception", False, f"Request failed: {e}")
        return False
    except Exception as e:
        log_test("TEST 1: Unexpected Error", False, f"Unexpected error: {e}")
        return False

def test_ns_activation_selftest_no_key():
    """TEST 2: NS Activation Self-Test without admin key (auth guard)"""
    print("\n" + "=" * 80)
    print("TEST 2: NS Activation Self-Test (no admin key - auth guard)")
    print("=" * 80)
    
    url = f"{BACKEND_URL}/api/admin/ns-activation-selftest"
    print(f"🌐 GET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"📊 HTTP Status: {response.status_code}")
        
        if response.status_code != 403:
            log_test("TEST 2: HTTP 403 Status", False, f"Expected 403, got {response.status_code}")
            print(f"📄 Response Body: {response.text[:500]}")
            return False
        
        log_test("TEST 2: HTTP 403 Status", True, f"Got HTTP {response.status_code}")
        
        # Parse JSON response
        try:
            data = response.json()
            print(f"📄 Response JSON:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            log_test("TEST 2: Valid JSON Response", False, f"Failed to parse JSON: {e}")
            return False
        
        log_test("TEST 2: Valid JSON Response", True, "Response is valid JSON")
        
        # Check for "Unauthorized" error
        error = data.get("error", "")
        if error != "Unauthorized":
            log_test("TEST 2: Unauthorized error message", False, f"Expected 'Unauthorized', got '{error}'")
            return False
        
        log_test("TEST 2: Unauthorized error message", True, f"error: '{error}'")
        
        return True
        
    except requests.exceptions.Timeout:
        log_test("TEST 2: Request Timeout", False, "Request timed out after 30 seconds")
        return False
    except requests.exceptions.RequestException as e:
        log_test("TEST 2: Request Exception", False, f"Request failed: {e}")
        return False
    except Exception as e:
        log_test("TEST 2: Unexpected Error", False, f"Unexpected error: {e}")
        return False

def test_health_endpoint():
    """TEST 3: Health endpoint (regression check)"""
    print("\n" + "=" * 80)
    print("TEST 3: Health Endpoint (regression check)")
    print("=" * 80)
    
    url = f"{BACKEND_URL}/api/health"
    print(f"🌐 GET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"📊 HTTP Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("TEST 3: HTTP 200 Status", False, f"Expected 200, got {response.status_code}")
            print(f"📄 Response Body: {response.text[:500]}")
            return False
        
        log_test("TEST 3: HTTP 200 Status", True, f"Got HTTP {response.status_code}")
        
        # Parse JSON response
        try:
            data = response.json()
            print(f"📄 Response JSON:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            log_test("TEST 3: Valid JSON Response", False, f"Failed to parse JSON: {e}")
            return False
        
        log_test("TEST 3: Valid JSON Response", True, "Response is valid JSON")
        
        # Check status field
        status = data.get("status", "")
        if status != "healthy":
            log_test("TEST 3: Status 'healthy'", False, f"Expected 'healthy', got '{status}'")
        else:
            log_test("TEST 3: Status 'healthy'", True, f"status: '{status}'")
        
        # Check database field
        database = data.get("database", "")
        if database != "connected":
            log_test("TEST 3: Database 'connected'", False, f"Expected 'connected', got '{database}'")
        else:
            log_test("TEST 3: Database 'connected'", True, f"database: '{database}'")
        
        return status == "healthy" and database == "connected"
        
    except requests.exceptions.Timeout:
        log_test("TEST 3: Request Timeout", False, "Request timed out after 30 seconds")
        return False
    except requests.exceptions.RequestException as e:
        log_test("TEST 3: Request Exception", False, f"Request failed: {e}")
        return False
    except Exception as e:
        log_test("TEST 3: Unexpected Error", False, f"Unexpected error: {e}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    total = test_results["passed"] + test_results["failed"]
    pass_rate = (test_results["passed"] / total * 100) if total > 0 else 0
    
    print(f"✅ Passed: {test_results['passed']}/{total} ({pass_rate:.1f}%)")
    print(f"❌ Failed: {test_results['failed']}/{total}")
    
    if test_results["failed"] > 0:
        print("\n❌ FAILED TESTS:")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"   • {test['name']}")
                if test["details"]:
                    print(f"     {test['details']}")
    
    print("=" * 80)
    
    return test_results["failed"] == 0

if __name__ == "__main__":
    # Run all tests
    test1_pass = test_ns_activation_selftest_with_key()
    test2_pass = test_ns_activation_selftest_no_key()
    test3_pass = test_health_endpoint()
    
    # Print summary
    all_pass = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_pass else 1)
