#!/usr/bin/env python3
"""
Backend Testing for Node.js Express Server
Testing two main fixes:
1. Panel domain root path fix
2. JS challenge toggle endpoint exists
"""

import requests
import json
import subprocess
import sys
from typing import Dict, Any, List

class BackendTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.api_url = "http://localhost:8001/api"
        self.frontend_url = "http://localhost:3000"
        
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: str = ""):
        """Log test result"""
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {message}")
        if details:
            print(f"    Details: {details}")
    
    def test_panel_domain_root_redirect(self):
        """Test 1: Panel domain root should redirect to /panel"""
        try:
            headers = {"Host": "panel.hostbay.io"}
            response = requests.get(f"{self.base_url}/", headers=headers, allow_redirects=False)
            
            if response.status_code == 302:
                location = response.headers.get('Location', '')
                if '/panel' in location:
                    self.log_result("Panel Domain Root Redirect", True, "Root redirects to /panel", f"Status: {response.status_code}, Location: {location}")
                else:
                    self.log_result("Panel Domain Root Redirect", False, "Root redirects but not to /panel", f"Status: {response.status_code}, Location: {location}")
            else:
                self.log_result("Panel Domain Root Redirect", False, f"Expected 302 redirect, got {response.status_code}", f"Response: {response.text[:200]}")
        
        except Exception as e:
            self.log_result("Panel Domain Root Redirect", False, f"Request failed: {str(e)}")
    
    def test_panel_domain_slug_404(self):
        """Test 2: Panel domain /testslug should return JSON 404, not shortener HTML"""
        try:
            headers = {"Host": "panel.hostbay.io"}
            response = requests.get(f"{self.base_url}/testslug", headers=headers)
            
            is_json = 'application/json' in response.headers.get('Content-Type', '')
            content = response.text
            
            if response.status_code == 404 and is_json:
                try:
                    data = response.json()
                    if 'error' in data and 'Panel' in data['error']:
                        self.log_result("Panel Domain Slug 404", True, "Returns JSON 404 for panel page not found", f"Response: {data}")
                    else:
                        self.log_result("Panel Domain Slug 404", False, "JSON response but wrong error message", f"Response: {data}")
                except json.JSONDecodeError:
                    self.log_result("Panel Domain Slug 404", False, "Response not valid JSON", f"Content: {content[:200]}")
            else:
                self.log_result("Panel Domain Slug 404", False, f"Expected JSON 404, got {response.status_code}", f"Content-Type: {response.headers.get('Content-Type')}, Body: {content[:200]}")
        
        except Exception as e:
            self.log_result("Panel Domain Slug 404", False, f"Request failed: {str(e)}")
    
    def test_panel_domain_abc123_404(self):
        """Test 3: Panel domain /abc123 should return JSON 404, not shortener HTML"""
        try:
            headers = {"Host": "panel.hostbay.io"}
            response = requests.get(f"{self.base_url}/abc123", headers=headers)
            
            is_json = 'application/json' in response.headers.get('Content-Type', '')
            content = response.text
            
            if response.status_code == 404 and is_json:
                try:
                    data = response.json()
                    if 'error' in data and 'Panel' in data['error']:
                        self.log_result("Panel Domain ABC123 404", True, "Returns JSON 404 for panel page not found", f"Response: {data}")
                    else:
                        self.log_result("Panel Domain ABC123 404", False, "JSON response but wrong error message", f"Response: {data}")
                except json.JSONDecodeError:
                    self.log_result("Panel Domain ABC123 404", False, "Response not valid JSON", f"Content: {content[:200]}")
            else:
                self.log_result("Panel Domain ABC123 404", False, f"Expected JSON 404, got {response.status_code}", f"Content-Type: {response.headers.get('Content-Type')}, Body: {content[:200]}")
        
        except Exception as e:
            self.log_result("Panel Domain ABC123 404", False, f"Request failed: {str(e)}")
    
    def test_normal_root_200(self):
        """Test 4: Normal domain root should return 200 with Nomadly greeting"""
        try:
            response = requests.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                content = response.text
                if 'Nomadly' in content:
                    self.log_result("Normal Root 200", True, "Returns 200 with Nomadly greeting", f"Content snippet: {content[:100]}...")
                else:
                    self.log_result("Normal Root 200", False, "Returns 200 but no Nomadly greeting found", f"Content snippet: {content[:200]}...")
            else:
                self.log_result("Normal Root 200", False, f"Expected 200, got {response.status_code}", f"Content: {response.text[:200]}")
        
        except Exception as e:
            self.log_result("Normal Root 200", False, f"Request failed: {str(e)}")
    
    def test_shortener_still_works(self):
        """Test 5: Shortener should still work on goog.link domain"""
        try:
            headers = {"Host": "goog.link"}
            response = requests.get(f"{self.base_url}/testslug", headers=headers)
            
            content = response.text
            is_html = 'text/html' in response.headers.get('Content-Type', '')
            
            # Should return HTML with "Link not found" message (shortener functionality)
            if is_html and ('Link not found' in content or 'not found' in content.lower()):
                self.log_result("Shortener Still Works", True, "Shortener returns HTML 'Link not found'", f"Content snippet: {content[:100]}...")
            else:
                self.log_result("Shortener Still Works", False, "Expected HTML 'Link not found' response", f"Content-Type: {response.headers.get('Content-Type')}, Body: {content[:200]}")
        
        except Exception as e:
            self.log_result("Shortener Still Works", False, f"Request failed: {str(e)}")
    
    def test_js_challenge_toggle_endpoint(self):
        """Test 6: JS challenge toggle endpoint should exist and return 401 (auth required)"""
        try:
            response = requests.post(f"{self.base_url}/panel/security/js-challenge/toggle")
            
            if response.status_code == 401:
                self.log_result("JS Challenge Toggle Endpoint", True, "Returns 401 (auth required)", f"Response: {response.text[:200]}")
            else:
                self.log_result("JS Challenge Toggle Endpoint", False, f"Expected 401, got {response.status_code}", f"Response: {response.text[:200]}")
        
        except Exception as e:
            self.log_result("JS Challenge Toggle Endpoint", False, f"Request failed: {str(e)}")
    
    def test_health_endpoints(self):
        """Test 7-9: Health checks for all services"""
        # Node.js health
        try:
            response = requests.get(f"{self.base_url}/health")
            if response.status_code == 200:
                self.log_result("Node.js Health Check", True, "Service healthy", f"Response: {response.text[:100]}")
            else:
                self.log_result("Node.js Health Check", False, f"Health check failed with {response.status_code}", response.text[:200])
        except Exception as e:
            self.log_result("Node.js Health Check", False, f"Request failed: {str(e)}")
        
        # FastAPI health
        try:
            response = requests.get(f"{self.api_url}/")
            if response.status_code == 200:
                self.log_result("FastAPI Health Check", True, "Service healthy", f"Response: {response.text[:100]}")
            else:
                self.log_result("FastAPI Health Check", False, f"Health check failed with {response.status_code}", response.text[:200])
        except Exception as e:
            self.log_result("FastAPI Health Check", False, f"Request failed: {str(e)}")
        
        # React health
        try:
            response = requests.get(f"{self.frontend_url}/")
            if response.status_code == 200:
                self.log_result("React Health Check", True, "Service healthy", f"Response length: {len(response.text)} chars")
            else:
                self.log_result("React Health Check", False, f"Health check failed with {response.status_code}", response.text[:200])
        except Exception as e:
            self.log_result("React Health Check", False, f"Request failed: {str(e)}")
    
    def check_error_logs(self):
        """Test 10: Check Node.js error logs should be clean"""
        try:
            result = subprocess.run(
                ["tail", "-n", "20", "/var/log/supervisor/nodejs.err.log"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                logs = result.stdout.strip()
                if not logs or len(logs) == 0:
                    self.log_result("Node.js Error Logs", True, "Error logs are clean (empty)", "No recent errors found")
                else:
                    # Check for critical errors
                    critical_errors = ['Error:', 'Exception:', 'Failed:', 'Cannot']
                    has_critical = any(err.lower() in logs.lower() for err in critical_errors)
                    
                    if has_critical:
                        self.log_result("Node.js Error Logs", False, "Error logs contain critical errors", f"Recent logs: {logs[:300]}")
                    else:
                        self.log_result("Node.js Error Logs", True, "Error logs clean (no critical errors)", f"Recent logs: {logs[:100]}...")
            else:
                self.log_result("Node.js Error Logs", False, f"Failed to read error logs: {result.stderr}")
                
        except Exception as e:
            self.log_result("Node.js Error Logs", False, f"Failed to check error logs: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("=== Backend Testing: Node.js Express Server Fixes ===\n")
        
        print("📋 Testing Fix 1: Panel domain root path")
        self.test_panel_domain_root_redirect()
        self.test_panel_domain_slug_404()
        self.test_panel_domain_abc123_404()
        self.test_normal_root_200()
        self.test_shortener_still_works()
        
        print("\n📋 Testing Fix 2: JS challenge toggle endpoint")
        self.test_js_challenge_toggle_endpoint()
        
        print("\n📋 General health checks")
        self.test_health_endpoints()
        
        print("\n📋 Error log check")
        self.check_error_logs()
        
        # Summary
        print("\n=== TEST SUMMARY ===")
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)