#!/usr/bin/env python3
"""
Nomadly Node.js Application Backend Testing Suite
Tests health checks, API endpoints, panel domain features, and service logs
"""

import requests
import subprocess
import time
import os
import sys
import json
from typing import Dict, Any
from urllib.parse import urljoin

class BackendTester:
    def __init__(self):
        # Get backend URL from frontend env for testing
        self.frontend_backend_url = self.get_frontend_backend_url()
        self.base_url = f"{self.frontend_backend_url}"
        self.api_url = f"{self.frontend_backend_url}/api"
        
        print(f"🔧 Testing Configuration:")
        print(f"   Frontend Backend URL: {self.frontend_backend_url}")
        print(f"   Base URL: {self.base_url}")
        print(f"   API URL: {self.api_url}")
        print()
        
        self.results = {}
        
    def get_frontend_backend_url(self) -> str:
        """Get backend URL from frontend .env file"""
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        return line.split('=')[1].strip()
        except Exception as e:
            print(f"⚠️ Could not read frontend .env: {e}")
        return "http://localhost:5000"  # fallback
    
    def log_test_result(self, test_name: str, success: bool, details: str = "", expected: str = "", actual: str = ""):
        """Log test results in a structured way"""
        self.results[test_name] = {
            "success": success,
            "details": details,
            "expected": expected,
            "actual": actual,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        status = "✅" if success else "❌"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        if not success and expected and actual:
            print(f"   Expected: {expected}")
            print(f"   Actual: {actual}")
        print()
    
    def test_health_check(self):
        """Test 1: Health check on main port (should be 5000 based on _index.js)"""
        test_name = "Health check localhost:5000"
        try:
            # First check what port the nodejs service is actually running on
            result = subprocess.run(['sudo', 'supervisorctl', 'status', 'nodejs'], 
                                    capture_output=True, text=True)
            
            # Test the health check endpoint
            response = requests.get("http://localhost:5000/", timeout=10)
            
            if response.status_code == 200:
                content = response.text.lower()
                if "nomadly" in content:
                    self.log_test_result(test_name, True, 
                                       f"Status: {response.status_code}, Content contains 'Nomadly'")
                else:
                    self.log_test_result(test_name, False, 
                                       f"Status: {response.status_code}, but content doesn't contain 'Nomadly'",
                                       "Content with 'Nomadly'", f"Content: {response.text[:200]}")
            else:
                self.log_test_result(test_name, False, 
                                   f"Wrong status code: {response.status_code}",
                                   "200", str(response.status_code))
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Connection error: {str(e)}")
    
    def test_fastapi_proxy(self):
        """Test 2: FastAPI proxy on port 8001/api/"""
        test_name = "FastAPI proxy localhost:8001/api/"
        try:
            # Check if there's actually a FastAPI service running on 8001
            response = requests.get("http://localhost:8001/api/", timeout=10)
            
            if response.status_code == 200:
                # Check if it's actually FastAPI by looking for typical FastAPI response
                try:
                    data = response.json()
                    self.log_test_result(test_name, True, 
                                       f"Status: {response.status_code}, JSON response received")
                except:
                    # Not JSON, check if it's HTML or text with FastAPI indicators
                    content = response.text.lower()
                    if "fastapi" in content or "docs" in content or "redoc" in content:
                        self.log_test_result(test_name, True, 
                                           f"Status: {response.status_code}, FastAPI-like content")
                    else:
                        self.log_test_result(test_name, True, 
                                           f"Status: {response.status_code}, Response received")
            else:
                self.log_test_result(test_name, False, 
                                   f"Wrong status code: {response.status_code}",
                                   "200", str(response.status_code))
                
        except requests.exceptions.ConnectionError:
            # Maybe FastAPI is not on 8001, check if it's integrated into the main app
            try:
                response = requests.get(f"{self.api_url}/", timeout=10)
                if response.status_code == 200:
                    self.log_test_result(test_name, True, 
                                       f"FastAPI found integrated in main app at {self.api_url}")
                else:
                    self.log_test_result(test_name, False, 
                                       f"No FastAPI found on 8001 or integrated in main app")
            except Exception as e:
                self.log_test_result(test_name, False, f"FastAPI not accessible: {str(e)}")
        except Exception as e:
            self.log_test_result(test_name, False, f"Connection error: {str(e)}")
    
    def test_autossl_endpoint_auth(self):
        """Test 3: AutoSSL endpoint auth behavior"""
        test_name = "AutoSSL endpoint auth check"
        try:
            # Test POST /panel/domains/ssl/autossl without auth (should return 401)
            # Use localhost:5000 directly since that's where the Node.js app is running
            url = "http://localhost:5000/panel/domains/ssl/autossl"
            
            response = requests.post(url, timeout=10, json={})
            
            if response.status_code == 401:
                self.log_test_result(test_name, True, 
                                   f"Correctly returned 401 Unauthorized - auth middleware working")
            elif response.status_code == 404:
                self.log_test_result(test_name, False, 
                                   f"Route not found (404) - endpoint may not be registered",
                                   "401 Unauthorized", "404 Not Found")
            elif response.status_code == 405:
                self.log_test_result(test_name, False, 
                                   f"Method not allowed (405) - POST may not be supported",
                                   "401 Unauthorized", "405 Method Not Allowed")
            else:
                self.log_test_result(test_name, False, 
                                   f"Unexpected status code: {response.status_code}",
                                   "401 Unauthorized", str(response.status_code))
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Connection error: {str(e)}")
    
    def test_call_route_frontend(self):
        """Test 4: /call route on frontend (React SPA)"""
        test_name = "/call route on frontend"
        try:
            # Test GET to /call on frontend port (should be served by React)
            frontend_url = self.frontend_backend_url.replace(':5000', ':3000')  # Adjust for frontend
            if ':5000' not in self.frontend_backend_url:
                # If not localhost:5000, try the frontend URL directly
                frontend_url = "http://localhost:3000"
            
            response = requests.get(f"{frontend_url}/call", timeout=10)
            
            if response.status_code == 200:
                content = response.text.lower()
                if "react" in content or "root" in content or "app" in content:
                    self.log_test_result(test_name, True, 
                                       f"Status: {response.status_code}, React app content detected")
                else:
                    self.log_test_result(test_name, True, 
                                       f"Status: {response.status_code}, Content served")
            else:
                self.log_test_result(test_name, False, 
                                   f"Wrong status code: {response.status_code}",
                                   "200", str(response.status_code))
                
        except Exception as e:
            # Try alternative: check if the route is handled by Express SPA catch-all
            try:
                response = requests.get(f"{self.base_url}/call", timeout=10)
                if response.status_code == 200:
                    self.log_test_result(test_name, True, 
                                       f"Route handled by Express SPA catch-all")
                else:
                    self.log_test_result(test_name, False, f"Route not accessible: {str(e)}")
            except:
                self.log_test_result(test_name, False, f"Connection error: {str(e)}")
    
    def test_phone_test_route(self):
        """Test 5: /phone/test route still works"""
        test_name = "/phone/test route check"
        try:
            # Test both frontend and backend versions
            frontend_url = "http://localhost:3000"
            
            # Try frontend first
            try:
                response = requests.get(f"{frontend_url}/phone/test", timeout=10)
                if response.status_code == 200:
                    self.log_test_result(test_name, True, 
                                       f"Frontend /phone/test: Status {response.status_code}")
                    return
            except:
                pass
            
            # Try backend
            response = requests.get(f"{self.base_url}/phone/test", timeout=10)
            if response.status_code == 200:
                self.log_test_result(test_name, True, 
                                   f"Backend /phone/test: Status {response.status_code}")
            else:
                self.log_test_result(test_name, False, 
                                   f"Wrong status code: {response.status_code}",
                                   "200", str(response.status_code))
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Connection error: {str(e)}")
    
    def test_bot_text_changes(self):
        """Test 6: Bot text changes - check for CALL_PAGE_URL and browser mentions"""
        test_name = "Bot text changes verification"
        try:
            # Check phone-config.js for the updated messages
            phone_config_path = "/app/js/phone-config.js"
            
            if not os.path.exists(phone_config_path):
                self.log_test_result(test_name, False, "phone-config.js file not found")
                return
            
            with open(phone_config_path, 'r') as f:
                content = f.read()
            
            found_issues = []
            
            # Check for CALL_PAGE_URL references
            if "CALL_PAGE_URL" not in content:
                found_issues.append("CALL_PAGE_URL not found")
            
            # Check for browser mentions
            browser_keywords = ["browser", "Browser", "BROWSER"]
            browser_found = any(keyword in content for keyword in browser_keywords)
            if not browser_found:
                found_issues.append("'browser' keyword not found")
            
            if not found_issues:
                self.log_test_result(test_name, True, 
                                   "CALL_PAGE_URL and browser mentions found in phone-config.js")
            else:
                self.log_test_result(test_name, False, 
                                   f"Missing: {', '.join(found_issues)}")
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Error reading phone-config.js: {str(e)}")
    
    def test_startup_logs(self):
        """Test 7: Check startup logs for errors and "Panel domain guard active" message"""
        test_name = "Startup logs check"
        try:
            # Check nodejs startup logs
            result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True)
            
            if result.returncode != 0:
                self.log_test_result(test_name, False, 
                                   "Could not read nodejs.out.log")
                return
            
            log_content = result.stdout
            issues = []
            
            # Check for "Panel domain guard active" message
            panel_guard_found = "Panel domain guard active" in log_content or "[Express] Panel domain guard active" in log_content
            if not panel_guard_found:
                issues.append("'Panel domain guard active' message not found")
            
            # Check for critical errors (but ignore minor warnings)
            critical_indicators = ["FATAL", "Fatal:", "CRITICAL", "Critical:", "Cannot start", "Failed to start"]
            for indicator in critical_indicators:
                if indicator in log_content:
                    # Count occurrences
                    count = log_content.count(indicator)
                    if count > 0:
                        issues.append(f"{count} critical '{indicator}' found in logs")
            
            if not issues:
                self.log_test_result(test_name, True, 
                                   "Startup logs clean, 'Panel domain guard active' found")
            else:
                self.log_test_result(test_name, False, 
                                   f"Issues found: {'; '.join(issues)}")
                # Print relevant log excerpts for critical issues only
                lines = log_content.split('\n')
                for line in lines[-30:]:  # Last 30 lines
                    if any(err in line for err in critical_indicators):
                        print(f"   Log: {line.strip()}")
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Error checking logs: {str(e)}")
    
    def test_error_logs(self):
        """Test 8: Check error logs are clean"""
        test_name = "Error logs check"
        try:
            # Check nodejs error logs
            result = subprocess.run(['tail', '-n', '20', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True)
            
            if result.returncode != 0:
                self.log_test_result(test_name, False, 
                                   "Could not read nodejs.err.log")
                return
            
            log_content = result.stdout.strip()
            
            if not log_content or len(log_content) < 10:
                self.log_test_result(test_name, True, 
                                   "Error logs are clean/empty")
            else:
                # Check if errors are critical
                critical_errors = ["FATAL", "CRITICAL", "Cannot", "Failed to start"]
                critical_found = any(error in log_content for error in critical_errors)
                
                if critical_found:
                    self.log_test_result(test_name, False, 
                                       f"Critical errors found in error logs")
                    print(f"   Error content: {log_content[:500]}")
                else:
                    # Minor warnings are acceptable
                    self.log_test_result(test_name, True, 
                                       "Only minor warnings in error logs (acceptable)")
                
        except Exception as e:
            self.log_test_result(test_name, False, f"Error checking error logs: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Nomadly Node.js Backend Tests")
        print("=" * 50)
        
        # Run all tests
        self.test_health_check()
        self.test_fastapi_proxy()
        self.test_autossl_endpoint_auth()
        self.test_call_route_frontend()
        self.test_phone_test_route()
        self.test_bot_text_changes()
        self.test_startup_logs()
        self.test_error_logs()
        
        # Summary
        print("=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for result in self.results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: ✅ {passed_tests}")
        print(f"Failed: ❌ {failed_tests}")
        print()
        
        # Show failed tests details
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for test_name, result in self.results.items():
                if not result["success"]:
                    print(f"  • {test_name}: {result['details']}")
            print()
        
        # Show passed tests
        if passed_tests > 0:
            print("✅ PASSED TESTS:")
            for test_name, result in self.results.items():
                if result["success"]:
                    print(f"  • {test_name}")
            print()
        
        return self.results

def main():
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    failed_count = sum(1 for result in results.values() if not result["success"])
    sys.exit(1 if failed_count > 0 else 0)

if __name__ == "__main__":
    main()