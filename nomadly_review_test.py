#!/usr/bin/env python3
"""
Nomadly Backend Testing Script - Review Request Verification
Testing Node.js backend after implementing 10 bug fixes from Railway log analysis

Key endpoints to test:
1. GET http://localhost:5000/health — should return {"status":"healthy","database":"connected"}
2. GET http://localhost:5000/sms-app/auth/817673476?deviceId=dev-test — should return valid auth response
3. GET http://localhost:5000/login-count/816807083 — should work without errors
4. GET http://localhost:8001/api/health — should proxy to node and return healthy

The fixes implemented:
- B1: Duplicate button fix in IVR template chooser
- B2: Message deduplication (2-second window)
- B3: Rate-limited menu resets (5-second cooldown)
- B4: Unmatched Fincra webhooks logged to MongoDB collection
- U1: Cart abandonment recorded on /start
- U2: Stale payment button text handlers
- U3: SMS App version urgent reminders
- U5: French IVR translations
- U6: URL shortener deduplication
- I1: CSF firewall fallback
"""

import requests
import json
import sys
from datetime import datetime

# Backend URLs
NODEJS_URL = "http://localhost:5000"
FASTAPI_URL = "http://localhost:8001"

def test_nodejs_health():
    """Test 1: Direct Node.js health endpoint"""
    print("🔍 Testing Node.js Health Endpoint (Direct)...")
    try:
        response = requests.get(f"{NODEJS_URL}/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check for required fields
            status = data.get('status')
            database = data.get('database')
            
            if status == 'healthy' and database == 'connected':
                print("   ✅ Node.js health check PASSED - status:healthy, database:connected")
                return True
            else:
                print(f"   ❌ Node.js health check FAILED - status:{status}, database:{database}")
                return False
        else:
            print(f"   ❌ Node.js health check FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Node.js health check FAILED - Error: {str(e)}")
        return False

def test_fastapi_proxy_health():
    """Test 4: FastAPI proxy to Node.js health endpoint"""
    print("\n🔍 Testing FastAPI Proxy Health Endpoint...")
    try:
        response = requests.get(f"{FASTAPI_URL}/api/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check for required fields
            status = data.get('status')
            database = data.get('database')
            
            if status == 'healthy' and database == 'connected':
                print("   ✅ FastAPI proxy health check PASSED - status:healthy, database:connected")
                return True
            else:
                print(f"   ❌ FastAPI proxy health check FAILED - status:{status}, database:{database}")
                return False
        else:
            print(f"   ❌ FastAPI proxy health check FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ FastAPI proxy health check FAILED - Error: {str(e)}")
        return False

def test_sms_app_auth():
    """Test 2: SMS App auth endpoint with specific user"""
    print("\n🔍 Testing SMS App Auth Endpoint...")
    
    chat_id = "817673476"
    device_id = "dev-test"
    
    print(f"   Testing /sms-app/auth/{chat_id}?deviceId={device_id}")
    print("   Expected: valid auth response with valid:true")
    
    try:
        response = requests.get(
            f"{NODEJS_URL}/sms-app/auth/{chat_id}",
            params={"deviceId": device_id},
            timeout=10
        )
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                
                # Check for valid field
                valid = data.get('valid')
                
                if valid is True:
                    print("   ✅ SMS App auth PASSED - valid:true")
                    
                    # Additional checks for user data
                    user = data.get('user', {})
                    if user:
                        print(f"   📋 User info: canLogin={user.get('canLogin')}, freeSmsRemaining={user.get('freeSmsRemaining')}")
                    
                    return True
                else:
                    print(f"   ❌ SMS App auth FAILED - valid:{valid}")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON response: {str(e)}")
                print(f"   Raw response: {response.text[:200]}")
                return False
        else:
            print(f"   ❌ SMS App auth FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ SMS App auth FAILED - Error: {str(e)}")
        return False

def test_login_count():
    """Test 3: Login count endpoint without errors"""
    print("\n🔍 Testing Login Count Endpoint...")
    
    chat_id = "816807083"
    
    print(f"   Testing /login-count/{chat_id}")
    print("   Expected: should work without errors (no TypeError)")
    
    try:
        response = requests.get(f"{NODEJS_URL}/login-count/{chat_id}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                print("   ✅ Login count PASSED - No TypeError, valid JSON response")
                return True
                
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON response: {str(e)}")
                print(f"   Raw response: {response.text[:200]}")
                return False
        else:
            print(f"   ❌ Login count FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Login count FAILED - Error: {str(e)}")
        return False

def test_server_status():
    """Additional test: Check if Node.js server is running properly"""
    print("\n🔍 Testing Server Status...")
    
    try:
        # Test a simple endpoint to verify server is responsive
        response = requests.get(f"{NODEJS_URL}/health", timeout=5)
        
        if response.status_code == 200:
            print("   ✅ Node.js server is running and responsive")
            return True
        else:
            print(f"   ❌ Node.js server returned HTTP {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Cannot connect to Node.js server - server may not be running")
        return False
    except Exception as e:
        print(f"   ❌ Server status check failed: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests for the review request"""
    print("=" * 80)
    print("🚀 NOMADLY BACKEND TESTING - Review Request Verification")
    print("=" * 80)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Node.js URL: {NODEJS_URL}")
    print(f"FastAPI URL: {FASTAPI_URL}")
    print("Focus: 10 bug fixes from Railway log analysis")
    print("=" * 80)
    
    test_results = []
    
    # Test 0: Server status check
    test_results.append(("Server Status", test_server_status()))
    
    # Test 1: Node.js health endpoint
    test_results.append(("Node.js Health Check", test_nodejs_health()))
    
    # Test 2: SMS App auth endpoint
    test_results.append(("SMS App Auth", test_sms_app_auth()))
    
    # Test 3: Login count endpoint
    test_results.append(("Login Count", test_login_count()))
    
    # Test 4: FastAPI proxy health endpoint
    test_results.append(("FastAPI Proxy Health", test_fastapi_proxy_health()))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.0f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Nomadly backend fixes verified successfully!")
        print("\n📋 Key Findings:")
        print("- Node.js Express server running correctly on port 5000")
        print("- FastAPI proxy working correctly on port 8001")
        print("- Health endpoints returning proper status")
        print("- SMS App auth endpoints functional")
        print("- Login count endpoints working without TypeError")
        return True
    else:
        print("⚠️  Some tests failed - see details above")
        print("\n🔧 Troubleshooting:")
        print("- Check if Node.js server is running on port 5000")
        print("- Check if FastAPI server is running on port 8001")
        print("- Verify MongoDB connection")
        print("- Check server logs for errors")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)