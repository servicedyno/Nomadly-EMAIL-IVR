#!/usr/bin/env python3
"""
Backend test for panel domain fix validation
Tests the Node.js Express server to ensure panel.hostbay.io returns correct responses
"""

import requests
import sys
import json
from typing import Dict, Any

class NodeJSServerTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.panel_domain = "panel.hostbay.io"
        self.shortener_domain = "goog.link"
        self.results = []
        
    def log_result(self, test_name: str, success: bool, details: str, expected: str = None, actual: str = None):
        """Log test result with details"""
        result = {
            "test_name": test_name,
            "success": success,
            "details": details,
            "expected": expected,
            "actual": actual
        }
        self.results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}: {details}")
        if not success and expected and actual:
            print(f"   Expected: {expected}")
            print(f"   Actual: {actual}")
    
    def test_panel_domain_shortener_blocked(self):
        """Test 1: Panel domain should return JSON 404, not shortener HTML"""
        try:
            headers = {"Host": self.panel_domain}
            response = requests.get(f"{self.base_url}/testslug", headers=headers, timeout=10)
            
            # Should return 404 status
            if response.status_code != 404:
                self.log_result(
                    "Panel domain shortener block - Status Code", 
                    False, 
                    f"Expected 404, got {response.status_code}",
                    "404",
                    str(response.status_code)
                )
                return False
            
            # Should return JSON, not HTML
            try:
                json_response = response.json()
                if json_response.get("error") == "Panel page not found":
                    self.log_result(
                        "Panel domain shortener block - Response Format", 
                        True, 
                        "Correctly returns JSON error for panel domain"
                    )
                    return True
                else:
                    self.log_result(
                        "Panel domain shortener block - Response Content", 
                        False, 
                        f"Expected 'Panel page not found' error, got: {json_response}",
                        '{"error": "Panel page not found"}',
                        str(json_response)
                    )
                    return False
            except:
                # If it's not JSON, it might be the HTML shortener page
                content = response.text[:200]
                if "Link not found" in content or "<html" in content:
                    self.log_result(
                        "Panel domain shortener block - Response Format", 
                        False, 
                        "Panel domain returned HTML shortener page instead of JSON",
                        "JSON with panel error",
                        "HTML shortener page"
                    )
                    return False
                else:
                    self.log_result(
                        "Panel domain shortener block - Response Parse", 
                        False, 
                        f"Could not parse response as JSON: {content}",
                        "Valid JSON response",
                        f"Unparseable content: {content}"
                    )
                    return False
                    
        except requests.RequestException as e:
            self.log_result(
                "Panel domain shortener block - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_panel_domain_random_slug(self):
        """Test 2: Panel domain with random slug should also return JSON 404"""
        try:
            headers = {"Host": self.panel_domain}
            response = requests.get(f"{self.base_url}/abc123", headers=headers, timeout=10)
            
            if response.status_code == 404:
                try:
                    json_response = response.json()
                    if json_response.get("error") == "Panel page not found":
                        self.log_result(
                            "Panel domain random slug", 
                            True, 
                            "Random slug on panel domain correctly returns JSON 404"
                        )
                        return True
                except:
                    pass
            
            self.log_result(
                "Panel domain random slug", 
                False, 
                f"Expected JSON 404 panel error, got status {response.status_code}",
                "404 JSON with panel error",
                f"{response.status_code} - {response.text[:100]}"
            )
            return False
            
        except requests.RequestException as e:
            self.log_result(
                "Panel domain random slug - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_shortener_domain_works(self):
        """Test 3: Shortener should still work on non-panel domains"""
        try:
            headers = {"Host": self.shortener_domain}
            response = requests.get(f"{self.base_url}/testslug", headers=headers, timeout=10)
            
            # Should return HTML "Link not found" page (shortener behavior)
            if "Link not found" in response.text or response.status_code == 404:
                # Check it's HTML (shortener response), not JSON (panel response)
                if "<html" in response.text.lower() or "text/html" in response.headers.get("content-type", ""):
                    self.log_result(
                        "Shortener domain functionality", 
                        True, 
                        "Shortener domain correctly returns HTML 'Link not found' page"
                    )
                    return True
                else:
                    self.log_result(
                        "Shortener domain functionality", 
                        False, 
                        "Shortener returned JSON instead of HTML",
                        "HTML response",
                        "JSON response"
                    )
                    return False
            else:
                self.log_result(
                    "Shortener domain functionality", 
                    False, 
                    f"Shortener didn't return expected 'Link not found', got: {response.text[:200]}",
                    "HTML with 'Link not found'",
                    response.text[:200]
                )
                return False
                
        except requests.RequestException as e:
            self.log_result(
                "Shortener domain functionality - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_health_check(self):
        """Test 4: Health check should return 200"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            if response.status_code == 200:
                self.log_result(
                    "Health check", 
                    True, 
                    f"Health check returns 200 OK"
                )
                return True
            else:
                self.log_result(
                    "Health check", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    "200",
                    str(response.status_code)
                )
                return False
                
        except requests.RequestException as e:
            self.log_result(
                "Health check - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_fastapi_proxy(self):
        """Test 5: FastAPI proxy should work"""
        try:
            response = requests.get("http://localhost:8001/api/", timeout=10)
            if response.status_code == 200:
                self.log_result(
                    "FastAPI proxy", 
                    True, 
                    f"FastAPI proxy returns 200 OK"
                )
                return True
            else:
                self.log_result(
                    "FastAPI proxy", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    "200",
                    str(response.status_code)
                )
                return False
                
        except requests.RequestException as e:
            self.log_result(
                "FastAPI proxy - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def test_react_frontend(self):
        """Test 6: React frontend should work"""
        try:
            response = requests.get("http://localhost:3000/", timeout=10)
            if response.status_code == 200:
                self.log_result(
                    "React frontend", 
                    True, 
                    f"React frontend returns 200 OK"
                )
                return True
            else:
                self.log_result(
                    "React frontend", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    "200",
                    str(response.status_code)
                )
                return False
                
        except requests.RequestException as e:
            self.log_result(
                "React frontend - Request", 
                False, 
                f"Request failed: {str(e)}"
            )
            return False
    
    def check_nodejs_logs(self):
        """Test 7: Check Node.js error logs are clean"""
        try:
            import subprocess
            result = subprocess.run(
                ["tail", "-n", "20", "/var/log/supervisor/nodejs.err.log"], 
                capture_output=True, text=True, timeout=5
            )
            
            if result.returncode == 0:
                log_content = result.stdout.strip()
                if not log_content or len(log_content) == 0:
                    self.log_result(
                        "Node.js error logs", 
                        True, 
                        "No recent errors in Node.js logs"
                    )
                    return True
                else:
                    # Check for actual errors vs just info logs
                    error_lines = [line for line in log_content.split('\n') 
                                 if any(keyword in line.lower() for keyword in ['error', 'exception', 'failed', 'crash'])]
                    if not error_lines:
                        self.log_result(
                            "Node.js error logs", 
                            True, 
                            "Node.js logs contain only info/debug messages, no errors"
                        )
                        return True
                    else:
                        self.log_result(
                            "Node.js error logs", 
                            False, 
                            f"Found errors in logs: {'; '.join(error_lines[:3])}"
                        )
                        return False
            else:
                self.log_result(
                    "Node.js error logs", 
                    False, 
                    f"Could not read logs: {result.stderr}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Node.js error logs", 
                False, 
                f"Log check failed: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🚀 Starting Panel Domain Fix Tests for Node.js Express Server\n")
        
        tests = [
            ("Panel Domain Shortener Block (testslug)", self.test_panel_domain_shortener_blocked),
            ("Panel Domain Random Slug (abc123)", self.test_panel_domain_random_slug),
            ("Shortener Domain Functionality", self.test_shortener_domain_works),
            ("Health Check", self.test_health_check),
            ("FastAPI Proxy", self.test_fastapi_proxy),
            ("React Frontend", self.test_react_frontend),
            ("Node.js Error Logs", self.check_nodejs_logs),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n--- Running: {test_name} ---")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL - {test_name}: Exception occurred - {str(e)}")
                failed += 1
        
        print(f"\n{'='*60}")
        print(f"🏁 TEST SUMMARY: {passed} passed, {failed} failed")
        print(f"{'='*60}")
        
        if failed > 0:
            print("\n🔍 FAILED TEST DETAILS:")
            for result in self.results:
                if not result["success"]:
                    print(f"❌ {result['test_name']}: {result['details']}")
                    if result.get("expected") and result.get("actual"):
                        print(f"   Expected: {result['expected']}")
                        print(f"   Actual: {result['actual']}")
        
        return passed, failed

if __name__ == "__main__":
    tester = NodeJSServerTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with non-zero code if any tests failed
    sys.exit(1 if failed > 0 else 0)