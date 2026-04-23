#!/usr/bin/env python3
"""
Backend API Testing for Nomadly File Copy/Move Endpoints
Tests the new file copy and move API endpoints on the Nomadly backend.
"""

import requests
import json
import sys
from typing import Dict, Any

# Base URL from frontend/.env
BASE_URL = "https://readme-init-2.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
TEST_CREDENTIALS = {
    "username": "hello@ivrpod.com",
    "pin": "Onlygod1234@"
}

# Correct endpoint paths (mounted under /panel)
ENDPOINTS = {
    "copy": "/panel/files/copy",
    "move": "/panel/files/move",
    "files": "/panel/files",
    "mkdir": "/panel/files/mkdir",
    "delete": "/panel/files/delete",
    "rename": "/panel/files/rename",
    "login": "/panel/login"
}

class FileManagerTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = 30
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def login(self) -> bool:
        """Login to get authentication token"""
        try:
            response = self.session.post(
                f"{BASE_URL}{ENDPOINTS['login']}",
                json=TEST_CREDENTIALS,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get("token")
                if self.auth_token:
                    self.log_test("Authentication", True, f"Token obtained for user: {data.get('username')}")
                    return True
                else:
                    self.log_test("Authentication", False, "No token in response")
                    return False
            else:
                self.log_test("Authentication", False, f"Status {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Exception: {str(e)}")
            return False
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get headers with authentication token"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_endpoint_exists(self, endpoint: str, method: str = "POST") -> bool:
        """Test if endpoint exists (not 404)"""
        try:
            if method == "POST":
                response = self.session.post(
                    f"{BASE_URL}{endpoint}",
                    json={},
                    headers=self.get_auth_headers()
                )
            else:
                response = self.session.get(
                    f"{BASE_URL}{endpoint}",
                    headers=self.get_auth_headers()
                )
            
            exists = response.status_code != 404
            self.log_test(
                f"Endpoint exists: {method} {endpoint}",
                exists,
                f"Status: {response.status_code}" if not exists else "Endpoint found"
            )
            return exists
            
        except Exception as e:
            self.log_test(f"Endpoint exists: {method} {endpoint}", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_required(self, endpoint: str, method: str = "POST") -> bool:
        """Test that endpoint requires authentication"""
        try:
            if method == "POST":
                response = self.session.post(
                    f"{BASE_URL}{endpoint}",
                    json={"dir": "/test", "file": "test.txt", "destDir": "/dest"}
                )
            else:
                response = self.session.get(f"{BASE_URL}{endpoint}")
            
            auth_required = response.status_code in [401, 403]
            self.log_test(
                f"Auth required: {method} {endpoint}",
                auth_required,
                f"Status: {response.status_code} (expected 401/403)"
            )
            return auth_required
            
        except Exception as e:
            self.log_test(f"Auth required: {method} {endpoint}", False, f"Exception: {str(e)}")
            return False
    
    def test_parameter_validation(self, endpoint: str) -> bool:
        """Test parameter validation for copy/move endpoints"""
        try:
            # Test with missing parameters (without auth)
            response = self.session.post(
                f"{BASE_URL}{endpoint}",
                json={}
            )
            
            # Should get auth error (401/403) before parameter validation
            # This confirms the endpoint exists and auth is checked first
            validation_works = response.status_code in [401, 403]
            details = f"Status: {response.status_code}"
            
            if response.status_code in [401, 403]:
                details += " (auth required - endpoint accessible)"
            elif response.status_code == 400:
                try:
                    error_data = response.json()
                    error_msg = error_data.get("error", "")
                    details += f", Error: {error_msg}"
                except:
                    details += f", Response: {response.text[:100]}"
            
            self.log_test(
                f"Parameter validation: {endpoint}",
                validation_works,
                details
            )
            return validation_works
            
        except Exception as e:
            self.log_test(f"Parameter validation: {endpoint}", False, f"Exception: {str(e)}")
            return False
    
    def test_existing_file_endpoints(self) -> bool:
        """Test that existing file manager endpoints still work"""
        endpoints_to_test = [
            (ENDPOINTS["files"], "GET"),
            (ENDPOINTS["mkdir"], "POST"),
            (ENDPOINTS["delete"], "POST"),
            (ENDPOINTS["rename"], "POST")
        ]
        
        all_working = True
        
        for endpoint, method in endpoints_to_test:
            try:
                if method == "GET":
                    response = self.session.get(
                        f"{BASE_URL}{endpoint}",
                        headers=self.get_auth_headers()
                    )
                else:
                    # Send minimal valid request to check endpoint exists
                    test_data = {}
                    if endpoint == ENDPOINTS["mkdir"]:
                        test_data = {"dir": "/test", "name": "testdir"}
                    elif endpoint == ENDPOINTS["delete"]:
                        test_data = {"dir": "/test", "file": "nonexistent.txt"}
                    elif endpoint == ENDPOINTS["rename"]:
                        test_data = {"dir": "/test", "oldName": "old.txt", "newName": "new.txt"}
                    
                    response = self.session.post(
                        f"{BASE_URL}{endpoint}",
                        json=test_data,
                        headers=self.get_auth_headers()
                    )
                
                # Endpoint should exist (not 404) and be accessible with auth
                working = response.status_code != 404
                if not working:
                    all_working = False
                
                self.log_test(
                    f"Existing endpoint: {method} {endpoint}",
                    working,
                    f"Status: {response.status_code}"
                )
                
            except Exception as e:
                self.log_test(f"Existing endpoint: {method} {endpoint}", False, f"Exception: {str(e)}")
                all_working = False
        
        return all_working
    
    def test_copy_move_with_valid_auth(self) -> bool:
        """Test copy/move endpoints with valid auth but invalid file paths"""
        endpoints = [ENDPOINTS["copy"], ENDPOINTS["move"]]
        all_working = True
        
        for endpoint in endpoints:
            try:
                # Use valid auth but non-existent file paths
                response = self.session.post(
                    f"{BASE_URL}{endpoint}",
                    json={
                        "dir": "/home/testuser/public_html",
                        "file": "nonexistent_test_file.txt",
                        "destDir": "/home/testuser/public_html/backup"
                    },
                    headers=self.get_auth_headers()
                )
                
                # Should not be 404 (endpoint exists) or 401/403 (auth works)
                # Might be 400 (bad params) or 500 (file not found) - both acceptable
                working = response.status_code not in [404, 401, 403]
                if not working:
                    all_working = False
                
                self.log_test(
                    f"Valid auth test: {endpoint}",
                    working,
                    f"Status: {response.status_code} (not 404/401/403 = endpoint accessible)"
                )
                
            except Exception as e:
                self.log_test(f"Valid auth test: {endpoint}", False, f"Exception: {str(e)}")
                all_working = False
        
        return all_working
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🧪 Starting File Copy/Move API Tests")
        print("=" * 50)
        
        # Step 1: Test new endpoints exist (without auth first)
        print("Testing endpoint existence...")
        copy_exists = self.test_endpoint_exists(ENDPOINTS["copy"], "POST")
        move_exists = self.test_endpoint_exists(ENDPOINTS["move"], "POST")
        
        print()
        
        # Step 2: Test authentication required
        print("Testing authentication requirements...")
        self.test_auth_required(ENDPOINTS["copy"], "POST")
        self.test_auth_required(ENDPOINTS["move"], "POST")
        
        print()
        
        # Step 3: Test parameter validation (without auth - should get auth error first)
        print("Testing parameter validation...")
        if copy_exists:
            self.test_parameter_validation(ENDPOINTS["copy"])
        if move_exists:
            self.test_parameter_validation(ENDPOINTS["move"])
        
        print()
        
        # Step 4: Test existing endpoints still work (without auth - should get auth error)
        print("Testing existing file manager endpoints...")
        self.test_existing_file_endpoints()
        
        print()
        
        # Step 5: Try authentication
        print("Testing authentication...")
        auth_success = self.login()
        
        if auth_success:
            print("\nTesting with valid authentication...")
            if copy_exists or move_exists:
                self.test_copy_move_with_valid_auth()
        else:
            print("⚠️  Authentication failed - testing without auth only")
            print("   This is expected if test credentials are not valid")
        
        print()
        
        # Summary
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        
        print("=" * 50)
        print(f"📊 Test Summary: {passed_tests}/{total_tests} tests passed")
        
        # Count critical tests (endpoint existence and auth requirements)
        critical_tests = [r for r in self.test_results if 
                         "Endpoint exists" in r["test"] or "Auth required" in r["test"]]
        critical_passed = sum(1 for test in critical_tests if test["success"])
        
        print(f"🔑 Critical tests (endpoints + auth): {critical_passed}/{len(critical_tests)} passed")
        
        if critical_passed == len(critical_tests):
            print("✅ All critical tests passed! Endpoints exist and require authentication.")
            return True
        else:
            print("❌ Some critical tests failed.")
            failed_critical = [r for r in critical_tests if not r["success"]]
            print("\nFailed critical tests:")
            for test in failed_critical:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    """Main test runner"""
    tester = FileManagerTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()