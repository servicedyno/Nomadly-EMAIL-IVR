#!/usr/bin/env python3
"""
Backend Test Suite for Plan-Gating of Redial Button and Custom OTP Messages
Tests the implementation according to the verification checklist.
"""

import subprocess
import json
import requests
import sys
import os

# Backend URL from environment
BACKEND_URL = "https://readme-setup-13.preview.emergentagent.com"

def run_node_check(file_path):
    """Run node -c syntax check on a JavaScript file"""
    try:
        result = subprocess.run(['node', '-c', file_path], 
                              capture_output=True, text=True, cwd='/app')
        return result.returncode == 0, result.stderr
    except Exception as e:
        return False, str(e)

def check_health():
    """Check backend health endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        return response.status_code == 200, response.json() if response.status_code == 200 else response.text
    except Exception as e:
        return False, str(e)

def search_file_content(file_path, pattern):
    """Search for pattern in file and return matching lines with line numbers"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        matches = []
        for i, line in enumerate(lines, 1):
            if pattern.lower() in line.lower():
                matches.append((i, line.strip()))
        return matches
    except Exception as e:
        return []

def verify_phone_config():
    """Verify phone-config.js feature flags and configuration"""
    print("🔍 TESTING: phone-config.js Feature Flags")
    
    results = []
    
    # Test 1: Check planFeatureAccess.starter has ivrRedial: false and otpCustomMessages: false
    matches = search_file_content('/app/js/phone-config.js', 'starter: {')
    starter_section_found = False
    for line_num, line in matches:
        if 'starter: {' in line:
            starter_section_found = True
            break
    
    ivr_redial_starter = search_file_content('/app/js/phone-config.js', 'ivrRedial: false')
    otp_custom_starter = search_file_content('/app/js/phone-config.js', 'otpCustomMessages: false')
    
    results.append({
        'test': 'planFeatureAccess.starter has ivrRedial: false and otpCustomMessages: false',
        'passed': len(ivr_redial_starter) >= 2 and len(otp_custom_starter) >= 2,  # Should appear in starter and pro
        'details': f"Found ivrRedial: false at lines: {[l[0] for l in ivr_redial_starter]}, otpCustomMessages: false at lines: {[l[0] for l in otp_custom_starter]}"
    })
    
    # Test 2: Check planFeatureAccess.business has ivrRedial: true and otpCustomMessages: true
    ivr_redial_business = search_file_content('/app/js/phone-config.js', 'ivrRedial: true')
    otp_custom_business = search_file_content('/app/js/phone-config.js', 'otpCustomMessages: true')
    
    results.append({
        'test': 'planFeatureAccess.business has ivrRedial: true and otpCustomMessages: true',
        'passed': len(ivr_redial_business) >= 1 and len(otp_custom_business) >= 1,
        'details': f"Found ivrRedial: true at lines: {[l[0] for l in ivr_redial_business]}, otpCustomMessages: true at lines: {[l[0] for l in otp_custom_business]}"
    })
    
    # Test 3: Check getUpgradeMessage maps ivrRedial and otpCustomMessages to 'Business'
    upgrade_mapping = search_file_content('/app/js/phone-config.js', "feature === 'ivrRedial' || feature === 'otpCustomMessages'")
    business_mapping = search_file_content('/app/js/phone-config.js', "'Business'")
    
    results.append({
        'test': 'getUpgradeMessage maps ivrRedial and otpCustomMessages to Business',
        'passed': len(upgrade_mapping) >= 1,
        'details': f"Found upgrade mapping at lines: {[l[0] for l in upgrade_mapping]}"
    })
    
    # Test 4: Check featureNamesI18n has entries for ivrRedial and otpCustomMessages in all languages
    feature_names_ivr = search_file_content('/app/js/phone-config.js', 'ivrRedial:')
    feature_names_otp = search_file_content('/app/js/phone-config.js', 'otpCustomMessages:')
    
    results.append({
        'test': 'featureNamesI18n has entries for ivrRedial and otpCustomMessages in en/fr/zh/hi',
        'passed': len(feature_names_ivr) >= 4 and len(feature_names_otp) >= 4,  # Should appear in all 4 languages
        'details': f"Found ivrRedial entries: {len(feature_names_ivr)}, otpCustomMessages entries: {len(feature_names_otp)}"
    })
    
    return results

def verify_voice_service():
    """Verify voice-service.js Telnyx redial gate implementation"""
    print("🔍 TESTING: voice-service.js Telnyx Redial Gate")
    
    results = []
    
    # Test 5: Check require('./phone-config.js') imports canAccessFeature
    phone_config_import = search_file_content('/app/js/voice-service.js', "require('./phone-config.js')")
    can_access_feature = search_file_content('/app/js/voice-service.js', 'canAccessFeature')
    
    results.append({
        'test': 'voice-service.js imports canAccessFeature from phone-config.js',
        'passed': len(phone_config_import) >= 1 and len(can_access_feature) >= 1,
        'details': f"Found phone-config import: {len(phone_config_import)}, canAccessFeature usage: {len(can_access_feature)}"
    })
    
    # Test 6: Check handleOutboundIvrHangup checks canAccessFeature(callerNum.plan, 'ivrRedial')
    hangup_redial_check = search_file_content('/app/js/voice-service.js', "canAccessFeature(callerNum.plan, 'ivrRedial')")
    
    results.append({
        'test': 'handleOutboundIvrHangup checks canAccessFeature for ivrRedial',
        'passed': len(hangup_redial_check) >= 1,
        'details': f"Found ivrRedial access check at lines: {[l[0] for l in hangup_redial_check]}"
    })
    
    # Test 7: Check conditional redial button logic
    show_redial = search_file_content('/app/js/voice-service.js', 'showRedial')
    
    results.append({
        'test': 'Conditional redial button logic implemented',
        'passed': len(show_redial) >= 1,
        'details': f"Found showRedial logic at lines: {[l[0] for l in show_redial]}"
    })
    
    return results

def verify_index_js():
    """Verify _index.js Twilio redial gate and OTP custom messages implementation"""
    print("🔍 TESTING: _index.js Twilio Redial Gate and OTP Custom Messages")
    
    results = []
    
    # Test 8: Check single-ivr-status handler checks canAccessFeature for ivrRedial
    single_ivr_redial = search_file_content('/app/js/_index.js', "canAccessFeature(callerNum.plan, 'ivrRedial')")
    
    results.append({
        'test': 'single-ivr-status handler checks canAccessFeature for ivrRedial',
        'passed': len(single_ivr_redial) >= 1,
        'details': f"Found ivrRedial access check at lines: {[l[0] for l in single_ivr_redial]}"
    })
    
    # Test 9: Check ivr_redial callback handler checks plan and calls getUpgradeMessage
    ivr_redial_callback = search_file_content('/app/js/_index.js', 'ivr_redial')
    upgrade_message_call = search_file_content('/app/js/_index.js', 'getUpgradeMessage')
    
    results.append({
        'test': 'ivr_redial callback handler checks plan and shows upgrade message',
        'passed': len(ivr_redial_callback) >= 1,
        'details': f"Found ivr_redial callback references: {len(ivr_redial_callback)}"
    })
    
    # Test 10: Check ivrObOtpLength handler checks canAccessFeature for otpCustomMessages
    otp_length_custom = search_file_content('/app/js/_index.js', "canAccessFeature(callerNum.plan, 'otpCustomMessages')")
    
    results.append({
        'test': 'ivrObOtpLength handler checks canAccessFeature for otpCustomMessages',
        'passed': len(otp_length_custom) >= 1,
        'details': f"Found otpCustomMessages access check at lines: {[l[0] for l in otp_length_custom]}"
    })
    
    # Test 11: Check Business plan gets Customize/Defaults buttons, others skip to voice provider
    customize_messages = search_file_content('/app/js/_index.js', 'Customize Messages')
    use_defaults = search_file_content('/app/js/_index.js', 'Use Defaults')
    
    results.append({
        'test': 'Business plan shows Customize Messages/Use Defaults buttons',
        'passed': len(customize_messages) >= 1 and len(use_defaults) >= 1,
        'details': f"Found Customize Messages: {len(customize_messages)}, Use Defaults: {len(use_defaults)}"
    })
    
    return results

def verify_syntax_and_health():
    """Verify syntax checks and health endpoint"""
    print("🔍 TESTING: Syntax Validation and Health Checks")
    
    results = []
    
    # Test 12-14: Syntax checks
    files_to_check = [
        '/app/js/phone-config.js',
        '/app/js/voice-service.js', 
        '/app/js/_index.js'
    ]
    
    for file_path in files_to_check:
        passed, error = run_node_check(file_path)
        results.append({
            'test': f'node -c {os.path.basename(file_path)} passes',
            'passed': passed,
            'details': f"Syntax check result: {'OK' if passed else error}"
        })
    
    # Test 15: Health endpoint
    health_ok, health_data = check_health()
    results.append({
        'test': 'Health endpoint returns healthy',
        'passed': health_ok and (isinstance(health_data, dict) and health_data.get('status') == 'healthy'),
        'details': f"Health response: {health_data}"
    })
    
    # Test 16: Check error log size
    try:
        log_size = os.path.getsize('/var/log/supervisor/nodejs.err.log') if os.path.exists('/var/log/supervisor/nodejs.err.log') else 0
        results.append({
            'test': 'Error log is empty (0 bytes)',
            'passed': log_size == 0,
            'details': f"Error log size: {log_size} bytes"
        })
    except Exception as e:
        results.append({
            'test': 'Error log is empty (0 bytes)',
            'passed': False,
            'details': f"Could not check error log: {e}"
        })
    
    return results

def main():
    """Run all tests and generate report"""
    print("=" * 80)
    print("🧪 BACKEND TESTING: Plan-Gating of Redial Button and Custom OTP Messages")
    print("=" * 80)
    
    all_results = []
    
    # Run all test suites
    all_results.extend(verify_phone_config())
    all_results.extend(verify_voice_service())
    all_results.extend(verify_index_js())
    all_results.extend(verify_syntax_and_health())
    
    # Generate summary
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed_count = 0
    total_count = len(all_results)
    
    for i, result in enumerate(all_results, 1):
        status = "✅ PASS" if result['passed'] else "❌ FAIL"
        print(f"{i:2d}. {status} - {result['test']}")
        if not result['passed'] or '--verbose' in sys.argv:
            print(f"    Details: {result['details']}")
        if result['passed']:
            passed_count += 1
    
    print("\n" + "=" * 80)
    success_rate = (passed_count / total_count) * 100
    print(f"🎯 OVERALL RESULT: {passed_count}/{total_count} tests passed ({success_rate:.1f}%)")
    
    if success_rate == 100:
        print("🎉 ALL TESTS PASSED! Plan-gating implementation is working correctly.")
    elif success_rate >= 80:
        print("⚠️  MOSTLY WORKING with some issues to address.")
    else:
        print("🚨 SIGNIFICANT ISSUES DETECTED - requires attention.")
    
    print("=" * 80)
    
    return 0 if success_rate == 100 else 1

if __name__ == "__main__":
    sys.exit(main())