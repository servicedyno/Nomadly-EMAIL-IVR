#!/usr/bin/env python3
"""
Backend Testing for Nomadly SMS App - Review Request Verification
Testing specific fixes: B1 (canLogin fix), B2 (Health check), B3 (Billing logic)
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL - Node.js Express server on port 5000
BASE_URL = "http://localhost:5000"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_icon = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_icon} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_health_check():
    """Test B2 & B3: Health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log_test("Health Check", "PASS", f"Status: {data.get('status')}, Database: {data.get('database', 'N/A')}")
                return True
            else:
                log_test("Health Check", "FAIL", f"Unexpected status: {data}")
                return False
        else:
            log_test("Health Check", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Health Check", "FAIL", f"Exception: {str(e)}")
        return False

def test_login_count(chat_id):
    """Test B1: Login count endpoint - should return canLogin: true"""
    try:
        response = requests.get(f"{BASE_URL}/login-count/{chat_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # canLogin is nested under val.canLogin
            can_login = data.get("val", {}).get("canLogin")
            login_count = data.get("val", {}).get("loginCount")
            if can_login is True:
                log_test(f"Login Count ({chat_id})", "PASS", f"canLogin: {can_login}, loginCount: {login_count}")
                return True
            else:
                log_test(f"Login Count ({chat_id})", "FAIL", f"canLogin: {can_login} (expected: true)")
                return False
        else:
            log_test(f"Login Count ({chat_id})", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test(f"Login Count ({chat_id})", "FAIL", f"Exception: {str(e)}")
        return False

def test_sms_app_auth(chat_id, device_id):
    """Test B1: SMS App auth endpoint - should return valid: true and canLogin: true"""
    try:
        response = requests.get(f"{BASE_URL}/sms-app/auth/{chat_id}?deviceId={device_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            valid = data.get("valid")
            # canLogin is nested under user.canLogin
            user_data = data.get("user", {})
            can_login = user_data.get("canLogin")
            can_use_sms = user_data.get("canUseSms")
            
            if valid is True and can_login is True:
                log_test(f"SMS App Auth ({chat_id})", "PASS", f"valid: {valid}, canLogin: {can_login}, canUseSms: {can_use_sms}")
                return True
            else:
                log_test(f"SMS App Auth ({chat_id})", "FAIL", f"valid: {valid}, canLogin: {can_login} (expected: both true)")
                return False
        else:
            log_test(f"SMS App Auth ({chat_id})", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test(f"SMS App Auth ({chat_id})", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all backend tests for the review request"""
    print("=" * 80)
    print("BACKEND TESTING - Review Request Verification")
    print("Testing Node.js Express backend on http://localhost:5000")
    print("=" * 80)
    print()
    
    # Test data from review request
    chat_id_1 = "817673476"  # johngambino
    chat_id_2 = "8246464913"  # heimlich_himmler
    device_id_1 = "dev-test123"
    device_id_2 = "dev-test456"
    
    results = []
    
    # B2 & B3: Health Check
    print("🔍 Testing B2 & B3: Health Check")
    results.append(test_health_check())
    
    # B1: canLogin fix tests
    print("🔍 Testing B1: canLogin Fix")
    
    # Test 1: Login count for chat_id_1 (should show canLogin: true)
    results.append(test_login_count(chat_id_1))
    
    # Test 2: SMS App auth for chat_id_1 (should return valid: true, canLogin: true)
    results.append(test_sms_app_auth(chat_id_1, device_id_1))
    
    # Test 3: SMS App auth for chat_id_2 (should return valid: true, canLogin: true)
    results.append(test_sms_app_auth(chat_id_2, device_id_2))
    
    # Test 4: Verify login count still shows canLogin: true after auth
    print("🔍 Re-testing login count after auth (should still be true)")
    results.append(test_login_count(chat_id_1))
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Tests Passed: {passed}/{total}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend fixes verified successfully!")
        return 0
    else:
        print("⚠️  Some tests failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())