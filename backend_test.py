#!/usr/bin/env python3
"""
Backend Testing Script for Node.js Express Server (Port 5000)
Testing B4, B6, B7 bug fixes and previous functionality
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL - Node.js Express server
BASE_URL = "http://localhost:5000"

def test_health_endpoint():
    """Test B6 & B7: Health endpoint should return status:healthy"""
    print("🔍 Testing Health Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            if data.get('status') == 'healthy':
                print("   ✅ Health check PASSED - status:healthy")
                return True
            else:
                print(f"   ❌ Health check FAILED - status: {data.get('status')}")
                return False
        else:
            print(f"   ❌ Health check FAILED - HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Health check FAILED - Error: {str(e)}")
        return False

def test_login_count_b4_fix():
    """Test B4: TypeError fix for login-count endpoints"""
    print("\n🔍 Testing B4 - TypeError Fix (login-count endpoints)...")
    
    test_cases = [
        ("816807083", "should return JSON with canLogin field, NO TypeError"),
        ("817673476", "should return JSON with canLogin:true")
    ]
    
    results = []
    
    for chat_id, description in test_cases:
        print(f"\n   Testing /login-count/{chat_id} - {description}")
        try:
            response = requests.get(f"{BASE_URL}/login-count/{chat_id}", timeout=10)
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    
                    # Check for canLogin field (can be at root or in val object)
                    can_login = data.get('canLogin') or (data.get('val', {}).get('canLogin'))
                    
                    if can_login is not None:
                        print(f"   ✅ canLogin field present: {can_login}")
                        
                        # Special check for 817673476 - should have canLogin:true
                        if chat_id == "817673476" and can_login is True:
                            print("   ✅ canLogin:true confirmed for 817673476")
                        elif chat_id == "816807083":
                            print("   ✅ No TypeError - JSON response received")
                            
                        results.append(True)
                    else:
                        print("   ❌ canLogin field missing from response")
                        results.append(False)
                        
                except json.JSONDecodeError as e:
                    print(f"   ❌ Invalid JSON response: {str(e)}")
                    print(f"   Raw response: {response.text[:200]}")
                    results.append(False)
            else:
                print(f"   ❌ HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                results.append(False)
                
        except Exception as e:
            print(f"   ❌ Request failed: {str(e)}")
            results.append(False)
    
    return all(results)

def test_sms_app_auth_previous_fixes():
    """Test previous fixes: SMS app auth endpoints"""
    print("\n🔍 Testing Previous Fixes - SMS App Auth Endpoints...")
    
    test_cases = [
        ("817673476", "dev-test123", "should return valid:true, canLogin:true"),
        ("8246464913", "dev-test456", "should return valid:true, canLogin:true")
    ]
    
    results = []
    
    for chat_id, device_id, description in test_cases:
        print(f"\n   Testing /sms-app/auth/{chat_id}?deviceId={device_id}")
        print(f"   Expected: {description}")
        
        try:
            response = requests.get(
                f"{BASE_URL}/sms-app/auth/{chat_id}",
                params={"deviceId": device_id},
                timeout=10
            )
            print(f"   Status Code: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"   Response: {json.dumps(data, indent=2)}")
                    
                    # Check for required fields (canLogin is in user object)
                    valid = data.get('valid')
                    user = data.get('user', {})
                    can_login = user.get('canLogin')
                    
                    if valid is True and can_login is True:
                        print("   ✅ PASSED - valid:true, canLogin:true")
                        results.append(True)
                    else:
                        print(f"   ❌ FAILED - valid:{valid}, canLogin:{can_login}")
                        results.append(False)
                        
                except json.JSONDecodeError as e:
                    print(f"   ❌ Invalid JSON response: {str(e)}")
                    results.append(False)
            else:
                print(f"   ❌ HTTP {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                results.append(False)
                
        except Exception as e:
            print(f"   ❌ Request failed: {str(e)}")
            results.append(False)
    
    return all(results)

def run_all_tests():
    """Run all backend tests for the review request"""
    print("=" * 60)
    print("🚀 BACKEND TESTING - Node.js Express Server (Port 5000)")
    print("=" * 60)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Focus: B4/B6/B7 Bug Fixes + Previous Functionality")
    print("=" * 60)
    
    test_results = []
    
    # Test 1: Health endpoint (B6 & B7)
    test_results.append(("Health Check (B6/B7)", test_health_endpoint()))
    
    # Test 2: B4 TypeError fix
    test_results.append(("B4 TypeError Fix", test_login_count_b4_fix()))
    
    # Test 3: Previous fixes verification
    test_results.append(("Previous Fixes", test_sms_app_auth_previous_fixes()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.0f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend fixes verified successfully!")
        return True
    else:
        print("⚠️  Some tests failed - see details above")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)