#!/usr/bin/env python3
"""
Backend test for Nomadly Telegram bot VPS/RDP purchase flow bug fix.
Tests the read-only diagnostic endpoint /api/admin/vps-catalog-check
"""

import requests
import json
import sys
import re

# Configuration
BACKEND_URL = "https://c02148ec-75bf-4762-a2ee-3f030a45e442.preview.emergentagent.com"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def test_proxy_health():
    """Test that FastAPI -> Node proxy is healthy"""
    print_section("TEST 1: Proxy Health Check")
    
    try:
        url = f"{BACKEND_URL}/api/"
        print(f"Testing: GET {url}")
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            print("✅ PASS: Proxy health check successful")
            return True
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_catalog_check_negative():
    """Test that catalog-check without key returns 403"""
    print_section("TEST 2: Negative Test (Missing/Wrong Key)")
    
    results = []
    
    # Test without key
    try:
        url = f"{BACKEND_URL}/api/admin/vps-catalog-check?region=EU"
        print(f"Testing: GET {url} (no key)")
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 403:
            print("✅ PASS: Returns 403 without key")
            results.append(True)
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        results.append(False)
    
    # Test with wrong key
    try:
        url = f"{BACKEND_URL}/api/admin/vps-catalog-check?key=wrongkey&region=EU"
        print(f"\nTesting: GET {url} (wrong key)")
        response = requests.get(url, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 403:
            print("✅ PASS: Returns 403 with wrong key")
            results.append(True)
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        results.append(False)
    
    return all(results)

def test_catalog_check_region(region, expected_location):
    """Test catalog-check endpoint for a specific region"""
    print_section(f"TEST 3: Catalog Check - Region {region}")
    
    try:
        url = f"{BACKEND_URL}/api/admin/vps-catalog-check?key={ADMIN_KEY}&region={region}"
        print(f"Testing: GET {url}")
        response = requests.get(url, timeout=15)
        
        print(f"Status Code: {response.status_code}")
        
        # Assertion (a): HTTP 200 with JSON body
        if response.status_code != 200:
            print(f"❌ FAIL (a): Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print("✅ PASS (a): HTTP 200 received")
        
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            print(f"❌ FAIL (a): Response is not valid JSON: {e}")
            return False
        
        print("✅ PASS (a): Valid JSON body")
        
        # Print full response for debugging
        print(f"\nFull Response JSON:")
        print(json.dumps(data, indent=2))
        
        # Assertion (b): providers.vps.name == "digitalocean" and providers.rdp.name == "azure"
        print("\n--- Assertion (b): Provider Names ---")
        vps_name = data.get('providers', {}).get('vps', {}).get('name')
        rdp_name = data.get('providers', {}).get('rdp', {}).get('name')
        
        print(f"VPS Provider: {vps_name}")
        print(f"RDP Provider: {rdp_name}")
        
        if vps_name == "digitalocean" and rdp_name == "azure":
            print("✅ PASS (b): Provider names correct")
        else:
            print(f"❌ FAIL (b): Expected vps='digitalocean' and rdp='azure'")
            return False
        
        # Assertion (c): namesDistinct == true
        print("\n--- Assertion (c): Names Distinct ---")
        names_distinct = data.get('namesDistinct')
        print(f"namesDistinct: {names_distinct}")
        
        if names_distinct is True:
            print("✅ PASS (c): namesDistinct is true")
        else:
            print(f"❌ FAIL (c): namesDistinct is {names_distinct}, expected true")
            return False
        
        # Show the actual plan names for verification
        vps_catalog = data.get('providers', {}).get('vps', {}).get('catalog', [])
        rdp_catalog = data.get('providers', {}).get('rdp', {}).get('catalog', [])
        
        print(f"\nVPS Plan Names: {[p.get('name') for p in vps_catalog]}")
        print(f"RDP Plan Names: {[p.get('name') for p in rdp_catalog]}")
        
        # Assertion (d): rdpSkusAreDsv6 == true
        print("\n--- Assertion (d): RDP SKUs are Dsv6 ---")
        rdp_skus_dsv6 = data.get('rdpSkusAreDsv6')
        print(f"rdpSkusAreDsv6: {rdp_skus_dsv6}")
        
        if rdp_skus_dsv6 is True:
            print("✅ PASS (d): rdpSkusAreDsv6 is true")
        else:
            print(f"❌ FAIL (d): rdpSkusAreDsv6 is {rdp_skus_dsv6}, expected true")
            return False
        
        # Verify actual SKU patterns
        print("\nRDP Product IDs:")
        for plan in rdp_catalog:
            product_id = plan.get('productId')
            print(f"  - {plan.get('name')}: {product_id}")
            if not re.match(r'^Standard_D\d+s_v6$', product_id):
                print(f"    ❌ Does not match Standard_D<number>s_v6 pattern")
                return False
        
        # Assertion (e): capacity array checks
        print("\n--- Assertion (e): Capacity Checks ---")
        capacity = data.get('capacity', [])
        
        if not capacity or len(capacity) == 0:
            print(f"❌ FAIL (e): capacity is empty")
            return False
        
        print(f"✅ Capacity array has {len(capacity)} entries")
        
        all_capacity_ok = True
        for idx, cap in enumerate(capacity):
            print(f"\nCapacity Entry {idx + 1}:")
            print(f"  ok: {cap.get('ok')}")
            print(f"  family: {cap.get('family')}")
            print(f"  familyAvailable: {cap.get('familyAvailable')}")
            print(f"  need: {cap.get('need')}")
            print(f"  location: {cap.get('location')}")
            print(f"  productId: {cap.get('productId')}")
            
            # Check all conditions
            if cap.get('ok') is not True:
                print(f"  ❌ FAIL: ok is not true")
                all_capacity_ok = False
            
            if cap.get('family') != "standardDSv6Family":
                print(f"  ❌ FAIL: family is not 'standardDSv6Family'")
                all_capacity_ok = False
            
            family_available = cap.get('familyAvailable', 0)
            need = cap.get('need', 0)
            if family_available < need:
                print(f"  ❌ FAIL: familyAvailable ({family_available}) < need ({need})")
                all_capacity_ok = False
            
            if cap.get('location') != expected_location:
                print(f"  ❌ FAIL: location is '{cap.get('location')}', expected '{expected_location}'")
                all_capacity_ok = False
        
        if all_capacity_ok:
            print("\n✅ PASS (e): All capacity entries valid")
        else:
            print("\n❌ FAIL (e): Some capacity entries failed validation")
            return False
        
        # Assertion (f): rdpProvisionable == true
        print("\n--- Assertion (f): RDP Provisionable ---")
        rdp_provisionable = data.get('rdpProvisionable')
        print(f"rdpProvisionable: {rdp_provisionable}")
        
        if rdp_provisionable is True:
            print("✅ PASS (f): rdpProvisionable is true")
        else:
            print(f"❌ FAIL (f): rdpProvisionable is {rdp_provisionable}, expected true")
            return False
        
        # Assertion (g): Pricing sanity checks
        print("\n--- Assertion (g): Pricing Sanity ---")
        
        # RDP pricing
        rdp_prices = {}
        for plan in rdp_catalog:
            rdp_prices[plan.get('name')] = plan.get('priceUsd')
        
        print(f"RDP Prices: {rdp_prices}")
        
        expected_rdp_prices = {
            "RDP 10": 90,
            "RDP 20": 156,
            "RDP 30": 288
        }
        
        rdp_pricing_ok = True
        for name, expected_price in expected_rdp_prices.items():
            actual_price = rdp_prices.get(name)
            if actual_price != expected_price:
                print(f"❌ FAIL: {name} price is ${actual_price}, expected ${expected_price}")
                rdp_pricing_ok = False
            else:
                print(f"✅ {name}: ${actual_price}")
        
        # VPS pricing
        vps_prices = {}
        for plan in vps_catalog:
            vps_prices[plan.get('name')] = plan.get('priceUsd')
        
        print(f"\nVPS Prices: {vps_prices}")
        
        cloud_vps_30_price = vps_prices.get("Cloud VPS 30")
        if cloud_vps_30_price == 54:
            print(f"✅ Cloud VPS 30: ${cloud_vps_30_price}")
        else:
            print(f"❌ FAIL: Cloud VPS 30 price is ${cloud_vps_30_price}, expected $54")
            rdp_pricing_ok = False
        
        if rdp_pricing_ok:
            print("\n✅ PASS (g): All pricing checks passed")
        else:
            print("\n❌ FAIL (g): Some pricing checks failed")
            return False
        
        print(f"\n{'='*80}")
        print(f"✅ ALL ASSERTIONS PASSED for region {region}")
        print(f"{'='*80}")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  NOMADLY VPS/RDP BUG FIX VERIFICATION")
    print("="*80)
    
    results = {}
    
    # Test 1: Proxy health
    results['proxy_health'] = test_proxy_health()
    
    # Test 2: Negative test (auth)
    results['negative_auth'] = test_catalog_check_negative()
    
    # Test 3: EU region
    results['eu_region'] = test_catalog_check_region('EU', 'westeurope')
    
    # Test 4: US-east region
    results['us_east_region'] = test_catalog_check_region('US-east', 'eastus')
    
    # Summary
    print_section("FINAL SUMMARY")
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n" + "="*80)
        print("  ✅ ALL TESTS PASSED")
        print("="*80)
        sys.exit(0)
    else:
        print("\n" + "="*80)
        print("  ❌ SOME TESTS FAILED")
        print("="*80)
        sys.exit(1)

if __name__ == "__main__":
    main()
