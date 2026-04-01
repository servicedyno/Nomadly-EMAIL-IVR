#!/usr/bin/env python3
"""
Backend Test Suite for SIP Connection ANI Override at Startup
Testing the implementation in /app/js/_index.js around lines 1104-1120
"""

import subprocess
import requests
import os
import re
import sys

def test_syntax_validation():
    """Test that _index.js has valid JavaScript syntax"""
    print("🔍 Testing JavaScript syntax validation...")
    try:
        result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ JavaScript syntax validation passed")
            return True
        else:
            print(f"❌ JavaScript syntax validation failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Syntax validation error: {e}")
        return False

def test_health_endpoint():
    """Test that the health endpoint returns healthy status"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ Health endpoint returns healthy status")
                return True
            else:
                print(f"❌ Health endpoint status not healthy: {data}")
                return False
        else:
            print(f"❌ Health endpoint returned status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_error_logs():
    """Test that nodejs error log is empty (0 bytes)"""
    print("🔍 Testing Node.js error logs...")
    try:
        error_log_path = '/var/log/supervisor/nodejs.err.log'
        if os.path.exists(error_log_path):
            size = os.path.getsize(error_log_path)
            if size == 0:
                print("✅ Node.js error log is 0 bytes (clean)")
                return True
            else:
                print(f"❌ Node.js error log has {size} bytes")
                # Show last few lines if there are errors
                with open(error_log_path, 'r') as f:
                    content = f.read()
                    print(f"Error log content: {content[-500:]}")  # Last 500 chars
                return False
        else:
            print("❌ Node.js error log file not found")
            return False
    except Exception as e:
        print(f"❌ Error log check failed: {e}")
        return False

def test_ani_override_implementation():
    """Test that the ANI override code is properly implemented in _index.js"""
    print("🔍 Testing ANI override implementation in _index.js...")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for the key implementation elements
        checks = [
            ('telnyxApi.updateAniOverride call', r'telnyxApi\.updateAniOverride\(sipConnId,\s*defaultAni\)'),
            ('defaultAni logic with TELNYX_DEFAULT_ANI', r'process\.env\.TELNYX_DEFAULT_ANI\s*\|\|\s*botTelnyxNumbers\?\.\[0\]'),
            ('sipConnId fallback logic', r'telnyxResources\.sipConnectionId\s*\|\|\s*process\.env\.TELNYX_SIP_CONNECTION_ID'),
            ('CloudPhone log message', r'\[CloudPhone\] SIP connection ANI override set to verified number'),
            ('ANI override comment section', r'Set SIP connection ANI override to a verified Telnyx number at startup')
        ]
        
        all_passed = True
        for check_name, pattern in checks:
            if re.search(pattern, content):
                print(f"✅ Found {check_name}")
            else:
                print(f"❌ Missing {check_name}")
                all_passed = False
        
        return all_passed
    except Exception as e:
        print(f"❌ ANI override implementation check failed: {e}")
        return False

def test_telnyx_service_function():
    """Test that updateAniOverride function exists and is exported in telnyx-service.js"""
    print("🔍 Testing updateAniOverride function in telnyx-service.js...")
    try:
        with open('/app/js/telnyx-service.js', 'r') as f:
            content = f.read()
        
        # Check for function definition and export
        checks = [
            ('updateAniOverride function definition', r'async function updateAniOverride\(sipConnectionId,\s*phoneNumber\)'),
            ('ANI override API call', r'axios\.patch.*credential_connections.*\{[\s\S]*?ani_override:'),
            ('updateAniOverride export', r'updateAniOverride,?\s*}?\s*$'),
            ('Telnyx log message', r'\[Telnyx\] ANI override updated to')
        ]
        
        all_passed = True
        for check_name, pattern in checks:
            if re.search(pattern, content, re.MULTILINE):
                print(f"✅ Found {check_name}")
            else:
                print(f"❌ Missing {check_name}")
                all_passed = False
        
        return all_passed
    except Exception as e:
        print(f"❌ Telnyx service function check failed: {e}")
        return False

def test_startup_logs():
    """Test that startup logs contain the expected ANI override messages"""
    print("🔍 Testing startup logs for ANI override messages...")
    try:
        log_path = '/var/log/supervisor/nodejs.out.log'
        if not os.path.exists(log_path):
            print("❌ Node.js output log file not found")
            return False
        
        with open(log_path, 'r') as f:
            log_content = f.read()
        
        # Check for both expected log messages
        expected_messages = [
            ('[Telnyx] ANI override updated to +18775877003', r'\[Telnyx\] ANI override updated to \+18775877003'),
            ('[CloudPhone] SIP connection ANI override set to verified number: +18775877003', 
             r'\[CloudPhone\] SIP connection ANI override set to verified number: \+18775877003')
        ]
        
        all_found = True
        for msg_name, pattern in expected_messages:
            if re.search(pattern, log_content):
                print(f"✅ Found startup log message: {msg_name}")
            else:
                print(f"❌ Missing startup log message: {msg_name}")
                all_found = False
        
        return all_found
    except Exception as e:
        print(f"❌ Startup log check failed: {e}")
        return False

def test_environment_variables():
    """Test that required environment variables are set"""
    print("🔍 Testing environment variables...")
    try:
        env_file_path = '/app/backend/.env'
        if not os.path.exists(env_file_path):
            print("❌ Backend .env file not found")
            return False
        
        with open(env_file_path, 'r') as f:
            env_content = f.read()
        
        # Check for required environment variables
        required_vars = [
            ('TELNYX_DEFAULT_ANI', r'TELNYX_DEFAULT_ANI="\+18775877003"'),
            ('TELNYX_SIP_CONNECTION_ID', r'TELNYX_SIP_CONNECTION_ID="2898118323872990714"')
        ]
        
        all_found = True
        for var_name, pattern in required_vars:
            if re.search(pattern, env_content):
                print(f"✅ Found environment variable: {var_name}")
            else:
                print(f"❌ Missing or incorrect environment variable: {var_name}")
                all_found = False
        
        return all_found
    except Exception as e:
        print(f"❌ Environment variable check failed: {e}")
        return False

def run_all_tests():
    """Run all tests and return overall result"""
    print("🚀 Starting SIP Connection ANI Override Testing Suite")
    print("=" * 60)
    
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Health Endpoint", test_health_endpoint),
        ("Error Logs", test_error_logs),
        ("ANI Override Implementation", test_ani_override_implementation),
        ("Telnyx Service Function", test_telnyx_service_function),
        ("Startup Logs", test_startup_logs),
        ("Environment Variables", test_environment_variables)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name} test...")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! SIP Connection ANI Override is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)