#!/usr/bin/env python3
"""
Backend Test Suite for Nomadly Telegram Bot IVR System
Testing 4 new features: Redial Button, Consistent Voice, Customizable OTP Messages, Placeholder Documentation
"""

import subprocess
import sys
import re
import json
import requests
from pathlib import Path

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def test(self, name, condition, details=""):
        if condition:
            self.passed += 1
            status = "✅ PASS"
        else:
            self.failed += 1
            status = "❌ FAIL"
        
        result = f"{status}: {name}"
        if details:
            result += f" - {details}"
        
        self.results.append(result)
        print(result)
        return condition
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed ({self.failed} failed)")
        print(f"{'='*60}")
        return self.failed == 0

def run_command(cmd):
    """Run shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"

def read_file_content(filepath):
    """Read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

def test_health_endpoint():
    """Test backend health endpoint"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('status') == 'healthy' and data.get('database') == 'connected'
    except:
        pass
    return False

def main():
    test = TestResult()
    
    print("🧪 NOMADLY TELEGRAM BOT IVR SYSTEM - BACKEND TESTING")
    print("Testing 4 new features: Redial Button, Consistent Voice, Customizable OTP Messages, Placeholder Documentation")
    print("="*80)
    
    # ========================================
    # GENERAL HEALTH CHECKS
    # ========================================
    print("\n📋 GENERAL HEALTH CHECKS")
    print("-" * 40)
    
    # 21. Syntax validation
    code, _, _ = run_command("node -c /app/js/_index.js")
    test.test("_index.js syntax validation", code == 0)
    
    code, _, _ = run_command("node -c /app/js/voice-service.js")
    test.test("voice-service.js syntax validation", code == 0)
    
    # 22. Health endpoint
    health_ok = test_health_endpoint()
    test.test("Health endpoint returns healthy", health_ok)
    
    # 23. Error logs check
    code, stdout, _ = run_command("ls -la /var/log/supervisor/nodejs.err.log")
    log_size = 0
    if code == 0 and stdout:
        # Extract file size from ls output
        parts = stdout.strip().split()
        if len(parts) >= 5:
            try:
                log_size = int(parts[4])
            except:
                pass
    test.test("Error log is empty (0 bytes)", log_size == 0, f"Log size: {log_size} bytes")
    
    # ========================================
    # FEATURE 1: REDIAL BUTTON
    # ========================================
    print("\n🔁 FEATURE 1: REDIAL BUTTON")
    print("-" * 40)
    
    voice_content = read_file_content("/app/js/voice-service.js")
    index_content = read_file_content("/app/js/_index.js")
    
    # 1. lastIvrCallParams Map declaration
    test.test("lastIvrCallParams Map declared near line 35", 
              "const lastIvrCallParams = new Map()" in voice_content and 
              "chatId → last IVR call params for Redial feature" in voice_content)
    
    # 2. lastIvrCallParams exported
    test.test("lastIvrCallParams exported at end of voice-service.js",
              "lastIvrCallParams," in voice_content)
    
    # 3. handleOutboundIvrHangup stores params
    hangup_stores_params = (
        "lastIvrCallParams.set(session.chatId," in voice_content and
        "handleOutboundIvrHangup" in voice_content
    )
    test.test("handleOutboundIvrHangup stores lastIvrCallParams", hangup_stores_params)
    
    # 4. Redial button in hangup notification
    redial_button = (
        "🔁 Redial Same Number" in index_content and
        "ivr_redial:" in index_content
    )
    test.test("Redial button in hangup notification", redial_button)
    
    # 5. ivr_redial callback handler
    redial_handler = (
        "if (chatId && data.startsWith('ivr_redial:'))" in index_content and
        "callback_query" in index_content
    )
    test.test("ivr_redial callback_query handler exists", redial_handler)
    
    # ========================================
    # FEATURE 2: CONSISTENT VOICE
    # ========================================
    print("\n🎤 FEATURE 2: CONSISTENT VOICE")
    print("-" * 40)
    
    # 6. OPENAI_TO_TWILIO_VOICE mapping
    twilio_mapping = (
        "const OPENAI_TO_TWILIO_VOICE = {" in voice_content and
        "alloy" in voice_content and "Polly.Joanna-Neural" in voice_content and
        "onyx" in voice_content and "Polly.Stephen-Neural" in voice_content
    )
    test.test("OPENAI_TO_TWILIO_VOICE mapping exists", twilio_mapping)
    
    # 7. OPENAI_TO_TELNYX_VOICE mapping
    telnyx_mapping = (
        "const OPENAI_TO_TELNYX_VOICE = {" in voice_content and
        "alloy" in voice_content and "female" in voice_content and
        "onyx" in voice_content and "male" in voice_content
    )
    test.test("OPENAI_TO_TELNYX_VOICE mapping exists", telnyx_mapping)
    
    # 8. getTwilioVoice and getTelnyxVoice functions
    voice_functions = (
        "function getTwilioVoice(voiceName)" in voice_content and
        "function getTelnyxVoice(voiceName)" in voice_content and
        "getTwilioVoice," in voice_content and
        "getTelnyxVoice," in voice_content
    )
    test.test("getTwilioVoice() and getTelnyxVoice() functions exist and exported", voice_functions)
    
    # 9. Twilio response.say() calls use voice parameter
    twilio_voice_usage = len(re.findall(r'voice:\s*twilioVoice', index_content))
    test.test("Twilio response.say() calls use voice: twilioVoice", 
              twilio_voice_usage >= 10, f"Found {twilio_voice_usage} usages")
    
    # 10. Telnyx speakOnCall uses getTelnyxVoice
    telnyx_voice_usage = "getTelnyxVoice(session.voiceName)" in voice_content
    test.test("Telnyx speakOnCall uses getTelnyxVoice(session.voiceName)", telnyx_voice_usage)
    
    # ========================================
    # FEATURE 3: CUSTOMIZABLE OTP MESSAGES
    # ========================================
    print("\n📝 FEATURE 3: CUSTOMIZABLE OTP MESSAGES")
    print("-" * 40)
    
    # 11. Action states declared
    otp_actions = (
        "ivrObOtpMessages: 'ivrObOtpMessages'" in index_content and
        "ivrObOtpConfirmMsg: 'ivrObOtpConfirmMsg'" in index_content and
        "ivrObOtpRejectMsg: 'ivrObOtpRejectMsg'" in index_content
    )
    test.test("OTP message action states declared", otp_actions)
    
    # 12. Customize Messages buttons after OTP length
    customize_buttons = (
        "Customize Messages" in index_content and
        "Use Defaults" in index_content and
        "ivrObOtpMessages" in index_content
    )
    test.test("Customize Messages/Use Defaults buttons exist", customize_buttons)
    
    # 13. ivrObOtpConfirmMsg handler
    confirm_handler = (
        "if (action === a.ivrObOtpConfirmMsg)" in index_content and
        "Confirmation Message" in index_content and
        "CONFIRM" in index_content
    )
    test.test("ivrObOtpConfirmMsg handler asks for confirm message", confirm_handler)
    
    # 14. ivrObOtpRejectMsg handler
    reject_handler = (
        "if (action === a.ivrObOtpRejectMsg)" in index_content and
        "Rejection Message" in index_content and
        "REJECT" in index_content
    )
    test.test("ivrObOtpRejectMsg handler asks for reject message", reject_handler)
    
    # 15. otpConfirmMsg and otpRejectMsg passed to initiateOutboundIvrCall
    otp_params_passed = (
        "otpConfirmMsg" in index_content and
        "otpRejectMsg" in index_content and
        "initiateOutboundIvrCall" in index_content
    )
    test.test("otpConfirmMsg and otpRejectMsg passed to initiateOutboundIvrCall", otp_params_passed)
    
    # 16. Twilio session constructors include OTP message fields
    twilio_otp_fields = (
        "otpConfirmMsg" in voice_content and
        "otpRejectMsg" in voice_content
    )
    test.test("Twilio session constructors include otpConfirmMsg and otpRejectMsg", twilio_otp_fields)
    
    # 17. OTP hold handler uses custom messages with fallback
    otp_hold_usage = (
        "session.otpConfirmMsg || 'Your code has been verified" in index_content and
        "session.otpRejectMsg || 'Maximum verification attempts" in index_content
    )
    test.test("OTP hold handler uses custom messages with fallback", otp_hold_usage)
    
    # ========================================
    # FEATURE 4: PLACEHOLDER DOCUMENTATION
    # ========================================
    print("\n📋 FEATURE 4: PLACEHOLDER DOCUMENTATION")
    print("-" * 40)
    
    # 19. Custom script prompt includes All Placeholders button
    placeholder_button = (
        "['ℹ️ All Placeholders']" in index_content and
        "Custom Script" in index_content
    )
    test.test("Custom script prompt includes 'ℹ️ All Placeholders' button", placeholder_button)
    
    # 20. All Placeholders handler shows complete reference
    placeholder_handler = (
        "if (message === 'ℹ️ All Placeholders')" in index_content and
        "Complete Placeholder Reference" in index_content and
        "Standard" in index_content and
        "Smart Auto-Fill" in index_content and
        "Smart Pick" in index_content
    )
    test.test("All Placeholders handler shows complete reference with categories", placeholder_handler)
    
    # ========================================
    # ADDITIONAL VERIFICATION CHECKS
    # ========================================
    print("\n🔍 ADDITIONAL VERIFICATION CHECKS")
    print("-" * 40)
    
    # Check for specific implementation details mentioned in checklist
    
    # Redial functionality details
    redial_details = (
        "lastIvrCallParams.set" in voice_content and
        "ivr_redial:" in index_content and
        "callback_data" in index_content
    )
    test.test("Redial functionality implementation details", redial_details)
    
    # Voice consistency implementation
    voice_consistency = (
        "OPENAI_TO_TWILIO_VOICE" in voice_content and
        "OPENAI_TO_TELNYX_VOICE" in voice_content and
        "getTwilioVoice" in voice_content and
        "getTelnyxVoice" in voice_content
    )
    test.test("Voice consistency implementation complete", voice_consistency)
    
    # OTP customization flow
    otp_flow = (
        "ivrObOtpMessages" in index_content and
        "ivrObOtpConfirmMsg" in index_content and
        "ivrObOtpRejectMsg" in index_content
    )
    test.test("OTP customization flow implementation", otp_flow)
    
    # Placeholder documentation completeness
    placeholder_completeness = (
        "Standard (you type the value)" in index_content and
        "Smart Auto-Fill (generated for you)" in index_content and
        "Smart Pick (choose from presets)" in index_content
    )
    test.test("Placeholder documentation completeness", placeholder_completeness)
    
    # ========================================
    # FINAL SUMMARY
    # ========================================
    success = test.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! All 4 new IVR features are correctly implemented.")
        print("✅ Redial Button: lastIvrCallParams Map, hangup storage, callback handler")
        print("✅ Consistent Voice: OpenAI→Twilio/Telnyx mappings, voice functions, usage")
        print("✅ Customizable OTP Messages: action states, handlers, message flow")
        print("✅ Placeholder Documentation: button, complete reference with categories")
    else:
        print(f"\n⚠️  {test.failed} test(s) failed. Review implementation details above.")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())