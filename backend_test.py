#!/usr/bin/env python3
"""
Comprehensive backend test script for Nomadly Node.js application
Testing after major SIP voice service changes as per review request
"""

import requests
import json
import os
import sys
import subprocess
from pymongo import MongoClient
from urllib.parse import urlparse

# Test configuration
BASE_URL = "http://localhost:5000"
BACKEND_URL = "https://onboard-quick.preview.emergentagent.com/api"

class TelnyxSIPTester:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
    
    def log_test(self, test_name: str, passed: bool, expected: str, actual: str, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "passed": passed,
            "expected": expected,
            "actual": actual,
            "details": details
        }
        self.test_results.append(result)
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        print(f"{status} {test_name}: {details}")
        return passed
    
    def test_1_health_check(self) -> bool:
        """Test 1: Health check on port 5000"""
        try:
            response = requests.get(f"{NODEJS_DIRECT_URL}/", timeout=10)
            expected = "200 OK"
            actual = f"{response.status_code} {response.reason}"
            
            passed = response.status_code == 200
            details = f"Status: {actual}"
            if passed and "Nomadly" in response.text:
                details += " | Contains Nomadly branding"
            
            return self.log_test("Health Check (port 5000)", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("Health Check (port 5000)", False, "200 OK", f"ERROR: {str(e)}", "Connection failed")
    
    def test_2_phone_test_spa(self) -> bool:
        """Test 2: /phone/test serves React SPA"""
        try:
            response = requests.get(f"{NODEJS_DIRECT_URL}/phone/test", timeout=10)
            expected = "200, HTML with <div id=\"root\">"
            actual = f"{response.status_code}"
            
            passed = (response.status_code == 200 and 
                     'text/html' in response.headers.get('content-type', '') and
                     '<div id="root">' in response.text)
            
            if response.status_code == 200:
                has_root_div = '<div id="root">' in response.text
                content_type = response.headers.get('content-type', 'unknown')
                details = f"Content-Type: {content_type} | Root div: {'✓' if has_root_div else '✗'}"
            else:
                details = f"Status: {actual} | Expected HTML with React root div"
                
            return self.log_test("/phone/test serves React SPA", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("/phone/test serves React SPA", False, expected, f"ERROR: {str(e)}", "Connection failed")
    
    def test_3_phone_test_proxy(self) -> bool:
        """Test 3: /phone/test through FastAPI proxy"""
        try:
            response = requests.get(f"{FASTAPI_PROXY_URL}/phone/test", timeout=15)
            expected = "200, HTML with <div id=\"root\">"
            actual = f"{response.status_code}"
            
            # Check if content-type is HTML-like (sometimes compressed/encoded)
            content_type = response.headers.get('content-type', '').lower()
            is_html = 'text/html' in content_type or 'html' in content_type
            has_root_div = '<div id="root">' in response.text
            
            passed = response.status_code == 200 and has_root_div
            
            if response.status_code == 200:
                details = f"Content-Type: {content_type} | Root div: {'✓' if has_root_div else '✗'} | Proxy working"
                if not is_html:
                    details += f" | Warning: Non-HTML content type but root div found"
            else:
                details = f"Status: {actual} | Proxy may not be working correctly"
                
            return self.log_test("/phone/test via FastAPI proxy", passed, expected, actual, details)
            
        except requests.exceptions.RequestException as e:
            return self.log_test("/phone/test via FastAPI proxy", False, expected, f"REQUEST ERROR: {str(e)}", "Network/proxy connection failed")
        except Exception as e:
            return self.log_test("/phone/test via FastAPI proxy", False, expected, f"ERROR: {str(e)}", "Proxy connection failed")
    
    def test_4_phone_test_api_otp(self) -> bool:
        """Test 4: Phone test API endpoint - OTP verification"""
        try:
            payload = {"otp": "123456"}
            headers = {"Content-Type": "application/json"}
            response = requests.post(f"{NODEJS_DIRECT_URL}/phone/test/verify-otp", 
                                   json=payload, headers=headers, timeout=10)
            
            expected = "401 (invalid OTP)"
            actual = f"{response.status_code}"
            
            # Expect 401 for invalid OTP, confirms API route works
            passed = response.status_code == 401
            
            if passed:
                details = "API endpoint working correctly (invalid OTP rejected)"
            else:
                details = f"Status: {actual} | Expected 401 for invalid OTP"
                
            return self.log_test("Phone test OTP API endpoint", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("Phone test OTP API endpoint", False, expected, f"ERROR: {str(e)}", "API connection failed")
    
    def test_5_inbound_webhook(self) -> bool:
        """Test 5: Inbound call webhook - SIP ringing flow"""
        try:
            payload = {
                "data": {
                    "event_type": "call.initiated",
                    "payload": {
                        "direction": "incoming",
                        "from": "+15551234567",
                        "to": "+18777000068",
                        "call_control_id": "test-inbound-sip-ring-001",
                        "call_leg_id": "leg-001",
                        "connection_id": "2898117434361775526",
                        "state": "ringing"
                    }
                }
            }
            headers = {"Content-Type": "application/json"}
            response = requests.post(f"{NODEJS_DIRECT_URL}/telnyx/voice-webhook", 
                                   json=payload, headers=headers, timeout=10)
            
            expected = "200"
            actual = f"{response.status_code}"
            
            passed = response.status_code == 200
            
            if passed:
                details = "Telnyx voice webhook accepting inbound calls correctly"
            else:
                details = f"Status: {actual} | Webhook may not be handling calls properly"
                
            return self.log_test("Inbound call webhook (SIP ringing)", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("Inbound call webhook (SIP ringing)", False, expected, f"ERROR: {str(e)}", "Webhook connection failed")
    
    def test_6_startup_logs(self) -> bool:
        """Test 6: Verify startup logs"""
        try:
            # Check Node.js stdout logs
            result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return self.log_test("Startup logs verification", False, "Log access", "Cannot read logs", "Permission or file not found")
            
            log_content = result.stdout
            
            # Check for required log messages
            checks = {
                "React frontend serving": "Express.*Serving React frontend from build directory",
                "Telnyx Resources Ready": "Telnyx Resources Ready|Telnyx resources initialized",
                "Migration complete": "Migration complete|Migrated.*numbers to Call Control App",
                "No PathError": True  # Will be checked separately
            }
            
            found_logs = {}
            for check_name, pattern in checks.items():
                if check_name == "No PathError":
                    # Check that there are NO PathError messages
                    found_logs[check_name] = "PathError" not in log_content
                else:
                    found_logs[check_name] = bool(re.search(pattern, log_content, re.IGNORECASE))
            
            # Count successful checks
            passed_checks = sum(1 for found in found_logs.values() if found)
            total_checks = len(checks)
            
            passed = passed_checks == total_checks
            expected = "All startup indicators present"
            actual = f"{passed_checks}/{total_checks} checks passed"
            
            details_list = []
            for check_name, found in found_logs.items():
                status = "✓" if found else "✗"
                details_list.append(f"{check_name}: {status}")
            
            details = " | ".join(details_list)
            
            return self.log_test("Startup logs verification", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("Startup logs verification", False, "Log verification", f"ERROR: {str(e)}", "Failed to read logs")
    
    def test_7_no_error_logs(self) -> bool:
        """Test 7: Check for error logs"""
        try:
            # Check Node.js stderr logs
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                return self.log_test("No error logs check", False, "Log access", "Cannot read error logs", "Permission or file not found")
            
            error_content = result.stdout.strip()
            
            expected = "Empty error log"
            actual = "Empty" if not error_content else f"{len(error_content.splitlines())} error lines"
            
            passed = not error_content or error_content == ""
            
            if passed:
                details = "No errors in Node.js stderr log"
            else:
                # Show first few lines of errors
                error_lines = error_content.splitlines()
                preview = " | ".join(error_lines[:3])
                if len(error_lines) > 3:
                    preview += f" | ... ({len(error_lines)} total lines)"
                details = f"Errors found: {preview}"
                
            return self.log_test("No error logs check", passed, expected, actual, details)
            
        except Exception as e:
            return self.log_test("No error logs check", False, expected, f"ERROR: {str(e)}", "Failed to read error logs")
    
    def run_all_tests(self):
        """Run all tests and generate summary"""
        print("🚀 Starting Telnyx SIP Voice Service Tests")
        print("=" * 60)
        
        # Execute tests in order
        self.test_1_health_check()
        self.test_2_phone_test_spa()
        self.test_3_phone_test_proxy()
        self.test_4_phone_test_api_otp()
        self.test_5_inbound_webhook()
        self.test_6_startup_logs()
        self.test_7_no_error_logs()
        
        # Generate summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY: {self.passed}/{len(self.test_results)} PASSED")
        print("=" * 60)
        
        if self.failed == 0:
            print("🎉 ALL TESTS PASSED! Telnyx SIP voice service is working correctly.")
        else:
            print(f"⚠️  {self.failed} tests failed. See details above.")
            
        return self.failed == 0

def main():
    """Main test execution"""
    tester = TelnyxSIPTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ Telnyx SIP voice service integration is fully operational")
        exit(0)
    else:
        print("\n❌ Some tests failed - manual review required")
        exit(1)

if __name__ == "__main__":
    main()