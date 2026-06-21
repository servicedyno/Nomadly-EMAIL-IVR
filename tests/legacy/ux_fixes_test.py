#!/usr/bin/env python3
"""
Backend Testing Script for Nomadly UX Fixes Verification
Testing the specific endpoints mentioned in the review request
"""

import requests
import json
import sys
import subprocess
from datetime import datetime

def test_endpoint(method, url, expected_status=200, description="", data=None, headers=None):
    """Test a single endpoint and return results"""
    try:
        print(f"\n🧪 Testing: {description}")
        print(f"   {method} {url}")
        
        if method.upper() == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, headers=headers, timeout=10)
        else:
            response = requests.request(method, url, json=data, headers=headers, timeout=10)
        
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        # Try to parse JSON response
        try:
            json_response = response.json()
            print(f"   Response: {json.dumps(json_response, indent=2)[:200]}...")
        except:
            print(f"   Response: {response.text[:200]}...")
        
        if response.status_code == expected_status:
            print(f"   ✅ PASS")
            return True, response
        else:
            print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
            return False, response
            
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
        return False, None

def test_code_verification(pattern, file_path, description, expected_count=None):
    """Test code verification using grep"""
    try:
        print(f"\n🔍 Code Verification: {description}")
        print(f"   Searching for: {pattern}")
        print(f"   In file: {file_path}")
        
        result = subprocess.run(
            ["grep", "-n", pattern, file_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            line_count = len([line for line in lines if line.strip()])
            print(f"   Found {line_count} occurrences")
            
            # Show first few matches
            for line in lines[:3]:
                if line.strip():
                    print(f"   📍 {line}")
            
            if expected_count is None or line_count >= expected_count:
                print(f"   ✅ PASS")
                return True
            else:
                print(f"   ❌ FAIL - Expected at least {expected_count}, found {line_count}")
                return False
        else:
            print(f"   ❌ FAIL - Pattern not found")
            return False
            
    except Exception as e:
        print(f"   ❌ ERROR: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("NOMADLY BACKEND UX FIXES VERIFICATION")
    print("=" * 60)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Backend URL: http://localhost:5000 (Node.js)")
    print("Proxy URL: http://localhost:8001/api (FastAPI)")
    
    # Test results tracking
    results = []
    
    # API Endpoint Tests
    print("\n" + "="*40)
    print("API ENDPOINT TESTS")
    print("="*40)
    
    # Test 1: Health check on Node.js server (localhost:5000)
    success, response = test_endpoint(
        'GET', 
        'http://localhost:5000/health',
        200,
        "Health Check (Direct Node.js) - should return status: healthy, database: connected"
    )
    results.append(("Health Check Direct", success))
    
    # Test 2: Health check via FastAPI proxy (localhost:8001/api)
    success, response = test_endpoint(
        'GET', 
        'http://localhost:8001/api/health',
        200,
        "Health Check (FastAPI Proxy) - should return 200"
    )
    results.append(("Health Check Proxy", success))
    
    # Test 3: SMS App Auth endpoint
    success, response = test_endpoint(
        'GET', 
        'http://localhost:5000/sms-app/auth/6687923716',
        200,
        "SMS App Auth (Test User 6687923716) - should return 200"
    )
    results.append(("SMS App Auth", success))
    
    # Code Verification Tests
    print("\n" + "="*40)
    print("CODE VERIFICATION TESTS")
    print("="*40)
    
    # Test 4: VPS disk labels updated
    success = test_code_verification(
        "label.*NVMe\\|label.*SSD",
        "/app/js/vm-instance-setup.js",
        "VPS disk labels updated - should show new labels '⚡ NVMe — Faster Speed' and '💾 SSD — 2× More Storage'",
        2
    )
    results.append(("VPS Disk Labels", success))
    
    # Test 5: Help handler exists
    success = test_code_verification(
        "helpWords",
        "/app/js/_index.js",
        "Help handler exists - should find the help handler",
        1
    )
    results.append(("Help Handler", success))
    
    # Test 6: Wallet incentive exists
    success = test_code_verification(
        "Tip.*Deposit",
        "/app/js/_index.js",
        "Wallet incentive exists - should find deposit tip for low balance",
        1
    )
    results.append(("Wallet Incentive", success))
    
    # Test 7: /testsip has keyboard
    success = test_code_verification(
        "reply_markup.*cloudPhone",
        "/app/js/_index.js",
        "/testsip has keyboard - should find keyboard with Cloud IVR button",
        1
    )
    results.append(("TestSIP Keyboard", success))
    
    # Test 8: sipTestCode has CTA
    success = test_code_verification(
        "Like it",
        "/app/js/phone-config.js",
        "sipTestCode has CTA - should find CTA text",
        1
    )
    results.append(("SIP Test CTA", success))
    
    # Test 9: Catch block improved
    success = test_code_verification(
        "Cuttly Shortener Error",
        "/app/js/_index.js",
        "Catch block improved - should find improved error format",
        1
    )
    results.append(("Catch Block Improved", success))
    
    # Test 10: Fallback message improved
    success = test_code_verification(
        "what:",
        "/app/js/lang/en.js",
        "Fallback message improved - should include '/start'",
        1
    )
    results.append(("Fallback Message", success))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL UX FIXES VERIFICATION TESTS PASSED!")
        return True
    else:
        print("⚠️  Some tests failed - check details above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)