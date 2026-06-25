#!/usr/bin/env python3
"""
Backend test for RDP purchase UX fixes - diagnostic endpoint verification
"""
import requests
import json
import sys

# Configuration
BACKEND_URL = "https://c02148ec-75bf-4762-a2ee-3f030a45e442.preview.emergentagent.com"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"
LANGUAGES = ["en", "fr", "zh", "hi"]

def test_base_api():
    """Test that base API endpoint is accessible"""
    print("\n" + "="*80)
    print("TEST: Base API Accessibility")
    print("="*80)
    try:
        response = requests.get(f"{BACKEND_URL}/api/", timeout=10)
        print(f"GET {BACKEND_URL}/api/")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("✅ PASS: Base API is accessible")
            return True
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_vps_flow_check_negative():
    """Test that endpoint returns 403 without proper key"""
    print("\n" + "="*80)
    print("TEST: Negative Case - Missing/Wrong Key")
    print("="*80)
    
    # Test without key
    try:
        response = requests.get(f"{BACKEND_URL}/api/admin/vps-flow-check?lang=en", timeout=10)
        print(f"GET {BACKEND_URL}/api/admin/vps-flow-check?lang=en (no key)")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 403:
            print("✅ PASS: Returns 403 without key")
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False
    
    # Test with wrong key
    try:
        response = requests.get(f"{BACKEND_URL}/api/admin/vps-flow-check?key=wrongkey&lang=en", timeout=10)
        print(f"\nGET {BACKEND_URL}/api/admin/vps-flow-check?key=wrongkey&lang=en")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 403:
            print("✅ PASS: Returns 403 with wrong key")
            return True
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_vps_flow_check_language(lang):
    """Test the vps-flow-check endpoint for a specific language"""
    print("\n" + "="*80)
    print(f"TEST: VPS Flow Check - Language: {lang.upper()}")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/admin/vps-flow-check?key={ADMIN_KEY}&lang={lang}"
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        # Assertion (a): HTTP 200 JSON
        if response.status_code != 200:
            print(f"❌ FAIL (a): Expected 200, got {response.status_code}")
            return False
        print("✅ PASS (a): HTTP 200")
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ FAIL (a): Response is not valid JSON: {e}")
            return False
        print("✅ PASS (a): Valid JSON response")
        
        print("\n--- Response Data ---")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        all_passed = True
        
        # Assertion (b): paymentRecieved.rdp contains "RDP" and NOT "VPS"; paymentRecieved.vps contains "VPS"
        print("\n--- Assertion (b): paymentRecieved wording ---")
        if "paymentRecieved" not in data:
            print("❌ FAIL (b): paymentRecieved not in response")
            all_passed = False
        else:
            pr = data["paymentRecieved"]
            
            # Check if it's a raw key string (failure case)
            if isinstance(pr.get("rdp"), str) and ("vp.paymentRecieved" in pr.get("rdp", "") or "t.paymentRecieved" in pr.get("rdp", "")):
                print(f"❌ FAIL (b): paymentRecieved.rdp is a raw i18n key: {pr.get('rdp')}")
                all_passed = False
            elif "rdp" in pr:
                rdp_text = pr["rdp"]
                has_rdp = "RDP" in rdp_text
                has_vps = "VPS" in rdp_text
                print(f"  paymentRecieved.rdp contains 'RDP': {has_rdp}")
                print(f"  paymentRecieved.rdp contains 'VPS': {has_vps}")
                if has_rdp and not has_vps:
                    print("✅ PASS (b): paymentRecieved.rdp has 'RDP' and NOT 'VPS'")
                else:
                    print(f"❌ FAIL (b): paymentRecieved.rdp - expected RDP without VPS")
                    all_passed = False
            else:
                print("❌ FAIL (b): paymentRecieved.rdp not found")
                all_passed = False
            
            if isinstance(pr.get("vps"), str) and ("vp.paymentRecieved" in pr.get("vps", "") or "t.paymentRecieved" in pr.get("vps", "")):
                print(f"❌ FAIL (b): paymentRecieved.vps is a raw i18n key: {pr.get('vps')}")
                all_passed = False
            elif "vps" in pr:
                vps_text = pr["vps"]
                has_vps = "VPS" in vps_text
                print(f"  paymentRecieved.vps contains 'VPS': {has_vps}")
                if has_vps:
                    print("✅ PASS (b): paymentRecieved.vps has 'VPS'")
                else:
                    print(f"❌ FAIL (b): paymentRecieved.vps - expected VPS")
                    all_passed = False
            else:
                print("❌ FAIL (b): paymentRecieved.vps not found")
                all_passed = False
        
        # Assertion (c): paymentRecievedHasEmailWording == false
        print("\n--- Assertion (c): paymentRecievedHasEmailWording ---")
        if "paymentRecievedHasEmailWording" not in data:
            print("❌ FAIL (c): paymentRecievedHasEmailWording not in response")
            all_passed = False
        else:
            has_email = data["paymentRecievedHasEmailWording"]
            print(f"  paymentRecievedHasEmailWording: {has_email}")
            if has_email == False:
                print("✅ PASS (c): paymentRecievedHasEmailWording is false")
            else:
                print(f"❌ FAIL (c): Expected false, got {has_email}")
                all_passed = False
        
        # Assertion (d): vps_5d.rdp starts with "Your RDP is ready!"; vps_5d.vps with "Your VPS is ready!"
        print("\n--- Assertion (d): vps_5d headers ---")
        if "vps_5d" not in data:
            print("❌ FAIL (d): vps_5d not in response")
            all_passed = False
        else:
            vps_5d = data["vps_5d"]
            
            # Check if it's a raw key string (failure case)
            if isinstance(vps_5d.get("rdp"), str) and ("t.vps_5d" in vps_5d.get("rdp", "") or "vp.vps_5d" in vps_5d.get("rdp", "")):
                print(f"❌ FAIL (d): vps_5d.rdp is a raw i18n key: {vps_5d.get('rdp')}")
                all_passed = False
            elif "rdp" in vps_5d:
                rdp_text = vps_5d["rdp"]
                # Check for the header pattern (allowing for emoji and HTML)
                if "Your RDP is ready!" in rdp_text or "RDP is ready!" in rdp_text:
                    print(f"✅ PASS (d): vps_5d.rdp starts with RDP ready header")
                else:
                    print(f"❌ FAIL (d): vps_5d.rdp doesn't start with expected RDP header")
                    print(f"  First 100 chars: {rdp_text[:100]}")
                    all_passed = False
            else:
                print("❌ FAIL (d): vps_5d.rdp not found")
                all_passed = False
            
            if isinstance(vps_5d.get("vps"), str) and ("t.vps_5d" in vps_5d.get("vps", "") or "vp.vps_5d" in vps_5d.get("vps", "")):
                print(f"❌ FAIL (d): vps_5d.vps is a raw i18n key: {vps_5d.get('vps')}")
                all_passed = False
            elif "vps" in vps_5d:
                vps_text = vps_5d["vps"]
                if "Your VPS is ready!" in vps_text or "VPS is ready!" in vps_text:
                    print(f"✅ PASS (d): vps_5d.vps starts with VPS ready header")
                else:
                    print(f"❌ FAIL (d): vps_5d.vps doesn't start with expected VPS header")
                    print(f"  First 100 chars: {vps_text[:100]}")
                    all_passed = False
            else:
                print("❌ FAIL (d): vps_5d.vps not found")
                all_passed = False
        
        # Assertion (e): vpsBoughtSuccess checks
        print("\n--- Assertion (e): vpsBoughtSuccess ---")
        if "vpsBoughtSuccess" not in data:
            print("❌ FAIL (e): vpsBoughtSuccess not in response")
            all_passed = False
        else:
            vbs = data["vpsBoughtSuccess"]
            
            # rdpHeaderSaysRDP
            if "rdpHeaderSaysRDP" in vbs:
                if vbs["rdpHeaderSaysRDP"] == True:
                    print(f"✅ PASS (e): rdpHeaderSaysRDP is true")
                else:
                    print(f"❌ FAIL (e): rdpHeaderSaysRDP is {vbs['rdpHeaderSaysRDP']}, expected true")
                    all_passed = False
            else:
                print("❌ FAIL (e): rdpHeaderSaysRDP not found")
                all_passed = False
            
            # vpsHeaderSaysVPS
            if "vpsHeaderSaysVPS" in vbs:
                if vbs["vpsHeaderSaysVPS"] == True:
                    print(f"✅ PASS (e): vpsHeaderSaysVPS is true")
                else:
                    print(f"❌ FAIL (e): vpsHeaderSaysVPS is {vbs['vpsHeaderSaysVPS']}, expected true")
                    all_passed = False
            else:
                print("❌ FAIL (e): vpsHeaderSaysVPS not found")
                all_passed = False
            
            # rdpHasEmailWording
            if "rdpHasEmailWording" in vbs:
                if vbs["rdpHasEmailWording"] == False:
                    print(f"✅ PASS (e): rdpHasEmailWording is false")
                else:
                    print(f"❌ FAIL (e): rdpHasEmailWording is {vbs['rdpHasEmailWording']}, expected false")
                    all_passed = False
            else:
                print("❌ FAIL (e): rdpHasEmailWording not found")
                all_passed = False
            
            # rdpLength < 1200
            if "rdpLength" in vbs:
                rdp_len = vbs["rdpLength"]
                print(f"  rdpLength: {rdp_len}")
                if rdp_len < 1200:
                    print(f"✅ PASS (e): rdpLength ({rdp_len}) < 1200")
                else:
                    print(f"❌ FAIL (e): rdpLength ({rdp_len}) >= 1200")
                    all_passed = False
            else:
                print("❌ FAIL (e): rdpLength not found")
                all_passed = False
        
        # Assertion (f): priceRule checks
        print("\n--- Assertion (f): priceRule ---")
        if "priceRule" not in data:
            print("❌ FAIL (f): priceRule not in response")
            all_passed = False
        else:
            pr = data["priceRule"]
            
            # displayPrice == 90
            if "displayPrice" in pr:
                display_price = pr["displayPrice"]
                print(f"  displayPrice: {display_price}")
                if display_price == 90:
                    print(f"✅ PASS (f): displayPrice is 90")
                else:
                    print(f"❌ FAIL (f): displayPrice is {display_price}, expected 90")
                    all_passed = False
            else:
                print("❌ FAIL (f): displayPrice not found")
                all_passed = False
            
            # displayEqualsCharge == true
            if "displayEqualsCharge" in pr:
                equals_charge = pr["displayEqualsCharge"]
                print(f"  displayEqualsCharge: {equals_charge}")
                if equals_charge == True:
                    print(f"✅ PASS (f): displayEqualsCharge is true")
                else:
                    print(f"❌ FAIL (f): displayEqualsCharge is {equals_charge}, expected true")
                    all_passed = False
            else:
                print("❌ FAIL (f): displayEqualsCharge not found")
                all_passed = False
        
        if all_passed:
            print(f"\n✅ ALL ASSERTIONS PASSED for language: {lang.upper()}")
        else:
            print(f"\n❌ SOME ASSERTIONS FAILED for language: {lang.upper()}")
        
        return all_passed
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("="*80)
    print("RDP PURCHASE UX FIXES - BACKEND DIAGNOSTIC ENDPOINT TESTS")
    print("="*80)
    
    results = {}
    
    # Test base API
    results["base_api"] = test_base_api()
    
    # Test negative case
    results["negative_case"] = test_vps_flow_check_negative()
    
    # Test all languages
    for lang in LANGUAGES:
        results[f"lang_{lang}"] = test_vps_flow_check_language(lang)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("="*80)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
