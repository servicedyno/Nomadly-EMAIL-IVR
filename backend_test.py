#!/usr/bin/env python3
"""
Backend Test Suite for DigitalOcean RDP Reseller API Endpoints
Testing the NEW password-reset and reinstall endpoints on e2e-rdp-1
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://secure-passphrase-2.preview.emergentagent.com/api/reseller/v1"
API_KEY = "nmdly_e2e_51573577f5db956c5c0cb039"
TEST_RDP_ID = "e2e-rdp-1"

# Test counters
tests_passed = 0
tests_failed = 0
test_results = []


def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1
    
    result = f"{status} | {test_name}"
    if details:
        result += f"\n    {details}"
    
    print(result)
    test_results.append({
        "test": test_name,
        "passed": passed,
        "details": details
    })


def make_request(method: str, path: str, headers: Optional[Dict] = None, 
                 json_data: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (status_code, response_json)"""
    url = f"{BASE_URL}{path}"
    
    if headers is None:
        headers = {}
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=10)
        else:
            return (0, {"error": f"Unsupported method: {method}"})
        
        try:
            return (resp.status_code, resp.json())
        except:
            return (resp.status_code, {"error": "Invalid JSON", "text": resp.text[:200]})
    except Exception as e:
        return (0, {"error": str(e)})


def test_d1_password_reset():
    """D1 - POST /rdp/e2e-rdp-1/password-reset (no body)"""
    print("\n=== TEST D1: Password Reset ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("POST", f"/rdp/{TEST_RDP_ID}/password-reset", headers=headers)
    
    # Check status code
    if status != 200:
        log_test("D1: Password Reset - Status Code", False, 
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D1: Password Reset - Status Code", True, f"Got 200")
    
    # Check response structure
    required_fields = ["mode", "id", "username", "method", "note"]
    missing_fields = [f for f in required_fields if f not in data]
    
    if missing_fields:
        log_test("D1: Password Reset - Response Structure", False,
                f"Missing fields: {missing_fields}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D1: Password Reset - Response Structure", True, 
            f"All required fields present")
    
    # Check field values
    checks = []
    if data.get("mode") != "dry_run":
        checks.append(f"mode is '{data.get('mode')}' (expected 'dry_run')")
    if data.get("id") != TEST_RDP_ID:
        checks.append(f"id is '{data.get('id')}' (expected '{TEST_RDP_ID}')")
    if data.get("username") != "Administrator":
        checks.append(f"username is '{data.get('username')}' (expected 'Administrator')")
    if data.get("method") != "agent":
        checks.append(f"method is '{data.get('method')}' (expected 'agent')")
    if not isinstance(data.get("note"), str):
        checks.append(f"note is not a string")
    
    if checks:
        log_test("D1: Password Reset - Field Values", False, 
                f"Issues: {'; '.join(checks)}")
    else:
        log_test("D1: Password Reset - Field Values", True,
                f"mode=dry_run, id={TEST_RDP_ID}, username=Administrator, method=agent")


def test_d2a_reinstall_ws2019():
    """D2a - POST /rdp/e2e-rdp-1/reinstall body {"os":"ws2019"}"""
    print("\n=== TEST D2a: Reinstall with ws2019 ===")
    
    headers = {"X-API-Key": API_KEY}
    body = {"os": "ws2019"}
    status, data = make_request("POST", f"/rdp/{TEST_RDP_ID}/reinstall", 
                               headers=headers, json_data=body)
    
    # Check status code
    if status != 200:
        log_test("D2a: Reinstall ws2019 - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D2a: Reinstall ws2019 - Status Code", True, f"Got 200")
    
    # Check response structure
    required_fields = ["mode", "id", "os", "note"]
    missing_fields = [f for f in required_fields if f not in data]
    
    if missing_fields:
        log_test("D2a: Reinstall ws2019 - Response Structure", False,
                f"Missing fields: {missing_fields}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D2a: Reinstall ws2019 - Response Structure", True,
            f"All required fields present")
    
    # Check field values
    checks = []
    if data.get("mode") != "dry_run":
        checks.append(f"mode is '{data.get('mode')}' (expected 'dry_run')")
    if data.get("id") != TEST_RDP_ID:
        checks.append(f"id is '{data.get('id')}' (expected '{TEST_RDP_ID}')")
    if data.get("os") != "ws2019":
        checks.append(f"os is '{data.get('os')}' (expected 'ws2019')")
    if not isinstance(data.get("note"), str):
        checks.append(f"note is not a string")
    
    if checks:
        log_test("D2a: Reinstall ws2019 - Field Values", False,
                f"Issues: {'; '.join(checks)}")
    else:
        log_test("D2a: Reinstall ws2019 - Field Values", True,
                f"mode=dry_run, id={TEST_RDP_ID}, os=ws2019")


def test_d2b_reinstall_invalid_os():
    """D2b - POST /rdp/e2e-rdp-1/reinstall body {"os":"badxx"}"""
    print("\n=== TEST D2b: Reinstall with Invalid OS ===")
    
    headers = {"X-API-Key": API_KEY}
    body = {"os": "badxx"}
    status, data = make_request("POST", f"/rdp/{TEST_RDP_ID}/reinstall",
                               headers=headers, json_data=body)
    
    # Check status code
    if status != 400:
        log_test("D2b: Invalid OS - Status Code", False,
                f"Expected 400, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D2b: Invalid OS - Status Code", True, f"Got 400")
    
    # Check error response
    if data.get("error") != "invalid_os":
        log_test("D2b: Invalid OS - Error Code", False,
                f"Expected error='invalid_os', got '{data.get('error')}'. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D2b: Invalid OS - Error Code", True, f"error='invalid_os'")
    
    # Check message contains valid OS options
    message = data.get("message", "")
    valid_os = ["ws2019", "ws2022", "ws2025"]
    missing_os = [os for os in valid_os if os not in message]
    
    if missing_os:
        log_test("D2b: Invalid OS - Error Message", False,
                f"Message missing OS options: {missing_os}. Message: {message}")
    else:
        log_test("D2b: Invalid OS - Error Message", True,
                f"Message contains all valid OS options (ws2019, ws2022, ws2025)")


def test_d2c_reinstall_empty_body():
    """D2c - POST /rdp/e2e-rdp-1/reinstall body {} (empty JSON)"""
    print("\n=== TEST D2c: Reinstall with Empty Body (Default OS) ===")
    
    headers = {"X-API-Key": API_KEY}
    body = {}
    status, data = make_request("POST", f"/rdp/{TEST_RDP_ID}/reinstall",
                               headers=headers, json_data=body)
    
    # Check status code
    if status != 200:
        log_test("D2c: Empty Body - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D2c: Empty Body - Status Code", True, f"Got 200")
    
    # Check response structure
    if data.get("mode") != "dry_run":
        log_test("D2c: Empty Body - Dry Run Mode", False,
                f"Expected mode='dry_run', got '{data.get('mode')}'")
        return
    
    log_test("D2c: Empty Body - Dry Run Mode", True, f"mode=dry_run")
    
    # Check OS defaults to ws2022 (the record's edition)
    if data.get("os") != "ws2022":
        log_test("D2c: Empty Body - Default OS", False,
                f"Expected os='ws2022' (record default), got '{data.get('os')}'. Response: {json.dumps(data, indent=2)}")
    else:
        log_test("D2c: Empty Body - Default OS", True,
                f"os defaulted to 'ws2022' (record's edition)")


def test_d3_get_rdp_with_agent_online():
    """D3 - GET /rdp/e2e-rdp-1"""
    print("\n=== TEST D3: GET RDP with agent_online Field ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("GET", f"/rdp/{TEST_RDP_ID}", headers=headers)
    
    # Check status code
    if status != 200:
        log_test("D3: GET RDP - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("D3: GET RDP - Status Code", True, f"Got 200")
    
    # Check agent_online field exists
    if "agent_online" not in data:
        log_test("D3: GET RDP - agent_online Field", False,
                f"Missing 'agent_online' field. Response keys: {list(data.keys())}")
        return
    
    log_test("D3: GET RDP - agent_online Field", True,
            f"agent_online={data.get('agent_online')} (boolean)")
    
    # Check agent_online is boolean
    if not isinstance(data.get("agent_online"), bool):
        log_test("D3: GET RDP - agent_online Type", False,
                f"agent_online is not boolean, got {type(data.get('agent_online'))}")
    else:
        log_test("D3: GET RDP - agent_online Type", True,
                f"agent_online is boolean")
    
    # Check live block has DO-RDP shape (not Azure error)
    if "live" not in data:
        log_test("D3: GET RDP - live Block", False,
                f"Missing 'live' field")
        return
    
    live = data.get("live", {})
    
    # Check it's DO-RDP shape (has status, mainIp)
    if "status" not in live:
        log_test("D3: GET RDP - DO-RDP Shape", False,
                f"live block missing 'status' field. live: {json.dumps(live, indent=2)}")
        return
    
    # Check it's NOT an Azure error string
    if isinstance(live, str) and "azure" in live.lower():
        log_test("D3: GET RDP - Not Azure Error", False,
                f"live block contains Azure error string: {live}")
        return
    
    log_test("D3: GET RDP - DO-RDP Shape", True,
            f"live block has DO-RDP shape (status={live.get('status')}, mainIp={live.get('mainIp')})")
    
    # Status "unknown" is expected for fake instance
    if live.get("status") == "unknown":
        log_test("D3: GET RDP - Status Unknown (Expected)", True,
                f"status='unknown' for fake instance (expected)")


def test_auth_missing_key():
    """Negative: POST /rdp/e2e-rdp-1/password-reset with NO api key"""
    print("\n=== TEST AUTH: Missing API Key ===")
    
    headers = {}  # No API key
    status, data = make_request("POST", f"/rdp/{TEST_RDP_ID}/password-reset", headers=headers)
    
    if status != 401:
        log_test("Auth: Missing Key - Status Code", False,
                f"Expected 401, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Auth: Missing Key - Status Code", True, f"Got 401")
    
    if data.get("error") != "missing_api_key":
        log_test("Auth: Missing Key - Error Code", False,
                f"Expected error='missing_api_key', got '{data.get('error')}'")
    else:
        log_test("Auth: Missing Key - Error Code", True,
                f"error='missing_api_key'")


def test_not_found_password_reset():
    """Negative: POST /rdp/does-not-exist/password-reset"""
    print("\n=== TEST NOT FOUND: Password Reset ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("POST", "/rdp/does-not-exist/password-reset", headers=headers)
    
    if status != 404:
        log_test("Not Found: Password Reset - Status Code", False,
                f"Expected 404, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Not Found: Password Reset - Status Code", True, f"Got 404")
    
    if data.get("error") != "not_found":
        log_test("Not Found: Password Reset - Error Code", False,
                f"Expected error='not_found', got '{data.get('error')}'")
    else:
        log_test("Not Found: Password Reset - Error Code", True,
                f"error='not_found'")


def test_not_found_reinstall():
    """Negative: POST /rdp/does-not-exist/reinstall"""
    print("\n=== TEST NOT FOUND: Reinstall ===")
    
    headers = {"X-API-Key": API_KEY}
    body = {"os": "ws2019"}
    status, data = make_request("POST", "/rdp/does-not-exist/reinstall", 
                               headers=headers, json_data=body)
    
    if status != 404:
        log_test("Not Found: Reinstall - Status Code", False,
                f"Expected 404, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Not Found: Reinstall - Status Code", True, f"Got 404")
    
    if data.get("error") != "not_found":
        log_test("Not Found: Reinstall - Error Code", False,
                f"Expected error='not_found', got '{data.get('error')}'")
    else:
        log_test("Not Found: Reinstall - Error Code", True,
                f"error='not_found'")


def test_regression_get_rdp_list():
    """Regression: GET /rdp"""
    print("\n=== TEST REGRESSION: GET /rdp List ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("GET", "/rdp", headers=headers)
    
    if status != 200:
        log_test("Regression: GET /rdp - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Regression: GET /rdp - Status Code", True, f"Got 200")
    
    # Check response has rdp array
    if "rdp" not in data:
        log_test("Regression: GET /rdp - Response Structure", False,
                f"Missing 'rdp' field. Response keys: {list(data.keys())}")
        return
    
    log_test("Regression: GET /rdp - Response Structure", True,
            f"Has 'rdp' array")
    
    # Check e2e-rdp-1 is in the list
    rdp_list = data.get("rdp", [])
    rdp_ids = [r.get("id") for r in rdp_list if isinstance(r, dict)]
    
    if TEST_RDP_ID not in rdp_ids:
        log_test("Regression: GET /rdp - Contains e2e-rdp-1", False,
                f"e2e-rdp-1 not found in list. IDs: {rdp_ids}")
    else:
        log_test("Regression: GET /rdp - Contains e2e-rdp-1", True,
                f"e2e-rdp-1 found in list")


def test_regression_get_rdp_plans():
    """Regression: GET /rdp/plans?region=EU"""
    print("\n=== TEST REGRESSION: GET /rdp/plans ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("GET", "/rdp/plans?region=EU", headers=headers)
    
    if status != 200:
        log_test("Regression: GET /rdp/plans - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Regression: GET /rdp/plans - Status Code", True, f"Got 200")
    
    # Check response structure
    if "product" not in data or "plans" not in data:
        log_test("Regression: GET /rdp/plans - Response Structure", False,
                f"Missing 'product' or 'plans' field. Response keys: {list(data.keys())}")
        return
    
    log_test("Regression: GET /rdp/plans - Response Structure", True,
            f"Has 'product' and 'plans' fields")
    
    # Check product is rdp
    if data.get("product") != "rdp":
        log_test("Regression: GET /rdp/plans - Product Field", False,
                f"Expected product='rdp', got '{data.get('product')}'")
    else:
        log_test("Regression: GET /rdp/plans - Product Field", True,
                f"product='rdp'")
    
    # Check plans is an array
    if not isinstance(data.get("plans"), list):
        log_test("Regression: GET /rdp/plans - Plans Array", False,
                f"plans is not an array, got {type(data.get('plans'))}")
    else:
        log_test("Regression: GET /rdp/plans - Plans Array", True,
                f"plans is an array with {len(data.get('plans', []))} items")


def test_regression_get_account():
    """Regression: GET /account"""
    print("\n=== TEST REGRESSION: GET /account ===")
    
    headers = {"X-API-Key": API_KEY}
    status, data = make_request("GET", "/account", headers=headers)
    
    if status != 200:
        log_test("Regression: GET /account - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Regression: GET /account - Status Code", True, f"Got 200")
    
    # Just check we got a valid response (structure may vary)
    if not isinstance(data, dict):
        log_test("Regression: GET /account - Response Type", False,
                f"Response is not a dict, got {type(data)}")
    else:
        log_test("Regression: GET /account - Response Type", True,
                f"Response is a valid dict with keys: {list(data.keys())[:5]}")


def test_auth_bearer_header():
    """Test Authorization: Bearer header (alternative to X-API-Key)"""
    print("\n=== TEST AUTH: Bearer Header ===")
    
    headers = {"Authorization": f"Bearer {API_KEY}"}
    status, data = make_request("GET", f"/rdp/{TEST_RDP_ID}", headers=headers)
    
    if status != 200:
        log_test("Auth: Bearer Header - Status Code", False,
                f"Expected 200, got {status}. Response: {json.dumps(data, indent=2)}")
        return
    
    log_test("Auth: Bearer Header - Status Code", True,
            f"Got 200 (Bearer auth works)")


def print_summary():
    """Print test summary"""
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Total Tests: {tests_passed + tests_failed}")
    print(f"✅ Passed: {tests_passed}")
    print(f"❌ Failed: {tests_failed}")
    print(f"Pass Rate: {tests_passed / (tests_passed + tests_failed) * 100:.1f}%")
    print("="*70)
    
    if tests_failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if not result["passed"]:
                print(f"  - {result['test']}")
                if result["details"]:
                    print(f"    {result['details']}")
    
    return tests_failed == 0


def main():
    """Run all tests"""
    print("="*70)
    print("DigitalOcean RDP Reseller API Test Suite")
    print("="*70)
    print(f"Base URL: {BASE_URL}")
    print(f"Test RDP ID: {TEST_RDP_ID}")
    print(f"Environment: DEV SANDBOX (dry_run mode)")
    print("="*70)
    
    # Run all tests
    test_d1_password_reset()
    test_d2a_reinstall_ws2019()
    test_d2b_reinstall_invalid_os()
    test_d2c_reinstall_empty_body()
    test_d3_get_rdp_with_agent_online()
    test_auth_missing_key()
    test_not_found_password_reset()
    test_not_found_reinstall()
    test_regression_get_rdp_list()
    test_regression_get_rdp_plans()
    test_regression_get_account()
    test_auth_bearer_header()
    
    # Print summary
    all_passed = print_summary()
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
