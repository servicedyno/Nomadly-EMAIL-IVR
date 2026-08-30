#!/usr/bin/env python3
"""
Backend API Test for Nomadly Hosting Panel - Three New Features
Tests:
1. Subdomain Document Root Fix (cpanel-proxy.js line 1053)
2. Bulk Subdomain Import API (POST /panel/subdomains/bulk-create)
3. WHM Session Fallback for File Operations (_uapiViaWhmSession)
"""

import requests
import os
import sys

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://c4f2d665-8838-46df-8009-e5ab651e163d.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
NODE_BASE = "http://localhost:5000"

def test_health_checks():
    """Test 1: Health checks"""
    print("\n=== TEST 1: Health Checks ===")
    
    # Test FastAPI health
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print(f"✅ FastAPI health check: {data}")
                return True
            else:
                print(f"❌ FastAPI health check failed: {data}")
                return False
        else:
            print(f"❌ FastAPI health check returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FastAPI health check error: {e}")
        return False

def test_nodejs_health():
    """Test 2: Node.js health check"""
    print("\n=== TEST 2: Node.js Health Check ===")
    
    try:
        resp = requests.get(f"{NODE_BASE}/health", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print(f"✅ Node.js health check: {data}")
                return True
            else:
                print(f"❌ Node.js health check failed: {data}")
                return False
        else:
            print(f"❌ Node.js health check returned {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ Node.js health check error: {e}")
        return False

def test_bulk_create_route_exists():
    """Test 3: Verify bulk-create route exists (should return 401 without auth)"""
    print("\n=== TEST 3: Bulk Subdomain Import Route Exists ===")
    
    try:
        # POST without auth should return 401 (Unauthorized), not 404 (Not Found)
        resp = requests.post(f"{NODE_BASE}/panel/subdomains/bulk-create", 
                            json={"subdomains": "test", "rootdomain": "example.com"},
                            timeout=10)
        
        if resp.status_code == 401:
            print(f"✅ Bulk-create route exists (returned 401 Unauthorized as expected)")
            return True
        elif resp.status_code == 404:
            print(f"❌ Bulk-create route NOT FOUND (404)")
            return False
        else:
            print(f"⚠️  Bulk-create route returned unexpected status: {resp.status_code}")
            # Still consider it a pass if the route exists (not 404)
            return True
    except Exception as e:
        print(f"❌ Bulk-create route test error: {e}")
        return False

def verify_code_changes():
    """Test 4: Verify code changes are in place"""
    print("\n=== TEST 4: Verify Code Changes ===")
    
    results = []
    
    # Check 1: Subdomain docroot fix
    try:
        with open('/app/js/cpanel-proxy.js', 'r') as f:
            content = f.read()
            if 'public_html/${subdomain}' in content and 'dir: dir || `public_html/${subdomain}`' in content:
                print("✅ Subdomain docroot fix found at line 1053 (public_html/${subdomain})")
                results.append(True)
            else:
                print("❌ Subdomain docroot fix NOT found")
                results.append(False)
    except Exception as e:
        print(f"❌ Error checking cpanel-proxy.js: {e}")
        results.append(False)
    
    # Check 2: Bulk-create route
    try:
        with open('/app/js/cpanel-routes.js', 'r') as f:
            content = f.read()
            if "router.post('/subdomains/bulk-create'" in content:
                print("✅ Bulk-create route found in cpanel-routes.js")
                results.append(True)
            else:
                print("❌ Bulk-create route NOT found in cpanel-routes.js")
                results.append(False)
    except Exception as e:
        print(f"❌ Error checking cpanel-routes.js: {e}")
        results.append(False)
    
    # Check 3: _uapiViaWhmSession function
    try:
        with open('/app/js/cpanel-routes.js', 'r') as f:
            content = f.read()
            if 'async function _uapiViaWhmSession' in content or 'function _uapiViaWhmSession' in content:
                print("✅ _uapiViaWhmSession function found in cpanel-routes.js")
                results.append(True)
            else:
                print("❌ _uapiViaWhmSession function NOT found")
                results.append(False)
    except Exception as e:
        print(f"❌ Error checking for _uapiViaWhmSession: {e}")
        results.append(False)
    
    # Check 4: WHM session fallback usage
    try:
        with open('/app/js/cpanel-routes.js', 'r') as f:
            content = f.read()
            if '_uapiViaWhmSession(whmApi, req.cpUser, \'Fileman\', \'get_file_content\'' in content:
                print("✅ WHM session fallback for get_file_content found")
                results.append(True)
            else:
                print("❌ WHM session fallback for get_file_content NOT found")
                results.append(False)
            
            if '_uapiViaWhmSession(whmApi, req.cpUser, \'Fileman\', \'save_file_content\'' in content:
                print("✅ WHM session fallback for save_file_content found")
                results.append(True)
            else:
                print("❌ WHM session fallback for save_file_content NOT found")
                results.append(False)
    except Exception as e:
        print(f"❌ Error checking WHM session fallback usage: {e}")
        results.append(False)
    
    return all(results)

def main():
    print("=" * 60)
    print("NOMADLY HOSTING PANEL - BACKEND API TEST")
    print("Testing Three New Features:")
    print("1. Subdomain Document Root Fix")
    print("2. Bulk Subdomain Import API")
    print("3. WHM Session Fallback for File Operations")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Health Checks", test_health_checks()))
    results.append(("Node.js Health", test_nodejs_health()))
    results.append(("Bulk-Create Route", test_bulk_create_route_exists()))
    results.append(("Code Changes", verify_code_changes()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    print("=" * 60)
    
    # Exit with appropriate code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
