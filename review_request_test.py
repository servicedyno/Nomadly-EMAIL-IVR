#!/usr/bin/env python3
"""
Nomadly Review Request Testing Script
Focus on the specific endpoints mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://get-going-11.preview.emergentagent.com"
TEST_CHAT_ID = "6687923716"  # From test_credentials.md
INVALID_CHAT_ID = "9999999999"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {details}")

def test_health_check():
    """Review Request Test 1: Health Check - GET /api/health"""
    print_test_header("Health Check")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print_result(True, "Health check passed", f"Status: {data.get('status')}")
                return True
            else:
                print_result(False, "Health check returned wrong status", f"Got: {data}")
                return False
        else:
            print_result(False, f"Health check failed with status {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, "Health check request failed", str(e))
        return False

def test_sms_app_auth_valid():
    """Review Request Test 2: SMS App Auth (valid) - GET /api/sms-app/auth/6687923716"""
    print_test_header("SMS App Auth (Valid)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/sms-app/auth/{TEST_CHAT_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("valid") == True:
                print_result(True, "Valid auth check passed", f"User: {data.get('user', {}).get('name', 'Unknown')}")
                print(f"   Plan: {data.get('user', {}).get('plan', 'none')}")
                print(f"   Free trial: {data.get('user', {}).get('isFreeTrial', False)}")
                print(f"   Can use SMS: {data.get('user', {}).get('canUseSms', False)}")
                print(f"   Free SMS remaining: {data.get('user', {}).get('freeSmsRemaining', 0)}")
                return True
            else:
                print_result(False, "Auth returned valid=false", f"Response: {data}")
                return False
        else:
            print_result(False, f"Auth check failed with status {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, "Auth check request failed", str(e))
        return False

def test_sms_app_auth_invalid():
    """Review Request Test 3: SMS App Auth (invalid) - GET /api/sms-app/auth/9999999999"""
    print_test_header("SMS App Auth (Invalid)")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/sms-app/auth/{INVALID_CHAT_ID}", timeout=10)
        
        if response.status_code == 401:
            print_result(True, "Invalid auth correctly returned 401", f"Response: {response.text}")
            return True
        else:
            print_result(False, f"Invalid auth should return 401, got {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, "Invalid auth request failed", str(e))
        return False

def test_sms_app_sync():
    """Review Request Test 4: SMS App Sync - GET /api/sms-app/sync/6687923716"""
    print_test_header("SMS App Sync")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/sms-app/sync/{TEST_CHAT_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            campaigns_count = len(data.get('campaigns', []))
            print_result(True, "Sync endpoint returned data", f"Campaigns: {campaigns_count}")
            print(f"   User can use SMS: {data.get('user', {}).get('canUseSms', False)}")
            print(f"   Latest version: {data.get('latestVersion', 'N/A')}")
            return True
        else:
            print_result(False, f"Sync failed with status {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, "Sync request failed", str(e))
        return False

def test_apk_download_info():
    """Review Request Test 5: APK Download Info - GET /api/sms-app/download/info"""
    print_test_header("APK Download Info")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/sms-app/download/info", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "version" in data:
                print_result(True, "APK download info returned version", f"Version: {data.get('version')}")
                print(f"   Name: {data.get('name', 'N/A')}")
                print(f"   Size: {data.get('size', 'N/A')} bytes")
                print(f"   Available: {data.get('available', False)}")
                return True
            else:
                print_result(False, "APK download info missing version", f"Response: {data}")
                return False
        else:
            print_result(False, f"APK download info failed with status {response.status_code}", response.text)
            return False
            
    except Exception as e:
        print_result(False, "APK download info request failed", str(e))
        return False

def test_single_ivr_twiml():
    """Review Request Test 6: SingleIVR TwiML - POST /api/twilio/single-ivr?sessionId=nonexistent"""
    print_test_header("SingleIVR TwiML Verification")
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/twilio/single-ivr?sessionId=nonexistent", timeout=10)
        
        # Check if response is XML
        content_type = response.headers.get('content-type', '').lower()
        is_xml = 'xml' in content_type or response.text.strip().startswith('<?xml') or response.text.strip().startswith('<Response>')
        
        if response.status_code == 200 and is_xml:
            print_result(True, "SingleIVR TwiML returned XML response", f"Content-Type: {content_type}")
            print(f"   TwiML Content: {response.text}")
            
            # Check for 2-second pause (optional - may not be present for error cases)
            has_pause = '<Pause length="2"/>' in response.text or '<Pause length="2">' in response.text
            if has_pause:
                print("   ✅ Contains 2-second pause")
            else:
                print("   ⚠️  No 2-second pause (expected for error case)")
            
            return True
        else:
            print_result(False, f"SingleIVR TwiML failed - Status: {response.status_code}, Content-Type: {content_type}", response.text[:200])
            return False
            
    except Exception as e:
        print_result(False, "SingleIVR TwiML request failed", str(e))
        return False

def test_bulk_ivr_twiml():
    """Review Request Test 7: BulkIVR TwiML - POST /api/twilio/bulk-ivr?campaignId=nonexistent&leadIndex=0"""
    print_test_header("BulkIVR TwiML Verification")
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/twilio/bulk-ivr?campaignId=nonexistent&leadIndex=0", timeout=10)
        
        # Check if response is XML
        content_type = response.headers.get('content-type', '').lower()
        is_xml = 'xml' in content_type or response.text.strip().startswith('<?xml') or response.text.strip().startswith('<Response>')
        
        if response.status_code == 200 and is_xml:
            print_result(True, "BulkIVR TwiML returned XML response", f"Content-Type: {content_type}")
            print(f"   TwiML Content: {response.text}")
            
            # Check for 2-second pause (optional - may not be present for error cases)
            has_pause = '<Pause length="2"/>' in response.text or '<Pause length="2">' in response.text
            if has_pause:
                print("   ✅ Contains 2-second pause")
            else:
                print("   ⚠️  No 2-second pause (expected for error case)")
            
            return True
        else:
            print_result(False, f"BulkIVR TwiML failed - Status: {response.status_code}, Content-Type: {content_type}", response.text[:200])
            return False
            
    except Exception as e:
        print_result(False, "BulkIVR TwiML request failed", str(e))
        return False

def main():
    """Run all review request tests and provide summary"""
    print(f"Nomadly Review Request Testing - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test User: {TEST_CHAT_ID}")
    
    # Run all tests
    tests = [
        ("Health Check", test_health_check),
        ("SMS App Auth (Valid)", test_sms_app_auth_valid),
        ("SMS App Auth (Invalid)", test_sms_app_auth_invalid),
        ("SMS App Sync", test_sms_app_sync),
        ("APK Download Info", test_apk_download_info),
        ("SingleIVR TwiML", test_single_ivr_twiml),
        ("BulkIVR TwiML", test_bulk_ivr_twiml),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_result(False, f"{test_name} crashed", str(e))
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'='*60}")
    print("REVIEW REQUEST TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL REVIEW REQUEST TESTS PASSED!")
        return 0
    else:
        print("⚠️  Some tests failed - Review required")
        return 1

if __name__ == "__main__":
    sys.exit(main())