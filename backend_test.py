#!/usr/bin/env python3
"""
Backend Test for Nomadly - Current Review Request Verification
Tests the specific endpoints mentioned in the review request:
1. GET http://localhost:5000/health — should return healthy
2. GET http://localhost:5000/sms-app/download/info — should return version "2.3.2", available: true, size > 3000000
3. GET http://localhost:5000/sms-app/download — should return 200 with ~3.7MB APK file
4. GET http://localhost:5000/sms-app/diagnostics/817673476 — should return full diagnostics object
5. PUT http://localhost:5000/sms-app/campaigns/6ea885e6-ae57-448b-9eff-0bfa18e7096c/progress with body {"chatId": "817673476", "sentCount": 2, "failedCount": 0, "status": "completed"} — should return ok with freeSmsRemaining
"""

import requests
import json
import sys

# Test configuration
BASE_URL = "http://localhost:5000"
TEST_CHAT_ID = "817673476"
TEST_CAMPAIGN_ID = "6ea885e6-ae57-448b-9eff-0bfa18e7096c"

def test_health_endpoint():
    """Test health check endpoint"""
    print("🔍 Testing Health Check Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"✅ GET {BASE_URL}/health - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get("status") == "healthy":
                print("   ✅ Health check response shows healthy status")
                return True
            else:
                print(f"   ❌ Health check status is not 'healthy': {data.get('status')}")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing health endpoint: {e}")
        return False

def test_download_info_endpoint():
    """Test SMS app download info endpoint"""
    print("\n🔍 Testing SMS App Download Info Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/sms-app/download/info", timeout=10)
        print(f"✅ GET {BASE_URL}/sms-app/download/info - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields and values
            version = data.get("version")
            available = data.get("available")
            size = data.get("size")
            
            success = True
            
            if version == "2.3.2":
                print(f"   ✅ Version is correct: {version}")
            else:
                print(f"   ❌ Expected version '2.3.2', got '{version}'")
                success = False
                
            if available is True:
                print(f"   ✅ Available is true: {available}")
            else:
                print(f"   ❌ Expected available to be true, got {available}")
                success = False
                
            if isinstance(size, int) and size > 3000000:
                print(f"   ✅ Size is greater than 3MB: {size:,} bytes")
            else:
                print(f"   ❌ Expected size > 3,000,000 bytes, got {size}")
                success = False
                
            return success
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing download info endpoint: {e}")
        return False

def test_download_endpoint():
    """Test SMS app download endpoint"""
    print("\n🔍 Testing SMS App Download Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/sms-app/download", timeout=30)
        print(f"✅ GET {BASE_URL}/sms-app/download - Status: {response.status_code}")
        
        if response.status_code == 200:
            content_length = len(response.content)
            content_type = response.headers.get('content-type', '')
            
            print(f"   Content-Type: {content_type}")
            print(f"   Content-Length: {content_length:,} bytes ({content_length/1024/1024:.1f} MB)")
            
            # Verify file size is approximately 3.7MB
            expected_min_size = 3.5 * 1024 * 1024  # 3.5MB
            expected_max_size = 4.0 * 1024 * 1024  # 4.0MB
            
            if expected_min_size <= content_length <= expected_max_size:
                print(f"   ✅ APK file size is within expected range (~3.7MB)")
                return True
            else:
                print(f"   ❌ APK file size {content_length:,} bytes is outside expected range {expected_min_size:,}-{expected_max_size:,}")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing download endpoint: {e}")
        return False

def test_diagnostics_endpoint():
    """Test SMS app diagnostics endpoint"""
    print("\n🔍 Testing SMS App Diagnostics Endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/sms-app/diagnostics/{TEST_CHAT_ID}", timeout=10)
        print(f"✅ GET {BASE_URL}/sms-app/diagnostics/{TEST_CHAT_ID} - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response keys: {list(data.keys())}")
            
            # Verify expected sections in diagnostics
            expected_sections = ['user', 'device', 'campaigns', 'errors']
            success = True
            
            for section in expected_sections:
                if section in data:
                    print(f"   ✅ {section} section present")
                    if section == 'user' and 'name' in data[section]:
                        print(f"      User name: {data[section]['name']}")
                    elif section == 'campaigns' and 'total' in data[section]:
                        print(f"      Total campaigns: {data[section]['total']}")
                    elif section == 'errors' and isinstance(data[section], dict):
                        print(f"      Error types: {list(data[section].keys())}")
                else:
                    print(f"   ❌ {section} section missing")
                    success = False
            
            return success
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing diagnostics endpoint: {e}")
        return False

def test_campaign_progress_endpoint():
    """Test campaign progress update endpoint"""
    print("\n🔍 Testing Campaign Progress Update Endpoint...")
    
    # Request body as specified in review request
    progress_data = {
        "chatId": TEST_CHAT_ID,
        "sentCount": 2,
        "failedCount": 0,
        "status": "completed"
    }
    
    try:
        response = requests.put(
            f"{BASE_URL}/sms-app/campaigns/{TEST_CAMPAIGN_ID}/progress",
            json=progress_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"✅ PUT {BASE_URL}/sms-app/campaigns/{TEST_CAMPAIGN_ID}/progress - Status: {response.status_code}")
        print(f"   Request data: {json.dumps(progress_data, indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify response contains freeSmsRemaining
            if 'freeSmsRemaining' in data:
                print(f"   ✅ Response contains freeSmsRemaining: {data['freeSmsRemaining']}")
                return True
            else:
                print(f"   ❌ Response missing freeSmsRemaining field")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing campaign progress endpoint: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Nomadly Backend Tests - Current Review Request Verification")
    print("=" * 80)
    print(f"Testing backend at: {BASE_URL}")
    print(f"Test user chatId: {TEST_CHAT_ID}")
    print(f"Test campaign ID: {TEST_CAMPAIGN_ID}")
    print("=" * 80)
    
    tests = [
        ("Health Check", test_health_endpoint),
        ("Download Info", test_download_info_endpoint),
        ("APK Download", test_download_endpoint),
        ("Diagnostics", test_diagnostics_endpoint),
        ("Campaign Progress", test_campaign_progress_endpoint),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} - PASSED")
            else:
                print(f"❌ {test_name} - FAILED")
        except Exception as e:
            print(f"❌ {test_name} - ERROR: {e}")
        
        print("-" * 60)
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend endpoints are working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())