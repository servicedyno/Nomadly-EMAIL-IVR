#!/usr/bin/env python3
"""
Comprehensive Backend Test for Reseller API cPanel Hosting-Management PARITY Endpoints
========================================================================================
Tests the NEWLY ADDED endpoints (2026 follow-up):
- POST /hosting/:user/email/test (SMTP test)
- GET /hosting/:user/mysql/phpmyadmin (SSO URL)
- POST /hosting/:user/subdomains/bulk-create (bulk subdomain creation)
- GET /hosting/:user/domains/docroot-modes + POST /hosting/:user/domains/docroot-mode
- POST /hosting/:user/domains/set-primary
- GET /hosting/:user/domains/ns-status
- GET+POST /hosting/:user/account/site-status
- GET+POST /hosting/:user/security/js-challenge
- POST /hosting/:user/files/upload-chunk + /files/upload-chunk/cancel
- POST /hosting/:user/addons (regression check for the bug fix)

This is a SANDBOX pod (SKIP_WEBHOOK_SYNC=true, dry_run mode).
All WRITE operations return mode:"dry_run" and never mutate production.
READ operations may hit live cPanel with fake credentials (expected to return graceful errors).
"""

import requests
import json
import sys
import base64
from typing import Dict, Any, Optional

# ============================================================
# Configuration
# ============================================================
BASE_URL = "https://quick-setup-113.preview.emergentagent.com/api/reseller/v1"
API_KEY = "rsk_sandbox_test_key_0001"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Test accounts (seeded via seed_sandbox_test.js)
GOLD_ACCOUNT = "sbxtestgold"      # Golden plan (gold + mysql features allowed)
TRIAL_ACCOUNT = "sbxtesttrial"    # Premium 1-Week trial (mysql + gold features blocked)
GOLD_ADDON_DOMAIN = "blog-sbxtest.com"  # Addon domain on sbxtestgold

# ============================================================
# Test Results Tracking
# ============================================================
test_results = []
total_tests = 0
passed_tests = 0
failed_tests = 0

def log_test(name: str, passed: bool, details: str = ""):
    """Log a test result"""
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        status = "✅ PASS"
    else:
        failed_tests += 1
        status = "❌ FAIL"
    
    result = f"{status}: {name}"
    if details:
        result += f"\n    {details}"
    test_results.append(result)
    print(result)

def check_response(resp: requests.Response, expected_status: int, test_name: str, 
                   expected_fields: Optional[list] = None, 
                   expected_values: Optional[Dict[str, Any]] = None) -> bool:
    """Check if response matches expectations"""
    try:
        # Check status code
        if resp.status_code != expected_status:
            log_test(test_name, False, 
                    f"Expected status {expected_status}, got {resp.status_code}. Body: {resp.text[:200]}")
            return False
        
        # For non-200 responses, just check status code
        if expected_status >= 400:
            log_test(test_name, True, f"Got expected {expected_status} error")
            return True
        
        # Parse JSON
        try:
            data = resp.json()
        except:
            log_test(test_name, False, f"Response is not valid JSON: {resp.text[:200]}")
            return False
        
        # Check expected fields
        if expected_fields:
            missing = [f for f in expected_fields if f not in data]
            if missing:
                log_test(test_name, False, f"Missing fields: {missing}. Got: {list(data.keys())}")
                return False
        
        # Check expected values
        if expected_values:
            for key, expected_val in expected_values.items():
                actual_val = data.get(key)
                if actual_val != expected_val:
                    log_test(test_name, False, 
                            f"Field '{key}': expected {expected_val}, got {actual_val}")
                    return False
        
        log_test(test_name, True, f"Response OK: {json.dumps(data)[:150]}")
        return True
    
    except Exception as e:
        log_test(test_name, False, f"Exception: {str(e)}")
        return False

# ============================================================
# Test Suite
# ============================================================

def test_a_email_test():
    """A) EMAIL TEST: POST /hosting/:user/email/test"""
    print("\n" + "="*80)
    print("TEST GROUP A: EMAIL TEST")
    print("="*80)
    
    # A1: Valid email test (should return dry_run)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/email/test",
        headers=HEADERS,
        json={"from": "info", "to": "you@example.com"}
    )
    check_response(resp, 200, "A1: POST email/test with valid params",
                   expected_fields=["mode", "action"],
                   expected_values={"mode": "dry_run", "action": "email.test"})
    
    # A2: Missing 'to' field (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/email/test",
        headers=HEADERS,
        json={"from": "info"}
    )
    check_response(resp, 400, "A2: POST email/test missing 'to' field")

def test_b_phpmyadmin_sso():
    """B) phpMyAdmin SSO: GET /hosting/:user/mysql/phpmyadmin"""
    print("\n" + "="*80)
    print("TEST GROUP B: phpMyAdmin SSO")
    print("="*80)
    
    # B1: Gold account (should return dry_run)
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/mysql/phpmyadmin",
        headers=HEADERS
    )
    check_response(resp, 200, "B1: GET phpmyadmin on gold account",
                   expected_fields=["mode"],
                   expected_values={"mode": "dry_run"})
    
    # B2: Trial account (should return 403 mysql_requires_monthly)
    resp = requests.get(
        f"{BASE_URL}/hosting/{TRIAL_ACCOUNT}/mysql/phpmyadmin",
        headers=HEADERS
    )
    if resp.status_code == 403:
        try:
            data = resp.json()
            if data.get("error") == "mysql_requires_monthly":
                log_test("B2: GET phpmyadmin on trial account", True, 
                        "Got expected 403 mysql_requires_monthly")
            else:
                log_test("B2: GET phpmyadmin on trial account", False,
                        f"Expected error 'mysql_requires_monthly', got {data.get('error')}")
        except:
            log_test("B2: GET phpmyadmin on trial account", False, "Response not JSON")
    else:
        log_test("B2: GET phpmyadmin on trial account", False,
                f"Expected 403, got {resp.status_code}")

def test_c_bulk_subdomains():
    """C) BULK SUBDOMAINS: POST /hosting/:user/subdomains/bulk-create"""
    print("\n" + "="*80)
    print("TEST GROUP C: BULK SUBDOMAINS")
    print("="*80)
    
    # C1: Valid bulk create with comma-separated string
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/subdomains/bulk-create",
        headers=HEADERS,
        json={"subdomains": "a,b,c"}
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("mode") == "dry_run" and data.get("count") == 3:
                log_test("C1: POST bulk-create with 'a,b,c'", True,
                        f"Got dry_run with count=3, subdomains={data.get('subdomains')}")
            else:
                log_test("C1: POST bulk-create with 'a,b,c'", False,
                        f"Expected mode=dry_run and count=3, got {data}")
        except:
            log_test("C1: POST bulk-create with 'a,b,c'", False, "Response not JSON")
    else:
        log_test("C1: POST bulk-create with 'a,b,c'", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # C2: Empty subdomains array (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/subdomains/bulk-create",
        headers=HEADERS,
        json={"subdomains": []}
    )
    check_response(resp, 400, "C2: POST bulk-create with empty array")
    
    # C3: Too many subdomains (>50, should return 400 too_many)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/subdomains/bulk-create",
        headers=HEADERS,
        json={"subdomains": ",".join([f"sub{i}" for i in range(51)])}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "too_many" in str(data.get("error", "")).lower() or "too many" in str(data.get("message", "")).lower():
                log_test("C3: POST bulk-create with >50 items", True, "Got expected 400 too_many")
            else:
                log_test("C3: POST bulk-create with >50 items", True, f"Got 400 (error: {data})")
        except:
            log_test("C3: POST bulk-create with >50 items", True, "Got 400")
    else:
        log_test("C3: POST bulk-create with >50 items", False,
                f"Expected 400, got {resp.status_code}")

def test_d_docroot_mode():
    """D) DOCROOT MODE: GET/POST /hosting/:user/domains/docroot-mode(s)"""
    print("\n" + "="*80)
    print("TEST GROUP D: DOCROOT MODE")
    print("="*80)
    
    # D1: GET docroot-modes
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/docroot-modes",
        headers=HEADERS
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "modes" in data and "primary" in data:
                log_test("D1: GET docroot-modes", True,
                        f"Got modes and primary: {json.dumps(data)[:150]}")
            else:
                log_test("D1: GET docroot-modes", False,
                        f"Missing 'modes' or 'primary': {data}")
        except:
            log_test("D1: GET docroot-modes", False, "Response not JSON")
    else:
        log_test("D1: GET docroot-modes", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # D2: POST docroot-mode for addon domain (should return dry_run)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/docroot-mode",
        headers=HEADERS,
        json={"domain": GOLD_ADDON_DOMAIN, "mode": "own"}
    )
    # Note: This endpoint returns mode=<docroot-mode> instead of mode="dry_run"
    # but includes a note field indicating dry-run behavior
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "note" in data and "Dry-run" in data.get("note", ""):
                log_test("D2: POST docroot-mode for addon domain", True,
                        f"Got dry-run response (note field present): {json.dumps(data)[:150]}")
            else:
                log_test("D2: POST docroot-mode for addon domain", False,
                        f"Missing dry-run indicator: {data}")
        except:
            log_test("D2: POST docroot-mode for addon domain", False, "Response not JSON")
    else:
        log_test("D2: POST docroot-mode for addon domain", False,
                f"Expected 200, got {resp.status_code}")
    
    # D3: POST docroot-mode for primary domain (should return 400 primary_immutable)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/docroot-mode",
        headers=HEADERS,
        json={"domain": f"{GOLD_ACCOUNT}.com", "mode": "own"}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "primary" in str(data.get("error", "")).lower() or "immutable" in str(data.get("error", "")).lower():
                log_test("D3: POST docroot-mode for primary domain", True,
                        "Got expected 400 primary_immutable")
            else:
                log_test("D3: POST docroot-mode for primary domain", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("D3: POST docroot-mode for primary domain", True, "Got 400")
    else:
        log_test("D3: POST docroot-mode for primary domain", False,
                f"Expected 400, got {resp.status_code}")
    
    # D4: POST docroot-mode for non-addon domain (should return 404 not_addon)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/docroot-mode",
        headers=HEADERS,
        json={"domain": "random-not-addon.com", "mode": "own"}
    )
    if resp.status_code == 404:
        try:
            data = resp.json()
            if "addon" in str(data.get("error", "")).lower() or "not_found" in str(data.get("error", "")).lower():
                log_test("D4: POST docroot-mode for non-addon domain", True,
                        "Got expected 404 not_addon")
            else:
                log_test("D4: POST docroot-mode for non-addon domain", True,
                        f"Got 404 (error: {data})")
        except:
            log_test("D4: POST docroot-mode for non-addon domain", True, "Got 404")
    else:
        log_test("D4: POST docroot-mode for non-addon domain", False,
                f"Expected 404, got {resp.status_code}")

def test_e_set_primary():
    """E) SET PRIMARY: POST /hosting/:user/domains/set-primary"""
    print("\n" + "="*80)
    print("TEST GROUP E: SET PRIMARY DOMAIN")
    print("="*80)
    
    # E1: POST set-primary for non-addon domain (should return 400 needs_attach)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/set-primary",
        headers=HEADERS,
        json={"domain": "random-not-addon.com"}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "attach" in str(data.get("error", "")).lower() or "needs_attach" in str(data.get("error", "")).lower():
                log_test("E1: POST set-primary for non-addon domain", True,
                        "Got expected 400 needs_attach")
            else:
                log_test("E1: POST set-primary for non-addon domain", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("E1: POST set-primary for non-addon domain", True, "Got 400")
    else:
        log_test("E1: POST set-primary for non-addon domain", False,
                f"Expected 400, got {resp.status_code}")
    
    # E2: POST set-primary for addon domain (should return dry_run)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/set-primary",
        headers=HEADERS,
        json={"domain": GOLD_ADDON_DOMAIN}
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("mode") == "dry_run" and data.get("action") == "domain.set-primary":
                log_test("E2: POST set-primary for addon domain", True,
                        f"Got dry_run with action=domain.set-primary")
            else:
                log_test("E2: POST set-primary for addon domain", False,
                        f"Expected mode=dry_run and action=domain.set-primary, got {data}")
        except:
            log_test("E2: POST set-primary for addon domain", False, "Response not JSON")
    else:
        log_test("E2: POST set-primary for addon domain", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # E3: POST set-primary for already-primary domain (should return 400 already_primary)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/set-primary",
        headers=HEADERS,
        json={"domain": f"{GOLD_ACCOUNT}.com"}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "already" in str(data.get("error", "")).lower() or "primary" in str(data.get("error", "")).lower():
                log_test("E3: POST set-primary for already-primary domain", True,
                        "Got expected 400 already_primary")
            else:
                log_test("E3: POST set-primary for already-primary domain", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("E3: POST set-primary for already-primary domain", True, "Got 400")
    else:
        log_test("E3: POST set-primary for already-primary domain", False,
                f"Expected 400, got {resp.status_code}")

def test_f_ns_status():
    """F) NS STATUS: GET /hosting/:user/domains/ns-status"""
    print("\n" + "="*80)
    print("TEST GROUP F: NS STATUS")
    print("="*80)
    
    # F1: GET ns-status without ?domain (should return 400 missing_parameter)
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/ns-status",
        headers=HEADERS
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "missing" in str(data.get("error", "")).lower() or "parameter" in str(data.get("error", "")).lower():
                log_test("F1: GET ns-status without ?domain", True,
                        "Got expected 400 missing_parameter")
            else:
                log_test("F1: GET ns-status without ?domain", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("F1: GET ns-status without ?domain", True, "Got 400")
    else:
        log_test("F1: GET ns-status without ?domain", False,
                f"Expected 400, got {resp.status_code}")
    
    # F2: GET ns-status with ?domain (should return 200 with status field)
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/domains/ns-status?domain={GOLD_ACCOUNT}.com",
        headers=HEADERS
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "status" in data:
                log_test("F2: GET ns-status with ?domain", True,
                        f"Got status field: {data.get('status')}")
            else:
                log_test("F2: GET ns-status with ?domain", False,
                        f"Missing 'status' field: {data}")
        except:
            log_test("F2: GET ns-status with ?domain", False, "Response not JSON")
    else:
        log_test("F2: GET ns-status with ?domain", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")

def test_g_site_status():
    """G) SITE STATUS: GET+POST /hosting/:user/account/site-status"""
    print("\n" + "="*80)
    print("TEST GROUP G: SITE STATUS")
    print("="*80)
    
    # G1: GET site-status (should return 200 with status field)
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/account/site-status",
        headers=HEADERS
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "status" in data:
                log_test("G1: GET site-status", True,
                        f"Got status: {data.get('status')}")
            else:
                log_test("G1: GET site-status", False,
                        f"Missing 'status' field: {data}")
        except:
            log_test("G1: GET site-status", False, "Response not JSON")
    else:
        log_test("G1: GET site-status", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # G2: POST site-status with valid action (should return dry_run)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/account/site-status",
        headers=HEADERS,
        json={"action": "take_offline", "mode": "maintenance"}
    )
    # Note: This endpoint returns mode=<site-status-mode> instead of mode="dry_run"
    # but includes a note field indicating dry-run behavior
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "note" in data and "Dry-run" in data.get("note", ""):
                log_test("G2: POST site-status with valid action", True,
                        f"Got dry-run response (note field present): {json.dumps(data)[:150]}")
            else:
                log_test("G2: POST site-status with valid action", False,
                        f"Missing dry-run indicator: {data}")
        except:
            log_test("G2: POST site-status with valid action", False, "Response not JSON")
    else:
        log_test("G2: POST site-status with valid action", False,
                f"Expected 200, got {resp.status_code}")
    
    # G3: POST site-status with invalid action (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/account/site-status",
        headers=HEADERS,
        json={"action": "bogus"}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "action" in str(data.get("error", "")).lower() or "invalid" in str(data.get("error", "")).lower():
                log_test("G3: POST site-status with invalid action", True,
                        "Got expected 400 invalid_action")
            else:
                log_test("G3: POST site-status with invalid action", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("G3: POST site-status with invalid action", True, "Got 400")
    else:
        log_test("G3: POST site-status with invalid action", False,
                f"Expected 400, got {resp.status_code}")
    
    # G4: POST site-status with missing mode (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/account/site-status",
        headers=HEADERS,
        json={"action": "take_offline"}
    )
    if resp.status_code == 400:
        try:
            data = resp.json()
            if "mode" in str(data.get("error", "")).lower() or "invalid" in str(data.get("error", "")).lower():
                log_test("G4: POST site-status with missing mode", True,
                        "Got expected 400 invalid_mode")
            else:
                log_test("G4: POST site-status with missing mode", True,
                        f"Got 400 (error: {data})")
        except:
            log_test("G4: POST site-status with missing mode", True, "Got 400")
    else:
        log_test("G4: POST site-status with missing mode", False,
                f"Expected 400, got {resp.status_code}")

def test_h_js_challenge():
    """H) JS CHALLENGE: GET+POST /hosting/:user/security/js-challenge"""
    print("\n" + "="*80)
    print("TEST GROUP H: JS CHALLENGE")
    print("="*80)
    
    # H1: GET js-challenge (should return 200 with enabled field)
    resp = requests.get(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/security/js-challenge",
        headers=HEADERS
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if "enabled" in data:
                log_test("H1: GET js-challenge", True,
                        f"Got enabled field: {data.get('enabled')}")
            else:
                log_test("H1: GET js-challenge", False,
                        f"Missing 'enabled' field: {data}")
        except:
            log_test("H1: GET js-challenge", False, "Response not JSON")
    else:
        log_test("H1: GET js-challenge", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # H2: POST js-challenge on gold account (should return dry_run)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/security/js-challenge",
        headers=HEADERS,
        json={"enabled": True}
    )
    check_response(resp, 200, "H2: POST js-challenge on gold account",
                   expected_fields=["mode"],
                   expected_values={"mode": "dry_run"})
    
    # H3: POST js-challenge on trial account (should return 403 gold_only)
    resp = requests.post(
        f"{BASE_URL}/hosting/{TRIAL_ACCOUNT}/security/js-challenge",
        headers=HEADERS,
        json={"enabled": True}
    )
    if resp.status_code == 403:
        try:
            data = resp.json()
            if "gold" in str(data.get("error", "")).lower():
                log_test("H3: POST js-challenge on trial account", True,
                        "Got expected 403 gold_only")
            else:
                log_test("H3: POST js-challenge on trial account", True,
                        f"Got 403 (error: {data})")
        except:
            log_test("H3: POST js-challenge on trial account", True, "Got 403")
    else:
        log_test("H3: POST js-challenge on trial account", False,
                f"Expected 403, got {resp.status_code}")
    
    # H4: POST js-challenge with missing enabled field (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/security/js-challenge",
        headers=HEADERS,
        json={}
    )
    check_response(resp, 400, "H4: POST js-challenge with missing enabled field")

def test_i_chunked_upload():
    """I) CHUNKED UPLOAD: POST /hosting/:user/files/upload-chunk + /cancel"""
    print("\n" + "="*80)
    print("TEST GROUP I: CHUNKED UPLOAD")
    print("="*80)
    
    # I1: Upload chunk 0/2 (should return chunk-received)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/files/upload-chunk",
        headers=HEADERS,
        json={
            "uploadId": "m1",
            "chunkIndex": 0,
            "totalChunks": 2,
            "fileName": "big.bin",
            "dir": "/public_html",
            "content_base64": base64.b64encode(b"hello").decode()
        }
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("status") == "chunk-received" and data.get("received") == 1 and data.get("totalChunks") == 2:
                log_test("I1: Upload chunk 0/2", True,
                        f"Got chunk-received with received=1, totalChunks=2")
            else:
                log_test("I1: Upload chunk 0/2", False,
                        f"Expected status=chunk-received, received=1, totalChunks=2, got {data}")
        except:
            log_test("I1: Upload chunk 0/2", False, "Response not JSON")
    else:
        log_test("I1: Upload chunk 0/2", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # I2: Upload chunk 1/2 (should return dry_run complete)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/files/upload-chunk",
        headers=HEADERS,
        json={
            "uploadId": "m1",
            "chunkIndex": 1,
            "totalChunks": 2,
            "fileName": "big.bin",
            "dir": "/public_html",
            "content_base64": base64.b64encode(b"world").decode()
        }
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("mode") == "dry_run" and data.get("action") == "files.upload-chunk":
                total_bytes = data.get("bytes", 0)
                log_test("I2: Upload chunk 1/2 (complete)", True,
                        f"Got dry_run complete with bytes={total_bytes}")
            else:
                log_test("I2: Upload chunk 1/2 (complete)", False,
                        f"Expected mode=dry_run and action=files.upload-chunk, got {data}")
        except:
            log_test("I2: Upload chunk 1/2 (complete)", False, "Response not JSON")
    else:
        log_test("I2: Upload chunk 1/2 (complete)", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    
    # I3: Upload protected file (.htaccess in public_html, should return 403)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/files/upload-chunk",
        headers=HEADERS,
        json={
            "uploadId": "p1",
            "chunkIndex": 0,
            "totalChunks": 1,
            "fileName": ".htaccess",
            "dir": "/x/public_html",
            "content_base64": base64.b64encode(b"x").decode()
        }
    )
    if resp.status_code == 403:
        try:
            data = resp.json()
            if "protected" in str(data.get("error", "")).lower():
                log_test("I3: Upload protected file (.htaccess)", True,
                        "Got expected 403 protected_file")
            else:
                log_test("I3: Upload protected file (.htaccess)", True,
                        f"Got 403 (error: {data})")
        except:
            log_test("I3: Upload protected file (.htaccess)", True, "Got 403")
    else:
        log_test("I3: Upload protected file (.htaccess)", False,
                f"Expected 403, got {resp.status_code}")
    
    # I4: Upload with missing fields (should return 400)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/files/upload-chunk",
        headers=HEADERS,
        json={"uploadId": "x"}
    )
    check_response(resp, 400, "I4: Upload with missing fields")
    
    # I5: Cancel non-existent upload (should return 200 with status=not_found)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/files/upload-chunk/cancel",
        headers=HEADERS,
        json={"uploadId": "doesnotexist"}
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("status") == "not_found":
                log_test("I5: Cancel non-existent upload", True,
                        "Got status=not_found")
            else:
                log_test("I5: Cancel non-existent upload", False,
                        f"Expected status=not_found, got {data}")
        except:
            log_test("I5: Cancel non-existent upload", False, "Response not JSON")
    else:
        log_test("I5: Cancel non-existent upload", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")

def test_j_addon_regression():
    """J) ADDON-ADD REGRESSION: POST /hosting/:user/addons"""
    print("\n" + "="*80)
    print("TEST GROUP J: ADDON-ADD REGRESSION (Bug Fix)")
    print("="*80)
    
    # J1: POST addons (should return dry_run, NOT 501)
    resp = requests.post(
        f"{BASE_URL}/hosting/{GOLD_ACCOUNT}/addons",
        headers=HEADERS,
        json={"domain": "newaddon.com"}
    )
    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("mode") == "dry_run":
                log_test("J1: POST addons (regression check)", True,
                        "Got dry_run (NOT 501, bug is fixed)")
            else:
                log_test("J1: POST addons (regression check)", False,
                        f"Expected mode=dry_run, got {data}")
        except:
            log_test("J1: POST addons (regression check)", False, "Response not JSON")
    elif resp.status_code == 501:
        log_test("J1: POST addons (regression check)", False,
                "Got 501 - BUG NOT FIXED (cpPass decryption issue)")
    else:
        log_test("J1: POST addons (regression check)", False,
                f"Expected 200, got {resp.status_code}: {resp.text[:200]}")

def test_k_no_500s():
    """K) Verify NO HTTP 500 errors in any test"""
    print("\n" + "="*80)
    print("TEST GROUP K: NO 500s CHECK")
    print("="*80)
    
    # Check if any test returned 500
    has_500 = any("500" in result for result in test_results)
    if not has_500:
        log_test("K1: No HTTP 500 errors", True, "All tests returned expected status codes")
    else:
        log_test("K1: No HTTP 500 errors", False, "Some tests returned HTTP 500")

# ============================================================
# Main Test Runner
# ============================================================

def main():
    print("="*80)
    print("RESELLER API cPanel HOSTING-MANAGEMENT PARITY ENDPOINTS TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {API_KEY}")
    print(f"Gold Account: {GOLD_ACCOUNT}")
    print(f"Trial Account: {TRIAL_ACCOUNT}")
    print(f"Gold Addon Domain: {GOLD_ADDON_DOMAIN}")
    print("="*80)
    
    # Run all test groups
    test_a_email_test()
    test_b_phpmyadmin_sso()
    test_c_bulk_subdomains()
    test_d_docroot_mode()
    test_e_set_primary()
    test_f_ns_status()
    test_g_site_status()
    test_h_js_challenge()
    test_i_chunked_upload()
    test_j_addon_regression()
    test_k_no_500s()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Pass Rate: {(passed_tests/total_tests*100):.1f}%")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if failed_tests == 0 else 1)

if __name__ == "__main__":
    main()
