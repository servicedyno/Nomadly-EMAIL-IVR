#!/usr/bin/env python3
"""
Nomadly Backend Test - Tier 1 AI Support Upgrades Verification
Tests the backend endpoints and verifies AI support code implementation
"""

import requests
import subprocess
import json
import sys
from datetime import datetime

# Test configuration
BACKEND_URL = "http://localhost:5000"
PROXY_URL = "http://localhost:8001/api"

def run_test(test_name, test_func):
    """Run a test and return results"""
    try:
        print(f"\n🧪 Testing: {test_name}")
        result = test_func()
        if result:
            print(f"✅ PASSED: {test_name}")
            return True
        else:
            print(f"❌ FAILED: {test_name}")
            return False
    except Exception as e:
        print(f"❌ ERROR in {test_name}: {str(e)}")
        return False

def test_health_direct():
    """Test direct Node.js health endpoint"""
    response = requests.get(f"{BACKEND_URL}/health", timeout=10)
    if response.status_code == 200:
        data = response.json()
        expected_keys = ['status', 'database']
        if all(key in data for key in expected_keys):
            if data['status'] == 'healthy' and data['database'] == 'connected':
                print(f"   Direct health: {data}")
                return True
    return False

def test_health_proxy():
    """Test FastAPI proxy health endpoint"""
    response = requests.get(f"{PROXY_URL}/health", timeout=10)
    if response.status_code == 200:
        data = response.json()
        expected_keys = ['status', 'database']
        if all(key in data for key in expected_keys):
            if data['status'] == 'healthy' and data['database'] == 'connected':
                print(f"   Proxy health: {data}")
                return True
    return False

def test_code_verification():
    """Test all code verification requirements"""
    tests = [
        ("Feature 1 - Last action context", 'grep "Last action before support" /app/js/ai-support.js'),
        ("Feature 2 - Error tracking", 'grep "RECENT ERRORS" /app/js/ai-support.js'),
        ("Feature 2 - recordUserError function", 'grep "recordUserError" /app/js/ai-support.js'),
        ("Feature 2 - Error tracking calls", 'grep "recordUserError" /app/js/_index.js'),
        ("Feature 3 - Action buttons", 'grep "extractActionButtons" /app/js/ai-support.js'),
        ("Feature 3 - Used in handler", 'grep "extractActionButtons" /app/js/_index.js'),
        ("Feature 4 - Smart escalation", 'grep "CRITICAL_ESCALATION" /app/js/ai-support.js'),
        ("Feature 5 - Satisfaction rating", 'grep "rateSupportSession\\|rate_support_good\\|rate_support_bad" /app/js/_index.js'),
        ("Collections initialized", 'grep "userErrors\\|supportRatings" /app/js/ai-support.js'),
        ("TTL index", 'grep "expireAfterSeconds" /app/js/ai-support.js')
    ]
    
    all_passed = True
    for test_name, command in tests:
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                print(f"   ✅ {test_name}: Found")
            else:
                print(f"   ❌ {test_name}: Not found")
                all_passed = False
        except Exception as e:
            print(f"   ❌ {test_name}: Error - {str(e)}")
            all_passed = False
    
    return all_passed

def count_recordUserError_calls():
    """Count recordUserError calls in _index.js"""
    try:
        result = subprocess.run('grep "recordUserError" /app/js/_index.js', shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            # Filter out the import line
            call_lines = [line for line in lines if 'recordUserError(' in line and 'require(' not in line]
            count = len(call_lines)
            print(f"   Found {count} recordUserError calls")
            return count >= 4  # Should find 4+ calls as specified
        return False
    except Exception as e:
        print(f"   Error counting recordUserError calls: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Nomadly Backend Test - Tier 1 AI Support Upgrades")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tests = [
        ("Health Check (Direct Node.js)", test_health_direct),
        ("Health Check (FastAPI Proxy)", test_health_proxy),
        ("Code Verification Tests", test_code_verification),
        ("recordUserError Call Count (4+ required)", count_recordUserError_calls)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
    
    print(f"\n📊 Test Results Summary:")
    print(f"   Passed: {passed}/{total}")
    print(f"   Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Tier 1 AI Support upgrades verified successfully!")
        return 0
    else:
        print("⚠️  Some tests failed - see details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())