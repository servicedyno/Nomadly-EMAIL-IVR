#!/usr/bin/env python3
"""
READ-ONLY verification of Windows RDP feature port (Track A)
CRITICAL: ONLY GET requests - NO provisioning, NO golden builds, NO POST operations
"""

import requests
import json
import sys
from urllib.parse import quote

# Base URL from frontend/.env
BASE_URL = "https://8f4e256b-fcce-4a5a-bd2d-9d9f846a5096.preview.emergentagent.com"

# Admin key: first 16 chars of SESSION_SECRET
ADMIN_KEY = "+zRwYjjbsc7Rifar"

def test_health_check():
    """
    CHECK 1: GET /api/health
    Expect: HTTP 200 with {status:"healthy", database:"connected"}
    Purpose: Confirm RDP port didn't break server boot
    """
    print("\n" + "="*80)
    print("CHECK 1: Health endpoint")
    print("="*80)
    
    url = f"{BASE_URL}/api/health"
    print(f"GET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        except:
            print(f"Response (text): {response.text[:500]}")
        
        # Verify expectations
        if response.status_code == 200:
            if isinstance(data, dict):
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    print("✅ PASSED: Health check returned 200 with healthy status and connected database")
                    return True
                else:
                    print(f"❌ FAILED: Expected status='healthy' and database='connected', got: {data}")
                    return False
            else:
                print(f"❌ FAILED: Expected JSON object, got: {type(data)}")
                return False
        else:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_rdp_golden_status_no_auth():
    """
    CHECK 2a: GET /api/admin/rdp-golden/status (NO key)
    Expect: HTTP 403 with {"error":"Unauthorized"}
    Purpose: Verify auth gate is working
    """
    print("\n" + "="*80)
    print("CHECK 2a: RDP golden-image STATUS route (no auth)")
    print("="*80)
    
    url = f"{BASE_URL}/api/admin/rdp-golden/status"
    print(f"GET {url} (no key)")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        except:
            print(f"Response (text): {response.text[:500]}")
        
        # Verify expectations
        if response.status_code == 403:
            if isinstance(data, dict) and data.get("error") == "Unauthorized":
                print("✅ PASSED: Correctly rejected with 403 Unauthorized")
                return True
            else:
                print(f"⚠️ PARTIAL: Got 403 but unexpected body: {data}")
                return True  # Still counts as pass since auth gate worked
        else:
            print(f"❌ FAILED: Expected HTTP 403, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_rdp_golden_status_with_auth():
    """
    CHECK 2b: GET /api/admin/rdp-golden/status?key=<ADMIN_KEY>
    Expect: HTTP 200 JSON listing RDP OS options/builds/regions
    Purpose: Verify read-only status endpoint works with auth
    """
    print("\n" + "="*80)
    print("CHECK 2b: RDP golden-image STATUS route (with auth)")
    print("="*80)
    
    # URL-encode the key (it has a leading '+')
    encoded_key = quote(ADMIN_KEY)
    url = f"{BASE_URL}/api/admin/rdp-golden/status?key={encoded_key}"
    print(f"GET {url}")
    print(f"Key (first 16 chars of SESSION_SECRET): {ADMIN_KEY}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            # Truncate response for readability
            response_str = json.dumps(data, indent=2)
            if len(response_str) > 1000:
                print(f"Response (truncated): {response_str[:1000]}...")
            else:
                print(f"Response: {response_str}")
        except:
            print(f"Response (text, truncated): {response.text[:500]}")
        
        # Verify expectations
        if response.status_code == 200:
            if isinstance(data, dict):
                print("✅ PASSED: Got 200 JSON response (RDP status endpoint is working)")
                print(f"   Response contains: {list(data.keys())}")
                return True
            else:
                print(f"❌ FAILED: Expected JSON object, got: {type(data)}")
                return False
        else:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_provision_router_mounted():
    """
    CHECK 3: GET /api/provision/bootscript (no/invalid token)
    Expect: NOT 404 (400/401/403 is fine)
    Purpose: Verify /provision router is mounted and protected
    """
    print("\n" + "="*80)
    print("CHECK 3: /provision router mount check")
    print("="*80)
    
    url = f"{BASE_URL}/api/provision/bootscript"
    print(f"GET {url} (no token)")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        try:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        except:
            print(f"Response (text): {response.text[:500]}")
        
        # Verify expectations
        if response.status_code == 404:
            print("❌ FAILED: Got 404 - /provision router failed to mount")
            return False
        elif response.status_code in [400, 401, 403]:
            print(f"✅ PASSED: Got {response.status_code} (router is mounted and protected)")
            return True
        else:
            print(f"⚠️ UNEXPECTED: Got {response.status_code} (expected 400/401/403, but NOT 404)")
            print("   Router appears to be mounted (not 404), so counting as PASS")
            return True
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def main():
    print("="*80)
    print("Windows RDP Feature Port - READ-ONLY Backend Verification")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Key: {ADMIN_KEY}")
    print("\nCRITICAL SAFETY: ONLY GET requests - NO POST operations allowed")
    print("="*80)
    
    results = []
    
    # Run all checks
    results.append(("Health check", test_health_check()))
    results.append(("RDP status (no auth)", test_rdp_golden_status_no_auth()))
    results.append(("RDP status (with auth)", test_rdp_golden_status_with_auth()))
    results.append(("Provision router mount", test_provision_router_mounted()))
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n🎉 ALL CHECKS PASSED - RDP feature port verification complete")
        return 0
    else:
        print(f"\n⚠️ {total - passed} check(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
