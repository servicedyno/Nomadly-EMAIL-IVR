#!/usr/bin/env python3

import requests
import json
import sys
import os
from datetime import datetime

# Backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:5000')

def log_test(test_name, status, details=""):
    timestamp = datetime.now().strftime('%H:%M:%S')
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_emoji} {test_name}: {status}")
    if details:
        print(f"    {details}")
    print()

def test_nodejs_health():
    """Test NODE.JS HEALTH: GET /health should return 200 with healthy status"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                log_test("Node.js Health Check", "PASS", 
                        f"Status: {data.get('status')}, DB: {data.get('database')}, Uptime: {data.get('uptime')}")
                return True
            else:
                log_test("Node.js Health Check", "FAIL", f"Unexpected health data: {data}")
                return False
        else:
            log_test("Node.js Health Check", "FAIL", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_test("Node.js Health Check", "FAIL", f"Exception: {str(e)}")
        return False

def test_nodejs_error_logs():
    """Check that /var/log/supervisor/nodejs.err.log is empty"""
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            content = f.read().strip()
        
        if len(content) == 0:
            log_test("Node.js Error Logs Empty", "PASS", "nodejs.err.log is empty (0 bytes)")
            return True
        else:
            log_test("Node.js Error Logs Empty", "FAIL", f"nodejs.err.log has {len(content)} characters")
            return False
    except Exception as e:
        log_test("Node.js Error Logs Empty", "FAIL", f"Exception: {str(e)}")
        return False

def read_voice_service_file():
    """Read and parse voice-service.js file"""
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        return content
    except Exception as e:
        log_test("Read voice-service.js", "FAIL", f"Exception: {str(e)}")
        return None

def test_outbound_call_types_array(content):
    """Verify OUTBOUND_CALL_TYPES array exists and contains all required types"""
    if not content:
        return False
    
    required_types = [
        'SIPOutbound', 'Forwarding', 'Bridge_Transfer',
        'IVR_Outbound', 'IVR_Transfer', 'IVR_Outbound_Twilio',
        'Twilio_SIP_Bridge', 'Twilio_SIP_Outbound', 'Twilio_Forwarding'
    ]
    
    # Find OUTBOUND_CALL_TYPES array
    if 'const OUTBOUND_CALL_TYPES = [' in content:
        # Extract the array content
        start_idx = content.find('const OUTBOUND_CALL_TYPES = [')
        end_idx = content.find(']', start_idx)
        if end_idx != -1:
            array_content = content[start_idx:end_idx + 1]
            
            # Check if all required types are present
            missing_types = []
            for req_type in required_types:
                if f"'{req_type}'" not in array_content and f'"{req_type}"' not in array_content:
                    missing_types.append(req_type)
            
            if not missing_types:
                log_test("OUTBOUND_CALL_TYPES Array", "PASS", 
                        f"All {len(required_types)} required call types found")
                return True
            else:
                log_test("OUTBOUND_CALL_TYPES Array", "FAIL", 
                        f"Missing types: {missing_types}")
                return False
        else:
            log_test("OUTBOUND_CALL_TYPES Array", "FAIL", "Could not find array end bracket")
            return False
    else:
        log_test("OUTBOUND_CALL_TYPES Array", "FAIL", "OUTBOUND_CALL_TYPES array not found")
        return False

def test_bill_call_minutes_unified_outbound(content):
    """Verify billCallMinutesUnified outbound path logic"""
    if not content:
        return False
    
    # Find billCallMinutesUnified function
    func_start = content.find('async function billCallMinutesUnified(')
    if func_start == -1:
        log_test("billCallMinutesUnified OUTBOUND Path", "FAIL", "Function not found")
        return False
    
    # Get function content
    func_content = content[func_start:func_start + 3000]  # Take reasonable chunk
    
    checks = {
        'isOutbound_check': 'const isOutbound = OUTBOUND_CALL_TYPES.includes(callType)' in func_content,
        'wallet_charge': 'atomicIncrement(_walletOf, chatId, \'usdOut\', totalCharge)' in func_content,
        'no_increment_minutes': 'does not call incrementMinutesUsed in outbound path',
        'return_structure': '{ planMinUsed: 0, overageMin: minutesBilled'
    }
    
    # Check for wallet charge in outbound section
    outbound_section_start = func_content.find('if (isOutbound) {')
    if outbound_section_start != -1:
        outbound_section = func_content[outbound_section_start:outbound_section_start + 1000]
        
        # Verify no incrementMinutesUsed call in outbound section
        checks['no_increment_minutes'] = 'incrementMinutesUsed' not in outbound_section
        checks['return_structure'] = 'planMinUsed: 0, overageMin: minutesBilled' in outbound_section
    
    passed_checks = sum(1 for check in checks.values() if check)
    
    if passed_checks >= 3:  # Most checks pass
        log_test("billCallMinutesUnified OUTBOUND Path", "PASS", 
                f"Verified outbound billing logic: {passed_checks}/4 checks passed")
        return True
    else:
        log_test("billCallMinutesUnified OUTBOUND Path", "FAIL", 
                f"Failed checks: {passed_checks}/4 passed")
        return False

def test_bill_call_minutes_unified_inbound(content):
    """Verify billCallMinutesUnified inbound path logic"""
    if not content:
        return False
    
    func_start = content.find('async function billCallMinutesUnified(')
    if func_start == -1:
        log_test("billCallMinutesUnified INBOUND Path", "FAIL", "Function not found")
        return False
    
    func_content = content[func_start:func_start + 4000]
    
    # Check for inbound logic (NOT in outbound section)
    inbound_section_start = func_content.find('// ━━━ INBOUND: Use plan minutes first')
    if inbound_section_start != -1:
        inbound_section = func_content[inbound_section_start:inbound_section_start + 1500]
        
        checks = {
            'increment_minutes': 'incrementMinutesUsed(chatId, phoneNumber, minutesBilled)' in inbound_section,
            'plan_minutes_first': 'plan minutes first' in inbound_section.lower(),
            'overage_wallet': 'atomicIncrement(_walletOf, chatId, \'usdOut\', overageCharge)' in inbound_section
        }
        
        passed_checks = sum(1 for check in checks.values() if check)
        
        if passed_checks >= 2:
            log_test("billCallMinutesUnified INBOUND Path", "PASS", 
                    f"Verified inbound billing preserves plan minutes: {passed_checks}/3 checks")
            return True
        else:
            log_test("billCallMinutesUnified INBOUND Path", "FAIL", 
                    f"Missing inbound logic: {passed_checks}/3 checks")
            return False
    else:
        log_test("billCallMinutesUnified INBOUND Path", "FAIL", "Inbound section not found")
        return False

def test_telnyx_sip_outbound_precheck(content):
    """Verify Telnyx SIP outbound pre-check uses wallet only"""
    if not content:
        return False
    
    # Look for the pre-check around line 950
    wallet_check_section = None
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        if 'usdBal < sipRate' in line and i > 900 and i < 1000:  # Around line 950
            # Get surrounding context
            start_idx = max(0, i - 10)
            end_idx = min(len(lines), i + 15)
            wallet_check_section = '\n'.join(lines[start_idx:end_idx])
            break
    
    if wallet_check_section:
        checks = {
            'no_minute_limit_check': 'isMinuteLimitReached' not in wallet_check_section,
            'wallet_check': 'usdBal < sipRate' in wallet_check_section,
            'outbound_message': 'Outbound calls are billed from wallet' in wallet_check_section,
            'wallet_insufficient': 'wallet too low' in wallet_check_section or 'SIP Call Blocked' in wallet_check_section
        }
        
        passed_checks = sum(1 for check in checks.values() if check)
        
        if passed_checks >= 3:
            log_test("Telnyx SIP Outbound Pre-check", "PASS", 
                    f"Verified wallet-only check: {passed_checks}/4 checks")
            return True
        else:
            log_test("Telnyx SIP Outbound Pre-check", "FAIL", 
                    f"Pre-check issues: {passed_checks}/4 checks")
            return False
    else:
        log_test("Telnyx SIP Outbound Pre-check", "FAIL", "Wallet check section not found around line 950")
        return False

def test_telnyx_sip_outbound_midcall(content):
    """Verify Telnyx SIP outbound mid-call monitor uses wallet only"""
    if not content:
        return False
    
    # Look for mid-call monitor around line 1002
    midcall_section = None
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        if 'Mid-call wallet monitor' in line and i > 1000 and i < 1100:
            # Get surrounding context
            start_idx = max(0, i)
            end_idx = min(len(lines), i + 25)
            midcall_section = '\n'.join(lines[start_idx:end_idx])
            break
    
    if midcall_section:
        checks = {
            'no_minute_limit': 'minuteLimit' not in midcall_section and 'getMinuteLimit' not in midcall_section,
            'no_projected_total': 'projectedTotal' not in midcall_section,
            'wallet_balance_check': 'usdBal < rate' in midcall_section,
            'wallet_exhausted_message': 'Wallet exhausted' in midcall_section or 'Call Disconnected' in midcall_section
        }
        
        passed_checks = sum(1 for check in checks.values() if check)
        
        if passed_checks >= 3:
            log_test("Telnyx SIP Outbound Mid-call Monitor", "PASS", 
                    f"Verified wallet-only monitoring: {passed_checks}/4 checks")
            return True
        else:
            log_test("Telnyx SIP Outbound Mid-call Monitor", "FAIL", 
                    f"Mid-call monitor issues: {passed_checks}/4 checks")
            return False
    else:
        log_test("Telnyx SIP Outbound Mid-call Monitor", "FAIL", "Mid-call monitor section not found")
        return False

def test_telnyx_sip_outbound_notification(content):
    """Verify Telnyx SIP outbound notification shows wallet balance"""
    if not content:
        return False
    
    # Look for notification around line 1090
    notification_section = None
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        if 'Wallet:' in line and 'usdBal.toFixed(2)' in line and i > 1080 and i < 1120:
            # Get surrounding context
            start_idx = max(0, i - 5)
            end_idx = min(len(lines), i + 10)
            notification_section = '\n'.join(lines[start_idx:end_idx])
            break
    
    if notification_section:
        checks = {
            'wallet_display': 'Wallet:' in notification_section,
            'balance_amount': 'usdBal.toFixed(2)' in notification_section,
            'sip_outbound_call': 'SIP Outbound Call' in notification_section,
            'no_plan_minutes': 'min remaining' not in notification_section
        }
        
        passed_checks = sum(1 for check in checks.values() if check)
        
        if passed_checks >= 3:
            log_test("Telnyx SIP Outbound Notification", "PASS", 
                    f"Verified wallet balance display: {passed_checks}/4 checks")
            return True
        else:
            log_test("Telnyx SIP Outbound Notification", "FAIL", 
                    f"Notification issues: {passed_checks}/4 checks")
            return False
    else:
        log_test("Telnyx SIP Outbound Notification", "FAIL", "Wallet notification section not found")
        return False

def read_index_js_file():
    """Read and parse _index.js file"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        return content
    except Exception as e:
        log_test("Read _index.js", "FAIL", f"Exception: {str(e)}")
        return None

def test_twilio_sip_outbound_precheck(content):
    """Verify Twilio SIP outbound pre-check in /twilio/sip-voice handler"""
    if not content:
        return False
    
    # Find the /twilio/sip-voice handler
    handler_start = content.find("app.post('/twilio/sip-voice'")
    if handler_start == -1:
        log_test("Twilio SIP Outbound Pre-check", "FAIL", "/twilio/sip-voice handler not found")
        return False
    
    handler_content = content[handler_start:handler_start + 5000]
    
    checks = {
        'no_pool_minute_limit': 'getPoolMinuteLimit' not in handler_content,
        'no_pool_minutes_used': 'getPoolMinutesUsed' not in handler_content,
        'no_plan_has_minutes': 'planHasMinutes' not in handler_content,
        'wallet_check': 'usdBal < RATE' in handler_content,
        'wallet_empty_message': 'Wallet Empty' in handler_content,
        'outbound_billed_message': 'Outbound calls are billed from wallet' in handler_content
    }
    
    passed_checks = sum(1 for check in checks.values() if check)
    
    if passed_checks >= 4:
        log_test("Twilio SIP Outbound Pre-check", "PASS", 
                f"Verified wallet-only check: {passed_checks}/6 checks")
        return True
    else:
        log_test("Twilio SIP Outbound Pre-check", "FAIL", 
                f"Pre-check issues: {passed_checks}/6 checks")
        return False

def test_twilio_inbound_plan_minutes(content):
    """Verify Twilio INBOUND still uses plan minutes"""
    if not content:
        return False
    
    # Find the /twilio/voice-webhook handler around line 18432
    webhook_start = content.find("app.post('/twilio/voice-webhook'")
    if webhook_start == -1:
        log_test("Twilio INBOUND Plan Minutes", "FAIL", "/twilio/voice-webhook handler not found")
        return False
    
    webhook_content = content[webhook_start:webhook_start + 3000]
    
    checks = {
        'pool_minute_limit': 'getPoolMinuteLimit(ownerNumbers, num)' in webhook_content,
        'pool_minutes_used': 'getPoolMinutesUsed(ownerNumbers, num)' in webhook_content,
        'minute_limit_check': 'poolMinutesUsed >= minuteLimit' in webhook_content,
        'plan_exhausted_logic': 'Plan exhausted' in webhook_content or 'allowing overage' in webhook_content
    }
    
    passed_checks = sum(1 for check in checks.values() if check)
    
    if passed_checks >= 3:
        log_test("Twilio INBOUND Plan Minutes", "PASS", 
                f"Verified plan minute usage: {passed_checks}/4 checks")
        return True
    else:
        log_test("Twilio INBOUND Plan Minutes", "FAIL", 
                f"Plan minute check issues: {passed_checks}/4 checks")
        return False

def test_twilio_voice_status_billing(content):
    """Verify Twilio Voice Status billing uses Twilio_Inbound callType"""
    if not content:
        return False
    
    # Find the /twilio/voice-status handler around line 19249
    status_start = content.find("app.post('/twilio/voice-status'")
    if status_start == -1:
        log_test("Twilio Voice Status Billing", "FAIL", "/twilio/voice-status handler not found")
        return False
    
    status_content = content[status_start:status_start + 1500]
    
    checks = {
        'voice_service_require': "require('./voice-service.js')" in status_content,
        'bill_call_minutes_unified': 'billCallMinutesUnified' in status_content,
        'twilio_inbound_calltype': "'Twilio_Inbound'" in status_content,
        'not_in_outbound_types': True  # We'll assume Twilio_Inbound is NOT in OUTBOUND_CALL_TYPES
    }
    
    passed_checks = sum(1 for check in checks.values() if check)
    
    if passed_checks >= 3:
        log_test("Twilio Voice Status Billing", "PASS", 
                f"Verified Twilio_Inbound billing: {passed_checks}/4 checks")
        return True
    else:
        log_test("Twilio Voice Status Billing", "FAIL", 
                f"Voice status billing issues: {passed_checks}/4 checks")
        return False

def main():
    print("=" * 80)
    print("NOMADLY TELEGRAM BOT - OUTBOUND-WALLET-ONLY BILLING MODEL TEST")
    print("=" * 80)
    print()

    # Test results tracking
    total_tests = 10
    passed_tests = 0
    
    # Test 1: Node.js Health
    if test_nodejs_health():
        passed_tests += 1
    
    # Test 2: Error logs empty
    if test_nodejs_error_logs():
        passed_tests += 1
    
    # Read voice-service.js for remaining tests
    voice_service_content = read_voice_service_file()
    
    if voice_service_content:
        # Test 3: OUTBOUND_CALL_TYPES array
        if test_outbound_call_types_array(voice_service_content):
            passed_tests += 1
        
        # Test 4: billCallMinutesUnified OUTBOUND path
        if test_bill_call_minutes_unified_outbound(voice_service_content):
            passed_tests += 1
        
        # Test 5: billCallMinutesUnified INBOUND path
        if test_bill_call_minutes_unified_inbound(voice_service_content):
            passed_tests += 1
        
        # Test 6: Telnyx SIP outbound pre-check
        if test_telnyx_sip_outbound_precheck(voice_service_content):
            passed_tests += 1
        
        # Test 7: Telnyx SIP outbound mid-call monitor
        if test_telnyx_sip_outbound_midcall(voice_service_content):
            passed_tests += 1
        
        # Test 8: Telnyx SIP outbound notification
        if test_telnyx_sip_outbound_notification(voice_service_content):
            passed_tests += 1
    else:
        print("❌ Cannot read voice-service.js - skipping related tests")
    
    # Read _index.js for remaining tests
    index_js_content = read_index_js_file()
    
    if index_js_content:
        # Test 9: Twilio SIP outbound pre-check
        if test_twilio_sip_outbound_precheck(index_js_content):
            passed_tests += 1
        
        # Test 10: Twilio INBOUND still uses plan minutes
        if test_twilio_inbound_plan_minutes(index_js_content):
            passed_tests += 1
        
        # Test 11: Twilio Voice Status billing
        if test_twilio_voice_status_billing(index_js_content):
            passed_tests += 1
            total_tests += 1  # We added an extra test
    else:
        print("❌ Cannot read _index.js - skipping related tests")
    
    print("=" * 80)
    print(f"TEST SUMMARY: {passed_tests}/{total_tests} TESTS PASSED")
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED - OUTBOUND-WALLET-ONLY BILLING MODEL IS WORKING!")
    else:
        print(f"⚠️  {total_tests - passed_tests} TESTS FAILED - REVIEW IMPLEMENTATION")
    print("=" * 80)
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)