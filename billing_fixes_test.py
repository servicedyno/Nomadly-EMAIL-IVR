#!/usr/bin/env python3
"""
Backend Test for Nomadly Cloud Phone Platform - 6 Billing/Alert Fixes
Tests the 6 specific billing/alert fixes mentioned in the review request.
"""

import requests
import json
import sys
import re
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:5000"
TEST_USER_AGENT = "NomadlyBillingFixesTest/1.0"

def log_test(message: str, test_name: str = ""):
    """Log test results with formatting"""
    prefix = f"[{test_name}] " if test_name else ""
    print(f"✓ {prefix}{message}")

def log_error(message: str, test_name: str = ""):
    """Log test errors with formatting"""
    prefix = f"[{test_name}] " if test_name else ""
    print(f"❌ {prefix}{message}")

def log_info(message: str, test_name: str = ""):
    """Log test info with formatting"""
    prefix = f"[{test_name}] " if test_name else ""
    print(f"ℹ️ {prefix}{message}")

class BillingFixesTest:
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': TEST_USER_AGENT,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.tests_passed = 0
        self.tests_failed = 0
    
    def test_health_endpoint(self) -> bool:
        """Test general health endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                status = data.get('status')
                database = data.get('database')
                
                if status == 'healthy' and database == 'connected':
                    log_test(f"GET {BASE_URL}/health returns 200 with healthy status and connected database", "HEALTH")
                    self.tests_passed += 1
                    return True
                else:
                    log_error(f"Health endpoint returned status={status}, database={database}", "HEALTH")
                    self.tests_failed += 1
                    return False
            else:
                log_error(f"Health endpoint returned {response.status_code}", "HEALTH")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Health endpoint test failed: {e}", "HEALTH")
            self.tests_failed += 1
            return False
    
    def check_backend_logs_empty(self) -> bool:
        """Check if backend error logs are empty"""
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '5', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                if not result.stdout.strip():
                    log_test("nodejs.err.log is EMPTY (0 bytes) - no startup errors", "LOGS")
                    self.tests_passed += 1
                    return True
                else:
                    log_error(f"nodejs.err.log contains errors: {result.stdout}", "LOGS")
                    self.tests_failed += 1
                    return False
            else:
                log_error(f"Cannot read nodejs.err.log (exit code {result.returncode})", "LOGS")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Log check failed: {e}", "LOGS")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix1(self) -> bool:
        """Fix 1: IVR Forward Wallet Check - Check code implementation"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for the IVR forward case with wallet check
            if "case 'forward':" in content:
                # Extract the forward case section
                lines = content.split('\n')
                forward_section = []
                in_forward_case = False
                brace_count = 0
                
                for line in lines:
                    if "case 'forward':" in line:
                        in_forward_case = True
                        brace_count = 0
                    
                    if in_forward_case:
                        forward_section.append(line)
                        brace_count += line.count('{') - line.count('}')
                        
                        # End of case when we reach 'break' and braces are balanced
                        if 'break' in line and brace_count <= 0:
                            break
                
                forward_code = '\n'.join(forward_section)
                
                # Check for required wallet checks
                checks = [
                    ("_walletOf wallet check", "_walletOf" in forward_code and "getBalance" in forward_code),
                    ("Rate calculation", "getCallRate" in forward_code),
                    ("Balance check before transfer", "usdBal < " in forward_code or "usdBal >=" in forward_code),
                    ("Voice message on insufficient balance", "speakOnCall" in forward_code and "insufficient" in forward_code.lower()),
                    ("Telegram notification", "sendMessage" in forward_code and "Blocked" in forward_code),
                    ("Low balance warning", "usdBal < 5" in forward_code or "Low Balance" in forward_code),
                    ("playHoldMusicAndTransfer call", "playHoldMusicAndTransfer" in forward_code)
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX1")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX1")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("case 'forward': not found in voice-service.js", "FIX1")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 1 verification failed: {e}", "FIX1")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix2(self) -> bool:
        """Fix 2: Twilio /voice-status unified billing - Check code implementation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for the /twilio/voice-status handler
            pattern = r"app\.post\('/twilio/voice-status'.*?(?=app\.post\('|$)"
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                handler_code = match.group(0)
                
                checks = [
                    ("Voice service require", "require('./voice-service.js')" in handler_code),
                    ("billCallMinutesUnified call", "billCallMinutesUnified" in handler_code),
                    ("No manual atomicIncrement", "atomicIncrement" not in handler_code or "voiceService." in handler_code),
                    ("Plan minutes remaining notification", "remaining" in handler_code and "limit" in handler_code),
                    ("Overage notification", "overage" in handler_code.lower())
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX2")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX2")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("/twilio/voice-status handler not found", "FIX2")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 2 verification failed: {e}", "FIX2")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix3(self) -> bool:
        """Fix 3: Twilio /voice-dial-status unified billing - Check code implementation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for the /twilio/voice-dial-status handler
            pattern = r"app\.post\('/twilio/voice-dial-status'.*?(?=app\.post\('|$)"
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                handler_code = match.group(0)
                
                checks = [
                    ("Voice service require", "require('./voice-service.js')" in handler_code),
                    ("billCallMinutesUnified call", "billCallMinutesUnified" in handler_code),
                    ("No manual atomicIncrement", "atomicIncrement" not in handler_code or "voiceService." in handler_code),
                    ("SIP bridge handling", "sip_bridge" in handler_code),
                    ("SIP outbound handling", "sip_outbound" in handler_code),
                    ("Forwarding call type", "Forwarding" in handler_code or "forward" in handler_code.lower())
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX3")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX3")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("/twilio/voice-dial-status handler not found", "FIX3")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 3 verification failed: {e}", "FIX3")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix4(self) -> bool:
        """Fix 4: Twilio Inbound wallet overage fallback - Check code implementation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for the /twilio/voice-webhook handler
            pattern = r"app\.post\('/twilio/voice-webhook'.*?(?=app\.post\('|$)"
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                handler_code = match.group(0)
                
                checks = [
                    ("ownerNumbers variable scoped correctly", "ownerNumbers = []" in handler_code and "let owner = null, num = null, ownerNumbers = []" in handler_code),
                    ("Minute limit check uses ownerNumbers", "getPoolMinuteLimit(ownerNumbers" in handler_code),
                    ("Plan exhausted wallet check", "getBalance(walletOf" in handler_code),
                    ("Wallet sufficient allows call", "allowing overage" in handler_code or "Fall through" in handler_code),
                    ("Wallet insufficient blocks with notification", "No Credits" in handler_code and "Blocked" in handler_code),
                    ("Rate info in notification", "rate" in handler_code and "US/CA" in handler_code and "Intl" in handler_code)
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX4")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX4")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("/twilio/voice-webhook handler not found", "FIX4")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 4 verification failed: {e}", "FIX4")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix5(self) -> bool:
        """Fix 5: Twilio SIP outbound plan check - Check code implementation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for the /twilio/sip-voice handler
            pattern = r"app\.post\('/twilio/sip-voice'.*?(?=app\.post\('|$)"
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                handler_code = match.group(0)
                
                checks = [
                    ("getPoolMinuteLimit check", "getPoolMinuteLimit" in handler_code),
                    ("getPoolMinutesUsed check", "getPoolMinutesUsed" in handler_code),
                    ("Plan has minutes check before wallet", "planHasMinutes" in handler_code and "Plan still has minutes" in handler_code),
                    ("Plan exhausted + wallet sufficient allows", "Plan exhausted" in handler_code and "allowing overage" in handler_code),
                    ("Plan exhausted + wallet empty blocks", "No Credits" in handler_code and "insufficient" in handler_code),
                    ("Detailed notification with rate info", "need" in handler_code and "min" in handler_code and "US/CA" in handler_code)
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX5")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX5")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("/twilio/sip-voice handler not found", "FIX5")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 5 verification failed: {e}", "FIX5")
            self.tests_failed += 1
            return False
    
    def verify_voice_service_fix6(self) -> bool:
        """Fix 6: Twilio SMS limit check + overage - Check code implementation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check isSmsLimitReached import
            if "isSmsLimitReached" not in content:
                log_error("isSmsLimitReached not imported", "FIX6")
                self.tests_failed += 1
                return False
            
            # Look for the /twilio/sms-webhook handler
            pattern = r"app\.post\('/twilio/sms-webhook'.*?(?=app\.post\('|$)"
            match = re.search(pattern, content, re.DOTALL)
            
            if match:
                handler_code = match.group(0)
                
                checks = [
                    ("isSmsLimitReached call", "isSmsLimitReached(match)" in handler_code),
                    ("Wallet balance check for overage", "getBalance(walletOf" in handler_code),
                    ("OVERAGE_RATE_SMS charging", "OVERAGE_RATE_SMS" in handler_code and "atomicIncrement" in handler_code),
                    ("Payment logging", "payments" in handler_code and "Overage" in handler_code),
                    ("User notification on overage", "SMS Overage" in handler_code),
                    ("No wallet -> drop SMS", "No Credits" in handler_code and "dropping" in handler_code.lower()),
                    ("isSmsLimitReached imported at line 235", content.split('\n')[234].strip().startswith("const") and "isSmsLimitReached" in content.split('\n')[234])
                ]
                
                all_passed = True
                for check_name, check_result in checks:
                    if check_result:
                        log_test(f"✓ {check_name} found", "FIX6")
                    else:
                        log_error(f"✗ {check_name} missing", "FIX6")
                        all_passed = False
                
                if all_passed:
                    self.tests_passed += 1
                    return True
                else:
                    self.tests_failed += 1
                    return False
            else:
                log_error("/twilio/sms-webhook handler not found", "FIX6")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"Fix 6 verification failed: {e}", "FIX6")
            self.tests_failed += 1
            return False
    
    def verify_formatphone_usage(self) -> bool:
        """Verify all formatPhone calls use phoneConfig.formatPhone"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for bare formatPhone calls (not prefixed with phoneConfig.)
            lines = content.split('\n')
            bare_calls = []
            
            for i, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith('//') or line.strip().startswith('*'):
                    continue
                    
                # Look for formatPhone calls that are NOT phoneConfig.formatPhone
                if 'formatPhone(' in line and 'phoneConfig.formatPhone(' not in line:
                    # Check if it's a function definition or import
                    if 'function formatPhone' not in line and 'formatPhone =' not in line and 'const formatPhone' not in line:
                        bare_calls.append((i, line.strip()))
            
            if not bare_calls:
                log_test("All formatPhone calls use phoneConfig.formatPhone (NO bare formatPhone found)", "FORMATPHONE")
                self.tests_passed += 1
                return True
            else:
                log_error(f"Found {len(bare_calls)} bare formatPhone calls:", "FORMATPHONE")
                for line_num, line in bare_calls[:3]:  # Show first 3
                    log_error(f"  Line {line_num}: {line}", "FORMATPHONE")
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"formatPhone verification failed: {e}", "FORMATPHONE")
            self.tests_failed += 1
            return False
    
    def verify_voiceservice_references(self) -> bool:
        """Verify all voiceService references are properly scoped"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for voiceService require statements in webhook handlers
            webhook_handlers = [
                '/twilio/voice-status',
                '/twilio/voice-dial-status'
            ]
            
            all_passed = True
            for handler in webhook_handlers:
                pattern = rf"app\.post\('{handler}'.*?(?=app\.post\('|$)"
                match = re.search(pattern, content, re.DOTALL)
                
                if match:
                    handler_code = match.group(0)
                    if "require('./voice-service.js')" in handler_code:
                        log_test(f"{handler} properly requires voice-service.js", "VOICESERVICE")
                    else:
                        log_error(f"{handler} missing voice-service require", "VOICESERVICE")
                        all_passed = False
                else:
                    log_error(f"{handler} handler not found", "VOICESERVICE")
                    all_passed = False
            
            if all_passed:
                self.tests_passed += 1
                return True
            else:
                self.tests_failed += 1
                return False
                
        except Exception as e:
            log_error(f"voiceService verification failed: {e}", "VOICESERVICE")
            self.tests_failed += 1
            return False
    
    def run_all_tests(self):
        """Run all billing/alert fix tests"""
        print("🔍 NOMADLY CLOUD PHONE BILLING/ALERT FIXES TEST")
        print("=" * 60)
        
        # General health tests
        self.test_health_endpoint()
        self.check_backend_logs_empty()
        
        # The 6 specific billing/alert fixes
        print("\n📋 TESTING 6 BILLING/ALERT FIXES:")
        print("-" * 40)
        
        self.verify_voice_service_fix1()  # Fix 1: IVR Forward Wallet Check
        self.verify_voice_service_fix2()  # Fix 2: Twilio /voice-status unified billing
        self.verify_voice_service_fix3()  # Fix 3: Twilio /voice-dial-status unified billing  
        self.verify_voice_service_fix4()  # Fix 4: Twilio Inbound wallet overage fallback
        self.verify_voice_service_fix5()  # Fix 5: Twilio SIP outbound plan check
        self.verify_voice_service_fix6()  # Fix 6: Twilio SMS limit check + overage
        
        # Additional verification
        print("\n🔧 GENERAL HEALTH CHECKS:")
        print("-" * 30)
        
        self.verify_formatphone_usage()
        self.verify_voiceservice_references()
        
        # Summary
        print("\n" + "=" * 60)
        total_tests = self.tests_passed + self.tests_failed
        success_rate = (self.tests_passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"📊 TEST SUMMARY:")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_failed == 0:
            print("\n🎉 ALL BILLING/ALERT FIXES VERIFIED SUCCESSFULLY!")
            return True
        else:
            print(f"\n⚠️  {self.tests_failed} ISSUES FOUND - REVIEW REQUIRED")
            return False

def main():
    """Main test function"""
    tester = BillingFixesTest()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()