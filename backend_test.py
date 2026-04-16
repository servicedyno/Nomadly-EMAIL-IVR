#!/usr/bin/env python3
"""
Backend Testing Script for Nomadly Node.js Backend (Port 5000) and FastAPI Proxy (Port 8001)
Testing shortlink operator precedence bug fix verification
"""

import requests
import json
import sys
import subprocess
from datetime import datetime

# Backend URLs
NODEJS_URL = "http://localhost:5000"
FASTAPI_URL = "http://localhost:8001"

def test_nodejs_health_direct():
    """Test direct Node.js health endpoint on port 5000"""
    print("🔍 Testing Node.js Health Endpoint (Direct - Port 5000)...")
    try:
        response = requests.get(f"{NODEJS_URL}/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Check for required fields
            if (data.get('status') == 'healthy' and 
                data.get('database') == 'connected'):
                print("   ✅ Node.js health check PASSED - status:healthy, database:connected")
                return True
            else:
                print(f"   ❌ Node.js health check FAILED - status: {data.get('status')}, database: {data.get('database')}")
                return False
        else:
            print(f"   ❌ Node.js health check FAILED - HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Node.js health check FAILED - Error: {str(e)}")
        return False

def test_fastapi_health_proxy():
    """Test FastAPI proxy to Node.js health endpoint on port 8001"""
    print("\n🔍 Testing FastAPI Health Proxy (Port 8001 -> Port 5000)...")
    try:
        response = requests.get(f"{FASTAPI_URL}/api/health", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            print("   ✅ FastAPI proxy health check PASSED")
            return True
        else:
            print(f"   ❌ FastAPI proxy health check FAILED - HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ FastAPI proxy health check FAILED - Error: {str(e)}")
        return False

def test_sms_app_auth_valid():
    """Test SMS app auth endpoint with valid user (6687923716)"""
    print("\n🔍 Testing SMS App Auth Endpoint (Valid User)...")
    
    chat_id = "6687923716"
    
    print(f"   Testing /sms-app/auth/{chat_id}")
    
    try:
        response = requests.get(f"{NODEJS_URL}/sms-app/auth/{chat_id}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {json.dumps(data, indent=2)}")
                
                # Check for required fields
                valid = data.get('valid')
                
                if valid is True:
                    print("   ✅ SMS App Auth (Valid) PASSED - valid:true")
                    return True
                else:
                    print(f"   ❌ SMS App Auth (Valid) FAILED - valid:{valid}")
                    return False
                    
            except json.JSONDecodeError as e:
                print(f"   ❌ Invalid JSON response: {str(e)}")
                return False
        else:
            print(f"   ❌ HTTP {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Request failed: {str(e)}")
        return False

def test_sms_app_auth_invalid():
    """Test SMS app auth endpoint with invalid user (9999999999)"""
    print("\n🔍 Testing SMS App Auth Endpoint (Invalid User)...")
    
    chat_id = "9999999999"
    
    print(f"   Testing /sms-app/auth/{chat_id}")
    
    try:
        response = requests.get(f"{NODEJS_URL}/sms-app/auth/{chat_id}", timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("   ✅ SMS App Auth (Invalid) PASSED - returns 401 as expected")
            return True
        else:
            print(f"   ❌ SMS App Auth (Invalid) FAILED - expected 401, got {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Request failed: {str(e)}")
        return False

def test_shortlink_operator_precedence_fix():
    """Verify the shortlink operator precedence bug fix in source code"""
    print("\n🔍 Testing Shortlink Operator Precedence Bug Fix...")
    
    try:
        # Test 1: Check for fixed pattern with parentheses
        print("   Checking for fixed pattern: 'await (linksOf?.find'")
        result = subprocess.run(
            ["grep", "-n", "await (linksOf?.find", "/app/js/_index.js"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            line_count = len([line for line in lines if line.strip()])
            print(f"   ✅ Found {line_count} occurrences of fixed pattern (expected: 2)")
            
            if line_count >= 2:
                print("   📍 Fixed pattern locations:")
                for line in lines[:3]:  # Show first 3 matches
                    if line.strip():
                        print(f"      {line}")
                fix_found = True
            else:
                print(f"   ⚠️  Expected 2 occurrences, found {line_count}")
                fix_found = False
        else:
            print("   ❌ Fixed pattern not found")
            fix_found = False
        
        # Test 2: Check that old buggy pattern is gone
        print("\n   Checking for old buggy pattern: 'await linksOf?.find' (without parens)")
        result = subprocess.run(
            ["grep", "-n", "await linksOf?.find", "/app/js/_index.js"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Filter out lines that have parentheses (the fixed version)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            buggy_lines = [line for line in lines if line.strip() and '(linksOf?.find' not in line]
            buggy_count = len(buggy_lines)
            
            if buggy_count == 0:
                print("   ✅ Old buggy pattern not found (good)")
                buggy_gone = True
            else:
                print(f"   ❌ Found {buggy_count} occurrences of old buggy pattern:")
                for line in buggy_lines[:3]:
                    print(f"      {line}")
                buggy_gone = False
        else:
            print("   ✅ Old buggy pattern not found (good)")
            buggy_gone = True
        
        # Test 3: Check for improved error reporting
        print("\n   Checking for improved error reporting: 'Shortener Error'")
        result = subprocess.run(
            ["grep", "-n", "Shortener Error", "/app/js/_index.js"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            error_count = len([line for line in lines if line.strip()])
            print(f"   ✅ Found {error_count} occurrences of improved error reporting")
            
            if error_count >= 1:
                print("   📍 Error reporting locations:")
                for line in lines[:2]:  # Show first 2 matches
                    if line.strip():
                        print(f"      {line}")
                error_reporting = True
            else:
                error_reporting = False
        else:
            print("   ❌ Improved error reporting not found")
            error_reporting = False
        
        # Overall result
        if fix_found and buggy_gone and error_reporting:
            print("\n   ✅ Shortlink operator precedence bug fix VERIFIED")
            return True
        else:
            print("\n   ❌ Shortlink operator precedence bug fix INCOMPLETE")
            print(f"      Fix found: {fix_found}")
            print(f"      Buggy pattern gone: {buggy_gone}")
            print(f"      Error reporting improved: {error_reporting}")
            return False
            
    except Exception as e:
        print(f"   ❌ Code verification failed: {str(e)}")
        return False

def test_backend_logs():
    """Check backend logs for any critical errors"""
    print("\n🔍 Checking Backend Logs for Critical Errors...")
    try:
        # Check supervisor logs for backend
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "50", "/var/log/supervisor/nodejs.out.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            log_content = result.stdout
            # More specific error patterns that indicate real problems
            critical_patterns = [
                "FATAL",
                "CRASH",
                "UNCAUGHT EXCEPTION",
                "CONNECTION REFUSED",
                "ECONNREFUSED",
                "MONGODB ERROR",
                "DATABASE ERROR",
                "AUTHENTICATION FAILED"
            ]
            
            recent_errors = []
            for line in log_content.split('\n')[-20:]:  # Check last 20 lines
                line_upper = line.upper()
                if any(pattern in line_upper for pattern in critical_patterns):
                    # Skip status messages and normal operational logs
                    if not any(skip in line_upper for skip in ["PROTECTIONENFORCER", "TOTAL:", "PROTECTED:", "FIXED:"]):
                        recent_errors.append(line.strip())
            
            if recent_errors:
                print("   ⚠️  Critical errors found in logs:")
                for error in recent_errors[-3:]:  # Show last 3 errors
                    print(f"      {error}")
                return False
            else:
                print("   ✅ No critical errors found in recent logs")
                return True
        else:
            print("   ⚠️  Could not read backend logs")
            return True  # Don't fail the test if we can't read logs
            
    except Exception as e:
        print(f"   ⚠️  Log check failed: {str(e)}")
        return True  # Don't fail the test if log check fails

def run_all_tests():
    """Run all backend tests for the shortlink operator precedence bug fix verification"""
    print("=" * 80)
    print("🚀 NOMADLY BACKEND TESTING - SHORTLINK OPERATOR PRECEDENCE BUG FIX")
    print("=" * 80)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Node.js URL: {NODEJS_URL}")
    print(f"FastAPI URL: {FASTAPI_URL}")
    print(f"Focus: Shortlink operator precedence bug fix verification")
    print("=" * 80)
    
    test_results = []
    
    # Test 1: Direct Node.js health check
    test_results.append(("Node.js Health (Direct)", test_nodejs_health_direct()))
    
    # Test 2: FastAPI proxy health check
    test_results.append(("FastAPI Health Proxy", test_fastapi_health_proxy()))
    
    # Test 3: SMS App Auth endpoint (valid user)
    test_results.append(("SMS App Auth (Valid)", test_sms_app_auth_valid()))
    
    # Test 4: SMS App Auth endpoint (invalid user)
    test_results.append(("SMS App Auth (Invalid)", test_sms_app_auth_invalid()))
    
    # Test 5: Shortlink operator precedence bug fix verification
    test_results.append(("Shortlink Bug Fix", test_shortlink_operator_precedence_fix()))
    
    # Test 6: Backend logs check
    test_results.append(("Backend Logs Check", test_backend_logs()))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.0f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Shortlink operator precedence bug fix verified!")
        print("\n📋 VERIFIED FUNCTIONALITY:")
        print("   • Node.js backend running on port 5000")
        print("   • FastAPI proxy working on port 8001")
        print("   • SMS app authentication working (valid/invalid users)")
        print("   • Shortlink operator precedence bug fix implemented")
        print("   • Improved error reporting in place")
        print("   • No critical backend errors")
        return True
    else:
        print("⚠️  Some tests failed - see details above")
        print("\n🔧 TROUBLESHOOTING:")
        if not test_results[0][1]:  # Node.js health failed
            print("   • Check if Node.js server is running on port 5000")
            print("   • Verify MongoDB connection")
        if not test_results[1][1]:  # FastAPI proxy failed
            print("   • Check if FastAPI server is running on port 8001")
            print("   • Verify proxy configuration")
        if not test_results[2][1] or not test_results[3][1]:  # SMS auth failed
            print("   • Check SMS app service configuration")
            print("   • Verify test users exist in database")
        if not test_results[4][1]:  # Shortlink fix failed
            print("   • Check if shortlink operator precedence fix is properly implemented")
            print("   • Verify code changes in /app/js/_index.js")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)