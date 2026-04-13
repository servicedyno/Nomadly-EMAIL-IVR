#!/usr/bin/env python3
"""
Backend Testing Script for Nomadly Review Request
Tests specific endpoints mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BACKEND_URL = "https://get-going-11.preview.emergentagent.com"
TEST_USER_ID = "6687923716"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"🧪 {test_name}")
    print(f"{'='*60}")

def print_result(success, message, details=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"   Details: {details}")

def test_health_check():
    """Test 1: Health Check - GET /api/health"""
    print_test_header("Health Check Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print_result(True, "Health check returns 200 with status: healthy", 
                           f"Response: {json.dumps(data, indent=2)}")
                return True
            else:
                print_result(False, "Health check returns 200 but status is not 'healthy'", 
                           f"Response: {json.dumps(data, indent=2)}")
                return False
        else:
            print_result(False, f"Health check failed with status {response.status_code}", 
                        f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Health check request failed", f"Error: {str(e)}")
        return False

def test_sms_app_auth():
    """Test 2: SMS App Auth - GET /api/sms-app/auth/6687923716"""
    print_test_header("SMS App Auth Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/sms-app/auth/{TEST_USER_ID}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "SMS App Auth returns 200", 
                        f"Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print_result(False, f"SMS App Auth failed with status {response.status_code}", 
                        f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"SMS App Auth request failed", f"Error: {str(e)}")
        return False

def test_single_ivr_twiml():
    """Test 3: SingleIVR TwiML - POST /api/twilio/single-ivr?sessionId=nonexistent"""
    print_test_header("SingleIVR TwiML Endpoint")
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/twilio/single-ivr?sessionId=nonexistent", timeout=10)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'xml' in content_type.lower():
                print_result(True, "SingleIVR TwiML returns 200 with XML content", 
                           f"Content-Type: {content_type}, Response length: {len(response.text)} chars")
                print(f"   XML Preview: {response.text[:200]}...")
                return True
            else:
                print_result(False, "SingleIVR TwiML returns 200 but not XML content", 
                           f"Content-Type: {content_type}, Response: {response.text[:200]}...")
                return False
        else:
            print_result(False, f"SingleIVR TwiML failed with status {response.status_code}", 
                        f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"SingleIVR TwiML request failed", f"Error: {str(e)}")
        return False

def test_bulk_ivr_twiml():
    """Test 4: BulkIVR TwiML - POST /api/twilio/bulk-ivr?campaignId=nonexistent&leadIndex=0"""
    print_test_header("BulkIVR TwiML Endpoint")
    
    try:
        response = requests.post(f"{BACKEND_URL}/api/twilio/bulk-ivr?campaignId=nonexistent&leadIndex=0", timeout=10)
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'xml' in content_type.lower():
                print_result(True, "BulkIVR TwiML returns 200 with XML content", 
                           f"Content-Type: {content_type}, Response length: {len(response.text)} chars")
                print(f"   XML Preview: {response.text[:200]}...")
                return True
            else:
                print_result(False, "BulkIVR TwiML returns 200 but not XML content", 
                           f"Content-Type: {content_type}, Response: {response.text[:200]}...")
                return False
        else:
            print_result(False, f"BulkIVR TwiML failed with status {response.status_code}", 
                        f"Response: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"BulkIVR TwiML request failed", f"Error: {str(e)}")
        return False

def test_code_verification():
    """Test 5: Code verification - cpChangePlan in _payActions array"""
    print_test_header("Code Verification - cpChangePlan in _payActions")
    
    try:
        # Read the file and check line 13911
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
            
        # Line 13911 (0-indexed would be 13910)
        if len(lines) > 13910:
            line_content = lines[13910].strip()
            if 'cpChangePlan' in line_content and '_payActions' in line_content:
                print_result(True, "cpChangePlan found in _payActions array at line 13911", 
                           f"Line content: {line_content}")
                return True
            else:
                print_result(False, "cpChangePlan not found in _payActions array at line 13911", 
                           f"Line content: {line_content}")
                return False
        else:
            print_result(False, "File doesn't have enough lines to check line 13911", 
                        f"File has {len(lines)} lines")
            return False
            
    except Exception as e:
        print_result(False, f"Code verification failed", f"Error: {str(e)}")
        return False

def run_all_tests():
    """Run all tests and provide summary"""
    print(f"\n🚀 Starting Nomadly Backend Review Request Tests")
    print(f"📅 Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"👤 Test User: {TEST_USER_ID}")
    
    tests = [
        ("Health Check", test_health_check),
        ("SMS App Auth", test_sms_app_auth),
        ("SingleIVR TwiML", test_single_ivr_twiml),
        ("BulkIVR TwiML", test_bulk_ivr_twiml),
        ("Code Verification", test_code_verification)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_result(False, f"{test_name} test crashed", f"Error: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'='*60}")
    print(f"📊 TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n🎯 Overall Result: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - No regressions detected!")
        return True
    else:
        print("⚠️  Some tests failed - Review required")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)