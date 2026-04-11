#!/usr/bin/env python3
"""
Nomadly SMS App Backend Test Suite
Testing subscription enforcement and API functionality
"""

import requests
import json
import time
import os

# Backend URL from environment
BACKEND_URL = "https://readme-guide-5.preview.emergentagent.com"

# Test credentials
TEST_CHAT_ID = "6687923716"  # Expired subscription, 0 free SMS remaining
INVALID_CHAT_ID = "9999999999"

def test_auth_valid():
    """Test 1: Auth with valid chatId - should return valid=true, canUseSms=false"""
    print("🔍 Test 1: Auth with valid chatId (expired subscription)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/auth/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') == True and data.get('user', {}).get('canUseSms') == False:
                print(f"✅ PASS: Auth valid, canUseSms=false - {data.get('user', {}).get('name', 'Unknown')}")
                print(f"   Plan: {data.get('user', {}).get('plan', 'none')}")
                print(f"   Free SMS remaining: {data.get('user', {}).get('freeSmsRemaining', 0)}")
                return True
            else:
                print(f"❌ FAIL: Unexpected auth response - valid: {data.get('valid')}, canUseSms: {data.get('user', {}).get('canUseSms')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Auth endpoint returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Auth endpoint error: {e}")
        return False

def test_auth_invalid():
    """Test 2: Auth with invalid chatId - should return 401"""
    print("\n🔍 Test 2: Auth with invalid chatId")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/auth/{INVALID_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 401:
            data = response.json()
            if data.get('valid') == False:
                print(f"✅ PASS: Invalid auth correctly rejected - {data.get('error', 'No error message')}")
                return True
            else:
                print(f"❌ FAIL: Invalid auth response format - {data}")
                return False
        else:
            print(f"❌ FAIL: Invalid auth returned {response.status_code} instead of 401")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Invalid auth test error: {e}")
        return False

def test_sync():
    """Test 3: Sync endpoint - should return canUseSms=false"""
    print("\n🔍 Test 3: Sync endpoint")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/sync/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('user', {}).get('canUseSms') == False:
                print(f"✅ PASS: Sync shows canUseSms=false")
                print(f"   Campaigns count: {len(data.get('campaigns', []))}")
                print(f"   Server time: {data.get('serverTime', 'N/A')}")
                return True
            else:
                print(f"❌ FAIL: Sync shows canUseSms={data.get('user', {}).get('canUseSms')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Sync endpoint returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Sync endpoint error: {e}")
        return False

def test_create_campaign_blocked():
    """Test 4: Create campaign - MUST return 403 with subscription_required"""
    print("\n🔍 Test 4: Create campaign (should be BLOCKED)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns"
        payload = {
            "chatId": int(TEST_CHAT_ID),
            "name": "Test Campaign",
            "content": ["Hi there!"],
            "contacts": [{"phoneNumber": "+1234567890", "name": "Test Contact"}]
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'subscription_required':
                print(f"✅ PASS: Campaign creation blocked - {data.get('message', 'No message')}")
                return True
            else:
                print(f"❌ FAIL: Wrong error type - {data.get('error')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Campaign creation returned {response.status_code} instead of 403")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Create campaign test error: {e}")
        return False

def test_update_campaign_blocked():
    """Test 5: Update campaign - MUST return 403"""
    print("\n🔍 Test 5: Update campaign (should be BLOCKED)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns/test-campaign-id"
        payload = {
            "chatId": int(TEST_CHAT_ID),
            "name": "Updated Campaign Name"
        }
        
        response = requests.put(url, json=payload, timeout=10)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'subscription_required':
                print(f"✅ PASS: Campaign update blocked - {data.get('message', 'No message')}")
                return True
            else:
                print(f"❌ FAIL: Wrong error type - {data.get('error')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Campaign update returned {response.status_code} instead of 403")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Update campaign test error: {e}")
        return False

def test_progress_update_blocked():
    """Test 6: Progress update - MUST return 403"""
    print("\n🔍 Test 6: Progress update (should be BLOCKED)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns/test-campaign-id/progress"
        payload = {
            "chatId": int(TEST_CHAT_ID),
            "sentCount": 1
        }
        
        response = requests.put(url, json=payload, timeout=10)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'subscription_required':
                print(f"✅ PASS: Progress update blocked - {data.get('message', 'No message')}")
                return True
            else:
                print(f"❌ FAIL: Wrong error type - {data.get('error')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Progress update returned {response.status_code} instead of 403")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Progress update test error: {e}")
        return False

def test_sms_sent_blocked():
    """Test 7: SMS sent tracking - MUST return 403"""
    print("\n🔍 Test 7: SMS sent tracking (should be BLOCKED)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/sms-sent/{TEST_CHAT_ID}"
        
        response = requests.post(url, timeout=10)
        
        if response.status_code == 403:
            data = response.json()
            if data.get('error') == 'subscription_required':
                print(f"✅ PASS: SMS sent tracking blocked - {data.get('message', 'No message')}")
                return True
            else:
                print(f"❌ FAIL: Wrong error type - {data.get('error')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: SMS sent tracking returned {response.status_code} instead of 403")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: SMS sent tracking test error: {e}")
        return False

def test_get_campaigns_allowed():
    """Test 8: Get campaigns - should work (read-only operation)"""
    print("\n🔍 Test 8: Get campaigns (read-only, should work)")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            campaigns = data.get('campaigns', [])
            print(f"✅ PASS: Get campaigns works - {len(campaigns)} campaigns found")
            if campaigns:
                print(f"   Sample campaign: {campaigns[0].get('name', 'Unnamed')} ({campaigns[0].get('status', 'unknown')})")
            return True
        else:
            print(f"❌ FAIL: Get campaigns returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Get campaigns test error: {e}")
        return False

def test_apk_download():
    """Test 9: APK download - should return 200, ~3.8MB"""
    print("\n🔍 Test 9: APK download")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/download"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            
            if 'application/vnd.android.package-archive' in content_type:
                size_mb = content_length / (1024 * 1024)
                print(f"✅ PASS: APK download works - {size_mb:.1f}MB, correct content-type")
                return True
            else:
                print(f"❌ FAIL: Wrong content-type - {content_type}")
                return False
        else:
            print(f"❌ FAIL: APK download returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: APK download test error: {e}")
        return False

def test_download_info():
    """Test 10: Download info - should return version 2.0.0"""
    print("\n🔍 Test 10: Download info")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/download/info"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            version = data.get('version')
            if version == '2.0.0':
                print(f"✅ PASS: Download info correct - version {version}")
                print(f"   Name: {data.get('name', 'N/A')}")
                print(f"   Size: {data.get('size', 0)} bytes")
                print(f"   Available: {data.get('available', False)}")
                return True
            else:
                print(f"❌ FAIL: Wrong version - {version}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Download info returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Download info test error: {e}")
        return False

def test_plan_info():
    """Test 11: Plan info - should show canUseSms=false"""
    print("\n🔍 Test 11: Plan info")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/plan/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('canUseSms') == False:
                print(f"✅ PASS: Plan info shows canUseSms=false")
                print(f"   Plan: {data.get('plan', 'none')}")
                print(f"   Subscription: {data.get('isSubscribed', False)}")
                print(f"   Free trial: {data.get('isFreeTrial', False)}")
                print(f"   Free SMS remaining: {data.get('freeSmsRemaining', 0)}")
                return True
            else:
                print(f"❌ FAIL: Plan info shows canUseSms={data.get('canUseSms')}")
                print(f"   Full response: {data}")
                return False
        else:
            print(f"❌ FAIL: Plan info returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Plan info test error: {e}")
        return False

def run_all_tests():
    """Run all Nomadly SMS App tests"""
    print("🚀 Starting Nomadly SMS App Backend Testing Suite")
    print("=" * 70)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test chatId: {TEST_CHAT_ID} (expired subscription, 0 free SMS)")
    print("=" * 70)
    
    tests = [
        test_auth_valid,
        test_auth_invalid,
        test_sync,
        test_create_campaign_blocked,
        test_update_campaign_blocked,
        test_progress_update_blocked,
        test_sms_sent_blocked,
        test_get_campaigns_allowed,
        test_apk_download,
        test_download_info,
        test_plan_info
    ]
    
    passed = 0
    total = len(tests)
    failed_tests = []
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed_tests.append(test.__name__)
        except Exception as e:
            print(f"❌ FAIL: Test {test.__name__} crashed: {e}")
            failed_tests.append(test.__name__)
    
    print("\n" + "=" * 70)
    print(f"📊 TEST RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for test_name in failed_tests:
            print(f"   - {test_name}")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Subscription enforcement is working correctly!")
        print("\n✅ SUMMARY:")
        print("   - Expired users cannot create/update campaigns")
        print("   - Expired users cannot send SMS or update progress")
        print("   - Read-only operations (get campaigns, plan info) work")
        print("   - APK download and info endpoints work")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - subscription enforcement may have issues")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)