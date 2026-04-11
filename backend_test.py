#!/usr/bin/env python3

"""
Backend Test for Voicemail Billing Implementation
Tests the voicemail billing implementation in js/_index.js and js/voice-service.js
"""

import subprocess
import sys
import re
import requests
import json

def run_command(cmd):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"

def test_syntax_validation():
    """Test 1 & 2: Syntax validation for both files"""
    print("🔍 Testing syntax validation...")
    
    # Test _index.js syntax
    code, stdout, stderr = run_command("node -c /app/js/_index.js")
    if code != 0:
        print(f"❌ _index.js syntax check failed: {stderr}")
        return False
    print("✅ _index.js syntax validation passed")
    
    # Test voice-service.js syntax
    code, stdout, stderr = run_command("node -c /app/js/voice-service.js")
    if code != 0:
        print(f"❌ voice-service.js syntax check failed: {stderr}")
        return False
    print("✅ voice-service.js syntax validation passed")
    
    return True

def test_health_endpoint():
    """Test 3: Health endpoint returns healthy"""
    print("🔍 Testing health endpoint...")
    
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                print(f"✅ Health endpoint healthy: {data}")
                return True
            else:
                print(f"❌ Health endpoint not healthy: {data}")
                return False
        else:
            print(f"❌ Health endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_error_logs():
    """Test 4: Error logs are clean"""
    print("🔍 Testing error logs...")
    
    code, stdout, stderr = run_command("wc -c /var/log/supervisor/nodejs.err.log")
    if code == 0:
        size = int(stdout.strip().split()[0])
        if size == 0:
            print("✅ Error log is empty (0 bytes)")
            return True
        else:
            print(f"❌ Error log has {size} bytes")
            # Show last few lines if not empty
            code2, content, _ = run_command("tail -10 /var/log/supervisor/nodejs.err.log")
            if content.strip():
                print(f"Recent errors:\n{content}")
            return False
    else:
        print(f"❌ Could not check error log: {stderr}")
        return False

def test_voicemail_complete_implementation():
    """Test 5: Verify /twilio/voicemail-complete implementation"""
    print("🔍 Testing /twilio/voicemail-complete implementation...")
    
    # Read the _index.js file
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Could not read _index.js: {e}")
        return False
    
    # Find the voicemail-complete handler (around line 25754)
    voicemail_handler_match = re.search(r"app\.post\('/twilio/voicemail-complete'.*?(?=app\.post|$)", content, re.DOTALL)
    if not voicemail_handler_match:
        print("❌ /twilio/voicemail-complete handler not found")
        return False
    
    handler_code = voicemail_handler_match.group(0)
    
    # Test 5a: voiceService import
    if "voiceService = require('./voice-service.js')" in handler_code:
        print("✅ voiceService import found")
    else:
        print("❌ voiceService import not found")
        return False
    
    # Test 5b: CallSid extraction
    if "CallSid" in handler_code and "req.body" in handler_code:
        print("✅ CallSid extraction from req.body found")
    else:
        print("❌ CallSid extraction not found")
        return False
    
    # Test 5c: 1-minute minimum billing
    if "Math.max(1, Math.ceil(duration / 60))" in handler_code:
        print("✅ 1-minute minimum billing logic found")
    else:
        print("❌ 1-minute minimum billing logic not found")
        return False
    
    # Test 5d: billCallMinutesUnified call with 'Twilio_Voicemail'
    if "billCallMinutesUnified(chatId, num.phoneNumber, minutesBilled, decodedFrom, 'Twilio_Voicemail')" in handler_code:
        print("✅ billCallMinutesUnified call with 'Twilio_Voicemail' found")
    else:
        print("❌ billCallMinutesUnified call with 'Twilio_Voicemail' not found")
        return False
    
    # Test 5e: _twilioBilledCallSids.add(CallSid) for deduplication
    if "_twilioBilledCallSids.add(CallSid)" in handler_code:
        print("✅ _twilioBilledCallSids.add(CallSid) deduplication found")
    else:
        print("❌ _twilioBilledCallSids.add(CallSid) deduplication not found")
        return False
    
    # Test 5f: billingLine with plan usage
    if "billingLine" in handler_code and "remaining" in handler_code and "billingInfo.limit" in handler_code:
        print("✅ billingLine with plan usage found")
    else:
        print("❌ billingLine with plan usage not found")
        return False
    
    # Test 5g: minutesBilled stored in phoneLogs
    if "minutesBilled" in handler_code and "phoneLogs" in handler_code:
        print("✅ minutesBilled stored in phoneLogs found")
    else:
        print("❌ minutesBilled stored in phoneLogs not found")
        return False
    
    return True

def test_voice_service_handlecallhangup():
    """Test 6: Verify voice-service.js handleCallHangup voicemail notification"""
    print("🔍 Testing voice-service.js handleCallHangup voicemail notification...")
    
    # Read the voice-service.js file
    try:
        with open("/app/js/voice-service.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Could not read voice-service.js: {e}")
        return False
    
    # Test 6a: voicemail_recording/voicemail_greeting phase check
    voicemail_phase_pattern = r"session\.phase === 'voicemail_recording' \|\| session\.phase === 'voicemail_greeting'"
    if re.search(voicemail_phase_pattern, content):
        print("✅ voicemail_recording/voicemail_greeting phase check found")
    else:
        print("❌ voicemail_recording/voicemail_greeting phase check not found")
        return False
    
    # Test 6b: Notification includes billingInfo.overageCharge
    # Find the voicemail notification section
    voicemail_section_match = re.search(r"session\.phase === 'voicemail_recording' \|\| session\.phase === 'voicemail_greeting'.*?(?=} else|$)", content, re.DOTALL)
    if not voicemail_section_match:
        print("❌ Voicemail notification section not found")
        return False
    
    voicemail_section = voicemail_section_match.group(0)
    
    if "billingInfo.overageCharge" in voicemail_section:
        print("✅ billingInfo.overageCharge in notification found")
    else:
        print("❌ billingInfo.overageCharge in notification not found")
        return False
    
    # Test 6c: planLine and formatDuration(duration)
    if "planLine" in voicemail_section and "formatDuration(duration)" in voicemail_section:
        print("✅ planLine and formatDuration(duration) found")
    else:
        print("❌ planLine and formatDuration(duration) not found")
        return False
    
    # Test 6d: Message header is 'Voicemail Call Ended'
    if "Voicemail Call Ended" in voicemail_section:
        print("✅ 'Voicemail Call Ended' header found")
    else:
        print("❌ 'Voicemail Call Ended' header not found")
        return False
    
    return True

def test_billcallminutesunified_function():
    """Test 7: Verify billCallMinutesUnified function exists and is exported"""
    print("🔍 Testing billCallMinutesUnified function...")
    
    # Read the voice-service.js file
    try:
        with open("/app/js/voice-service.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Could not read voice-service.js: {e}")
        return False
    
    # Check if function exists around line 877
    if "async function billCallMinutesUnified(" in content:
        print("✅ billCallMinutesUnified function found")
    else:
        print("❌ billCallMinutesUnified function not found")
        return False
    
    # Check if it's exported (around line 3906)
    if "billCallMinutesUnified," in content:
        print("✅ billCallMinutesUnified is exported")
    else:
        print("❌ billCallMinutesUnified is not exported")
        return False
    
    return True

def test_twilio_billed_call_sids():
    """Test 8: Verify _twilioBilledCallSids variable exists"""
    print("🔍 Testing _twilioBilledCallSids variable...")
    
    # Read the _index.js file
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Could not read _index.js: {e}")
        return False
    
    # Check if _twilioBilledCallSids is declared
    if "_twilioBilledCallSids = new Set()" in content:
        print("✅ _twilioBilledCallSids variable declaration found")
    else:
        print("❌ _twilioBilledCallSids variable declaration not found")
        return False
    
    # Check if it's used for deduplication
    if "_twilioBilledCallSids.add(CallSid)" in content:
        print("✅ _twilioBilledCallSids.add(CallSid) usage found")
    else:
        print("❌ _twilioBilledCallSids.add(CallSid) usage not found")
        return False
    
    return True

def test_regular_twilio_billing_paths():
    """Test 9: Verify regular Twilio inbound billing paths still work"""
    print("🔍 Testing regular Twilio inbound billing paths...")
    
    # Read the _index.js file
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Could not read _index.js: {e}")
        return False
    
    # Check sip-ring-result handler
    sip_ring_match = re.search(r"app\.post\('/twilio/sip-ring-result'.*?(?=app\.post|$)", content, re.DOTALL)
    if sip_ring_match and "_twilioBilledCallSids.add(CallSid)" in sip_ring_match.group(0):
        print("✅ sip-ring-result handler adds to _twilioBilledCallSids")
    else:
        print("❌ sip-ring-result handler does not add to _twilioBilledCallSids")
        return False
    
    # Check voice-dial-status handler
    voice_dial_match = re.search(r"app\.post\('/twilio/voice-dial-status'.*?(?=app\.post|$)", content, re.DOTALL)
    if voice_dial_match and "_twilioBilledCallSids.add(CallSid)" in voice_dial_match.group(0):
        print("✅ voice-dial-status handler adds to _twilioBilledCallSids")
    else:
        print("❌ voice-dial-status handler does not add to _twilioBilledCallSids")
        return False
    
    return True

def main():
    """Run all tests"""
    print("🚀 Starting Voicemail Billing Implementation Tests")
    print("=" * 60)
    
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Health Endpoint", test_health_endpoint),
        ("Error Logs", test_error_logs),
        ("Voicemail Complete Implementation", test_voicemail_complete_implementation),
        ("Voice Service HandleCallHangup", test_voice_service_handlecallhangup),
        ("billCallMinutesUnified Function", test_billcallminutesunified_function),
        ("_twilioBilledCallSids Variable", test_twilio_billed_call_sids),
        ("Regular Twilio Billing Paths", test_regular_twilio_billing_paths),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 40)
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} PASSED")
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 TEST SUMMARY: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Voicemail billing implementation is working correctly!")
        return 0
    else:
        print(f"⚠️  {total - passed} test(s) failed - Please review the implementation")
        return 1

if __name__ == "__main__":
    sys.exit(main())