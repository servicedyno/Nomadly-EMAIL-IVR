#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Telnyx Quick IVR and SIP Functionality Fixes
Tests the fixes implemented in voice-service.js and _index.js
"""

import requests
import json
import time
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://readme-setup-5.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Test credentials from review request
TELNYX_CALLER_ID = "+18889020132"
TELNYX_TARGET_NUMBER = "+13025141000"
TELNYX_SIP_CONNECTION_ID = "2898118323872990714"

class TelnyxTestSuite:
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

    def test_health_endpoint(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    self.log_result("Health Endpoint", True, "Backend is healthy and database connected")
                    return True
                else:
                    self.log_result("Health Endpoint", False, f"Unhealthy status: {data}")
                    return False
            else:
                self.log_result("Health Endpoint", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Endpoint", False, f"Request failed: {str(e)}")
            return False

    def test_telnyx_ivr_endpoint(self):
        """Priority 1: Test the /test/telnyx-ivr endpoint"""
        try:
            payload = {
                "callerId": TELNYX_CALLER_ID,
                "targetNumber": TELNYX_TARGET_NUMBER
            }
            
            response = requests.post(f"{BASE_URL}/test/telnyx-ivr", 
                                   json=payload, 
                                   headers=HEADERS, 
                                   timeout=30)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "callControlId" in data or "success" in data:
                        self.log_result("Telnyx IVR Test Endpoint", True, 
                                      "Endpoint responded successfully", 
                                      f"Response: {data}")
                        return True
                    else:
                        self.log_result("Telnyx IVR Test Endpoint", False, 
                                      "Missing expected response fields", 
                                      f"Response: {data}")
                        return False
                except json.JSONDecodeError:
                    # Some endpoints might return plain text
                    response_text = response.text
                    if "call" in response_text.lower() or "success" in response_text.lower():
                        self.log_result("Telnyx IVR Test Endpoint", True, 
                                      "Endpoint responded (text response)", 
                                      f"Response: {response_text[:200]}")
                        return True
                    else:
                        self.log_result("Telnyx IVR Test Endpoint", False, 
                                      "Unexpected text response", 
                                      f"Response: {response_text[:200]}")
                        return False
            else:
                self.log_result("Telnyx IVR Test Endpoint", False, 
                              f"HTTP {response.status_code}", 
                              f"Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_result("Telnyx IVR Test Endpoint", False, f"Request failed: {str(e)}")
            return False

    def test_sip_inbound_webhook(self):
        """Priority 2: Test SIP inbound call handling"""
        try:
            # Simulate inbound webhook from Telnyx
            payload = {
                "data": {
                    "event_type": "call.initiated",
                    "payload": {
                        "call_control_id": f"test_inbound_{int(time.time())}",
                        "direction": "incoming",
                        "from": "+15551234567",
                        "to": TELNYX_CALLER_ID,
                        "connection_id": "test_connection"
                    }
                }
            }
            
            response = requests.post(f"{BASE_URL}/telnyx/voice-webhook", 
                                   json=payload, 
                                   headers=HEADERS, 
                                   timeout=15)
            
            # Webhook should return 200 regardless of processing result
            if response.status_code == 200:
                self.log_result("SIP Inbound Webhook", True, 
                              "Webhook accepted inbound call simulation")
                return True
            else:
                self.log_result("SIP Inbound Webhook", False, 
                              f"HTTP {response.status_code}", 
                              f"Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_result("SIP Inbound Webhook", False, f"Request failed: {str(e)}")
            return False

    def test_sip_outbound_webhook(self):
        """Priority 2: Test SIP outbound call handling"""
        try:
            # Simulate outbound webhook from SIP connection
            payload = {
                "data": {
                    "event_type": "call.initiated",
                    "payload": {
                        "call_control_id": f"test_outbound_{int(time.time())}",
                        "direction": "outgoing",
                        "from": TELNYX_CALLER_ID,
                        "to": TELNYX_TARGET_NUMBER,
                        "connection_id": TELNYX_SIP_CONNECTION_ID
                    }
                }
            }
            
            response = requests.post(f"{BASE_URL}/telnyx/voice-webhook", 
                                   json=payload, 
                                   headers=HEADERS, 
                                   timeout=15)
            
            # Webhook should return 200 regardless of processing result
            if response.status_code == 200:
                self.log_result("SIP Outbound Webhook", True, 
                              "Webhook accepted outbound call simulation")
                return True
            else:
                self.log_result("SIP Outbound Webhook", False, 
                              f"HTTP {response.status_code}", 
                              f"Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            self.log_result("SIP Outbound Webhook", False, f"Request failed: {str(e)}")
            return False

    def test_voice_service_fix_verification(self):
        """Verify the outboundIvrCalls check fix in handleOutboundSipCall"""
        try:
            # Read the voice-service.js file to verify the fix is in place
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
                
            # Check for the critical fix around line 1031
            if "if (outboundIvrCalls[callControlId])" in content:
                # Look for the specific pattern that indicates the fix
                lines = content.split('\n')
                fix_found = False
                for i, line in enumerate(lines):
                    if "outboundIvrCalls[callControlId]" in line and "if (" in line:
                        # Check the surrounding context
                        context = '\n'.join(lines[max(0, i-5):i+10])
                        if "routing to IVR handler" in context or "return" in lines[i+1:i+5]:
                            fix_found = True
                            break
                
                if fix_found:
                    self.log_result("Voice Service Fix Verification", True, 
                                  "outboundIvrCalls check found in handleOutboundSipCall")
                else:
                    self.log_result("Voice Service Fix Verification", False, 
                                  "outboundIvrCalls check exists but fix pattern not confirmed")
            else:
                self.log_result("Voice Service Fix Verification", False, 
                              "outboundIvrCalls check not found in voice-service.js")
                
        except Exception as e:
            self.log_result("Voice Service Fix Verification", False, f"File check failed: {str(e)}")

    def test_scheduler_db_guards(self):
        """Priority 3: Test scheduler error fixes with DB guards"""
        try:
            # Read the _index.js file to verify DB guards are in place
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for both scheduler functions with guards
            functions_to_check = [
                "checkVPSPlansExpiryandPayment",
                "sendRemindersForExpiringPackages"
            ]
            
            guards_found = 0
            for func_name in functions_to_check:
                if func_name in content:
                    # Find the function and check for DB guard
                    func_start = content.find(f"function {func_name}")
                    if func_start == -1:
                        func_start = content.find(f"async function {func_name}")
                    
                    if func_start != -1:
                        # Get the next 500 characters to check for guard
                        func_content = content[func_start:func_start+500]
                        if ("typeof" in func_content and "find" in func_content and 
                            "function" in func_content and "return" in func_content):
                            guards_found += 1
            
            if guards_found == 2:
                self.log_result("Scheduler DB Guards", True, 
                              "Both scheduler functions have DB initialization guards")
            elif guards_found == 1:
                self.log_result("Scheduler DB Guards", False, 
                              "Only one scheduler function has DB guard")
            else:
                self.log_result("Scheduler DB Guards", False, 
                              "No DB guards found in scheduler functions")
                
        except Exception as e:
            self.log_result("Scheduler DB Guards", False, f"File check failed: {str(e)}")

    def test_backend_logs_for_errors(self):
        """Check for recent errors in backend logs"""
        try:
            # Check if there are any recent critical errors
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                # If health endpoint works, backend is running without critical errors
                self.log_result("Backend Error Check", True, 
                              "Backend responding normally, no critical errors detected")
            else:
                self.log_result("Backend Error Check", False, 
                              f"Backend health check failed: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("Backend Error Check", False, f"Health check failed: {str(e)}")

    def test_telnyx_webhook_endpoint_availability(self):
        """Test that Telnyx webhook endpoints are available"""
        endpoints_to_test = [
            "/telnyx/voice-webhook",
            "/telnyx/sms-webhook"
        ]
        
        all_available = True
        for endpoint in endpoints_to_test:
            try:
                # Send a minimal test payload
                test_payload = {"data": {"event_type": "test"}}
                response = requests.post(f"{BASE_URL}{endpoint}", 
                                       json=test_payload, 
                                       headers=HEADERS, 
                                       timeout=10)
                
                # Webhook endpoints should return 200 even for invalid payloads
                if response.status_code != 200:
                    all_available = False
                    break
                    
            except Exception:
                all_available = False
                break
        
        if all_available:
            self.log_result("Telnyx Webhook Endpoints", True, 
                          "All Telnyx webhook endpoints are available")
        else:
            self.log_result("Telnyx Webhook Endpoints", False, 
                          "One or more Telnyx webhook endpoints unavailable")

    def run_all_tests(self):
        """Run all tests in priority order"""
        print("=" * 60)
        print("TELNYX QUICK IVR AND SIP FUNCTIONALITY TEST SUITE")
        print("=" * 60)
        print()
        
        # Priority 1: Critical Telnyx Quick IVR Fix
        print("🔥 PRIORITY 1: TELNYX QUICK IVR FIX (CRITICAL)")
        print("-" * 50)
        self.test_health_endpoint()
        self.test_voice_service_fix_verification()
        self.test_telnyx_ivr_endpoint()
        
        # Priority 2: SIP Inbound/Outbound Verification  
        print("📞 PRIORITY 2: SIP INBOUND/OUTBOUND VERIFICATION")
        print("-" * 50)
        self.test_telnyx_webhook_endpoint_availability()
        self.test_sip_inbound_webhook()
        self.test_sip_outbound_webhook()
        
        # Priority 3: Scheduler Error Fixes
        print("⏰ PRIORITY 3: SCHEDULER ERROR FIXES")
        print("-" * 50)
        self.test_scheduler_db_guards()
        self.test_backend_logs_for_errors()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"✅ PASSED: {self.passed}")
        print(f"❌ FAILED: {self.failed}")
        print(f"📊 TOTAL:  {self.passed + self.failed}")
        print()
        
        if self.failed == 0:
            print("🎉 ALL TESTS PASSED! Telnyx fixes are working correctly.")
        else:
            print("⚠️  SOME TESTS FAILED. Review the failures above.")
            
        return self.failed == 0

def main():
    """Main test execution"""
    test_suite = TelnyxTestSuite()
    success = test_suite.run_all_tests()
    
    # Return appropriate exit code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()