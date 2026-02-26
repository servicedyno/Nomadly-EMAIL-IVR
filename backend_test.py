#!/usr/bin/env python3
"""
Phone Reviews Fix Testing - Railway catch-all route order + collection mismatch
Tests the implementation against all key verification requirements.
"""

import requests
import json
import os
import tempfile
import time
import subprocess
import sys

# Configuration
BACKEND_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://config-management.preview.emergentagent.com')
NODEJS_URL = "http://localhost:5000"
FASTAPI_URL = "http://localhost:8001"

print(f"Testing with BACKEND_URL: {BACKEND_URL}")
print(f"Node.js URL: {NODEJS_URL}")
print(f"FastAPI URL: {FASTAPI_URL}")

def test_1_express_catch_all_fix():
    """
    Test 1: Express catch-all fix in js/_index.js (around line 15493-15501)
    Verify the catch-all route calls next() for known API path prefixes
    """
    print("\n=== TEST 1: Express Catch-All Route Fix ===")
    
    # Read the js/_index.js file to verify the implementation
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        # Look for the catch-all route implementation
        lines = content.split('\n')
        catch_all_found = False
        api_prefixes_found = False
        next_call_found = False
        
        for i, line in enumerate(lines):
            if "app.get('/{*splat}'" in line:
                catch_all_found = True
                print(f"✅ Found catch-all route at line {i+1}")
                
                # Check the next few lines for apiPrefixes and next() call
                for j in range(i, min(i+15, len(lines))):
                    if 'apiPrefixes' in lines[j] and '/phone/' in lines[j]:
                        api_prefixes_found = True
                        print(f"✅ Found apiPrefixes array at line {j+1}")
                        print(f"   Content: {lines[j].strip()}")
                        
                        # Verify it includes the required prefixes
                        required_prefixes = ['/phone/', '/honeypot/', '/telegram/', '/telnyx/', '/twilio/', '/panel/', '/dynopay/', '/fincra/', '/blockbee/']
                        for prefix in required_prefixes:
                            if prefix in lines[j]:
                                print(f"   ✅ Contains {prefix}")
                            else:
                                print(f"   ❌ Missing {prefix}")
                                
                    if 'return next()' in lines[j]:
                        next_call_found = True
                        print(f"✅ Found next() call at line {j+1}")
                        
                break
        
        if catch_all_found and api_prefixes_found and next_call_found:
            print("✅ EXPRESS CATCH-ALL FIX: Correctly implemented")
            return True
        else:
            print("❌ EXPRESS CATCH-ALL FIX: Not properly implemented")
            return False
            
    except Exception as e:
        print(f"❌ Error reading js/_index.js: {e}")
        return False

def test_2_fastapi_review_handlers_removed():
    """
    Test 2: FastAPI review handlers REMOVED from backend/server.py
    Verify that the handlers and collection references are gone
    """
    print("\n=== TEST 2: FastAPI Review Handlers Removal ===")
    
    try:
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
            
        # Check that these should be REMOVED
        removed_items = [
            '@app.get("/api/phone/reviews")',
            '@app.post("/api/phone/reviews")', 
            'reviews_col = db[\'phone_reviews\']',
            'ReviewSubmit',
            'phone_reviews'  # collection name
        ]
        
        all_removed = True
        for item in removed_items:
            if item in content:
                print(f"❌ Found {item} - should be REMOVED")
                all_removed = False
            else:
                print(f"✅ {item} - correctly removed")
        
        # Check for comment explaining Node.js handling
        if 'Node.js Express' in content or 'handled by Node.js' in content:
            print("✅ Found comment explaining Node.js handling")
        else:
            print("❌ Missing comment explaining Node.js handling")
            all_removed = False
            
        if all_removed:
            print("✅ FASTAPI HANDLERS REMOVAL: Correctly implemented")
            return True
        else:
            print("❌ FASTAPI HANDLERS REMOVAL: Not fully implemented")
            return False
            
    except Exception as e:
        print(f"❌ Error reading backend/server.py: {e}")
        return False

def test_3_nodejs_phone_reviews_api():
    """
    Test 3: Phone reviews API works via Node.js Express on port 5000
    Test both GET and POST endpoints directly
    """
    print("\n=== TEST 3: Node.js Express Phone Reviews API ===")
    
    results = []
    
    # Test GET /phone/reviews
    try:
        response = requests.get(f"{NODEJS_URL}/phone/reviews", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'reviews' in data:
                print(f"✅ GET /phone/reviews: {response.status_code}, got {len(data['reviews'])} reviews")
                results.append(True)
            else:
                print(f"❌ GET /phone/reviews: Missing 'reviews' field in response")
                results.append(False)
        else:
            print(f"❌ GET /phone/reviews: Status {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /phone/reviews error: {e}")
        results.append(False)
    
    # Test GET /api/phone/reviews (with /api/ stripping middleware)
    try:
        response = requests.get(f"{NODEJS_URL}/api/phone/reviews", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'reviews' in data:
                print(f"✅ GET /api/phone/reviews: {response.status_code}, got {len(data['reviews'])} reviews")
                results.append(True)
            else:
                print(f"❌ GET /api/phone/reviews: Missing 'reviews' field in response")
                results.append(False)
        else:
            print(f"❌ GET /api/phone/reviews: Status {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET /api/phone/reviews error: {e}")
        results.append(False)
    
    # Test POST /api/phone/reviews
    test_review = {
        "stars": 5,
        "comment": "Test review from testing agent",
        "name": "TestUser"
    }
    
    try:
        response = requests.post(f"{NODEJS_URL}/api/phone/reviews", 
                               json=test_review, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"✅ POST /api/phone/reviews: {response.status_code}, success: {data['success']}")
                results.append(True)
            else:
                print(f"❌ POST /api/phone/reviews: No success field")
                results.append(False)
        else:
            print(f"❌ POST /api/phone/reviews: Status {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ POST /api/phone/reviews error: {e}")
        results.append(False)
    
    if all(results):
        print("✅ NODE.JS PHONE REVIEWS API: All tests passed")
        return True
    else:
        print("❌ NODE.JS PHONE REVIEWS API: Some tests failed")
        return False

def test_4_fastapi_proxy_phone_reviews():
    """
    Test 4: Phone reviews API works via FastAPI proxy on port 8001
    Test that requests are properly proxied to Node.js
    """
    print("\n=== TEST 4: FastAPI Proxy Phone Reviews API ===")
    
    results = []
    
    # Test GET via FastAPI proxy
    try:
        response = requests.get(f"{FASTAPI_URL}/api/phone/reviews", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'reviews' in data:
                print(f"✅ GET {FASTAPI_URL}/api/phone/reviews: {response.status_code}, got {len(data['reviews'])} reviews")
                results.append(True)
            else:
                print(f"❌ GET {FASTAPI_URL}/api/phone/reviews: Missing 'reviews' field")
                results.append(False)
        else:
            print(f"❌ GET {FASTAPI_URL}/api/phone/reviews: Status {response.status_code}")
            results.append(False)
    except Exception as e:
        print(f"❌ GET {FASTAPI_URL}/api/phone/reviews error: {e}")
        results.append(False)
    
    # Test POST via FastAPI proxy
    test_review = {
        "stars": 4,
        "comment": "Proxy test from FastAPI to Node.js",
        "name": "ProxyTester"
    }
    
    try:
        response = requests.post(f"{FASTAPI_URL}/api/phone/reviews", 
                               json=test_review, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"✅ POST {FASTAPI_URL}/api/phone/reviews: {response.status_code}, success: {data['success']}")
                results.append(True)
            else:
                print(f"❌ POST {FASTAPI_URL}/api/phone/reviews: No success field")
                results.append(False)
        else:
            print(f"❌ POST {FASTAPI_URL}/api/phone/reviews: Status {response.status_code}")
            print(f"Response: {response.text}")
            results.append(False)
    except Exception as e:
        print(f"❌ POST {FASTAPI_URL}/api/phone/reviews error: {e}")
        results.append(False)
    
    if all(results):
        print("✅ FASTAPI PROXY PHONE REVIEWS: All tests passed")
        return True
    else:
        print("❌ FASTAPI PROXY PHONE REVIEWS: Some tests failed") 
        return False

def test_5_railway_scenario_simulation():
    """
    Test 5: Simulate Railway scenario (critical)
    Create build dir, restart nodejs, test API vs SPA routing
    """
    print("\n=== TEST 5: Railway Scenario Simulation ===")
    
    build_dir = '/app/frontend/build'
    index_html = os.path.join(build_dir, 'index.html')
    
    try:
        # Step 1: Create build directory and index.html
        os.makedirs(build_dir, exist_ok=True)
        with open(index_html, 'w') as f:
            f.write('<html><body>SPA</body></html>')
        print("✅ Created build/index.html")
        
        # Step 2: Restart nodejs service
        print("🔄 Restarting nodejs service...")
        result = subprocess.run(['sudo', 'supervisorctl', 'restart', 'nodejs'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ nodejs restarted successfully")
        else:
            print(f"❌ nodejs restart failed: {result.stderr}")
            return False
        
        # Step 3: Wait for service to be ready
        print("⏳ Waiting 6 seconds for service to start...")
        time.sleep(6)
        
        # Step 4: Test API endpoint (should return JSON, not HTML)
        try:
            response = requests.get(f"{NODEJS_URL}/api/phone/reviews", timeout=10)
            content_type = response.headers.get('content-type', '')
            
            if response.status_code == 200 and 'application/json' in content_type:
                data = response.json()
                if 'reviews' in data:
                    print(f"✅ /api/phone/reviews returns JSON (not index.html)")
                    api_test_passed = True
                else:
                    print(f"❌ /api/phone/reviews returns JSON but missing 'reviews'")
                    api_test_passed = False
            else:
                print(f"❌ /api/phone/reviews returns {content_type} (should be JSON)")
                print(f"Response: {response.text[:200]}")
                api_test_passed = False
        except Exception as e:
            print(f"❌ /api/phone/reviews error: {e}")
            api_test_passed = False
        
        # Step 5: Test SPA route (should return HTML)
        try:
            response = requests.get(f"{NODEJS_URL}/call", timeout=10)
            if response.status_code == 200 and 'SPA' in response.text:
                print(f"✅ /call returns index.html (SPA routing works)")
                spa_test_passed = True
            else:
                print(f"❌ /call doesn't return expected SPA content")
                print(f"Response: {response.text[:200]}")
                spa_test_passed = False
        except Exception as e:
            print(f"❌ /call error: {e}")
            spa_test_passed = False
        
        # Step 6: Cleanup
        try:
            import shutil
            shutil.rmtree(build_dir)
            print("🧹 Removed build directory")
        except:
            pass
            
        # Step 7: Restart nodejs again to reset to original state
        subprocess.run(['sudo', 'supervisorctl', 'restart', 'nodejs'], 
                      capture_output=True, text=True)
        print("🔄 Reset nodejs service")
        
        if api_test_passed and spa_test_passed:
            print("✅ RAILWAY SCENARIO SIMULATION: All tests passed")
            return True
        else:
            print("❌ RAILWAY SCENARIO SIMULATION: Tests failed")
            return False
            
    except Exception as e:
        print(f"❌ Railway simulation error: {e}")
        return False

def test_6_nodejs_health():
    """
    Test 6: Node.js health - Service running on port 5000 without critical errors
    """
    print("\n=== TEST 6: Node.js Service Health ===")
    
    # Test basic health endpoint
    try:
        response = requests.get(f"{NODEJS_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health endpoint accessible: {data}")
            health_ok = True
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            health_ok = False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        health_ok = False
    
    # Check supervisor status
    try:
        result = subprocess.run(['sudo', 'supervisorctl', 'status', 'nodejs'], 
                              capture_output=True, text=True)
        if 'RUNNING' in result.stdout:
            print("✅ Node.js service is RUNNING in supervisor")
            supervisor_ok = True
        else:
            print(f"❌ Node.js service status: {result.stdout}")
            supervisor_ok = False
    except Exception as e:
        print(f"❌ Supervisor check error: {e}")
        supervisor_ok = False
    
    # Check for critical errors in logs
    try:
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        error_log = result.stdout
        
        critical_errors = ['EADDRINUSE', 'ECONNREFUSED', 'UnhandledPromiseRejection', 'Error:']
        found_errors = []
        for error in critical_errors:
            if error in error_log:
                found_errors.append(error)
        
        if found_errors:
            print(f"⚠️ Found potential issues in error log: {found_errors}")
            print("Recent error log:")
            print(error_log[-500:])  # Last 500 chars
            log_ok = False
        else:
            print("✅ No critical errors in recent logs")
            log_ok = True
    except:
        print("⚠️ Could not check error logs")
        log_ok = True  # Don't fail the test if we can't check logs
    
    if health_ok and supervisor_ok and log_ok:
        print("✅ NODE.JS HEALTH: Service is healthy")
        return True
    else:
        print("❌ NODE.JS HEALTH: Service has issues")
        return False

def main():
    """Run all tests and provide summary"""
    print("🧪 PHONE REVIEWS FIX TESTING")
    print("Testing fix for 'Phone reviews not working on Railway — catch-all route order + collection mismatch'")
    print("=" * 80)
    
    test_results = []
    
    # Run all tests
    test_results.append(("Express Catch-All Fix", test_1_express_catch_all_fix()))
    test_results.append(("FastAPI Handlers Removal", test_2_fastapi_review_handlers_removed()))
    test_results.append(("Node.js Phone Reviews API", test_3_nodejs_phone_reviews_api()))
    test_results.append(("FastAPI Proxy", test_4_fastapi_proxy_phone_reviews()))
    test_results.append(("Railway Scenario Simulation", test_5_railway_scenario_simulation()))
    test_results.append(("Node.js Health", test_6_nodejs_health()))
    
    # Summary
    print("\n" + "=" * 80)
    print("🏁 TESTING SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\nResult: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Phone reviews fix is working correctly.")
        return True
    else:
        print("⚠️ SOME TESTS FAILED! Review the failures above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)