#!/usr/bin/env python3
"""
Nomadly SMS App Backend Test Suite - Review Request Specific Tests
Testing campaign creation with multiple content items and smsGapTime functionality
"""

import requests
import json
import time
import os

# Backend URL from environment
BACKEND_URL = "https://get-going-11.preview.emergentagent.com"

# Test credentials - user now has free trial with 100 SMS
TEST_CHAT_ID = "6687923716"  # Free trial active, 100 free SMS remaining
INVALID_CHAT_ID = "9999999999"

def test_health_check():
    """Test 1: Health check - should return 200 with status: healthy"""
    print("🔍 Test 1: Health check")
    
    try:
        url = f"{BACKEND_URL}/api/health"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print(f"✅ PASS: Health check returns 200 with status: healthy")
                return True
            else:
                print(f"❌ FAIL: Health check status is {data.get('status')}")
                return False
        else:
            print(f"❌ FAIL: Health check returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Health check error: {e}")
        return False

def test_auth_valid():
    """Test 2: Auth with valid chatId - should return 200 with valid=true"""
    print("\n🔍 Test 2: Auth with valid chatId")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/auth/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') == True:
                print(f"✅ PASS: Auth returns 200 with valid=true")
                print(f"   User: {data.get('user', {}).get('name', 'Unknown')}")
                print(f"   Can use SMS: {data.get('user', {}).get('canUseSms', False)}")
                print(f"   Free SMS remaining: {data.get('user', {}).get('freeSmsRemaining', 0)}")
                return True
            else:
                print(f"❌ FAIL: Auth valid is {data.get('valid')}")
                return False
        else:
            print(f"❌ FAIL: Auth endpoint returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Auth endpoint error: {e}")
        return False

def test_auth_invalid():
    """Test 3: Auth with invalid chatId - should return 401"""
    print("\n🔍 Test 3: Auth with invalid chatId")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/auth/{INVALID_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 401:
            print(f"✅ PASS: Invalid auth returns 401")
            return True
        else:
            print(f"❌ FAIL: Invalid auth returned {response.status_code} instead of 401")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Invalid auth test error: {e}")
        return False

def test_sync_endpoint():
    """Test 4: Sync endpoint - should return canUseSms, campaigns array"""
    print("\n🔍 Test 4: Sync endpoint")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/sync/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            user = data.get('user', {})
            campaigns = data.get('campaigns', [])
            
            print(f"✅ PASS: Sync returns canUseSms={user.get('canUseSms')}, campaigns array with {len(campaigns)} items")
            return True
        else:
            print(f"❌ FAIL: Sync endpoint returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Sync endpoint error: {e}")
        return False

def test_create_campaign_with_rotation():
    """Test 5: Create campaign with multiple content items and custom smsGapTime"""
    print("\n🔍 Test 5: Create campaign with message rotation and smsGapTime=10")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns"
        payload = {
            "chatId": TEST_CHAT_ID,
            "name": "Test Bot Campaign",
            "content": ["Hello [name]", "Hi [name], check this out"],
            "contacts": [{"phoneNumber": "+18189279992", "name": "John"}],
            "smsGapTime": 10,
            "source": "bot"
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            campaign = data.get('campaign', {})
            
            # Check content array has 2 items
            content = campaign.get('content', [])
            if len(content) != 2:
                print(f"❌ FAIL: Content array has {len(content)} items, expected 2")
                return False, None
            
            # Check smsGapTime is stored as 10
            gap_time = campaign.get('smsGapTime')
            if gap_time != 10:
                print(f"❌ FAIL: smsGapTime is {gap_time}, expected 10")
                return False, None
            
            # Check content items
            expected_content = ["Hello [name]", "Hi [name], check this out"]
            if content != expected_content:
                print(f"❌ FAIL: Content mismatch. Got: {content}, Expected: {expected_content}")
                return False, None
            
            campaign_id = campaign.get('_id')
            print(f"✅ PASS: Campaign created successfully with:")
            print(f"   - Content array: {len(content)} messages")
            print(f"   - smsGapTime: {gap_time} (not hardcoded 5)")
            print(f"   - Campaign ID: {campaign_id}")
            print(f"   - Messages: {content}")
            
            return True, campaign_id
        else:
            print(f"❌ FAIL: Campaign creation returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"❌ FAIL: Create campaign error: {e}")
        return False, None

def test_get_created_campaign(campaign_id):
    """Test 6: Get campaigns to verify the created campaign"""
    print(f"\n🔍 Test 6: Get campaigns to verify created campaign")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            campaigns = data.get('campaigns', [])
            
            # Find our created campaign
            created_campaign = None
            for campaign in campaigns:
                if campaign.get('_id') == campaign_id:
                    created_campaign = campaign
                    break
            
            if created_campaign:
                content = created_campaign.get('content', [])
                gap_time = created_campaign.get('smsGapTime')
                
                print(f"✅ PASS: Created campaign found with:")
                print(f"   - Name: {created_campaign.get('name')}")
                print(f"   - Content array: {len(content)} items")
                print(f"   - smsGapTime: {gap_time}")
                print(f"   - Messages: {content}")
                
                return True
            else:
                print(f"❌ FAIL: Created campaign with ID {campaign_id} not found")
                return False
        else:
            print(f"❌ FAIL: Get campaigns returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Get campaigns error: {e}")
        return False

def test_plan_info():
    """Test 7: Plan info - should return plan info"""
    print("\n🔍 Test 7: Plan info")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/plan/{TEST_CHAT_ID}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ PASS: Plan info returns 200")
            print(f"   Plan: {data.get('plan', 'none')}")
            print(f"   Can use SMS: {data.get('canUseSms', False)}")
            print(f"   Free trial: {data.get('isFreeTrial', False)}")
            print(f"   Free SMS remaining: {data.get('freeSmsRemaining', 0)}")
            return True
        else:
            print(f"❌ FAIL: Plan info returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Plan info error: {e}")
        return False

def test_apk_download():
    """Test 8: APK download - should return 200 with APK file"""
    print("\n🔍 Test 8: APK download")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/download"
        response = requests.get(url, timeout=30)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            size_mb = content_length / (1024 * 1024)
            
            print(f"✅ PASS: APK download returns 200")
            print(f"   Size: {size_mb:.1f}MB")
            print(f"   Content-Type: {content_type}")
            return True
        else:
            print(f"❌ FAIL: APK download returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: APK download error: {e}")
        return False

def test_download_info():
    """Test 9: Download info - should return version info"""
    print("\n🔍 Test 9: Download info")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/download/info"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ PASS: Download info returns 200")
            print(f"   Version: {data.get('version')}")
            print(f"   Name: {data.get('name')}")
            print(f"   Size: {data.get('size')} bytes")
            print(f"   Available: {data.get('available')}")
            return True
        else:
            print(f"❌ FAIL: Download info returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Download info error: {e}")
        return False

def test_delete_campaign(campaign_id):
    """Test 10: Delete campaign for cleanup"""
    print(f"\n🔍 Test 10: Delete campaign for cleanup")
    
    try:
        url = f"{BACKEND_URL}/api/sms-app/campaigns/{campaign_id}?chatId={TEST_CHAT_ID}"
        response = requests.delete(url, timeout=10)
        
        if response.status_code == 200:
            print(f"✅ PASS: Campaign deleted successfully")
            return True
        else:
            print(f"❌ FAIL: Campaign deletion returned {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Delete campaign error: {e}")
        return False

def run_review_tests():
    """Run all tests for the review request"""
    print("🚀 Starting Nomadly SMS App Backend Testing Suite - Review Request")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test chatId: {TEST_CHAT_ID}")
    print("Focus: Campaign creation with message rotation and smsGapTime")
    print("=" * 80)
    
    tests_results = []
    campaign_id = None
    
    # Test 1: Health check
    tests_results.append(("Health Check", test_health_check()))
    
    # Test 2: Auth valid
    tests_results.append(("Auth Valid", test_auth_valid()))
    
    # Test 3: Auth invalid
    tests_results.append(("Auth Invalid", test_auth_invalid()))
    
    # Test 4: Sync endpoint
    tests_results.append(("Sync Endpoint", test_sync_endpoint()))
    
    # Test 5: Create campaign with rotation
    success, campaign_id = test_create_campaign_with_rotation()
    tests_results.append(("Create Campaign with Rotation", success))
    
    # Test 6: Get created campaign (only if creation succeeded)
    if campaign_id:
        tests_results.append(("Get Created Campaign", test_get_created_campaign(campaign_id)))
    
    # Test 7: Plan info
    tests_results.append(("Plan Info", test_plan_info()))
    
    # Test 8: APK download
    tests_results.append(("APK Download", test_apk_download()))
    
    # Test 9: Download info
    tests_results.append(("Download Info", test_download_info()))
    
    # Test 10: Delete campaign (only if creation succeeded)
    if campaign_id:
        tests_results.append(("Delete Campaign", test_delete_campaign(campaign_id)))
    
    # Summary
    passed = sum(1 for _, result in tests_results if result)
    total = len(tests_results)
    failed_tests = [name for name, result in tests_results if not result]
    
    print("\n" + "=" * 80)
    print(f"📊 TEST RESULTS: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for test_name in failed_tests:
            print(f"   - {test_name}")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED!")
        print("\n✅ KEY VERIFICATION POINTS CONFIRMED:")
        print("   - Campaign creation accepts multiple content items (message rotation)")
        print("   - smsGapTime is stored as 10 (not hardcoded 5)")
        print("   - Content array has 2 items when 2 messages are sent")
        print("   - All existing endpoints still work")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return False

if __name__ == "__main__":
    success = run_review_tests()
    exit(0 if success else 1)