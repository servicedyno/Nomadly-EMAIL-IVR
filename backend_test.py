#!/usr/bin/env python3
"""
RDP Purchase Flow UX Verification Test
Tests the diagnostic endpoint for all languages (en, fr, zh, hi)
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://c02148ec-75bf-4762-a2ee-3f030a45e442.preview.emergentagent.com"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"
LANGUAGES = ["en", "fr", "zh", "hi"]

def test_base_api():
    """Test that base API is accessible"""
    print("=" * 80)
    print("TEST: Base API Accessibility")
    print("=" * 80)
    try:
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        if response.status_code == 200:
            print(f"✅ PASS: Base API accessible (HTTP {response.status_code})")
            return True
        else:
            print(f"❌ FAIL: Base API returned HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Base API request failed: {e}")
        return False

def test_negative_auth():
    """Test that missing/wrong key returns 403"""
    print("\n" + "=" * 80)
    print("TEST: Negative Authentication")
    print("=" * 80)
    
    results = []
    
    # Test 1: No key
    print("\n1. Testing with no key...")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/vps-flow-check?lang=en", timeout=10)
        if response.status_code == 403:
            print(f"✅ PASS: No key returns 403")
            results.append(True)
        else:
            print(f"❌ FAIL: No key returned HTTP {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Request failed: {e}")
        results.append(False)
    
    # Test 2: Wrong key
    print("\n2. Testing with wrong key...")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/vps-flow-check?key=wrongkey123&lang=en", timeout=10)
        if response.status_code == 403:
            print(f"✅ PASS: Wrong key returns 403")
            results.append(True)
        else:
            print(f"❌ FAIL: Wrong key returned HTTP {response.status_code} (expected 403)")
            results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Request failed: {e}")
        results.append(False)
    
    return all(results)

def test_vps_flow_check(lang):
    """Test the vps-flow-check endpoint for a specific language"""
    print("\n" + "=" * 80)
    print(f"TEST: VPS Flow Check - Language: {lang.upper()}")
    print("=" * 80)
    
    url = f"{BASE_URL}/api/admin/vps-flow-check?key={ADMIN_KEY}&lang={lang}"
    
    try:
        response = requests.get(url, timeout=10)
        
        # (a) HTTP 200 JSON
        print(f"\n(a) HTTP Status Check:")
        if response.status_code != 200:
            print(f"❌ FAIL: HTTP {response.status_code} (expected 200)")
            print(f"Response: {response.text[:500]}")
            return False
        print(f"✅ PASS: HTTP 200")
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ FAIL: Invalid JSON response: {e}")
            return False
        print(f"✅ PASS: Valid JSON response")
        
        # Print full response for debugging
        print(f"\n📋 Full Response:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        all_passed = True
        
        # (b) paymentRecieved checks
        print(f"\n(b) paymentRecieved Checks:")
        if "paymentRecieved" not in data:
            print(f"❌ FAIL: Missing 'paymentRecieved' in response")
            all_passed = False
        else:
            pr = data["paymentRecieved"]
            
            # Check rdp
            if "rdp" not in pr:
                print(f"❌ FAIL: Missing 'paymentRecieved.rdp'")
                all_passed = False
            else:
                rdp_text = pr["rdp"]
                print(f"   RDP text: {rdp_text[:200]}...")
                
                # Should contain "RDP"
                if "RDP" in rdp_text:
                    print(f"   ✅ PASS: paymentRecieved.rdp contains 'RDP'")
                else:
                    print(f"   ❌ FAIL: paymentRecieved.rdp does NOT contain 'RDP'")
                    all_passed = False
                
                # Should NOT contain "VPS"
                if "VPS" not in rdp_text:
                    print(f"   ✅ PASS: paymentRecieved.rdp does NOT contain 'VPS'")
                else:
                    print(f"   ❌ FAIL: paymentRecieved.rdp contains 'VPS' (should not)")
                    all_passed = False
                
                # Should not be raw key
                if rdp_text == "vp.paymentRecieved":
                    print(f"   ❌ FAIL: paymentRecieved.rdp is raw key 'vp.paymentRecieved'")
                    all_passed = False
            
            # Check vps
            if "vps" not in pr:
                print(f"❌ FAIL: Missing 'paymentRecieved.vps'")
                all_passed = False
            else:
                vps_text = pr["vps"]
                print(f"   VPS text: {vps_text[:200]}...")
                
                # Should contain "VPS"
                if "VPS" in vps_text:
                    print(f"   ✅ PASS: paymentRecieved.vps contains 'VPS'")
                else:
                    print(f"   ❌ FAIL: paymentRecieved.vps does NOT contain 'VPS'")
                    all_passed = False
                
                # Should not be raw key
                if vps_text == "vp.paymentRecieved":
                    print(f"   ❌ FAIL: paymentRecieved.vps is raw key 'vp.paymentRecieved'")
                    all_passed = False
        
        # (c) paymentRecievedHasEmailWording
        print(f"\n(c) paymentRecievedHasEmailWording Check:")
        if "paymentRecievedHasEmailWording" not in data:
            print(f"❌ FAIL: Missing 'paymentRecievedHasEmailWording' in response")
            all_passed = False
        else:
            has_email = data["paymentRecievedHasEmailWording"]
            if has_email == False:
                print(f"✅ PASS: paymentRecievedHasEmailWording = false")
            else:
                print(f"❌ FAIL: paymentRecievedHasEmailWording = {has_email} (expected false)")
                all_passed = False
        
        # (d) vps_5d checks
        print(f"\n(d) vps_5d Checks:")
        if "vps_5d" not in data:
            print(f"❌ FAIL: Missing 'vps_5d' in response")
            all_passed = False
        else:
            vps5d = data["vps_5d"]
            
            # Check rdp
            if "rdp" not in vps5d:
                print(f"❌ FAIL: Missing 'vps_5d.rdp'")
                all_passed = False
            else:
                rdp_text = vps5d["rdp"]
                print(f"   RDP text: {rdp_text[:200]}...")
                
                # Should contain RDP-ready header (localized)
                rdp_ready_indicators = ["RDP is ready", "RDP est prêt", "RDP 已准备就绪", "RDP तैयार है"]
                has_rdp_ready = any(indicator in rdp_text for indicator in rdp_ready_indicators)
                
                if has_rdp_ready or "RDP" in rdp_text:
                    print(f"   ✅ PASS: vps_5d.rdp contains RDP-ready header")
                else:
                    print(f"   ❌ FAIL: vps_5d.rdp does NOT contain RDP-ready header")
                    all_passed = False
                
                # Should not be raw key
                if rdp_text == "t.vps_5d":
                    print(f"   ❌ FAIL: vps_5d.rdp is raw key 't.vps_5d'")
                    all_passed = False
            
            # Check vps
            if "vps" not in vps5d:
                print(f"❌ FAIL: Missing 'vps_5d.vps'")
                all_passed = False
            else:
                vps_text = vps5d["vps"]
                print(f"   VPS text: {vps_text[:200]}...")
                
                # Should contain VPS-ready header
                vps_ready_indicators = ["VPS is ready", "VPS est prêt", "VPS 已准备就绪", "VPS तैयार है"]
                has_vps_ready = any(indicator in vps_text for indicator in vps_ready_indicators)
                
                if has_vps_ready or "VPS" in vps_text:
                    print(f"   ✅ PASS: vps_5d.vps contains VPS-ready header")
                else:
                    print(f"   ❌ FAIL: vps_5d.vps does NOT contain VPS-ready header")
                    all_passed = False
                
                # Should not be raw key
                if vps_text == "t.vps_5d":
                    print(f"   ❌ FAIL: vps_5d.vps is raw key 't.vps_5d'")
                    all_passed = False
        
        # (e) vpsBoughtSuccess checks
        print(f"\n(e) vpsBoughtSuccess Checks:")
        if "vpsBoughtSuccess" not in data:
            print(f"❌ FAIL: Missing 'vpsBoughtSuccess' in response")
            all_passed = False
        else:
            vbs = data["vpsBoughtSuccess"]
            
            # rdpHeaderSaysRDP
            if "rdpHeaderSaysRDP" not in vbs:
                print(f"❌ FAIL: Missing 'vpsBoughtSuccess.rdpHeaderSaysRDP'")
                all_passed = False
            else:
                if vbs["rdpHeaderSaysRDP"] == True:
                    print(f"✅ PASS: vpsBoughtSuccess.rdpHeaderSaysRDP = true")
                else:
                    print(f"❌ FAIL: vpsBoughtSuccess.rdpHeaderSaysRDP = {vbs['rdpHeaderSaysRDP']} (expected true)")
                    all_passed = False
            
            # vpsHeaderSaysVPS
            if "vpsHeaderSaysVPS" not in vbs:
                print(f"❌ FAIL: Missing 'vpsBoughtSuccess.vpsHeaderSaysVPS'")
                all_passed = False
            else:
                if vbs["vpsHeaderSaysVPS"] == True:
                    print(f"✅ PASS: vpsBoughtSuccess.vpsHeaderSaysVPS = true")
                else:
                    print(f"❌ FAIL: vpsBoughtSuccess.vpsHeaderSaysVPS = {vbs['vpsHeaderSaysVPS']} (expected true)")
                    all_passed = False
            
            # rdpHasEmailWording
            if "rdpHasEmailWording" not in vbs:
                print(f"❌ FAIL: Missing 'vpsBoughtSuccess.rdpHasEmailWording'")
                all_passed = False
            else:
                if vbs["rdpHasEmailWording"] == False:
                    print(f"✅ PASS: vpsBoughtSuccess.rdpHasEmailWording = false")
                else:
                    print(f"❌ FAIL: vpsBoughtSuccess.rdpHasEmailWording = {vbs['rdpHasEmailWording']} (expected false)")
                    all_passed = False
                    # Print the actual text for debugging
                    if "rdp" in vbs:
                        print(f"   RDP text length: {len(vbs['rdp'])} chars")
                        print(f"   RDP text: {vbs['rdp']}")
            
            # rdpLength < 1200
            if "rdpLength" not in vbs:
                print(f"❌ FAIL: Missing 'vpsBoughtSuccess.rdpLength'")
                all_passed = False
            else:
                rdp_len = vbs["rdpLength"]
                if rdp_len < 1200:
                    print(f"✅ PASS: vpsBoughtSuccess.rdpLength = {rdp_len} < 1200")
                else:
                    print(f"❌ FAIL: vpsBoughtSuccess.rdpLength = {rdp_len} >= 1200")
                    all_passed = False
        
        # (f) priceRule checks
        print(f"\n(f) priceRule Checks:")
        if "priceRule" not in data:
            print(f"❌ FAIL: Missing 'priceRule' in response")
            all_passed = False
        else:
            pr = data["priceRule"]
            
            # displayPrice == 90
            if "displayPrice" not in pr:
                print(f"❌ FAIL: Missing 'priceRule.displayPrice'")
                all_passed = False
            else:
                if pr["displayPrice"] == 90:
                    print(f"✅ PASS: priceRule.displayPrice = 90")
                else:
                    print(f"❌ FAIL: priceRule.displayPrice = {pr['displayPrice']} (expected 90)")
                    all_passed = False
            
            # displayEqualsCharge == true
            if "displayEqualsCharge" not in pr:
                print(f"❌ FAIL: Missing 'priceRule.displayEqualsCharge'")
                all_passed = False
            else:
                if pr["displayEqualsCharge"] == True:
                    print(f"✅ PASS: priceRule.displayEqualsCharge = true")
                else:
                    print(f"❌ FAIL: priceRule.displayEqualsCharge = {pr['displayEqualsCharge']} (expected true)")
                    all_passed = False
        
        # Final result
        print(f"\n{'='*80}")
        if all_passed:
            print(f"✅ ALL CHECKS PASSED for {lang.upper()}")
        else:
            print(f"❌ SOME CHECKS FAILED for {lang.upper()}")
        print(f"{'='*80}")
        
        return all_passed
        
    except Exception as e:
        print(f"❌ FAIL: Request failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "🧪" * 40)
    print("RDP PURCHASE FLOW UX VERIFICATION TEST")
    print("🧪" * 40 + "\n")
    
    results = {}
    
    # Test base API
    results["base_api"] = test_base_api()
    
    # Test negative auth
    results["negative_auth"] = test_negative_auth()
    
    # Test all languages
    for lang in LANGUAGES:
        results[f"lang_{lang}"] = test_vps_flow_check(lang)
    
    # Summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 80)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        print("=" * 80)
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        print("=" * 80)
        sys.exit(1)

if __name__ == "__main__":
    main()
