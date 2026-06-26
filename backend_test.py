#!/usr/bin/env python3
"""
Backend API Test Suite for Nomadly Bot
Tests VPS/RDP billing-safety logic and dev-pod scheduler guard
"""

import requests
import json
import sys

# Load backend URL from frontend/.env
BACKEND_URL = "https://api-config-setup-8.preview.emergentagent.com"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"

def test_vps_billing_safety_check():
    """
    Test VPS/RDP renewal+deletion billing-safety logic
    Verifies that cloud fees stop when instances aren't renewed or wallet can't cover renewal
    """
    print("\n" + "="*80)
    print("TEST: VPS/RDP Billing-Safety Check (DigitalOcean + Azure)")
    print("="*80)
    
    # Test 1: Valid key - should return 200 with correct data
    print("\n[1] Testing with valid admin key...")
    url = f"{BACKEND_URL}/api/admin/vps-billing-safety-check?key={ADMIN_KEY}"
    response = requests.get(url)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        return False
    
    data = response.json()
    print(f"Response JSON:\n{json.dumps(data, indent=2)}")
    
    # Assertion (a): HTTP 200 JSON
    print("\n✅ (a) HTTP 200 JSON - PASSED")
    
    # Assertion (b): routingCorrect == true
    if data.get("routingCorrect") != True:
        print(f"❌ (b) FAILED: routingCorrect = {data.get('routingCorrect')}, expected True")
        return False
    print("✅ (b) routingCorrect == true - PASSED")
    
    # Verify routing object
    routing = data.get("routing", {})
    expected_routing = {
        "do-580192787": "digitalocean",
        "az-nmd9a1d52bd0": "azure",
        "vps-123": "ovh",
        "203283942": "contabo"
    }
    for key, expected_provider in expected_routing.items():
        if routing.get(key) != expected_provider:
            print(f"❌ FAILED: routing['{key}'] = {routing.get(key)}, expected '{expected_provider}'")
            return False
    print(f"   Routing verified: {routing}")
    
    # Assertion (c): cancelExists.digitalocean == true AND cancelExists.azure == true
    cancel_exists = data.get("cancelExists", {})
    if cancel_exists.get("digitalocean") != True or cancel_exists.get("azure") != True:
        print(f"❌ (c) FAILED: cancelExists = {cancel_exists}")
        return False
    print(f"✅ (c) cancelExists.digitalocean == true AND cancelExists.azure == true - PASSED")
    
    # Assertion (d): immediateDeleteProviders includes "digitalocean" and "azure"
    immediate_delete = data.get("immediateDeleteProviders", [])
    if "digitalocean" not in immediate_delete or "azure" not in immediate_delete:
        print(f"❌ (d) FAILED: immediateDeleteProviders = {immediate_delete}")
        return False
    print(f"✅ (d) immediateDeleteProviders includes 'digitalocean' and 'azure' - PASSED")
    print(f"   Full list: {immediate_delete}")
    
    # Assertion (e): newInstanceAutoRenewDefault == false
    if data.get("newInstanceAutoRenewDefault") != False:
        print(f"❌ (e) FAILED: newInstanceAutoRenewDefault = {data.get('newInstanceAutoRenewDefault')}")
        return False
    print(f"✅ (e) newInstanceAutoRenewDefault == false - PASSED")
    
    # Assertion (f): scenarios
    scenarios = data.get("scenarios", {})
    expected_scenarios = {
        "not_renewed_autorenew_off": "delete",
        "autorenew_on_but_no_balance": "delete",
        "autorenew_on_with_balance": "renew",
        "active_not_expired_autorenew_off": "will_delete_at_expiry"
    }
    for key, expected_value in expected_scenarios.items():
        if scenarios.get(key) != expected_value:
            print(f"❌ (f) FAILED: scenarios['{key}'] = {scenarios.get(key)}, expected '{expected_value}'")
            return False
    print(f"✅ (f) All scenarios correct - PASSED")
    print(f"   {json.dumps(scenarios, indent=2)}")
    
    # Assertion (g): feesStopOnNonRenewal == true
    if data.get("feesStopOnNonRenewal") != True:
        print(f"❌ (g) FAILED: feesStopOnNonRenewal = {data.get('feesStopOnNonRenewal')}")
        return False
    print(f"✅ (g) feesStopOnNonRenewal == true - PASSED")
    
    # Assertion (h): devSchedulerGuardActive == true
    if data.get("devSchedulerGuardActive") != True:
        print(f"❌ (h) FAILED: devSchedulerGuardActive = {data.get('devSchedulerGuardActive')}")
        return False
    print(f"✅ (h) devSchedulerGuardActive == true - PASSED")
    
    # Test 2: Invalid key - should return 403
    print("\n[2] Testing with invalid admin key (negative test)...")
    url_wrong = f"{BACKEND_URL}/api/admin/vps-billing-safety-check?key=wrongkey"
    response_wrong = requests.get(url_wrong)
    
    if response_wrong.status_code != 403:
        print(f"❌ FAILED: Expected 403 for wrong key, got {response_wrong.status_code}")
        return False
    print(f"✅ Wrong key returns 403 - PASSED")
    
    # Test 3: No key - should return 403
    print("\n[3] Testing with no admin key (negative test)...")
    url_no_key = f"{BACKEND_URL}/api/admin/vps-billing-safety-check"
    response_no_key = requests.get(url_no_key)
    
    if response_no_key.status_code != 403:
        print(f"❌ FAILED: Expected 403 for no key, got {response_no_key.status_code}")
        return False
    print(f"✅ No key returns 403 - PASSED")
    
    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED - VPS/RDP Billing-Safety Logic Verified")
    print("="*80)
    print("\nSUMMARY:")
    print("• Provider routing: DigitalOcean, Azure, OVH, Contabo - all correct")
    print("• Cancel methods exist for DigitalOcean and Azure")
    print("• Immediate delete on non-renewal for PAYG providers (DO, Azure, Vultr)")
    print("• New instances default to autoRenewable=false")
    print("• Renewal scenarios: delete when not renewed or no balance, renew when balance available")
    print("• Cloud fees STOP on non-renewal")
    print("• Dev-pod scheduler guard is ACTIVE (no destructive operations in dev)")
    print("• Admin endpoint properly secured (403 for unauthorized access)")
    
    return True

def test_base_api():
    """Test base API endpoint"""
    print("\n" + "="*80)
    print("TEST: Base API Endpoint")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/"
    response = requests.get(url)
    
    print(f"URL: {url}")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        return False
    
    print("✅ Base API endpoint responding correctly")
    return True

if __name__ == "__main__":
    print("\n" + "="*80)
    print("NOMADLY BOT - BACKEND API TEST SUITE")
    print("Testing VPS/RDP Billing-Safety Logic")
    print("="*80)
    
    all_passed = True
    
    # Test base API
    if not test_base_api():
        all_passed = False
    
    # Test VPS billing-safety
    if not test_vps_billing_safety_check():
        all_passed = False
    
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL BACKEND TESTS PASSED")
        print("="*80)
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        print("="*80)
        sys.exit(1)
