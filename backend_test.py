#!/usr/bin/env python3
"""
Backend test for SMS-app bug fixes (group-B)
Tests both b1 (curl) and b2 (browser E2E with Playwright)
"""

import requests
import json
import time
from playwright.sync_api import sync_playwright, expect

# Read backend URL from frontend/.env
BACKEND_URL = "https://9301884d-aa88-496f-bcb1-99734d54ef54.preview.emergentagent.com"
ADMIN_KEY = "o%2FQb8ArGahlquhCQ"  # URL-encoded o/Qb8ArGahlquhCQ

def test_b1_curl_tests():
    """Test b1: SMS-app download link resolver (curl tests)"""
    print("\n" + "="*80)
    print("PART 1 - b1: SMS-app download link resolver (curl tests)")
    print("="*80)
    
    # TEST 1a: Self-test endpoint with admin key
    print("\n[TEST 1a] GET /api/admin/smsapp-fix-selftest?key=o%2FQb8ArGahlquhCQ")
    response = requests.get(f"{BACKEND_URL}/api/admin/smsapp-fix-selftest?key={ADMIN_KEY}")
    print(f"HTTP Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
        return False
    
    data = response.json()
    print(f"Response JSON:\n{json.dumps(data, indent=2)}")
    
    # Verify all checks passed
    if not data.get("ok"):
        print(f"❌ FAILED: ok field is not true")
        return False
    
    if data.get("passed") != 6 or data.get("total") != 6:
        print(f"❌ FAILED: Expected passed=6, total=6, got passed={data.get('passed')}, total={data.get('total')}")
        return False
    
    # Verify live field
    live_url = data.get("live", "")
    if not live_url.endswith("/sms-app/download"):
        print(f"❌ FAILED: live URL doesn't end with /sms-app/download: {live_url}")
        return False
    
    if "panel.1.hostbay.io" in live_url:
        print(f"❌ FAILED: live URL still points to panel host: {live_url}")
        return False
    
    if "nomadly-email-ivr-production.up.railway.app" not in live_url:
        print(f"❌ FAILED: live URL doesn't point to nomadly-email-ivr-production.up.railway.app: {live_url}")
        return False
    
    # Verify all 6 checks
    expected_checks = [
        "B1_panel_host_redirected",
        "B1_panel_prefix_redirected",
        "B1_good_link_preserved",
        "B1_empty_falls_back",
        "B1_live_not_panel",
        "B1_live_is_download_url"
    ]
    
    checks = data.get("checks", [])
    check_names = [c.get("name") for c in checks]
    
    for expected_name in expected_checks:
        if expected_name not in check_names:
            print(f"❌ FAILED: Missing check: {expected_name}")
            return False
        
        check = next(c for c in checks if c.get("name") == expected_name)
        if not check.get("pass"):
            print(f"❌ FAILED: Check {expected_name} did not pass")
            return False
    
    print("✅ TEST 1a PASSED: All 6 checks passed, live URL correct")
    
    # TEST 1b: Download info endpoint
    print("\n[TEST 1b] GET /api/sms-app/download/info")
    response = requests.get(f"{BACKEND_URL}/api/sms-app/download/info")
    print(f"HTTP Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
        return False
    
    data = response.json()
    print(f"Response JSON:\n{json.dumps(data, indent=2)}")
    
    if not data.get("available"):
        print(f"❌ FAILED: available field is not true")
        return False
    
    if data.get("name") != "Nomadly SMS":
        print(f"❌ FAILED: Expected name='Nomadly SMS', got '{data.get('name')}'")
        return False
    
    print("✅ TEST 1b PASSED: APK info correct")
    
    # TEST 1c: Auth guard (no key)
    print("\n[TEST 1c] GET /api/admin/smsapp-fix-selftest (no key)")
    response = requests.get(f"{BACKEND_URL}/api/admin/smsapp-fix-selftest")
    print(f"HTTP Status: {response.status_code}")
    
    if response.status_code != 403:
        print(f"❌ FAILED: Expected HTTP 403, got {response.status_code}")
        return False
    
    data = response.json()
    print(f"Response JSON:\n{json.dumps(data, indent=2)}")
    
    if data.get("error") != "Unauthorized":
        print(f"❌ FAILED: Expected error='Unauthorized', got '{data.get('error')}'")
        return False
    
    print("✅ TEST 1c PASSED: Auth guard works correctly")
    
    return True


def test_b2_browser_e2e():
    """Test b2: SMS web-app API client timeout (browser E2E with Playwright)"""
    print("\n" + "="*80)
    print("PART 2 - b2: SMS web-app API client timeout (browser E2E)")
    print("="*80)
    
    with sync_playwright() as p:
        # Launch browser
        print("\n[TEST 2] Opening browser and navigating to SMS web app...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 480, 'height': 900},
            user_agent='Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
        )
        page = context.new_page()
        
        try:
            # Navigate to SMS web app
            url = f"{BACKEND_URL}/api/sms-app-web"
            print(f"Navigating to: {url}")
            page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Wait for login screen to load
            print("Waiting for login screen to load...")
            page.wait_for_selector('#loginCode', timeout=10000)
            page.wait_for_selector('#loginBtn', timeout=10000)
            
            # Verify we're on the login screen
            login_screen = page.locator('#loginScreen')
            if not login_screen.is_visible():
                print("❌ FAILED: Login screen not visible")
                return False
            
            print("✅ Login screen loaded successfully")
            
            # Type invalid activation code
            print("\nTyping invalid activation code '9999999999' into #loginCode...")
            login_code_input = page.locator('#loginCode')
            login_code_input.fill('9999999999')
            
            # Click the Connect button
            print("Clicking #loginBtn ('Connect to Account')...")
            login_btn = page.locator('#loginBtn')
            
            # Verify button is initially enabled
            if login_btn.is_disabled():
                print("⚠️  WARNING: Login button is disabled before clicking")
            
            login_btn.click()
            
            # Wait up to 8 seconds for the error to appear
            print("Waiting up to 8 seconds for error message...")
            time.sleep(1)  # Give it a moment to start processing
            
            # Wait for loginError to become visible
            login_error = page.locator('#loginError')
            try:
                login_error.wait_for(state='visible', timeout=8000)
                print("✅ Login error element became visible")
            except Exception as e:
                print(f"❌ FAILED: Login error did not become visible within 8 seconds: {e}")
                return False
            
            # Get the error text
            error_text = login_error.text_content()
            print(f"\nError message text: '{error_text}'")
            
            if "Invalid activation code" not in error_text:
                print(f"❌ FAILED: Error text doesn't contain 'Invalid activation code'")
                return False
            
            print("✅ Error message contains 'Invalid activation code'")
            
            # Check if button is re-enabled
            print("\nChecking if #loginBtn is re-enabled...")
            is_disabled = login_btn.is_disabled()
            print(f"Button disabled state: {is_disabled}")
            
            if is_disabled:
                print("❌ FAILED: Login button is still disabled (hung in spinner state)")
                return False
            
            print("✅ Login button is re-enabled (not stuck)")
            
            # Verify still on login screen
            print("\nVerifying still on login screen...")
            if not login_screen.is_visible():
                print("❌ FAILED: No longer on login screen")
                return False
            
            # Check if loginScreen has 'active' class
            classes = login_screen.get_attribute('class') or ''
            if 'active' not in classes:
                print(f"⚠️  WARNING: loginScreen doesn't have 'active' class: '{classes}'")
            else:
                print("✅ loginScreen has 'active' class")
            
            print("\n✅ TEST 2 PASSED: No hang occurred, button re-enabled, error shown correctly")
            
            return True
            
        except Exception as e:
            print(f"\n❌ EXCEPTION during browser test: {e}")
            import traceback
            traceback.print_exc()
            return False
        finally:
            browser.close()


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("SMS-APP BUG FIXES VERIFICATION (group-B)")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Admin Key: {ADMIN_KEY}")
    
    # Run b1 curl tests
    b1_passed = test_b1_curl_tests()
    
    # Run b2 browser E2E test
    b2_passed = test_b2_browser_e2e()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"b1 (curl tests): {'✅ PASSED' if b1_passed else '❌ FAILED'}")
    print(f"b2 (browser E2E): {'✅ PASSED' if b2_passed else '❌ FAILED'}")
    
    if b1_passed and b2_passed:
        print("\n✅ ALL TESTS PASSED")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit(main())
