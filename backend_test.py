#!/usr/bin/env python3
"""
Backend API Testing for AI Support Reply Delivery Fix
Tests the guaranteed delivery mechanism for AI support replies
"""

import requests
import json
import time
import os

# Get the backend URL from environment
BACKEND_URL = "https://setup-guide-134.preview.emergentagent.com"
BASE_URL = f"{BACKEND_URL}/api"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_result(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

def test_stream_delivery():
    """
    TEST 1: Guaranteed delivery test
    POST /api/dev/stream-delivery-test
    Expects pass:true with all checks true
    """
    print_section("TEST 1: Stream Delivery Guaranteed Delivery")
    
    url = f"{BASE_URL}/dev/stream-delivery-test"
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {{}}")
    
    try:
        response = requests.post(
            url,
            json={},
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response Body: {response.text[:500]}")
            print_result("TEST 1 - HTTP Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Parse JSON response
        try:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Response text: {response.text[:500]}")
            print_result("TEST 1 - JSON Parse", False, str(e))
            return False
        
        # Check top-level pass
        if not data.get("pass"):
            print_result("TEST 1 - Top-level pass", False, f"pass={data.get('pass')}")
            return False
        
        # Check all required checks (nested under "checks" key)
        required_checks = [
            "editPathWorks",
            "failureStillDelivers",
            "plainTextLastResort",
            "alreadyShownNoDuplicate"
        ]
        
        checks = data.get("checks", {})
        all_passed = True
        for check in required_checks:
            check_value = checks.get(check)
            if check_value is True:
                print(f"  ✅ {check}: true")
            else:
                print(f"  ❌ {check}: {check_value}")
                all_passed = False
        
        if all_passed:
            print_result("TEST 1 - All Checks", True, "All 4 checks passed")
            return True
        else:
            print_result("TEST 1 - All Checks", False, "Some checks failed")
            return False
            
    except requests.exceptions.Timeout:
        print_result("TEST 1 - Request", False, "Request timed out after 60s")
        return False
    except Exception as e:
        print_result("TEST 1 - Request", False, str(e))
        return False

def test_ai_stream_diagnose():
    """
    TEST 2: Streaming pipeline health test
    POST /api/dev/ai-stream-diagnose
    Expects streamingWorks:true, deltaCount>0, responseLength>20, error:null
    This is a REAL OpenAI streaming call - allow up to ~45s
    """
    print_section("TEST 2: AI Stream Diagnose (Real OpenAI Call)")
    
    url = f"{BASE_URL}/dev/ai-stream-diagnose"
    question = "Are your domains truly bulletproof?"
    body = {"question": question}
    
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {json.dumps(body)}")
    print(f"Note: This is a REAL OpenAI streaming call, may take up to 45 seconds...")
    
    try:
        start_time = time.time()
        response = requests.post(
            url,
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=60  # Allow up to 60s for OpenAI call
        )
        elapsed = time.time() - start_time
        
        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Time: {elapsed:.2f}s")
        
        if response.status_code != 200:
            print(f"Response Body: {response.text[:500]}")
            print_result("TEST 2 - HTTP Status", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Parse JSON response
        try:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
        except Exception as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Response text: {response.text[:500]}")
            print_result("TEST 2 - JSON Parse", False, str(e))
            return False
        
        # Check required fields
        checks = {
            "streamingWorks": data.get("streamingWorks") is True,
            "deltaCount > 0": data.get("deltaCount", 0) > 0,
            "responseLength > 20": data.get("responseLength", 0) > 20,
            "error is null": data.get("error") is None
        }
        
        all_passed = True
        for check_name, check_result in checks.items():
            if check_result:
                print(f"  ✅ {check_name}")
            else:
                print(f"  ❌ {check_name}")
                all_passed = False
        
        # Print actual values
        print(f"\nActual Values:")
        print(f"  streamingWorks: {data.get('streamingWorks')}")
        print(f"  deltaCount: {data.get('deltaCount')}")
        print(f"  responseLength: {data.get('responseLength')}")
        print(f"  error: {data.get('error')}")
        
        if all_passed:
            print_result("TEST 2 - All Checks", True, f"All checks passed in {elapsed:.2f}s")
            return True
        else:
            print_result("TEST 2 - All Checks", False, "Some checks failed")
            return False
            
    except requests.exceptions.Timeout:
        print_result("TEST 2 - Request", False, "Request timed out after 60s")
        return False
    except Exception as e:
        print_result("TEST 2 - Request", False, str(e))
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  AI SUPPORT REPLY DELIVERY FIX - BACKEND TESTING")
    print("="*80)
    print(f"\nBackend URL: {BACKEND_URL}")
    print(f"Base API URL: {BASE_URL}")
    print(f"\nTesting Environment: BOT_ENVIRONMENT=development")
    print(f"Note: /dev/* endpoints are enabled in development mode")
    
    results = {}
    
    # Run TEST 1
    results["test1_stream_delivery"] = test_stream_delivery()
    
    # Run TEST 2
    results["test2_ai_stream_diagnose"] = test_ai_stream_diagnose()
    
    # Summary
    print_section("TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed_tests}/{total_tests} tests passed")
    
    if all(results.values()):
        print("\n🎉 ALL TESTS PASSED - AI support reply delivery fix is working correctly!")
        return 0
    else:
        print("\n⚠️  SOME TESTS FAILED - See details above")
        return 1

if __name__ == "__main__":
    exit(main())
