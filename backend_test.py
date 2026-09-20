#!/usr/bin/env python3
"""
Backend Test: Reseller API File Manager / SSL CPANEL_AUTH_FAILURE Fix
Bug: File Manager/SSL endpoints returned CPANEL_AUTH_FAILURE for accounts with stale passwords
Fix: Added WHM-root fallback mechanism (uapiViaWhmRoot + withCpAuthFallback)
"""

import requests
import json
import sys

# Base URL from frontend/.env
BASE_URL = "https://8634d267-73d5-41dc-811f-bd9cb39114dc.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api/reseller/v1"

# Test fixture API key (seeded for this bug fix)
API_KEY = "rsk_live_testfix_namea3a5_filemgr_ssl_2026"

# Test account (deliberately wrong cpPass to reproduce CPANEL_AUTH_FAILURE)
TEST_ACCOUNT = "namea3a5"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def log_test(test_num, description):
    print(f"\n{BLUE}[TEST {test_num}] {description}{RESET}")

def log_pass(message):
    print(f"  {GREEN}✅ {message}{RESET}")

def log_fail(message):
    print(f"  {RED}❌ {message}{RESET}")

def log_info(message):
    print(f"  {YELLOW}ℹ️  {message}{RESET}")

def make_request(method, endpoint, headers=None, json_data=None, params=None):
    """Make HTTP request and return response"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=15)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=15)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return resp
    except requests.exceptions.Timeout:
        log_fail(f"Request timeout after 15s")
        return None
    except Exception as e:
        log_fail(f"Request failed: {e}")
        return None

def test_file_manager_healed():
    """TEST 1: GET /hosting/namea3a5/files - should return healed listing via WHM-root fallback"""
    log_test(1, "GET /hosting/namea3a5/files (File Manager with stale password)")
    
    headers = {"X-API-Key": API_KEY}
    resp = make_request("GET", f"/hosting/{TEST_ACCOUNT}/files", headers=headers)
    
    if not resp:
        return False
    
    # Check HTTP status
    if resp.status_code != 200:
        log_fail(f"Expected HTTP 200, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code}")
    
    try:
        data = resp.json()
    except:
        log_fail("Response is not valid JSON")
        log_info(f"Response: {resp.text[:500]}")
        return False
    
    # Check for OLD broken shape (CPANEL_AUTH_FAILURE)
    if data.get("status") == 0 and data.get("code") == "CPANEL_AUTH_FAILURE":
        log_fail("STILL RETURNING CPANEL_AUTH_FAILURE - BUG NOT FIXED")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    
    # Check for NEW healed shape
    if data.get("status") != 1:
        log_fail(f"Expected status:1, got status:{data.get('status')}")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"status: {data.get('status')} (success)")
    
    # Check for data array (real directory listing)
    if "data" not in data or not isinstance(data["data"], list):
        log_fail("Missing or invalid 'data' array in response")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"data: array with {len(data['data'])} items (real directory listing)")
    
    # Check for healed flag
    if not data.get("healed"):
        log_fail("Missing 'healed:true' flag")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"healed: {data.get('healed')}")
    
    # Check for healed_via
    if data.get("healed_via") != "whm-root-uapi":
        log_fail(f"Expected healed_via:'whm-root-uapi', got '{data.get('healed_via')}'")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"healed_via: {data.get('healed_via')}")
    
    # Log some file names if available
    if data["data"]:
        file_names = [item.get("file", item.get("name", "?")) for item in data["data"][:3]]
        log_info(f"Sample files: {', '.join(file_names)}")
    
    log_pass("✅ TEST 1 PASSED: File Manager returns healed listing via WHM-root fallback")
    return True

def test_ssl_healed():
    """TEST 2: GET /hosting/namea3a5/ssl - should return healed SSL listing"""
    log_test(2, "GET /hosting/namea3a5/ssl (SSL with stale password)")
    
    headers = {"X-API-Key": API_KEY}
    resp = make_request("GET", f"/hosting/{TEST_ACCOUNT}/ssl", headers=headers)
    
    if not resp:
        return False
    
    # Check HTTP status
    if resp.status_code != 200:
        log_fail(f"Expected HTTP 200, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code}")
    
    try:
        data = resp.json()
    except:
        log_fail("Response is not valid JSON")
        log_info(f"Response: {resp.text[:500]}")
        return False
    
    # Check for OLD broken shape (CPANEL_AUTH_FAILURE)
    if data.get("status") == 0 and data.get("code") == "CPANEL_AUTH_FAILURE":
        log_fail("STILL RETURNING CPANEL_AUTH_FAILURE - BUG NOT FIXED")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    
    # Check for NEW healed shape
    if data.get("status") != 1:
        log_fail(f"Expected status:1, got status:{data.get('status')}")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"status: {data.get('status')} (success)")
    
    # Check for data (SSL listing)
    if "data" not in data:
        log_fail("Missing 'data' in response")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"data: present (SSL listing)")
    
    # Check for healed flag
    if not data.get("healed"):
        log_fail("Missing 'healed:true' flag")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"healed: {data.get('healed')}")
    
    # Check for SSL host namewords.sbs
    data_list = data["data"] if isinstance(data["data"], list) else []
    ssl_hosts = [item.get("servername", item.get("domain", "?")) for item in data_list]
    if "namewords.sbs" in ssl_hosts or any("namewords" in host for host in ssl_hosts):
        log_pass(f"SSL host found: namewords.sbs")
    else:
        log_info(f"SSL hosts: {ssl_hosts}")
    
    log_pass("✅ TEST 2 PASSED: SSL returns healed listing via WHM-root fallback")
    return True

def test_file_manager_path_alias():
    """TEST 3: GET /hosting/namea3a5/files?path=public_html - verify path alias works"""
    log_test(3, "GET /hosting/namea3a5/files?path=public_html (path alias)")
    
    headers = {"X-API-Key": API_KEY}
    resp = make_request("GET", f"/hosting/{TEST_ACCOUNT}/files", headers=headers, params={"path": "public_html"})
    
    if not resp:
        return False
    
    # Check HTTP status
    if resp.status_code != 200:
        log_fail(f"Expected HTTP 200, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code}")
    
    try:
        data = resp.json()
    except:
        log_fail("Response is not valid JSON")
        log_info(f"Response: {resp.text[:500]}")
        return False
    
    # Check for success
    if data.get("status") != 1:
        log_fail(f"Expected status:1, got status:{data.get('status')}")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"status: {data.get('status')} (success)")
    
    # Check for data array
    if "data" not in data or not isinstance(data["data"], list):
        log_fail("Missing or invalid 'data' array in response")
        return False
    log_pass(f"data: array with {len(data['data'])} items")
    
    log_pass("✅ TEST 3 PASSED: path alias works correctly")
    return True

def test_auth_guard_no_key():
    """TEST 4a: GET /hosting/namea3a5/files with NO key - should return 401"""
    log_test("4a", "GET /hosting/namea3a5/files (no API key)")
    
    resp = make_request("GET", f"/hosting/{TEST_ACCOUNT}/files")
    
    if not resp:
        return False
    
    if resp.status_code != 401:
        log_fail(f"Expected HTTP 401, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code} (Unauthorized)")
    
    log_pass("✅ TEST 4a PASSED: Auth guard rejects missing key")
    return True

def test_auth_guard_bogus_key():
    """TEST 4b: GET /hosting/namea3a5/files with BOGUS key - should return 401"""
    log_test("4b", "GET /hosting/namea3a5/files (bogus API key)")
    
    headers = {"X-API-Key": "rsk_live_bogus"}
    resp = make_request("GET", f"/hosting/{TEST_ACCOUNT}/files", headers=headers)
    
    if not resp:
        return False
    
    if resp.status_code != 401:
        log_fail(f"Expected HTTP 401, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code} (Unauthorized)")
    
    log_pass("✅ TEST 4b PASSED: Auth guard rejects bogus key")
    return True

def test_ownership_guard():
    """TEST 5: GET /hosting/doesnotexist/files - should return 404"""
    log_test(5, "GET /hosting/doesnotexist/files (unknown account)")
    
    headers = {"X-API-Key": API_KEY}
    resp = make_request("GET", f"/hosting/doesnotexist/files", headers=headers)
    
    if not resp:
        return False
    
    if resp.status_code != 404:
        log_fail(f"Expected HTTP 404, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code} (Not Found)")
    
    try:
        data = resp.json()
        if data.get("error") == "not_found":
            log_pass(f"error: {data.get('error')}")
    except:
        pass
    
    log_pass("✅ TEST 5 PASSED: Ownership guard rejects unknown account")
    return True

def test_write_dry_run():
    """TEST 6: POST /hosting/namea3a5/files/upload - should return dry_run"""
    log_test(6, "POST /hosting/namea3a5/files/upload (dry_run write)")
    
    headers = {"X-API-Key": API_KEY}
    payload = {
        "dir": f"/home/{TEST_ACCOUNT}/public_html",
        "fileName": "testfix.txt",
        "content_base64": "aGVsbG8="  # "hello" in base64
    }
    resp = make_request("POST", f"/hosting/{TEST_ACCOUNT}/files/upload", headers=headers, json_data=payload)
    
    if not resp:
        return False
    
    # Check HTTP status
    if resp.status_code != 200:
        log_fail(f"Expected HTTP 200, got {resp.status_code}")
        log_info(f"Response: {resp.text[:500]}")
        return False
    log_pass(f"HTTP status: {resp.status_code}")
    
    try:
        data = resp.json()
    except:
        log_fail("Response is not valid JSON")
        log_info(f"Response: {resp.text[:500]}")
        return False
    
    # Check for dry_run mode
    if data.get("mode") != "dry_run":
        log_fail(f"Expected mode:'dry_run', got mode:'{data.get('mode')}'")
        log_info(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    log_pass(f"mode: {data.get('mode')}")
    
    log_pass("✅ TEST 6 PASSED: Write operation correctly gated to dry_run")
    return True

def main():
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}BACKEND TEST: Reseller API File Manager / SSL CPANEL_AUTH_FAILURE Fix{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"\nBase URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Account: {TEST_ACCOUNT} (server 68.183.77.106, domain namewords.sbs)")
    print(f"Test Fixture: Account has DELIBERATELY WRONG cpPass to reproduce bug")
    print(f"Expected: WHM-root fallback should heal CPANEL_AUTH_FAILURE")
    
    results = []
    
    # Run all tests
    results.append(("TEST 1: File Manager healed listing", test_file_manager_healed()))
    results.append(("TEST 2: SSL healed listing", test_ssl_healed()))
    results.append(("TEST 3: File Manager path alias", test_file_manager_path_alias()))
    results.append(("TEST 4a: Auth guard (no key)", test_auth_guard_no_key()))
    results.append(("TEST 4b: Auth guard (bogus key)", test_auth_guard_bogus_key()))
    results.append(("TEST 5: Ownership guard", test_ownership_guard()))
    results.append(("TEST 6: Write dry_run", test_write_dry_run()))
    
    # Summary
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST SUMMARY{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{BLUE}Total: {passed}/{total} tests passed ({100*passed//total}%){RESET}")
    
    if passed == total:
        print(f"\n{GREEN}✅ ALL TESTS PASSED - BUG FIX VERIFIED{RESET}")
        print(f"{GREEN}The File Manager/SSL CPANEL_AUTH_FAILURE bug is FIXED.{RESET}")
        print(f"{GREEN}WHM-root fallback successfully heals stale password failures.{RESET}")
        return 0
    else:
        print(f"\n{RED}❌ SOME TESTS FAILED - BUG FIX NOT COMPLETE{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
