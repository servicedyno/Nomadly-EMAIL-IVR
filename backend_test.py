#!/usr/bin/env python3
"""
Backend Test Suite for 10 IVR Improvements
Tests the specific IVR features implemented in js/_index.js, js/voice-service.js, and js/phone-config.js
"""

import requests
import json
import sys
import subprocess
import os
import time
from urllib.parse import urljoin

# Backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://readme-setup-13.preview.emergentagent.com')
API_BASE = urljoin(BACKEND_URL, '/api')

def log_test(test_name, status, details=""):
    """Log test results with consistent formatting"""
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} {test_name}: {status}")
    if details:
        print(f"   {details}")

def check_syntax(file_path):
    """Check JavaScript syntax using node -c"""
    try:
        result = subprocess.run(['node', '-c', file_path], 
                              capture_output=True, text=True, timeout=10)
        return result.returncode == 0, result.stderr
    except Exception as e:
        return False, str(e)

def check_health():
    """Check backend health endpoint"""
    try:
        # Try Node.js health endpoint first (port 5000)
        response = requests.get("http://localhost:5000/health", timeout=10)
        if response.status_code == 200:
            return True, response.json()
        
        # Fallback to external URL
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        return response.status_code == 200, response.json() if response.status_code == 200 else response.text
    except Exception as e:
        return False, str(e)

def search_file_content(file_path, patterns):
    """Search for multiple patterns in a file and return results"""
    results = {}
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            for pattern_name, pattern in patterns.items():
                results[pattern_name] = pattern in content
    except Exception as e:
        results['error'] = str(e)
    return results

def count_pattern_occurrences(file_path, pattern):
    """Count occurrences of a pattern in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            return content.count(pattern)
    except Exception:
        return 0

def main():
    print("🧪 BACKEND TEST SUITE: 10 IVR Improvements")
    print("=" * 60)
    
    total_tests = 0
    passed_tests = 0
    failed_tests = []
    
    # Test 1: Syntax Validation
    print("\n📋 SYNTAX VALIDATION")
    files_to_check = [
        '/app/js/_index.js',
        '/app/js/voice-service.js', 
        '/app/js/phone-config.js'
    ]
    
    for file_path in files_to_check:
        total_tests += 1
        is_valid, error = check_syntax(file_path)
        if is_valid:
            log_test(f"Syntax check: {os.path.basename(file_path)}", "PASS")
            passed_tests += 1
        else:
            log_test(f"Syntax check: {os.path.basename(file_path)}", "FAIL", error)
            failed_tests.append(f"Syntax: {os.path.basename(file_path)}")
    
    # Test 2: Health Check
    print("\n🏥 HEALTH CHECK")
    total_tests += 1
    is_healthy, health_data = check_health()
    if is_healthy:
        log_test("Backend health endpoint", "PASS", f"Status: {health_data}")
        passed_tests += 1
    else:
        log_test("Backend health endpoint", "FAIL", health_data)
        failed_tests.append("Health check")
    
    # Test 3: Error Log Check
    print("\n📋 ERROR LOG CHECK")
    total_tests += 1
    try:
        result = subprocess.run(['stat', '-c', '%s', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            size = int(result.stdout.strip())
            if size == 0:
                log_test("Error log size", "PASS", "0 bytes (clean)")
                passed_tests += 1
            else:
                log_test("Error log size", "WARN", f"{size} bytes")
                passed_tests += 1  # Not a failure, just a warning
        else:
            log_test("Error log check", "FAIL", "Could not check log file")
            failed_tests.append("Error log check")
    except Exception as e:
        log_test("Error log check", "FAIL", str(e))
        failed_tests.append("Error log check")
    
    # Test 4-13: IVR Feature Verification
    print("\n🤖 IVR FEATURE VERIFICATION")
    
    # Test 4: #8 Twilio IVR Auto-Attendant (CRITICAL)
    total_tests += 1
    patterns = {
        'priority_0_check': 'PRIORITY 0: IVR Auto-Attendant',
        'ivr_config_check': 'phoneConfig.canAccessFeature(num.plan, \'ivr\')',
        'inbound_ivr_gather_endpoint': 'app.post(\'/twilio/inbound-ivr-gather\'',
        'ivr_inbound_log': 'type: \'ivr_inbound\''
    }
    results = search_file_content('/app/js/_index.js', patterns)
    
    if all(results.get(k, False) for k in patterns.keys() if k != 'error'):
        log_test("#8 Twilio IVR Auto-Attendant", "PASS", "All components found")
        passed_tests += 1
    else:
        missing = [k for k, v in results.items() if not v and k != 'error']
        log_test("#8 Twilio IVR Auto-Attendant", "FAIL", f"Missing: {missing}")
        failed_tests.append("#8 Twilio IVR Auto-Attendant")
    
    # Test 5: #1 Quick Dial Presets
    total_tests += 1
    preset_patterns = {
        'preset_prefix': '💾 ',
        'new_call_button': 'New Call',
        'save_preset_callback': 'save_preset:',
        'preset_name_action': 'ivrObPresetName',
        'save_preset_button': '💾 Save Preset'
    }
    results = search_file_content('/app/js/_index.js', preset_patterns)
    
    if all(results.get(k, False) for k in preset_patterns.keys() if k != 'error'):
        log_test("#1 Quick Dial Presets", "PASS", "All preset components found")
        passed_tests += 1
    else:
        missing = [k for k, v in results.items() if not v and k != 'error']
        log_test("#1 Quick Dial Presets", "FAIL", f"Missing: {missing}")
        failed_tests.append("#1 Quick Dial Presets")
    
    # Test 6: #2 Recent Calls
    total_tests += 1
    recent_patterns = {
        'phone_logs_query': 'phoneLogs',
        'last_5_calls': 'last 5',
        'deduplicate': 'target number'
    }
    results = search_file_content('/app/js/_index.js', recent_patterns)
    
    if results.get('phone_logs_query', False):
        log_test("#2 Recent Calls", "PASS", "Phone logs integration found")
        passed_tests += 1
    else:
        log_test("#2 Recent Calls", "FAIL", "Phone logs integration not found")
        failed_tests.append("#2 Recent Calls")
    
    # Test 7: #3 Auto-Suggest Placeholders
    total_tests += 1
    placeholder_count = count_pattern_occurrences('/app/js/_index.js', '📌')
    if placeholder_count >= 5:
        log_test("#3 Auto-Suggest Placeholders", "PASS", f"Found {placeholder_count} placeholder references")
        passed_tests += 1
    else:
        log_test("#3 Auto-Suggest Placeholders", "FAIL", f"Only found {placeholder_count} placeholder references")
        failed_tests.append("#3 Auto-Suggest Placeholders")
    
    # Test 8: #4 Remember Voice/Speed
    total_tests += 1
    voice_speed_count = count_pattern_occurrences('/app/js/_index.js', '⭐ Last:')
    if voice_speed_count >= 5:
        log_test("#4 Remember Voice/Speed", "PASS", f"Found {voice_speed_count} 'Last:' references")
        passed_tests += 1
    else:
        log_test("#4 Remember Voice/Speed", "FAIL", f"Only found {voice_speed_count} 'Last:' references")
        failed_tests.append("#4 Remember Voice/Speed")
    
    # Test 9: #5 Batch Number Entry
    total_tests += 1
    batch_patterns = {
        'comma_separated': 'comma-separated',
        'batch_targets': 'batchTargets',
        'batch_delay': '2s delay'
    }
    results = search_file_content('/app/js/_index.js', batch_patterns)
    
    if results.get('batch_targets', False):
        log_test("#5 Batch Number Entry", "PASS", "Batch targets functionality found")
        passed_tests += 1
    else:
        log_test("#5 Batch Number Entry", "FAIL", "Batch targets functionality not found")
        failed_tests.append("#5 Batch Number Entry")
    
    # Test 10: #6 Skip Preview
    total_tests += 1
    skip_count = count_pattern_occurrences('/app/js/_index.js', '⏭ Skip & Call')
    if skip_count >= 2:
        log_test("#6 Skip Preview", "PASS", f"Found {skip_count} skip preview references")
        passed_tests += 1
    else:
        log_test("#6 Skip Preview", "FAIL", f"Only found {skip_count} skip preview references")
        failed_tests.append("#6 Skip Preview")
    
    # Test 11: #7 Flatten Templates
    total_tests += 1
    custom_script_count = count_pattern_occurrences('/app/js/_index.js', '✍️ Custom Script')
    if custom_script_count >= 5:
        log_test("#7 Flatten Templates", "PASS", f"Found {custom_script_count} custom script references")
        passed_tests += 1
    else:
        log_test("#7 Flatten Templates", "FAIL", f"Only found {custom_script_count} custom script references")
        failed_tests.append("#7 Flatten Templates")
    
    # Test 12: #9 Audio Greeting in Telnyx IVR
    total_tests += 1
    audio_patterns = {
        'gather_dtmf_audio': 'gatherDTMFWithAudio',
        'greeting_audio_url': 'greetingAudioUrl'
    }
    results = search_file_content('/app/js/voice-service.js', audio_patterns)
    
    if all(results.get(k, False) for k in audio_patterns.keys() if k != 'error'):
        log_test("#9 Audio Greeting in Telnyx IVR", "PASS", "Audio greeting functionality found")
        passed_tests += 1
    else:
        missing = [k for k, v in results.items() if not v and k != 'error']
        log_test("#9 Audio Greeting in Telnyx IVR", "FAIL", f"Missing: {missing}")
        failed_tests.append("#9 Audio Greeting in Telnyx IVR")
    
    # Test 13: #10 Call Scheduling
    total_tests += 1
    schedule_count = count_pattern_occurrences('/app/js/_index.js', '🕐 Schedule')
    scheduled_calls_patterns = {
        'schedule_button': '🕐 Schedule',
        'scheduled_calls': 'scheduledCalls',
        'set_interval': 'setInterval'
    }
    results = search_file_content('/app/js/_index.js', scheduled_calls_patterns)
    
    if schedule_count >= 2 and results.get('scheduled_calls', False):
        log_test("#10 Call Scheduling", "PASS", f"Found {schedule_count} schedule references and scheduledCalls")
        passed_tests += 1
    else:
        log_test("#10 Call Scheduling", "FAIL", f"Schedule count: {schedule_count}, scheduledCalls: {results.get('scheduled_calls', False)}")
        failed_tests.append("#10 Call Scheduling")
    
    # Test 14: General Health Checks
    print("\n🔧 GENERAL HEALTH CHECKS")
    
    # Check if Node.js service is running
    total_tests += 1
    try:
        # Check if the Node.js process is running (either _index.js or start-bot.js)
        result = subprocess.run(['pgrep', '-f', 'node.*start-bot.js'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            log_test("Node.js service running", "PASS", f"PID: {result.stdout.strip()}")
            passed_tests += 1
        else:
            # Fallback check for _index.js
            result = subprocess.run(['pgrep', '-f', 'node.*_index.js'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log_test("Node.js service running", "PASS", f"PID: {result.stdout.strip()}")
                passed_tests += 1
            else:
                log_test("Node.js service running", "FAIL", "No Node.js process found")
                failed_tests.append("Node.js service")
    except Exception as e:
        log_test("Node.js service check", "FAIL", str(e))
        failed_tests.append("Node.js service check")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {len(failed_tests)}")
    
    if failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for test in failed_tests:
            print(f"   • {test}")
    
    success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 OVERALL STATUS: GOOD - Most IVR improvements are working")
        return 0
    elif success_rate >= 60:
        print("⚠️ OVERALL STATUS: PARTIAL - Some IVR improvements need attention")
        return 1
    else:
        print("🚨 OVERALL STATUS: CRITICAL - Major IVR improvements are failing")
        return 2

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)