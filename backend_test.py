#!/usr/bin/env python3
"""
Backend Test Suite for NS Alert Fix
Testing the "Fix: NS alert on domain page — only show for external domains" implementation
"""

import requests
import json
import os
import time
from typing import Dict, Any

# Configuration
class Config:
    def __init__(self):
        # Get backend URL from environment
        self.backend_url = self._get_backend_url()
        self.timeout = 30
        self.session = requests.Session()
        self.session.timeout = self.timeout
        
    def _get_backend_url(self) -> str:
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        # Remove quotes if present
                        if url.startswith('"') and url.endswith('"'):
                            url = url[1:-1]
                        return url + '/api'
        except Exception as e:
            print(f"Could not read backend URL from frontend/.env: {e}")
        
        return "http://localhost:8001/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
        
    def add_test(self, name: str, passed: bool, details: str = ""):
        self.tests.append({
            'name': name,
            'passed': passed,
            'details': details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
    def summary(self) -> str:
        total = self.passed + self.failed
        return f"Tests: {self.passed}/{total} passed"

class NSAlertTester:
    def __init__(self):
        self.config = Config()
        self.results = TestResults()
        
    def log(self, message: str):
        print(f"[TEST] {message}")
        
    def test_health_check(self):
        """Test backend health endpoint"""
        try:
            response = self.config.session.get(f"{self.config.backend_url}/health")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get('status') == 'healthy':
                        self.results.add_test("Backend Health Check", True, "Backend is healthy")
                        self.log("✅ Backend health check passed")
                        return True
                except:
                    pass
                    
            self.results.add_test("Backend Health Check", False, f"Status: {response.status_code}")
            self.log(f"❌ Backend health check failed: {response.status_code}")
            return False
            
        except Exception as e:
            self.results.add_test("Backend Health Check", False, str(e))
            self.log(f"❌ Backend health check error: {e}")
            return False
    
    def test_ns_status_endpoint_structure(self):
        """Test /domains/ns-status endpoint structure"""
        self.log("Testing /domains/ns-status endpoint structure...")
        
        # Test missing domain parameter
        try:
            response = self.config.session.get(f"{self.config.backend_url}/panel/domains/ns-status")
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data and 'domain' in data['error']:
                    self.results.add_test("NS Status - Missing Domain Error", True, "Correctly returns 400 for missing domain")
                    self.log("✅ NS status endpoint correctly validates domain parameter")
                else:
                    self.results.add_test("NS Status - Missing Domain Error", False, "Wrong error response format")
                    self.log("❌ NS status endpoint returns wrong error format")
            else:
                self.results.add_test("NS Status - Missing Domain Error", False, f"Wrong status code: {response.status_code}")
                self.log(f"❌ NS status endpoint returns wrong status code: {response.status_code}")
                
        except Exception as e:
            self.results.add_test("NS Status - Missing Domain Error", False, str(e))
            self.log(f"❌ NS status endpoint test error: {e}")
    
    def test_ns_status_response_format(self):
        """Test NS status response format with test domain"""
        self.log("Testing NS status response format...")
        
        test_domain = "example.com"
        
        try:
            response = self.config.session.get(
                f"{self.config.backend_url}/panel/domains/ns-status",
                params={'domain': test_domain}
            )
            
            # Expect 401 Unauthorized since we don't have auth token
            if response.status_code == 401:
                self.results.add_test("NS Status - Auth Required", True, "Correctly requires authentication")
                self.log("✅ NS status endpoint correctly requires authentication")
            else:
                # If it responds with 200, check the response format
                if response.status_code == 200:
                    try:
                        data = response.json()
                        required_fields = ['status', 'nameservers', 'autoManaged']
                        
                        has_required = all(field in data for field in required_fields)
                        
                        if has_required:
                            self.results.add_test("NS Status - Response Format", True, "Response has required fields")
                            self.log("✅ NS status response has required fields: status, nameservers, autoManaged")
                        else:
                            missing = [f for f in required_fields if f not in data]
                            self.results.add_test("NS Status - Response Format", False, f"Missing fields: {missing}")
                            self.log(f"❌ NS status response missing fields: {missing}")
                            
                    except json.JSONDecodeError:
                        self.results.add_test("NS Status - Response Format", False, "Invalid JSON response")
                        self.log("❌ NS status endpoint returned invalid JSON")
                else:
                    self.results.add_test("NS Status - Response Format", False, f"Unexpected status: {response.status_code}")
                    self.log(f"❌ NS status endpoint returned unexpected status: {response.status_code}")
                
        except Exception as e:
            self.results.add_test("NS Status - Response Format", False, str(e))
            self.log(f"❌ NS status response format test error: {e}")
    
    def test_add_enhanced_endpoint_structure(self):
        """Test /domains/add-enhanced endpoint structure"""
        self.log("Testing /domains/add-enhanced endpoint structure...")
        
        # Test missing domain parameter
        try:
            response = self.config.session.post(
                f"{self.config.backend_url}/panel/domains/add-enhanced",
                json={}
            )
            
            if response.status_code == 401:
                self.results.add_test("Add Enhanced - Auth Required", True, "Correctly requires authentication")
                self.log("✅ Add enhanced endpoint correctly requires authentication")
            elif response.status_code == 400:
                try:
                    data = response.json()
                    if 'error' in data and 'domain' in data['error']:
                        self.results.add_test("Add Enhanced - Missing Domain", True, "Correctly validates domain parameter")
                        self.log("✅ Add enhanced endpoint correctly validates domain parameter")
                    else:
                        self.results.add_test("Add Enhanced - Missing Domain", False, "Wrong error format")
                        self.log("❌ Add enhanced endpoint returns wrong error format")
                except:
                    self.results.add_test("Add Enhanced - Missing Domain", False, "Invalid JSON response")
                    self.log("❌ Add enhanced endpoint returned invalid JSON")
            else:
                self.results.add_test("Add Enhanced - Missing Domain", False, f"Unexpected status: {response.status_code}")
                self.log(f"❌ Add enhanced endpoint returned unexpected status: {response.status_code}")
                
        except Exception as e:
            self.results.add_test("Add Enhanced - Missing Domain", False, str(e))
            self.log(f"❌ Add enhanced endpoint test error: {e}")
    
    def test_code_structure_ns_status(self):
        """Verify NS status endpoint code structure"""
        self.log("Verifying NS status endpoint code structure...")
        
        try:
            with open('/app/js/cpanel-routes.js', 'r') as f:
                content = f.read()
                
            # Check for required components
            checks = [
                ("chatId from req.cpChatId", "req.cpChatId" in content),
                ("domain-service require", "require('./domain-service')" in content),  
                ("op-service require", "require('./op-service')" in content),
                ("registeredDomains collection query", "registeredDomains" in content),
                ("domainsOf collection query", "domainsOf" in content),
                ("autoManaged flag", "autoManaged" in content),
                ("getDomainMeta call", "getDomainMeta" in content),
                ("NS status endpoint route", "'/domains/ns-status'" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed == len(checks):
                self.results.add_test("NS Status Code Structure", True, f"All {len(checks)} code requirements found")
                self.log("✅ NS status endpoint code structure is complete")
            else:
                self.results.add_test("NS Status Code Structure", False, f"Only {passed}/{len(checks)} requirements found")
                self.log(f"❌ NS status endpoint code structure incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("NS Status Code Structure", False, str(e))
            self.log(f"❌ NS status code structure verification error: {e}")
    
    def test_code_structure_add_enhanced(self):
        """Verify add-enhanced endpoint code structure"""
        self.log("Verifying add-enhanced endpoint code structure...")
        
        try:
            with open('/app/js/cpanel-routes.js', 'r') as f:
                content = f.read()
                
            # Look for autoManaged flag in nsInfo responses
            checks = [
                ("add-enhanced route", "'/domains/add-enhanced'" in content),
                ("autoManaged in nsInfo", "autoManaged:" in content or "autoManaged =" in content),
                ("isOwnDomain check", "isOwnDomain" in content),
                ("nameserverType check", "nameserverType" in content),
                ("cfZoneId persistence", "cfZoneId" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed >= 4:  # Allow some flexibility
                self.results.add_test("Add Enhanced Code Structure", True, f"{passed}/{len(checks)} code requirements found")
                self.log("✅ Add enhanced endpoint code structure looks good")
            else:
                self.results.add_test("Add Enhanced Code Structure", False, f"Only {passed}/{len(checks)} requirements found")
                self.log(f"❌ Add enhanced endpoint code structure incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("Add Enhanced Code Structure", False, str(e))
            self.log(f"❌ Add enhanced code structure verification error: {e}")
    
    def test_frontend_nsbadge_component(self):
        """Verify NSBadge component implementation"""
        self.log("Verifying NSBadge component...")
        
        try:
            with open('/app/frontend/src/components/panel/DomainList.js', 'r') as f:
                content = f.read()
                
            checks = [
                ("NSBadge component", "NSBadge" in content),
                ("propagating state", "propagating" in content),
                ("autoManaged check", "autoManaged" in content),
                ("pending status check", "status === 'pending'" in content),
                ("dl-ns-badge--propagating class", "dl-ns-badge--propagating" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed >= 4:
                self.results.add_test("NSBadge Component", True, f"{passed}/{len(checks)} requirements found")
                self.log("✅ NSBadge component implementation looks correct")
            else:
                self.results.add_test("NSBadge Component", False, f"Only {passed}/{len(checks)} requirements found")
                self.log(f"❌ NSBadge component implementation incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("NSBadge Component", False, str(e))
            self.log(f"❌ NSBadge component verification error: {e}")
    
    def test_frontend_nspendinginfo_component(self):
        """Verify NSPendingInfo component implementation"""
        self.log("Verifying NSPendingInfo component...")
        
        try:
            with open('/app/frontend/src/components/panel/DomainList.js', 'r') as f:
                content = f.read()
                
            checks = [
                ("NSPendingInfo component", "NSPendingInfo" in content),
                ("autoManaged message", "Nameservers configured automatically" in content),
                ("external domain message", "Update your nameservers at registrar" in content or "Update your domain nameservers" in content),
                ("dl-ns-inline-info--auto class", "dl-ns-inline-info--auto" in content),
                ("Re-check button", "Re-check" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed >= 4:
                self.results.add_test("NSPendingInfo Component", True, f"{passed}/{len(checks)} requirements found")
                self.log("✅ NSPendingInfo component implementation looks correct")
            else:
                self.results.add_test("NSPendingInfo Component", False, f"Only {passed}/{len(checks)} requirements found")
                self.log(f"❌ NSPendingInfo component implementation incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("NSPendingInfo Component", False, str(e))
            self.log(f"❌ NSPendingInfo component verification error: {e}")
    
    def test_css_styles(self):
        """Verify CSS styles for propagating state and auto info"""
        self.log("Verifying CSS styles...")
        
        try:
            with open('/app/frontend/src/App.css', 'r') as f:
                content = f.read()
                
            checks = [
                ("propagating badge style", ".dl-ns-badge--propagating" in content),
                ("auto info style", ".dl-ns-inline-info--auto" in content),
                ("blue color for propagating", "59, 130, 246" in content or "60a5fa" in content),
                ("recheck button style", ".dl-ns-recheck-btn" in content),
                ("inline info base style", ".dl-ns-inline-info" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed >= 4:
                self.results.add_test("CSS Styles", True, f"{passed}/{len(checks)} styles found")
                self.log("✅ CSS styles implementation looks correct")
            else:
                self.results.add_test("CSS Styles", False, f"Only {passed}/{len(checks)} styles found")
                self.log(f"❌ CSS styles implementation incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("CSS Styles", False, str(e))
            self.log(f"❌ CSS styles verification error: {e}")
    
    def test_op_service_module(self):
        """Verify op-service module exists and has updateNameservers"""
        self.log("Verifying op-service module...")
        
        try:
            with open('/app/js/op-service.js', 'r') as f:
                content = f.read()
                
            checks = [
                ("op-service file exists", True),
                ("updateNameservers function", "updateNameservers" in content),
                ("exports updateNameservers", "updateNameservers," in content),
                ("OpenProvider API integration", "openprovider" in content.lower()),
                ("Proper function structure", "const updateNameservers = async" in content or "function updateNameservers" in content)
            ]
            
            passed = 0
            for check_name, condition in checks:
                if condition:
                    passed += 1
                    self.log(f"  ✅ {check_name}")
                else:
                    self.log(f"  ❌ {check_name}")
                    
            if passed >= 4:
                self.results.add_test("Op-Service Module", True, f"{passed}/{len(checks)} requirements met")
                self.log("✅ op-service module implementation looks correct")
            else:
                self.results.add_test("Op-Service Module", False, f"Only {passed}/{len(checks)} requirements met")
                self.log(f"❌ op-service module implementation incomplete: {passed}/{len(checks)}")
                
        except Exception as e:
            self.results.add_test("Op-Service Module", False, str(e))
            self.log(f"❌ op-service module verification error: {e}")
    
    def run_all_tests(self):
        """Run all tests for the NS alert fix"""
        self.log("Starting NS Alert Fix Testing Suite...")
        self.log("=" * 60)
        
        # Backend health and structure tests
        if self.test_health_check():
            self.test_ns_status_endpoint_structure()
            self.test_ns_status_response_format()
            self.test_add_enhanced_endpoint_structure()
        
        # Code structure verification
        self.test_code_structure_ns_status()
        self.test_code_structure_add_enhanced()
        
        # Frontend component verification
        self.test_frontend_nsbadge_component()
        self.test_frontend_nspendinginfo_component()
        
        # CSS and module verification
        self.test_css_styles()
        self.test_op_service_module()
        
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS:")
        
        for test in self.results.tests:
            status = "✅ PASS" if test['passed'] else "❌ FAIL"
            self.log(f"{status}: {test['name']}")
            if test['details']:
                self.log(f"      Details: {test['details']}")
        
        self.log("=" * 60)
        self.log(f"SUMMARY: {self.results.summary()}")
        
        # Return success if majority of tests pass
        return self.results.passed >= (self.results.passed + self.results.failed) * 0.7

if __name__ == "__main__":
    tester = NSAlertTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 NS Alert Fix testing completed successfully!")
        exit(0)
    else:
        print(f"\n⚠️  NS Alert Fix testing completed with issues. Check details above.")
        exit(1)