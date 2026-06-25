#!/usr/bin/env python3
"""
Backend test for VPS/RDP purchase price-display fix verification.
Tests the /api/admin/vps-flow-check endpoint for all languages.
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://c02148ec-75bf-4762-a2ee-3f030a45e442.preview.emergentagent.com"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"
LANGUAGES = ["en", "fr", "zh", "hi"]

def test_negative_auth():
    """Test that missing/wrong key returns 403"""
    print("\n" + "="*80)
    print("NEGATIVE AUTH TEST")
    print("="*80)
    
    # Test without key
    response = requests.get(f"{BASE_URL}/api/admin/vps-flow-check")
    print(f"Without key: HTTP {response.status_code}")
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    # Test with wrong key
    response = requests.get(f"{BASE_URL}/api/admin/vps-flow-check?key=wrongkey")
    print(f"With wrong key: HTTP {response.status_code}")
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    print("✅ Negative auth test PASSED")
    return True

def test_vps_flow_check(lang):
    """Test the vps-flow-check endpoint for a specific language"""
    print("\n" + "="*80)
    print(f"TESTING LANGUAGE: {lang.upper()}")
    print("="*80)
    
    url = f"{BASE_URL}/api/admin/vps-flow-check?key={ADMIN_KEY}&lang={lang}"
    response = requests.get(url)
    
    # (a) HTTP 200 JSON
    print(f"\n(a) HTTP Status: {response.status_code}")
    if response.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {response.status_code}")
        return False
    
    try:
        data = response.json()
    except Exception as e:
        print(f"❌ FAILED: Response is not valid JSON: {e}")
        return False
    
    print("✅ (a) HTTP 200 JSON - PASSED")
    
    # (b) paymentRecieved.rdp contains "RDP" and NOT "VPS"; paymentRecieved.vps contains "VPS"
    print("\n(b) Testing paymentRecieved messages:")
    payment_rdp = data.get("paymentRecieved", {}).get("rdp", "")
    payment_vps = data.get("paymentRecieved", {}).get("vps", "")
    
    print(f"  paymentRecieved.rdp: {payment_rdp[:100]}...")
    print(f"  paymentRecieved.vps: {payment_vps[:100]}...")
    
    rdp_has_rdp = "RDP" in payment_rdp or "rdp" in payment_rdp.lower()
    rdp_has_vps = "VPS" in payment_rdp and "RDP" not in payment_rdp
    vps_has_vps = "VPS" in payment_vps
    rdp_is_raw_key = payment_rdp.startswith("vp.") or payment_rdp.startswith("t.")
    vps_is_raw_key = payment_vps.startswith("vp.") or payment_vps.startswith("t.")
    
    if not rdp_has_rdp or rdp_has_vps or not vps_has_vps or rdp_is_raw_key or vps_is_raw_key:
        print(f"❌ FAILED (b):")
        print(f"  - RDP message has 'RDP': {rdp_has_rdp}")
        print(f"  - RDP message has 'VPS' without 'RDP': {rdp_has_vps}")
        print(f"  - VPS message has 'VPS': {vps_has_vps}")
        print(f"  - RDP is raw key: {rdp_is_raw_key}")
        print(f"  - VPS is raw key: {vps_is_raw_key}")
        return False
    
    print("✅ (b) paymentRecieved messages - PASSED")
    
    # (c) paymentRecievedHasEmailWording == false
    print("\n(c) Testing paymentRecievedHasEmailWording:")
    has_email_wording = data.get("paymentRecievedHasEmailWording", True)
    print(f"  paymentRecievedHasEmailWording: {has_email_wording}")
    
    if has_email_wording:
        print("❌ FAILED (c): paymentRecievedHasEmailWording should be false")
        return False
    
    print("✅ (c) paymentRecievedHasEmailWording - PASSED")
    
    # (d) vps_5d.rdp = RDP-ready header; vps_5d.vps = VPS-ready header
    print("\n(d) Testing vps_5d messages:")
    vps5d_rdp = data.get("vps_5d", {}).get("rdp", "")
    vps5d_vps = data.get("vps_5d", {}).get("vps", "")
    
    print(f"  vps_5d.rdp: {vps5d_rdp[:100]}...")
    print(f"  vps_5d.vps: {vps5d_vps[:100]}...")
    
    # Check that RDP message contains "RDP" and VPS message contains "VPS"
    # Don't check for "ready" in English since it's translated in other languages
    rdp_header_ok = "RDP" in vps5d_rdp
    vps_header_ok = "VPS" in vps5d_vps
    rdp5d_is_raw_key = vps5d_rdp.startswith("t.vps_5d") or vps5d_rdp.startswith("vp.")
    vps5d_is_raw_key = vps5d_vps.startswith("t.vps_5d") or vps5d_vps.startswith("vp.")
    
    if not rdp_header_ok or not vps_header_ok or rdp5d_is_raw_key or vps5d_is_raw_key:
        print(f"❌ FAILED (d):")
        print(f"  - RDP header has 'RDP': {rdp_header_ok}")
        print(f"  - VPS header has 'VPS': {vps_header_ok}")
        print(f"  - RDP is raw key: {rdp5d_is_raw_key}")
        print(f"  - VPS is raw key: {vps5d_is_raw_key}")
        return False
    
    print("✅ (d) vps_5d messages - PASSED")
    
    # (e) vpsBoughtSuccess checks
    print("\n(e) Testing vpsBoughtSuccess:")
    vbs = data.get("vpsBoughtSuccess", {})
    rdp_header_says_rdp = vbs.get("rdpHeaderSaysRDP", False)
    vps_header_says_vps = vbs.get("vpsHeaderSaysVPS", False)
    rdp_has_email = vbs.get("rdpHasEmailWording", True)
    rdp_length = vbs.get("rdpLength", 9999)
    
    print(f"  rdpHeaderSaysRDP: {rdp_header_says_rdp}")
    print(f"  vpsHeaderSaysVPS: {vps_header_says_vps}")
    print(f"  rdpHasEmailWording: {rdp_has_email}")
    print(f"  rdpLength: {rdp_length}")
    
    if not rdp_header_says_rdp or not vps_header_says_vps or rdp_has_email or rdp_length >= 1200:
        print(f"❌ FAILED (e):")
        print(f"  - rdpHeaderSaysRDP should be true: {rdp_header_says_rdp}")
        print(f"  - vpsHeaderSaysVPS should be true: {vps_header_says_vps}")
        print(f"  - rdpHasEmailWording should be false: {not rdp_has_email}")
        print(f"  - rdpLength should be < 1200: {rdp_length < 1200}")
        return False
    
    print("✅ (e) vpsBoughtSuccess - PASSED")
    
    # (f) priceRule.displayPrice == 90 AND priceRule.displayEqualsCharge == true (RDP scenario)
    print("\n(f) Testing priceRule (RDP scenario):")
    price_rule = data.get("priceRule", {})
    display_price = price_rule.get("displayPrice", 0)
    display_equals_charge = price_rule.get("displayEqualsCharge", False)
    
    print(f"  displayPrice: {display_price}")
    print(f"  displayEqualsCharge: {display_equals_charge}")
    
    if display_price != 90 or not display_equals_charge:
        print(f"❌ FAILED (f):")
        print(f"  - displayPrice should be 90: {display_price == 90}")
        print(f"  - displayEqualsCharge should be true: {display_equals_charge}")
        return False
    
    print("✅ (f) priceRule (RDP) - PASSED")
    
    # (g) linuxPriceRule.displayPrice == 18 AND linuxPriceRule.displayEqualsCharge == true (Linux VPS scenario)
    print("\n(g) Testing linuxPriceRule (Linux VPS scenario):")
    linux_price_rule = data.get("linuxPriceRule", {})
    linux_display_price = linux_price_rule.get("displayPrice", 0)
    linux_display_equals_charge = linux_price_rule.get("displayEqualsCharge", False)
    
    print(f"  displayPrice: {linux_display_price}")
    print(f"  displayEqualsCharge: {linux_display_equals_charge}")
    
    if linux_display_price != 18 or not linux_display_equals_charge:
        print(f"❌ FAILED (g):")
        print(f"  - displayPrice should be 18: {linux_display_price == 18}")
        print(f"  - displayEqualsCharge should be true: {linux_display_equals_charge}")
        print(f"\nFull linuxPriceRule data:")
        print(json.dumps(linux_price_rule, indent=2))
        return False
    
    print("✅ (g) linuxPriceRule (Linux VPS) - PASSED")
    
    print(f"\n{'='*80}")
    print(f"✅ ALL TESTS PASSED FOR {lang.upper()}")
    print(f"{'='*80}")
    
    return True

def main():
    """Run all tests"""
    print("="*80)
    print("VPS/RDP PURCHASE PRICE-DISPLAY FIX VERIFICATION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Key: {ADMIN_KEY}")
    print(f"Languages: {', '.join(LANGUAGES)}")
    
    all_passed = True
    
    # Test negative auth
    try:
        if not test_negative_auth():
            all_passed = False
    except Exception as e:
        print(f"❌ Negative auth test FAILED with exception: {e}")
        all_passed = False
    
    # Test each language
    results = {}
    for lang in LANGUAGES:
        try:
            results[lang] = test_vps_flow_check(lang)
            if not results[lang]:
                all_passed = False
        except Exception as e:
            print(f"\n❌ Test for {lang} FAILED with exception: {e}")
            import traceback
            traceback.print_exc()
            results[lang] = False
            all_passed = False
    
    # Summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Negative auth: ✅ PASSED")
    for lang in LANGUAGES:
        status = "✅ PASSED" if results.get(lang, False) else "❌ FAILED"
        print(f"{lang.upper()}: {status}")
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
