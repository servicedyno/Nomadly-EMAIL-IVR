#!/usr/bin/env python3
"""
Backend Testing Suite for DNSSEC Auto-fix in op-service.js
Tests the specific DNSSEC functionality as requested in the review.
"""

import requests
import subprocess
import json
import time
import sys
import os

# Backend URL from frontend .env
BACKEND_URL = "https://getting-started-199.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class DNSSECAutoFixTester:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
        
    def log_test(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def test_syntax_validation(self):
        """Test 1: Syntax validation of op-service.js"""
        try:
            result = subprocess.run(
                ["node", "-c", "/app/js/op-service.js"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            passed = result.returncode == 0
            details = f"Exit code: {result.returncode}"
            if result.stderr:
                details += f", stderr: {result.stderr.strip()}"
                
            self.log_test("Syntax validation (node -c op-service.js)", passed, details)
            return passed
        except Exception as e:
            self.log_test("Syntax validation (node -c op-service.js)", False, str(e))
            return False
    
    def test_health_endpoint(self):
        """Test 2: Health endpoint returns healthy"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                is_healthy = data.get('status') == 'healthy'
                details = f"Status: {response.status_code}, Data: {data}"
                self.log_test("Health endpoint returns healthy", is_healthy, details)
                return is_healthy
            else:
                self.log_test("Health endpoint returns healthy", False, f"HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Health endpoint returns healthy", False, str(e))
            return False
    
    def test_error_log_clean(self):
        """Test 3: Error log should be 0 bytes or near-empty"""
        try:
            # Check nodejs error log
            result = subprocess.run(
                ["wc", "-c", "/var/log/supervisor/nodejs.err.log"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                size_str = result.stdout.strip().split()[0]
                size = int(size_str)
                is_clean = size <= 100  # Allow up to 100 bytes for minor warnings
                details = f"Error log size: {size} bytes"
                self.log_test("Error log is clean (≤100 bytes)", is_clean, details)
                return is_clean
            else:
                self.log_test("Error log is clean", False, f"Failed to check log: {result.stderr}")
                return False
                
        except Exception as e:
            self.log_test("Error log is clean", False, str(e))
            return False
    
    def test_disable_dnssec_function_exists(self):
        """Test 4: disableDnssec function exists with proper signature"""
        try:
            # Read the op-service.js file and check for disableDnssec function
            with open("/app/js/op-service.js", "r") as f:
                content = f.read()
            
            # Check function declaration
            has_function = "const disableDnssec = async (domainName) => {" in content
            
            # Check it calls getDomainInfo
            calls_get_domain_info = "await getDomainInfo(domainName)" in content
            
            # Check it checks is_dnssec_enabled and dnssec_keys
            checks_dnssec_enabled = "info.domainData?.is_dnssec_enabled" in content
            checks_dnssec_keys = "info.domainData?.dnssec_keys" in content
            
            # Check early return for already disabled
            has_early_return = "alreadyDisabled: true" in content
            
            # Check PUT request with proper payload
            has_put_request = 'is_dnssec_enabled: false' in content and 'dnssec_keys: []' in content
            
            # Check try/catch
            has_try_catch = content.count("try {") >= 1 and content.count("} catch") >= 1
            
            all_checks = [
                ("Function declaration", has_function),
                ("Calls getDomainInfo", calls_get_domain_info),
                ("Checks is_dnssec_enabled", checks_dnssec_enabled),
                ("Checks dnssec_keys", checks_dnssec_keys),
                ("Has early return for already disabled", has_early_return),
                ("Makes PUT request with correct payload", has_put_request),
                ("Has try/catch error handling", has_try_catch)
            ]
            
            passed_checks = sum(1 for _, check in all_checks if check)
            total_checks = len(all_checks)
            
            details = f"{passed_checks}/{total_checks} checks passed: " + ", ".join([
                f"{name}={'✓' if check else '✗'}" for name, check in all_checks
            ])
            
            passed = passed_checks == total_checks
            self.log_test("disableDnssec function implementation", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("disableDnssec function implementation", False, str(e))
            return False
    
    def test_send_ns_update_helper(self):
        """Test 5: _sendNsUpdate helper function exists with timeout retry"""
        try:
            with open("/app/js/op-service.js", "r") as f:
                content = f.read()
            
            # Check helper function exists
            has_helper = "const _sendNsUpdate = async (domainId, domainName, nsPayload, headers) => {" in content
            
            # Check 30s initial timeout
            has_30s_timeout = "timeout: 30000" in content
            
            # Check 45s retry timeout
            has_45s_retry = "timeout: 45000" in content
            
            # Check retry on ECONNABORTED/timeout
            has_retry_logic = "ECONNABORTED" in content and "timeout" in content and "retrying" in content
            
            checks = [
                ("Helper function exists", has_helper),
                ("30s initial timeout", has_30s_timeout),
                ("45s retry timeout", has_45s_retry),
                ("Retry logic for timeouts", has_retry_logic)
            ]
            
            passed_checks = sum(1 for _, check in checks if check)
            total_checks = len(checks)
            
            details = f"{passed_checks}/{total_checks} checks passed: " + ", ".join([
                f"{name}={'✓' if check else '✗'}" for name, check in checks
            ])
            
            passed = passed_checks == total_checks
            self.log_test("_sendNsUpdate helper function", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("_sendNsUpdate helper function", False, str(e))
            return False
    
    def test_update_nameservers_dnssec_autofix(self):
        """Test 6: updateNameservers DNSSEC auto-fix implementation"""
        try:
            with open("/app/js/op-service.js", "r") as f:
                content = f.read()
            
            # Check _dnssecRetried parameter with default false
            has_retry_param = "_dnssecRetried = false" in content
            
            # Check isDnssecError detection with code 524 + dnskey/dnssec
            has_error_detection = "opCode === 524" in content and "dnskey" in content and "dnssec" in content
            
            # Check calls disableDnssec when error detected
            calls_disable_dnssec = "await disableDnssec(domainName)" in content
            
            # Check 3s wait after disabling DNSSEC
            has_3s_wait = "setTimeout(r, 3000)" in content
            
            # Check recursive retry with _dnssecRetried=true
            has_recursive_retry = "updateNameservers(domainName, nameservers, true)" in content
            
            # Check _dnssecRetried prevents infinite recursion
            prevents_infinite_recursion = "!_dnssecRetried" in content
            
            checks = [
                ("_dnssecRetried parameter with default false", has_retry_param),
                ("isDnssecError detection (code 524 + dnskey/dnssec)", has_error_detection),
                ("Calls disableDnssec on error", calls_disable_dnssec),
                ("3s wait after DNSSEC disable", has_3s_wait),
                ("Recursive retry with _dnssecRetried=true", has_recursive_retry),
                ("Prevents infinite recursion", prevents_infinite_recursion)
            ]
            
            passed_checks = sum(1 for _, check in checks if check)
            total_checks = len(checks)
            
            details = f"{passed_checks}/{total_checks} checks passed: " + ", ".join([
                f"{name}={'✓' if check else '✗'}" for name, check in checks
            ])
            
            passed = passed_checks == total_checks
            self.log_test("updateNameservers DNSSEC auto-fix", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("updateNameservers DNSSEC auto-fix", False, str(e))
            return False
    
    def test_module_exports(self):
        """Test 7: disableDnssec is exported in module.exports"""
        try:
            with open("/app/js/op-service.js", "r") as f:
                content = f.read()
            
            # Check disableDnssec is in module.exports
            has_export = "disableDnssec," in content and "module.exports = {" in content
            
            # Count exports to verify it's properly included
            exports_section = content[content.find("module.exports = {"):]
            export_count = exports_section.count("disableDnssec")
            
            details = f"disableDnssec found in exports: {has_export}, count: {export_count}"
            passed = has_export and export_count >= 1
            
            self.log_test("disableDnssec exported in module.exports", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("disableDnssec exported in module.exports", False, str(e))
            return False
    
    def test_dnssec_error_patterns(self):
        """Test 8: Comprehensive DNSSEC error pattern detection"""
        try:
            with open("/app/js/op-service.js", "r") as f:
                content = f.read()
            
            # Check for various DNSSEC error patterns
            patterns = [
                ("Code 524 + dnskey", "opCode === 524" in content and "dnskey" in content),
                ("Code 524 + dnssec", "opCode === 524" in content and "dnssec" in content),
                ("Unable to retrieve DNSKEY", "unable to retrieve dnskey" in content),
                ("DNSSEC validation", "dnssec validation" in content),
                ("DNSKEY RR", "dnskey rr" in content),
                ("Case insensitive matching", ".toLowerCase()" in content)
            ]
            
            passed_patterns = sum(1 for _, check in patterns if check)
            total_patterns = len(patterns)
            
            details = f"{passed_patterns}/{total_patterns} patterns found: " + ", ".join([
                f"{name}={'✓' if check else '✗'}" for name, check in patterns
            ])
            
            passed = passed_patterns >= 4  # At least 4 patterns should be present
            self.log_test("DNSSEC error pattern detection", passed, details)
            return passed
            
        except Exception as e:
            self.log_test("DNSSEC error pattern detection", False, str(e))
            return False
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🧪 Starting DNSSEC Auto-fix Testing Suite")
        print("=" * 60)
        
        # Run all tests
        tests = [
            self.test_syntax_validation,
            self.test_health_endpoint,
            self.test_error_log_clean,
            self.test_disable_dnssec_function_exists,
            self.test_send_ns_update_helper,
            self.test_update_nameservers_dnssec_autofix,
            self.test_module_exports,
            self.test_dnssec_error_patterns
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(f"Exception in {test.__name__}", False, str(e))
            print()  # Add spacing between tests
        
        # Print summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY: {self.passed}/{self.passed + self.failed} tests passed")
        
        if self.failed > 0:
            print(f"❌ {self.failed} tests failed")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("✅ All tests passed!")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = DNSSECAutoFixTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)