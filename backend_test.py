#!/usr/bin/env python3
"""
Backend Testing Suite for Domain Registration Flow Fixes
Testing 4 specific code structure fixes:
1. buyDomainOnline() now accepts optional ns1, ns2 params
2. domain-service.js passes nameservers to buyDomainOnline for CR path
3. buyDomainFullProcess no longer has 60s/10s sleep + getAccountNameservers block
4. registerDomainAndCreateCpanel reordered + CF zone reuse logic
"""

import requests
import json
import os
import sys
import time
from typing import Dict, Any, Optional

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
        return 'http://localhost:8001'
    except:
        return 'http://localhost:8001'

BACKEND_URL = get_backend_url()
API_BASE = f"{BACKEND_URL}/api"

class DomainRegistrationFlowTester:
    def __init__(self):
        self.results = []
        self.backend_url = BACKEND_URL
        self.api_base = API_BASE
        print(f"🚀 Testing Domain Registration Flow Fixes")
        print(f"📍 Backend URL: {self.backend_url}")
        print(f"📍 API Base: {self.api_base}")
        
    def log_result(self, test_name: str, status: str, details: str = ""):
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': time.strftime('%H:%M:%S')
        }
        self.results.append(result)
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_emoji} {test_name}: {status} {details}")
    
    def test_health_checks(self):
        """Test basic service health"""
        print("\n🏥 === HEALTH CHECKS ===")
        
        # Test Node.js service
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_result("Node.js Health", "PASS", f"Status: {data.get('status', 'unknown')}")
            else:
                self.log_result("Node.js Health", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Node.js Health", "FAIL", f"Connection error: {str(e)}")
        
        # Test FastAPI service  
        try:
            response = requests.get(f"{self.api_base}/health", timeout=10)
            if response.status_code == 200:
                self.log_result("FastAPI Health", "PASS", "Service running")
            else:
                self.log_result("FastAPI Health", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("FastAPI Health", "FAIL", f"Connection error: {str(e)}")
    
    def test_code_structure_fix_1(self):
        """Verify buyDomainOnline signature accepts ns1, ns2 parameters"""
        print("\n🔧 === FIX 1: buyDomainOnline() Signature ===")
        
        try:
            with open('/app/js/cr-domain-register.js', 'r') as f:
                content = f.read()
            
            # Check function signature
            if 'const buyDomainOnline = async (domain, ns1, ns2) =>' in content:
                self.log_result("buyDomainOnline Signature", "PASS", "Accepts (domain, ns1, ns2)")
            else:
                self.log_result("buyDomainOnline Signature", "FAIL", "Signature doesn't match expected format")
                return
            
            # Check fallback logic
            if 'ns1: ns1 ||' in content and 'ns2: ns2 ||' in content:
                self.log_result("NS Fallback Logic", "PASS", "Uses ns1 || default, ns2 || default pattern")
            else:
                self.log_result("NS Fallback Logic", "FAIL", "Missing proper fallback logic")
            
            # Check logging
            if 'Registered ${domain} with NS:' in content:
                self.log_result("NS Logging", "PASS", "Logs which nameservers were used")
            else:
                self.log_result("NS Logging", "WARN", "Missing NS logging (minor)")
                
        except Exception as e:
            self.log_result("Fix 1 Code Review", "FAIL", f"Error reading file: {e}")
    
    def test_code_structure_fix_2(self):
        """Verify domain-service.js passes nameservers to buyDomainOnline for CR path"""
        print("\n🔧 === FIX 2: domain-service.js NS Passing ===")
        
        try:
            with open('/app/js/domain-service.js', 'r') as f:
                content = f.read()
            
            # Look for CR registration path
            if 'if (registrar === \'ConnectReseller\')' in content:
                self.log_result("CR Registration Path", "PASS", "ConnectReseller path found")
            else:
                self.log_result("CR Registration Path", "FAIL", "ConnectReseller path not found")
                return
            
            # Check NS extraction and passing
            if 'const ns1 = nameservers.length >= 1 ? nameservers[0] : undefined' in content:
                self.log_result("NS1 Extraction", "PASS", "Extracts ns1 from nameservers array")
            else:
                self.log_result("NS1 Extraction", "FAIL", "Missing ns1 extraction")
            
            if 'const ns2 = nameservers.length >= 2 ? nameservers[1] : undefined' in content:
                self.log_result("NS2 Extraction", "PASS", "Extracts ns2 from nameservers array")
            else:
                self.log_result("NS2 Extraction", "FAIL", "Missing ns2 extraction")
            
            if 'result = await buyDomainOnline(domainName, ns1, ns2)' in content:
                self.log_result("NS Passing to buyDomainOnline", "PASS", "Passes ns1, ns2 to buyDomainOnline")
            else:
                self.log_result("NS Passing to buyDomainOnline", "FAIL", "Not passing NS params correctly")
                
        except Exception as e:
            self.log_result("Fix 2 Code Review", "FAIL", f"Error reading file: {e}")
    
    def test_code_structure_fix_3(self):
        """Verify buyDomainFullProcess no longer has post-reg NS update block"""
        print("\n🔧 === FIX 3: buyDomainFullProcess Sleep Removal ===")
        
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for removed sleep calls
            if 'sleep(60000)' not in content and 'sleep(10000)' not in content:
                self.log_result("Sleep Removal", "PASS", "60s/10s sleep calls removed")
            else:
                self.log_result("Sleep Removal", "FAIL", "Still contains sleep(60000) or sleep(10000)")
            
            # Check for removed getAccountNameservers calls
            if 'getAccountNameservers()' not in content:
                self.log_result("getAccountNameservers Removal", "PASS", "getAccountNameservers() calls removed")
            else:
                self.log_result("getAccountNameservers Removal", "FAIL", "Still contains getAccountNameservers() calls")
            
            # Check for buyResult.nameservers usage
            if 'buyResult.nameservers' in content:
                self.log_result("buyResult.nameservers Usage", "PASS", "Uses buyResult.nameservers for confirmation")
            else:
                self.log_result("buyResult.nameservers Usage", "WARN", "buyResult.nameservers usage not found")
                
        except Exception as e:
            self.log_result("Fix 3 Code Review", "FAIL", f"Error reading file: {e}")
    
    def test_code_structure_fix_4(self):
        """Verify registerDomainAndCreateCpanel reordering and CF zone reuse"""
        print("\n🔧 === FIX 4: registerDomainAndCreateCpanel Reorder ===")
        
        try:
            with open('/app/js/cr-register-domain-&-create-cpanel.js', 'r') as f:
                content = f.read()
            
            # Check for proper step ordering in comments
            step2_domain = content.find('Step 2: Domain registration FIRST')
            step3_hosting = content.find('Step 3: Create hosting account')
            
            if step2_domain != -1 and step3_hosting != -1 and step2_domain < step3_hosting:
                self.log_result("Step Ordering", "PASS", "Domain registration (Step 2) before hosting (Step 3)")
            else:
                self.log_result("Step Ordering", "FAIL", "Incorrect step ordering or missing step comments")
            
            # Check for domain registration first logic
            if 'if (isNewDomain)' in content and 'registerDomain(' in content:
                self.log_result("Domain Registration First", "PASS", "Domain registration runs first for new domains")
            else:
                self.log_result("Domain Registration First", "FAIL", "Domain registration logic not found")
            
            # Check for CF zone reuse logic
            if 'cfZoneId = regResult.cfZoneId' in content:
                self.log_result("CF Zone Capture", "PASS", "Captures cfZoneId from registration result")
            else:
                self.log_result("CF Zone Capture", "FAIL", "Missing CF zone capture from registration")
            
            if 'if (!cfZoneId)' in content and 'createZone(domain)' in content:
                self.log_result("CF Zone Reuse Logic", "PASS", "Only creates new CF zone when !cfZoneId")
            else:
                self.log_result("CF Zone Reuse Logic", "FAIL", "Missing CF zone reuse logic")
            
            # Check for early abort on domain registration failure
            if 'return { success: false, error: `Domain registration failed' in content:
                self.log_result("Early Abort Logic", "PASS", "Returns early on domain registration failure")
            else:
                self.log_result("Early Abort Logic", "FAIL", "Missing early abort on domain reg failure")
                
        except Exception as e:
            self.log_result("Fix 4 Code Review", "FAIL", f"Error reading file: {e}")
    
    def test_nodejs_error_logs(self):
        """Check for Node.js startup errors"""
        print("\n📋 === NODE.JS ERROR LOG CHECK ===")
        
        try:
            # Check error log
            with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
                error_content = f.read().strip()
            
            if not error_content:
                self.log_result("Node.js Error Log", "PASS", "No errors in nodejs.err.log")
            else:
                # Check if errors are critical
                critical_errors = ['SyntaxError', 'ReferenceError', 'TypeError', 'Cannot find module']
                has_critical = any(err in error_content for err in critical_errors)
                
                if has_critical:
                    self.log_result("Node.js Error Log", "FAIL", f"Critical errors found in log")
                    print(f"🔍 Error details: {error_content[-500:]}")  # Last 500 chars
                else:
                    self.log_result("Node.js Error Log", "WARN", "Non-critical warnings in log")
                    
        except Exception as e:
            self.log_result("Node.js Error Log Check", "WARN", f"Could not read log: {e}")
    
    def test_api_endpoints_basic(self):
        """Test basic API endpoint availability (not full functionality)"""
        print("\n🌐 === BASIC API ENDPOINT TESTS ===")
        
        # These are structural tests - we can't test actual domain registration
        # due to external API dependencies, but we can check if endpoints exist
        
        endpoints_to_check = [
            ('/health', 'GET'),
        ]
        
        for endpoint, method in endpoints_to_check:
            try:
                url = f"{self.backend_url}{endpoint}"
                
                if method == 'GET':
                    response = requests.get(url, timeout=5)
                else:
                    response = requests.post(url, json={}, timeout=5)
                
                if response.status_code < 500:  # Any response except server error is good
                    self.log_result(f"Endpoint {endpoint}", "PASS", f"Responds with HTTP {response.status_code}")
                else:
                    self.log_result(f"Endpoint {endpoint}", "FAIL", f"Server error: HTTP {response.status_code}")
                    
            except Exception as e:
                self.log_result(f"Endpoint {endpoint}", "FAIL", f"Connection error: {str(e)[:50]}")
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print("=" * 60)
        print("🧪 DOMAIN REGISTRATION FLOW FIXES - STRUCTURAL TESTING")
        print("=" * 60)
        
        # Run all test methods
        self.test_health_checks()
        self.test_code_structure_fix_1()
        self.test_code_structure_fix_2()
        self.test_code_structure_fix_3()
        self.test_code_structure_fix_4()
        self.test_nodejs_error_logs()
        self.test_api_endpoints_basic()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        warnings = sum(1 for r in self.results if r['status'] == 'WARN')
        total = len(self.results)
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Warnings: {warnings}")
        print(f"📊 Total: {total}")
        
        if failed > 0:
            print(f"\n🚨 CRITICAL ISSUES FOUND ({failed} failures):")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"   • {result['test']}: {result['details']}")
        
        if warnings > 0:
            print(f"\n⚠️  MINOR ISSUES ({warnings} warnings):")
            for result in self.results:
                if result['status'] == 'WARN':
                    print(f"   • {result['test']}: {result['details']}")
        
        if failed == 0:
            print(f"\n🎉 ALL CRITICAL TESTS PASSED!")
            print(f"✨ The 4 domain registration flow fixes are structurally correct")
            print(f"🚀 Node.js service is running without critical errors")
        
        return failed == 0

if __name__ == "__main__":
    tester = DomainRegistrationFlowTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)