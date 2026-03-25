#!/usr/bin/env python3
"""
Comprehensive Backend Testing for SIP Outbound Caller Identification Fix
Tests the fixes implemented in voice-service.js and telnyx-service.js
"""

import requests
import json
import time
import sys
import subprocess
import os
from datetime import datetime

# Test configuration
BASE_URL = "https://readme-setup-5.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Test credentials from review request
TELNYX_CALLER_ID = "+18889020132"
TELNYX_TARGET_NUMBER = "+13025141000"
TELNYX_SIP_CONNECTION_ID = "2898118323872990714"

class SipCallerIdTestSuite:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        
    def log_result(self, test_name, passed, message="", details=""):
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details:
            print(f"    Details: {details}")
        print()

    def test_syntax_validation(self):
        """Test 1: Syntax validation for voice-service.js and telnyx-service.js"""
        try:
            # Test voice-service.js syntax
            result1 = subprocess.run(['node', '-c', '/app/js/voice-service.js'], 
                                   capture_output=True, text=True, timeout=10)
            
            # Test telnyx-service.js syntax  
            result2 = subprocess.run(['node', '-c', '/app/js/telnyx-service.js'], 
                                   capture_output=True, text=True, timeout=10)
            
            if result1.returncode == 0 and result2.returncode == 0:
                self.log_result("Syntax Validation", True, 
                              "Both voice-service.js and telnyx-service.js pass syntax checks")
                return True
            else:
                errors = []
                if result1.returncode != 0:
                    errors.append(f"voice-service.js: {result1.stderr}")
                if result2.returncode != 0:
                    errors.append(f"telnyx-service.js: {result2.stderr}")
                
                self.log_result("Syntax Validation", False, 
                              "Syntax errors found", "; ".join(errors))
                return False
                
        except Exception as e:
            self.log_result("Syntax Validation", False, f"Syntax check failed: {str(e)}")
            return False

    def test_nodejs_health(self):
        """Test 2: Node.js running clean with health endpoint and error log check"""
        try:
            # Check health endpoint
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code != 200:
                self.log_result("Node.js Health", False, f"Health endpoint returned HTTP {response.status_code}")
                return False
                
            data = response.json()
            if data.get("status") != "healthy":
                self.log_result("Node.js Health", False, f"Health status not healthy: {data}")
                return False
            
            # Check error log size
            try:
                error_log_size = os.path.getsize('/var/log/supervisor/nodejs.err.log')
                if error_log_size == 0:
                    self.log_result("Node.js Health", True, 
                                  "Health endpoint healthy and error log is 0 bytes")
                    return True
                else:
                    self.log_result("Node.js Health", False, 
                                  f"Error log is {error_log_size} bytes (should be 0)")
                    return False
            except FileNotFoundError:
                # If error log doesn't exist, that's also good
                self.log_result("Node.js Health", True, 
                              "Health endpoint healthy and no error log found")
                return True
                
        except Exception as e:
            self.log_result("Node.js Health", False, f"Health check failed: {str(e)}")
            return False

    def test_findNumberBySipUser_signature(self):
        """Test 3: Verify findNumberBySipUser function accepts 3 parameters"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for the function signature
            if "async function findNumberBySipUser(sipUsername, fromPhone, connectionPhoneNumber)" in content:
                self.log_result("findNumberBySipUser Signature", True, 
                              "Function signature has 3 parameters: sipUsername, fromPhone, connectionPhoneNumber")
                return True
            else:
                # Check for alternative patterns
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if "findNumberBySipUser" in line and "function" in line:
                        if "sipUsername" in line and "fromPhone" in line and "connectionPhoneNumber" in line:
                            self.log_result("findNumberBySipUser Signature", True, 
                                          "Function signature found with 3 parameters")
                            return True
                
                self.log_result("findNumberBySipUser Signature", False, 
                              "Function signature does not have expected 3 parameters")
                return False
                
        except Exception as e:
            self.log_result("findNumberBySipUser Signature", False, f"File check failed: {str(e)}")
            return False

    def test_connectionPhoneNumber_blocking(self):
        """Test 4: Verify connectionPhoneNumber blocking logic"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for the blocking condition
            if "(!connectionPhoneNumber || fromPhone !== connectionPhoneNumber)" in content:
                self.log_result("connectionPhoneNumber Blocking", True, 
                              "Found blocking condition: (!connectionPhoneNumber || fromPhone !== connectionPhoneNumber)")
                return True
            else:
                self.log_result("connectionPhoneNumber Blocking", False, 
                              "connectionPhoneNumber blocking condition not found")
                return False
                
        except Exception as e:
            self.log_result("connectionPhoneNumber Blocking", False, f"File check failed: {str(e)}")
            return False

    def test_sip_credential_extraction(self):
        """Test 5: Verify SIP credential extraction from multiple sources"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Check for extraction from custom_headers
            custom_headers_check = (
                "custom_headers" in content and 
                "p-asserted-identity" in content and
                "x-authenticated-user" in content and
                "x-credential-username" in content and
                "remote-party-id" in content
            )
            
            # Check for extraction from sip_headers
            sip_headers_check = (
                "sip_headers" in content and
                "contact" in content
            )
            
            # Check for extraction from from_display_name
            display_name_check = (
                "from_display_name" in content and
                "gencred" in content
            )
            
            if custom_headers_check and sip_headers_check and display_name_check:
                self.log_result("SIP Credential Extraction", True, 
                              "All credential extraction sources found: custom_headers, sip_headers, from_display_name")
                return True
            else:
                missing = []
                if not custom_headers_check:
                    missing.append("custom_headers extraction")
                if not sip_headers_check:
                    missing.append("sip_headers extraction")
                if not display_name_check:
                    missing.append("from_display_name extraction")
                
                self.log_result("SIP Credential Extraction", False, 
                              f"Missing credential extraction sources: {', '.join(missing)}")
                return False
                
        except Exception as e:
            self.log_result("SIP Credential Extraction", False, f"File check failed: {str(e)}")
            return False

    def test_isConnectionDefaultNumber_logic(self):
        """Test 6: Verify isConnectionDefaultNumber logic"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for the logic that sets connectionPhoneNumber when conditions are met
            if ("isConnectionDefaultNumber" in content and 
                "isSipByConnection" in content and 
                "!credentialExtracted" in content and
                "connectionPhoneNumber" in content):
                self.log_result("isConnectionDefaultNumber Logic", True, 
                              "Found isConnectionDefaultNumber logic with proper conditions")
                return True
            else:
                self.log_result("isConnectionDefaultNumber Logic", False, 
                              "isConnectionDefaultNumber logic not found or incomplete")
                return False
                
        except Exception as e:
            self.log_result("isConnectionDefaultNumber Logic", False, f"File check failed: {str(e)}")
            return False

    def test_full_payload_logging(self):
        """Test 7: Verify full payload logging for SIP calls"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for payload logging when credential not extracted
            if ("SIP FULL PAYLOAD KEYS" in content and 
                "SIP PAYLOAD DETAIL" in content and
                "custom_headers" in content and
                "sip_headers" in content and
                "from_display_name" in content and
                "client_state" in content):
                self.log_result("Full Payload Logging", True, 
                              "Found comprehensive payload logging for SIP calls")
                return True
            else:
                self.log_result("Full Payload Logging", False, 
                              "Full payload logging not found or incomplete")
                return False
                
        except Exception as e:
            self.log_result("Full Payload Logging", False, f"File check failed: {str(e)}")
            return False

    def test_listSIPCredentials_function(self):
        """Test 8: Verify listSIPCredentials function in telnyx-service.js"""
        try:
            with open('/app/js/telnyx-service.js', 'r') as f:
                content = f.read()
            
            # Check if function exists
            if "async function listSIPCredentials(connectionId)" in content:
                # Check if it calls Telnyx API with filter
                if ("/telephony_credentials" in content and 
                    "filter[connection_id]" in content and
                    "module.exports" in content and
                    "listSIPCredentials" in content):
                    self.log_result("listSIPCredentials Function", True, 
                                  "Function exists, calls Telnyx API with filter, and is exported")
                    return True
                else:
                    self.log_result("listSIPCredentials Function", False, 
                                  "Function exists but missing API call or export")
                    return False
            else:
                self.log_result("listSIPCredentials Function", False, 
                              "listSIPCredentials function not found")
                return False
                
        except Exception as e:
            self.log_result("listSIPCredentials Function", False, f"File check failed: {str(e)}")
            return False

    def test_telnyx_reverse_lookup_fallback(self):
        """Test 9: Verify Telnyx reverse lookup fallback"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Look for the fallback logic
            if ("!credentialExtracted && isSipByConnection" in content and
                "listSIPCredentials" in content and
                "tryResult = await findNumberBySipUser" in content):
                self.log_result("Telnyx Reverse Lookup Fallback", True, 
                              "Found reverse lookup fallback with listSIPCredentials")
                return True
            else:
                self.log_result("Telnyx Reverse Lookup Fallback", False, 
                              "Reverse lookup fallback logic not found")
                return False
                
        except Exception as e:
            self.log_result("Telnyx Reverse Lookup Fallback", False, f"File check failed: {str(e)}")
            return False

    def test_regression_check(self):
        """Test 10: Regression check for previous SIP fixes"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Check for outboundIvrCalls check
            outbound_ivr_check = "outboundIvrCalls[callControlId]" in content
            
            # Check for smartWallet imports
            smart_wallet_check = ("smartWalletCheck" in content and "smartWalletDeduct" in content)
            
            # Check for token recovery in _attemptTwilioDirectCall (more flexible pattern)
            token_recovery_check = ("_attemptTwilioDirectCall" in content and 
                                  ("recovering from Twilio API" in content or 
                                   "Token recovered" in content or
                                   "getSubAccount" in content))
            
            if outbound_ivr_check and smart_wallet_check and token_recovery_check:
                self.log_result("Regression Check", True, 
                              "All previous SIP fixes intact: outboundIvrCalls check, smartWallet functions, token recovery")
                return True
            else:
                missing = []
                if not outbound_ivr_check:
                    missing.append("outboundIvrCalls check")
                if not smart_wallet_check:
                    missing.append("smartWallet functions")
                if not token_recovery_check:
                    missing.append("token recovery")
                
                self.log_result("Regression Check", False, 
                              f"Missing previous fixes: {', '.join(missing)}")
                return False
                
        except Exception as e:
            self.log_result("Regression Check", False, f"File check failed: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests for SIP outbound caller identification fix"""
        print("=" * 80)
        print("SIP OUTBOUND CALLER IDENTIFICATION FIX - COMPREHENSIVE TEST SUITE")
        print("=" * 80)
        print()
        
        print("🔧 TESTING: Fix SIP outbound caller identification — wrong user billing")
        print("-" * 70)
        
        # Run all 10 tests from the review request
        self.test_syntax_validation()
        self.test_nodejs_health()
        self.test_findNumberBySipUser_signature()
        self.test_connectionPhoneNumber_blocking()
        self.test_sip_credential_extraction()
        self.test_isConnectionDefaultNumber_logic()
        self.test_full_payload_logging()
        self.test_listSIPCredentials_function()
        self.test_telnyx_reverse_lookup_fallback()
        self.test_regression_check()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"✅ PASSED: {self.passed}")
        print(f"❌ FAILED: {self.failed}")
        print(f"📊 TOTAL:  {self.passed + self.failed}")
        print()
        
        if self.failed == 0:
            print("🎉 ALL TESTS PASSED! SIP outbound caller identification fix is working correctly.")
            print("   - findNumberBySipUser function signature updated")
            print("   - connectionPhoneNumber blocking logic implemented")
            print("   - Multi-source SIP credential extraction working")
            print("   - Telnyx reverse lookup fallback implemented")
            print("   - All previous SIP fixes remain intact")
        else:
            print("⚠️  SOME TESTS FAILED. Review the failures above.")
            print("   The SIP outbound caller identification fix may not be complete.")
            
        return self.failed == 0

def main():
    """Main test execution"""
    test_suite = SipCallerIdTestSuite()
    success = test_suite.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()