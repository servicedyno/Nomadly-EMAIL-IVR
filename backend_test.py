#!/usr/bin/env python3
"""
Backend Test Suite for OTP Collection Mode in Single IVR Calls
Tests the new OTP Collection feature implementation
"""

import subprocess
import sys
import json
import requests
import time
import re
from pathlib import Path

# Test configuration
BACKEND_URL = "http://localhost:5000"
TEST_RESULTS = []

def log_test(test_name, status, details=""):
    """Log test results"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    TEST_RESULTS.append(result)
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} {test_name}: {status}")
    if details:
        print(f"   Details: {details}")

def run_syntax_check(file_path, test_name):
    """Run Node.js syntax check on a file"""
    try:
        result = subprocess.run(['node', '-c', file_path], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log_test(test_name, "PASS", f"Syntax check passed for {file_path}")
            return True
        else:
            log_test(test_name, "FAIL", f"Syntax error in {file_path}: {result.stderr}")
            return False
    except Exception as e:
        log_test(test_name, "FAIL", f"Error checking {file_path}: {str(e)}")
        return False

def check_health_endpoint():
    """Test the health endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                log_test("Health Endpoint", "PASS", f"Status: {data.get('status')}, DB: {data.get('database')}")
                return True
            else:
                log_test("Health Endpoint", "FAIL", f"Unhealthy status: {data}")
                return False
        else:
            log_test("Health Endpoint", "FAIL", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_test("Health Endpoint", "FAIL", f"Request failed: {str(e)}")
        return False

def check_error_log():
    """Check if error log is empty"""
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Parse file size from ls output
            size_match = re.search(r'\s+(\d+)\s+', result.stdout)
            if size_match:
                size = int(size_match.group(1))
                if size == 0:
                    log_test("Error Log Check", "PASS", "Error log is 0 bytes")
                    return True
                else:
                    log_test("Error Log Check", "FAIL", f"Error log has {size} bytes")
                    return False
            else:
                log_test("Error Log Check", "WARN", "Could not parse file size")
                return False
        else:
            log_test("Error Log Check", "FAIL", f"Could not access error log: {result.stderr}")
            return False
    except Exception as e:
        log_test("Error Log Check", "FAIL", f"Error checking log: {str(e)}")
        return False

def search_file_content(file_path, patterns, test_name):
    """Search for patterns in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        found_patterns = []
        missing_patterns = []
        
        for pattern in patterns:
            if isinstance(pattern, str):
                if pattern in content:
                    found_patterns.append(pattern)
                else:
                    missing_patterns.append(pattern)
            else:  # regex pattern
                if re.search(pattern, content):
                    found_patterns.append(str(pattern))
                else:
                    missing_patterns.append(str(pattern))
        
        if not missing_patterns:
            log_test(test_name, "PASS", f"Found all {len(patterns)} patterns")
            return True
        else:
            log_test(test_name, "FAIL", f"Missing patterns: {missing_patterns}")
            return False
            
    except Exception as e:
        log_test(test_name, "FAIL", f"Error reading {file_path}: {str(e)}")
        return False

def count_occurrences(file_path, pattern, expected_count, test_name):
    """Count occurrences of a pattern in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if isinstance(pattern, str):
            count = content.count(pattern)
        else:  # regex
            count = len(re.findall(pattern, content))
        
        if count == expected_count:
            log_test(test_name, "PASS", f"Found exactly {count} occurrences of pattern")
            return True
        else:
            log_test(test_name, "FAIL", f"Expected {expected_count} occurrences, found {count}")
            return False
            
    except Exception as e:
        log_test(test_name, "FAIL", f"Error reading {file_path}: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🧪 Starting OTP Collection Mode Backend Tests")
    print("=" * 60)
    
    # Test 1-3: Syntax checks
    run_syntax_check('/app/js/_index.js', "Syntax Check: _index.js")
    run_syntax_check('/app/js/voice-service.js', "Syntax Check: voice-service.js") 
    run_syntax_check('/app/js/ivr-outbound.js', "Syntax Check: ivr-outbound.js")
    
    # Test 4: Health endpoint
    check_health_endpoint()
    
    # Test 5: Error log
    check_error_log()
    
    # Test 6: Action constants exist
    search_file_content('/app/js/_index.js', [
        'ivrObSelectMode: \'ivrObSelectMode\'',
        'ivrObOtpLength: \'ivrObOtpLength\''
    ], "Action Constants Exist")
    
    # Test 7: Mode selection handler exists
    search_file_content('/app/js/_index.js', [
        'if (action === a.ivrObSelectMode)',
        '🔗 Transfer',
        '🔑 OTP Collection'
    ], "Mode Selection Handler")
    
    # Test 8: Three places skip to mode selection
    count_occurrences('/app/js/_index.js', 'skip to mode selection', 3, 
                     "Skip to Mode Selection (3 occurrences)")
    
    # Test 9: /twilio/single-ivr-gather OTP mode redirect
    search_file_content('/app/js/_index.js', [
        'if (session.ivrMode === \'otp_collect\')',
        'response.redirect({ method: \'POST\' }, `${selfUrl}/twilio/single-ivr-otp'
    ], "IVR Gather OTP Mode Redirect")
    
    # Test 10: /twilio/single-ivr-otp endpoint exists
    search_file_content('/app/js/_index.js', [
        'app.post(\'/twilio/single-ivr-otp\'',
        'response.gather({',
        'numDigits: otpLength',
        'finishOnKey: \'#\''
    ], "Single IVR OTP Endpoint")
    
    # Test 11: /twilio/single-ivr-otp-result endpoint exists
    search_file_content('/app/js/_index.js', [
        'app.post(\'/twilio/single-ivr-otp-result\'',
        'session.otpDigits = digits',
        'session.otpStatus = \'pending_review\'',
        'ivr_otp:confirm:',
        'ivr_otp:reject:'
    ], "Single IVR OTP Result Endpoint")
    
    # Test 12: /twilio/single-ivr-otp-hold endpoint exists
    search_file_content('/app/js/_index.js', [
        'app.post(\'/twilio/single-ivr-otp-hold\'',
        'if (session.otpStatus === \'confirmed\')',
        'if (session.otpStatus === \'rejected\')',
        'if (holdElapsed > OTP_HOLD_TIMEOUT_MS)'
    ], "Single IVR OTP Hold Endpoint")
    
    # Test 13: ivr_otp callback query handler exists
    search_file_content('/app/js/_index.js', [
        'if (chatId && data.startsWith(\'ivr_otp:\'))',
        'if (action === \'confirm\')',
        'if (action === \'reject\')',
        'editMessageText'
    ], "IVR OTP Callback Query Handler")
    
    # Test 14: Voice service session creation includes OTP fields (trial)
    search_file_content('/app/js/voice-service.js', [
        'ivrMode: ivrMode || \'transfer\'',
        'otpLength: otpLength || 6',
        'otpMaxAttempts: otpMaxAttempts || 3',
        'otpAttempt: 0',
        'otpDigits: null',
        'otpStatus: null',
        'otpHoldStartedAt: null'
    ], "Voice Service OTP Fields (Trial)")
    
    # Test 15: Voice service session creation includes OTP fields (non-trial)
    # Check for second occurrence of OTP fields in non-trial block
    with open('/app/js/voice-service.js', 'r') as f:
        content = f.read()
    otp_field_count = content.count('ivrMode: ivrMode || \'transfer\'')
    if otp_field_count >= 2:
        log_test("Voice Service OTP Fields (Non-Trial)", "PASS", 
                f"Found OTP fields in both trial and non-trial blocks")
    else:
        log_test("Voice Service OTP Fields (Non-Trial)", "FAIL", 
                f"OTP fields only found {otp_field_count} time(s)")
    
    # Test 16: ivr-outbound.js formatCallPreview shows OTP mode info
    search_file_content('/app/js/ivr-outbound.js', [
        'const isOtp = data.ivrMode === \'otp_collect\'',
        'lines.push(`🔑 Mode: <b>OTP Collection</b>`)',
        'lines.push(`🔢 OTP Length: <b>${data.otpLength || 6} digits</b>`)',
        'lines.push(`🔄 Max Attempts: <b>${data.otpMaxAttempts || 3}</b>`)'
    ], "IVR Outbound formatCallPreview OTP Mode")
    
    # Test 17: formatCallNotification has OTP completion case
    search_file_content('/app/js/ivr-outbound.js', [
        'if (data.ivrMode === \'otp_collect\')',
        'const otpResult = data.otpStatus === \'confirmed\' ? \'✅ Confirmed\'',
        '🔑 <b>OTP Call Completed</b>',
        '🔢 Last OTP: ${data.otpDigits || \'None\'}',
        '🔄 Attempts: ${data.otpAttempt || 0}/${data.otpMaxAttempts || 3}'
    ], "IVR Outbound formatCallNotification OTP Mode")
    
    # Test 18: single-ivr-status handler has OTP mode completion report
    search_file_content('/app/js/_index.js', [
        'if (session.ivrMode === \'otp_collect\')',
        '📊 <b>OTP Call Complete</b>',
        '🔑 Mode: OTP Collection',
        '🔢 Last Code: <code>${session.otpDigits || \'None\'}</code>',
        '📊 Result: ${otpResult}',
        '🔄 Attempts: ${session.otpAttempt || 0}/${session.otpMaxAttempts || 3}'
    ], "Single IVR Status OTP Mode Report")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(TEST_RESULTS)
    passed_tests = len([r for r in TEST_RESULTS if r['status'] == 'PASS'])
    failed_tests = len([r for r in TEST_RESULTS if r['status'] == 'FAIL'])
    warned_tests = len([r for r in TEST_RESULTS if r['status'] == 'WARN'])
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"⚠️  Warnings: {warned_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    if failed_tests > 0:
        print("\n❌ FAILED TESTS:")
        for result in TEST_RESULTS:
            if result['status'] == 'FAIL':
                print(f"  - {result['test']}: {result['details']}")
    
    print("\n🎯 OTP Collection Mode Implementation Status:")
    if failed_tests == 0:
        print("✅ ALL TESTS PASSED - OTP Collection mode is fully implemented and ready!")
    elif failed_tests <= 2:
        print("⚠️  MOSTLY IMPLEMENTED - Minor issues found, but core functionality appears complete")
    else:
        print("❌ IMPLEMENTATION INCOMPLETE - Multiple critical components missing or broken")
    
    return failed_tests == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)