#!/usr/bin/env python3
"""
Nomadly Backend Testing - Final Comprehensive Test Round 2
Test User: 817673476 (johngambino - Active free trial)
Backend URL: http://localhost:5000

Tests:
1. Health check
2. Download info (version 2.4.0, size > 3.5MB)
3. Sync returns latestVersion field
4. Trial persistence check (freeSmsUsed > 0)
5. Campaign CRUD cycle
6. Progress endpoint returns canUseSms
7. APK download
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:5000"
TEST_USER = "817673476"  # johngambino - Active free trial
EXPECTED_VERSION = "2.4.0"
MIN_APK_SIZE = 3.5 * 1024 * 1024  # 3.5MB in bytes

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_icon = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_icon} {test_name}")
    if details:
        print(f"    {details}")

def test_health_check():
    """Test 1: Health check"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log_test("Health Check", "PASS", f"Status: {data.get('status')}, Database: {data.get('database')}")
                return True
            else:
                log_test("Health Check", "FAIL", f"Unhealthy status: {data}")
                return False
        else:
            log_test("Health Check", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Health Check", "FAIL", f"Exception: {e}")
        return False

def test_download_info():
    """Test 2: Download info - version 2.4.0, size > 3.5MB"""
    try:
        response = requests.get(f"{BASE_URL}/sms-app/download/info", timeout=10)
        if response.status_code == 200:
            data = response.json()
            version = data.get("version")
            size = data.get("size", 0)
            available = data.get("available", False)
            
            if version == EXPECTED_VERSION and size > MIN_APK_SIZE and available:
                log_test("Download Info", "PASS", f"Version: {version}, Size: {size:,} bytes ({size/1024/1024:.1f}MB), Available: {available}")
                return True
            else:
                log_test("Download Info", "FAIL", f"Version: {version} (expected {EXPECTED_VERSION}), Size: {size:,} bytes, Available: {available}")
                return False
        else:
            log_test("Download Info", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Download Info", "FAIL", f"Exception: {e}")
        return False

def test_sync_latest_version():
    """Test 3: Sync returns latestVersion field"""
    try:
        response = requests.get(f"{BASE_URL}/sms-app/sync/{TEST_USER}?version=2.3.0", timeout=10)
        if response.status_code == 200:
            data = response.json()
            latest_version = data.get("latestVersion")
            
            if latest_version == EXPECTED_VERSION:
                log_test("Sync latestVersion", "PASS", f"latestVersion: {latest_version}")
                return True
            else:
                log_test("Sync latestVersion", "FAIL", f"latestVersion: {latest_version} (expected {EXPECTED_VERSION})")
                return False
        else:
            log_test("Sync latestVersion", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Sync latestVersion", "FAIL", f"Exception: {e}")
        return False

def test_trial_persistence():
    """Test 4: Trial persistence check - freeSmsUsed > 0 OR freeSmsRemaining < 100 (proving trial counter persists)"""
    try:
        response = requests.get(f"{BASE_URL}/sms-app/auth/{TEST_USER}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            free_sms_used = data.get("freeSmsUsed", 0)
            free_sms_remaining = data.get("freeSmsRemaining", 0)
            
            # Trial persistence is proven if either freeSmsUsed > 0 OR freeSmsRemaining < 100 (default trial limit)
            if free_sms_used > 0 or free_sms_remaining < 100:
                log_test("Trial Persistence", "PASS", f"freeSmsUsed: {free_sms_used}, freeSmsRemaining: {free_sms_remaining} (trial counter persists)")
                return True
            else:
                log_test("Trial Persistence", "FAIL", f"freeSmsUsed: {free_sms_used}, freeSmsRemaining: {free_sms_remaining} (trial appears to have reset)")
                return False
        else:
            log_test("Trial Persistence", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Trial Persistence", "FAIL", f"Exception: {e}")
        return False

def test_campaign_crud_cycle():
    """Test 5: Campaign CRUD cycle"""
    campaign_id = None
    
    try:
        # 5a. Create campaign
        create_payload = {
            "chatId": TEST_USER,
            "name": "Delete Test",
            "content": ["Test msg"],
            "contacts": [{"phoneNumber": "+18189279992", "name": "Test"}],
            "smsGapTime": 5,
            "source": "app"
        }
        
        response = requests.post(f"{BASE_URL}/sms-app/campaigns", json=create_payload, timeout=10)
        if response.status_code != 200:
            log_test("Campaign Create", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        create_data = response.json()
        campaign_id = create_data.get("campaign", {}).get("_id") or create_data.get("id")
        if not campaign_id:
            log_test("Campaign Create", "FAIL", f"No campaign ID returned: {create_data}")
            return False
        
        log_test("Campaign Create", "PASS", f"Campaign ID: {campaign_id}")
        
        # 5b. Verify campaign exists
        response = requests.get(f"{BASE_URL}/sms-app/campaigns/{TEST_USER}", timeout=10)
        if response.status_code != 200:
            log_test("Campaign List", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        campaigns_data = response.json()
        campaigns = campaigns_data.get("campaigns", [])
        campaign_found = any(c.get("_id") == campaign_id for c in campaigns)
        if not campaign_found:
            log_test("Campaign List", "FAIL", f"Campaign {campaign_id} not found in list")
            return False
        
        log_test("Campaign List", "PASS", f"Campaign {campaign_id} found in list")
        
        # 5c. Delete campaign
        response = requests.delete(f"{BASE_URL}/sms-app/campaigns/{campaign_id}?chatId={TEST_USER}", timeout=10)
        if response.status_code != 200:
            log_test("Campaign Delete", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        log_test("Campaign Delete", "PASS", f"Campaign {campaign_id} deleted")
        
        # 5d. Verify campaign is gone
        response = requests.get(f"{BASE_URL}/sms-app/campaigns/{TEST_USER}", timeout=10)
        if response.status_code != 200:
            log_test("Campaign Delete Verify", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        campaigns_data = response.json()
        campaigns = campaigns_data.get("campaigns", [])
        campaign_found = any(c.get("_id") == campaign_id for c in campaigns)
        if campaign_found:
            log_test("Campaign Delete Verify", "FAIL", f"Campaign {campaign_id} still exists after deletion")
            return False
        
        log_test("Campaign Delete Verify", "PASS", f"Campaign {campaign_id} successfully removed")
        return True
        
    except Exception as e:
        log_test("Campaign CRUD", "FAIL", f"Exception: {e}")
        return False

def test_progress_endpoint():
    """Test 6: Progress endpoint returns canUseSms and freeSmsRemaining"""
    campaign_id = None
    
    try:
        # Create a campaign first
        create_payload = {
            "chatId": TEST_USER,
            "name": "Progress Test",
            "content": ["Progress test msg"],
            "contacts": [{"phoneNumber": "+18189279992", "name": "Test"}],
            "smsGapTime": 5,
            "source": "app"
        }
        
        response = requests.post(f"{BASE_URL}/sms-app/campaigns", json=create_payload, timeout=10)
        if response.status_code != 200:
            log_test("Progress Test Setup", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        create_data = response.json()
        campaign_id = create_data.get("campaign", {}).get("_id") or create_data.get("id")
        
        # Update progress
        progress_payload = {
            "chatId": TEST_USER,
            "sentCount": 1,
            "failedCount": 0,
            "status": "sending"
        }
        
        response = requests.put(f"{BASE_URL}/sms-app/campaigns/{campaign_id}/progress", json=progress_payload, timeout=10)
        if response.status_code != 200:
            log_test("Progress Update", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
        
        progress_data = response.json()
        can_use_sms = progress_data.get("canUseSms")
        free_sms_remaining = progress_data.get("freeSmsRemaining")
        
        if can_use_sms is not None and free_sms_remaining is not None:
            log_test("Progress Update", "PASS", f"canUseSms: {can_use_sms}, freeSmsRemaining: {free_sms_remaining}")
            
            # Clean up - delete the test campaign
            requests.delete(f"{BASE_URL}/sms-app/campaigns/{campaign_id}?chatId={TEST_USER}", timeout=10)
            return True
        else:
            log_test("Progress Update", "FAIL", f"Missing required fields - canUseSms: {can_use_sms}, freeSmsRemaining: {free_sms_remaining}")
            return False
        
    except Exception as e:
        log_test("Progress Update", "FAIL", f"Exception: {e}")
        return False
    finally:
        # Clean up campaign if it exists
        if campaign_id:
            try:
                requests.delete(f"{BASE_URL}/sms-app/campaigns/{campaign_id}?chatId={TEST_USER}", timeout=10)
            except:
                pass

def test_apk_download():
    """Test 7: APK download - 200 status, ~3.8MB size"""
    try:
        response = requests.get(f"{BASE_URL}/sms-app/download", timeout=30)
        if response.status_code == 200:
            content_length = len(response.content)
            content_type = response.headers.get("content-type", "")
            
            if content_length > MIN_APK_SIZE and "android" in content_type.lower():
                log_test("APK Download", "PASS", f"Size: {content_length:,} bytes ({content_length/1024/1024:.1f}MB), Content-Type: {content_type}")
                return True
            else:
                log_test("APK Download", "FAIL", f"Size: {content_length:,} bytes, Content-Type: {content_type}")
                return False
        else:
            log_test("APK Download", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("APK Download", "FAIL", f"Exception: {e}")
        return False

def main():
    """Run all tests"""
    print(f"🚀 Starting Nomadly Backend Testing - Final Comprehensive Test Round 2")
    print(f"📍 Backend URL: {BASE_URL}")
    print(f"👤 Test User: {TEST_USER} (johngambino - Active free trial)")
    print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    tests = [
        ("Health Check", test_health_check),
        ("Download Info", test_download_info),
        ("Sync latestVersion", test_sync_latest_version),
        ("Trial Persistence", test_trial_persistence),
        ("Campaign CRUD", test_campaign_crud_cycle),
        ("Progress Endpoint", test_progress_endpoint),
        ("APK Download", test_apk_download),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        if test_func():
            passed += 1
    
    print("=" * 80)
    print(f"📊 Test Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend is fully functional!")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())