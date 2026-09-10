#!/usr/bin/env python3
"""
Backend test for 2026-09 anomaly fixes verification
Tests the three backend bug fixes via the diagnostic endpoint
"""

import requests
import json
import sys

# Configuration
BASE_URL = "https://3e8bc17b-00ee-4e5e-96a4-2f67722351f1.preview.emergentagent.com"
SESSION_SECRET = "o/Qb8ArGahlquhCQafi6752xMe0p0S93Uf5g2gTX6MZtBE7vVcp230LKEsGTz3YJ/q9fluyEvweAMB9FGdv8zQ=="
KEY = SESSION_SECRET[:16]  # First 16 characters

print("=" * 80)
print("BACKEND TEST: 2026-09 Anomaly Fixes Verification")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Key (first 16 chars of SESSION_SECRET): {KEY}")
print("=" * 80)

# Test counters
total_tests = 0
passed_tests = 0
failed_tests = 0

def test_result(name, passed, details=""):
    global total_tests, passed_tests, failed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
        print(f"✅ {name}")
    else:
        failed_tests += 1
        print(f"❌ {name}")
    if details:
        print(f"   {details}")

print("\n" + "=" * 80)
print("TEST 1: PRIMARY ENDPOINT - /api/dev/anomaly-fixes-check")
print("=" * 80)

try:
    url = f"{BASE_URL}/api/dev/anomaly-fixes-check?key={KEY}"
    print(f"\nGET {url}")
    response = requests.get(url, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    test_result("Status code is 200", response.status_code == 200, 
                f"Expected: 200, Got: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\nFull JSON Response:")
        print(json.dumps(data, indent=2))
        
        # Check top-level allPass
        all_pass = data.get("allPass", False)
        test_result("Top-level 'allPass' is true", all_pass == True,
                   f"allPass: {all_pass}")
        
        # Test item1a_regions
        print("\n" + "-" * 80)
        print("ITEM 1a: Region Slugs Fix")
        print("-" * 80)
        item1a = data.get("item1a_regions", {})
        print(f"item1a_regions: {json.dumps(item1a, indent=2)}")
        
        item1a_pass = item1a.get("pass", False)
        test_result("item1a_regions.pass is true", item1a_pass == True,
                   f"pass: {item1a_pass}")
        
        legacy_bad_slugs = item1a.get("legacyBadSlugsPresent", None)
        test_result("legacyBadSlugsPresent is empty array", 
                   legacy_bad_slugs == [],
                   f"legacyBadSlugsPresent: {legacy_bad_slugs}")
        
        region_slugs = item1a.get("regionSlugs", [])
        required_slugs = ["SIN", "JPN", "AUS", "IND"]
        forbidden_slugs = ["SG", "JP", "AU", "IN"]
        
        has_required = all(slug in region_slugs for slug in required_slugs)
        test_result("regionSlugs includes SIN, JPN, AUS, IND", has_required,
                   f"regionSlugs: {region_slugs}")
        
        has_forbidden = any(slug in region_slugs for slug in forbidden_slugs)
        test_result("regionSlugs does NOT include SG, JP, AU, IN", not has_forbidden,
                   f"regionSlugs: {region_slugs}")
        
        all_regions_have_catalog = item1a.get("allRegionsHaveCatalog", False)
        test_result("allRegionsHaveCatalog is true", all_regions_have_catalog == True,
                   f"allRegionsHaveCatalog: {all_regions_have_catalog}")
        
        catalog_counts = item1a.get("catalogCountByRegion", {})
        print(f"catalogCountByRegion: {catalog_counts}")
        required_regions = ["EU", "US-east", "US-west", "UK", "AUS", "SIN", "JPN", "IND"]
        all_counts_positive = all(catalog_counts.get(region, 0) > 0 for region in required_regions)
        test_result("All regions (EU, US-east, US-west, UK, AUS, SIN, JPN, IND) have catalogCount > 0",
                   all_counts_positive,
                   f"catalogCountByRegion: {catalog_counts}")
        
        # Test item1b_breaker
        print("\n" + "-" * 80)
        print("ITEM 1b: Circuit Breaker Fix")
        print("-" * 80)
        item1b = data.get("item1b_breaker", {})
        print(f"item1b_breaker: {json.dumps(item1b, indent=2)}")
        
        item1b_pass = item1b.get("pass", False)
        test_result("item1b_breaker.pass is true", item1b_pass == True,
                   f"pass: {item1b_pass}")
        
        healthy_before = item1b.get("healthyBefore", False)
        test_result("healthyBefore is true", healthy_before == True,
                   f"healthyBefore: {healthy_before}")
        
        healthy_after_one = item1b.get("healthyAfterOne", False)
        test_result("healthyAfterOne is true", healthy_after_one == True,
                   f"healthyAfterOne: {healthy_after_one}")
        
        healthy_after_two_systemic = item1b.get("healthyAfterTwoSystemic400", False)
        test_result("healthyAfterTwoSystemic400 is false", healthy_after_two_systemic == False,
                   f"healthyAfterTwoSystemic400: {healthy_after_two_systemic}")
        
        healthy_after_benign = item1b.get("healthyAfterBenign400", False)
        test_result("healthyAfterBenign400 is true", healthy_after_benign == True,
                   f"healthyAfterBenign400: {healthy_after_benign}")
        
        # Test item7_notifyRetry
        print("\n" + "-" * 80)
        print("ITEM 7: Notify Retry Fix")
        print("-" * 80)
        item7 = data.get("item7_notifyRetry", {})
        print(f"item7_notifyRetry: {json.dumps(item7, indent=2)}")
        
        item7_pass = item7.get("pass", False)
        test_result("item7_notifyRetry.pass is true", item7_pass == True,
                   f"pass: {item7_pass}")
        
        efatal_transient = item7.get("efatalAggregateIsTransient", False)
        test_result("efatalAggregateIsTransient is true", efatal_transient == True,
                   f"efatalAggregateIsTransient: {efatal_transient}")
        
        etimedout_transient = item7.get("etimedoutIsTransient", False)
        test_result("etimedoutIsTransient is true", etimedout_transient == True,
                   f"etimedoutIsTransient: {etimedout_transient}")
        
        chat_not_found_transient = item7.get("chatNotFoundIsTransient", False)
        test_result("chatNotFoundIsTransient is false", chat_not_found_transient == False,
                   f"chatNotFoundIsTransient: {chat_not_found_transient}")
        
        helper_present = item7.get("helperPresent", False)
        test_result("helperPresent is true", helper_present == True,
                   f"helperPresent: {helper_present}")
        
        # Test item8a_getZoneRetry
        print("\n" + "-" * 80)
        print("ITEM 8a: getZoneByName Retry Fix")
        print("-" * 80)
        item8a = data.get("item8a_getZoneRetry", {})
        print(f"item8a_getZoneRetry: {json.dumps(item8a, indent=2)}")
        
        item8a_pass = item8a.get("pass", False)
        test_result("item8a_getZoneRetry.pass is true", item8a_pass == True,
                   f"pass: {item8a_pass}")
        
        has_retry_loop = item8a.get("hasRetryLoop", False)
        test_result("hasRetryLoop is true", has_retry_loop == True,
                   f"hasRetryLoop: {has_retry_loop}")
        
        has_higher_timeout = item8a.get("hasHigherTimeout", False)
        test_result("hasHigherTimeout is true", has_higher_timeout == True,
                   f"hasHigherTimeout: {has_higher_timeout}")
        
        # Test item8b_staleZoneRefresh
        print("\n" + "-" * 80)
        print("ITEM 8b: Stale Zone Refresh Fix")
        print("-" * 80)
        item8b = data.get("item8b_staleZoneRefresh", {})
        print(f"item8b_staleZoneRefresh: {json.dumps(item8b, indent=2)}")
        
        item8b_pass = item8b.get("pass", False)
        test_result("item8b_staleZoneRefresh.pass is true", item8b_pass == True,
                   f"pass: {item8b_pass}")
        
        refreshes_stale_zone = item8b.get("refreshesStaleZone", False)
        test_result("refreshesStaleZone is true", refreshes_stale_zone == True,
                   f"refreshesStaleZone: {refreshes_stale_zone}")
        
    else:
        print(f"ERROR: Unexpected status code {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

# Test 2: Regression check - vps-catalog-check endpoint
print("\n" + "=" * 80)
print("TEST 2: REGRESSION CHECK - /api/admin/vps-catalog-check")
print("=" * 80)

try:
    url = f"{BASE_URL}/api/admin/vps-catalog-check?key={KEY}&region=EU"
    print(f"\nGET {url}")
    response = requests.get(url, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    test_result("vps-catalog-check EU: Status code is 200", response.status_code == 200,
                f"Expected: 200, Got: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response (first 500 chars): {json.dumps(data, indent=2)[:500]}...")
        test_result("vps-catalog-check EU: Returns valid JSON", True)
    else:
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    test_result("vps-catalog-check EU: Request failed", False, str(e))

try:
    url = f"{BASE_URL}/api/admin/vps-catalog-check?key={KEY}&region=AUS"
    print(f"\nGET {url}")
    response = requests.get(url, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    test_result("vps-catalog-check AUS: Status code is 200", response.status_code == 200,
                f"Expected: 200, Got: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response (first 500 chars): {json.dumps(data, indent=2)[:500]}...")
        test_result("vps-catalog-check AUS: Returns valid JSON", True)
    else:
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    test_result("vps-catalog-check AUS: Request failed", False, str(e))

# Test 3: Negative check - no key should return 403
print("\n" + "=" * 80)
print("TEST 3: NEGATIVE CHECK - No key should return 403")
print("=" * 80)

try:
    url = f"{BASE_URL}/api/dev/anomaly-fixes-check"
    print(f"\nGET {url} (no key)")
    response = requests.get(url, timeout=30)
    
    print(f"Status Code: {response.status_code}")
    test_result("No key: Status code is 403", response.status_code == 403,
                f"Expected: 403, Got: {response.status_code}")
    
    if response.status_code != 200:
        print(f"Response: {response.text[:200]}")
        
except Exception as e:
    print(f"❌ ERROR: {str(e)}")
    test_result("No key: Request failed", False, str(e))

# Summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {total_tests}")
print(f"Passed: {passed_tests} ✅")
print(f"Failed: {failed_tests} ❌")
print(f"Pass Rate: {(passed_tests/total_tests*100):.1f}%")
print("=" * 80)

if failed_tests == 0:
    print("\n🎉 ALL TESTS PASSED!")
    sys.exit(0)
else:
    print(f"\n⚠️  {failed_tests} TEST(S) FAILED")
    sys.exit(1)
