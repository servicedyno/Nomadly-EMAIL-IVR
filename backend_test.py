#!/usr/bin/env python3
"""
Backend Test Suite for Quick IVR Trial Call Fix
Tests the two main changes:
1. TRIAL_CALLER_ID in ivr-outbound.js changed to use env var with default '+18889020132'
2. callerProvider changed from 'twilio' to 'telnyx' in _index.js for trial IVR calls
"""

import subprocess
import json
import re
import sys
import os

def run_command(cmd, description=""):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'description': description
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out',
            'description': description
        }

def test_trial_caller_id_change():
    """Test 1: Verify TRIAL_CALLER_ID in ivr-outbound.js uses env var with correct default"""
    print("🔍 Test 1: TRIAL_CALLER_ID Configuration")
    
    # Read the ivr-outbound.js file
    try:
        with open('/app/js/ivr-outbound.js', 'r') as f:
            content = f.read()
        
        # Check for the new pattern: process.env.TELNYX_TRIAL_CALLER_ID || '+18889020132'
        pattern = r"TRIAL_CALLER_ID\s*=\s*process\.env\.TELNYX_TRIAL_CALLER_ID\s*\|\|\s*['\"](\+\d+)['\"]"
        match = re.search(pattern, content)
        
        if match:
            default_number = match.group(1)
            if default_number == '+18889020132':
                print("✅ TRIAL_CALLER_ID correctly uses env var with default '+18889020132'")
                return True
            else:
                print(f"❌ TRIAL_CALLER_ID has wrong default: {default_number} (expected: +18889020132)")
                return False
        else:
            # Check if it's still hardcoded to the old number
            if '+18556820054' in content:
                print("❌ TRIAL_CALLER_ID still hardcoded to old number '+18556820054'")
                return False
            else:
                print("❌ TRIAL_CALLER_ID pattern not found in expected format")
                return False
                
    except Exception as e:
        print(f"❌ Error reading ivr-outbound.js: {e}")
        return False

def test_caller_provider_change():
    """Test 2: Verify callerProvider is 'telnyx' in _index.js for trial IVR calls"""
    print("\n🔍 Test 2: callerProvider Configuration")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Search for the line with TRIAL_CALLER_ID and callerProvider
        pattern = r"saveInfo\(['\"]ivrObData['\"],\s*\{\s*callerId:\s*ivrOb\.TRIAL_CALLER_ID,\s*isTrial:\s*true,\s*callerProvider:\s*['\"]([^'\"]+)['\"]"
        match = re.search(pattern, content)
        
        if match:
            provider = match.group(1)
            if provider == 'telnyx':
                print("✅ callerProvider correctly set to 'telnyx' for trial IVR calls")
                return True
            else:
                print(f"❌ callerProvider is '{provider}' (expected: 'telnyx')")
                return False
        else:
            print("❌ callerProvider pattern not found in expected format")
            return False
            
    except Exception as e:
        print(f"❌ Error reading _index.js: {e}")
        return False

def test_telnyx_call_control_app_id():
    """Test 3: Verify TELNYX_CALL_CONTROL_APP_ID matches the connection for +18889020132"""
    print("\n🔍 Test 3: TELNYX_CALL_CONTROL_APP_ID Configuration")
    
    try:
        with open('/app/backend/.env', 'r') as f:
            content = f.read()
        
        # Find TELNYX_CALL_CONTROL_APP_ID
        pattern = r"TELNYX_CALL_CONTROL_APP_ID=['\"]?([^'\"\n]+)['\"]?"
        match = re.search(pattern, content)
        
        if match:
            app_id = match.group(1).strip('"\'')
            if app_id == '2898117434361775526':
                print("✅ TELNYX_CALL_CONTROL_APP_ID correctly set to '2898117434361775526'")
                return True
            else:
                print(f"❌ TELNYX_CALL_CONTROL_APP_ID is '{app_id}' (expected: '2898117434361775526')")
                return False
        else:
            print("❌ TELNYX_CALL_CONTROL_APP_ID not found in .env")
            return False
            
    except Exception as e:
        print(f"❌ Error reading backend/.env: {e}")
        return False

def test_voice_service_telnyx_path():
    """Test 4: Verify voice-service.js uses TELNYX_CALL_CONTROL_APP_ID in createOutboundCall"""
    print("\n🔍 Test 4: Voice Service Telnyx Path")
    
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Check for the initiateOutboundIvrCall function and Telnyx path
        if 'initiateOutboundIvrCall' in content and 'createOutboundCall' in content:
            print("✅ initiateOutboundIvrCall function found with createOutboundCall usage")
            
            # Check telnyx-service.js for the connection_id default
            with open('/app/js/telnyx-service.js', 'r') as f:
                telnyx_content = f.read()
            
            # Look for the createOutboundCall function that defaults to TELNYX_CALL_CONTROL_APP_ID
            pattern = r"connection_id:\s*connectionId\s*\|\|\s*process\.env\.TELNYX_CALL_CONTROL_APP_ID"
            if re.search(pattern, telnyx_content):
                print("✅ createOutboundCall defaults connection_id to TELNYX_CALL_CONTROL_APP_ID")
                return True
            else:
                print("❌ createOutboundCall connection_id default pattern not found")
                return False
        else:
            print("❌ Required functions not found in voice-service.js")
            return False
            
    except Exception as e:
        print(f"❌ Error reading voice service files: {e}")
        return False

def test_syntax_validation():
    """Test 5: Verify JavaScript syntax is valid"""
    print("\n🔍 Test 5: JavaScript Syntax Validation")
    
    files_to_check = [
        '/app/js/ivr-outbound.js',
        '/app/js/_index.js'
    ]
    
    all_valid = True
    for file_path in files_to_check:
        result = run_command(f'node -c {file_path}', f'Syntax check for {file_path}')
        if result['success']:
            print(f"✅ {file_path} syntax is valid")
        else:
            print(f"❌ {file_path} syntax error: {result['stderr']}")
            all_valid = False
    
    return all_valid

def test_health_endpoint():
    """Test 6: Verify health endpoint is working"""
    print("\n🔍 Test 6: Health Endpoint")
    
    result = run_command('curl -s http://localhost:5000/health', 'Health endpoint check')
    if result['success']:
        try:
            health_data = json.loads(result['stdout'])
            if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
                print("✅ Health endpoint returns healthy status with database connected")
                return True
            else:
                print(f"❌ Health endpoint status: {health_data}")
                return False
        except json.JSONDecodeError:
            print(f"❌ Health endpoint returned invalid JSON: {result['stdout']}")
            return False
    else:
        print(f"❌ Health endpoint failed: {result['stderr']}")
        return False

def test_error_log_clean():
    """Test 7: Verify error log is clean (0 bytes)"""
    print("\n🔍 Test 7: Error Log Status")
    
    result = run_command('ls -la /var/log/supervisor/nodejs.err.log', 'Check error log size')
    if result['success']:
        if ' 0 ' in result['stdout']:  # File size is 0
            print("✅ nodejs.err.log is 0 bytes (clean)")
            return True
        else:
            print(f"❌ nodejs.err.log is not empty: {result['stdout']}")
            return False
    else:
        print(f"❌ Could not check error log: {result['stderr']}")
        return False

def main():
    """Run all tests and report results"""
    print("🚀 Quick IVR Trial Call Fix - Backend Test Suite")
    print("=" * 60)
    
    tests = [
        test_trial_caller_id_change,
        test_caller_provider_change,
        test_telnyx_call_control_app_id,
        test_voice_service_telnyx_path,
        test_syntax_validation,
        test_health_endpoint,
        test_error_log_clean
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ Test {test_func.__name__} failed with exception: {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Quick IVR trial call fix is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())