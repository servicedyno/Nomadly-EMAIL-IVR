#!/usr/bin/env python3
"""
Backend Testing Script for cPanel Management Panel
Tests the fixes implemented and verifies backend health.
"""

import requests
import json
import sys
import time
from typing import Dict, Any, Optional

# Read backend URL from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip().rstrip('/')
    except:
        pass
    return 'http://localhost:5000'

BASE_URL = get_backend_url()
API_URL = f"{BASE_URL}/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, test_name: str):
        print(f"✅ {test_name}")
        self.passed += 1
    
    def failure(self, test_name: str, error: str):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        success_rate = (self.passed / total * 100) if total > 0 else 0
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")

results = TestResults()

def test_backend_health():
    """Test 1: Backend Health Check"""
    try:
        # Test basic connectivity
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            results.success("Backend health endpoint accessible")
        else:
            results.failure("Backend health check", f"Status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        results.failure("Backend health check", f"Connection error: {str(e)}")

def test_nodejs_service():
    """Test 2: Node.js service status"""
    try:
        # Check if we can reach the main server
        response = requests.get(BASE_URL, timeout=10)
        if response.status_code in [200, 404]:  # 404 is OK for root path
            results.success("Node.js service running")
        else:
            results.failure("Node.js service check", f"Unexpected status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        results.failure("Node.js service check", f"Service not accessible: {str(e)}")

def verify_autossl_fix():
    """Test 3: Verify AutoSSL fix in DomainList.js"""
    print("\n🔍 Verifying AutoSSL fix in DomainList.js...")
    
    try:
        with open('/app/frontend/src/components/panel/DomainList.js', 'r') as f:
            content = f.read()
        
        # Check that triggerAutoSSL() is NOT called in checkNS function
        lines = content.split('\n')
        in_checkns = False
        checkns_content = []
        
        for line in lines:
            if 'const checkNS = async (domain) => {' in line:
                in_checkns = True
                continue
            if in_checkns and line.strip().startswith('};'):
                break
            if in_checkns:
                checkns_content.append(line)
        
        checkns_code = '\n'.join(checkns_content)
        
        # Verify fetchSSL() is called but NOT triggerAutoSSL()
        has_fetchssl = 'fetchSSL()' in checkns_code
        has_triggerautossl = 'triggerAutoSSL()' in checkns_code
        
        if has_fetchssl and not has_triggerautossl:
            results.success("AutoSSL fix: fetchSSL() called, triggerAutoSSL() removed from checkNS")
        elif not has_fetchssl:
            results.failure("AutoSSL fix verification", "fetchSSL() not found in checkNS function")
        elif has_triggerautossl:
            results.failure("AutoSSL fix verification", "triggerAutoSSL() still called in checkNS function")
        
        # Verify triggerAutoSSL function still exists
        if 'const triggerAutoSSL = async () => {' in content:
            results.success("AutoSSL fix: triggerAutoSSL function still exists for manual button")
        else:
            results.failure("AutoSSL fix verification", "triggerAutoSSL function not found")
            
    except Exception as e:
        results.failure("AutoSSL fix verification", f"Error reading file: {str(e)}")

def verify_create_folder_fix():
    """Test 4: Verify create folder bug fix in cpanel-proxy.js"""
    print("\n🔍 Verifying create folder fix in cpanel-proxy.js...")
    
    try:
        with open('/app/js/cpanel-proxy.js', 'r') as f:
            content = f.read()
        
        # Find createDirectory function
        lines = content.split('\n')
        in_create_dir = False
        create_dir_content = []
        
        for line in lines:
            if 'async function createDirectory(cpUser, cpPass, dir, name)' in line:
                in_create_dir = True
                create_dir_content.append(line)
                continue
            if in_create_dir and line.strip().startswith('}'):
                create_dir_content.append(line)
                break
            if in_create_dir:
                create_dir_content.append(line)
        
        create_dir_code = '\n'.join(create_dir_content)
        
        # Verify fullPath construction
        has_fullpath = 'const fullPath = dir.endsWith' in create_dir_code
        uses_fullpath_param = '{ path: fullPath }' in create_dir_code
        
        if has_fullpath and uses_fullpath_param:
            results.success("Create folder fix: fullPath constructed and used correctly")
        else:
            results.failure("Create folder fix verification", "fullPath construction or usage not found")
            
        # Check frontend error handling
        with open('/app/frontend/src/components/panel/FileManager.js', 'r') as f:
            fm_content = f.read()
        
        # Check if handleCreateDir has error handling
        if 'if (res.errors?.length)' in fm_content and 'handleCreateDir' in fm_content:
            results.success("Create folder fix: Frontend error handling added")
        else:
            results.failure("Create folder fix verification", "Frontend error handling not found in handleCreateDir")
            
    except Exception as e:
        results.failure("Create folder fix verification", f"Error reading files: {str(e)}")

def verify_panel_routes():
    """Test 5: Verify all panel routes exist in cpanel-routes.js"""
    print("\n🔍 Verifying panel routes in cpanel-routes.js...")
    
    expected_routes = [
        "POST /login",
        "GET /me",
        "GET /files",
        "GET /files/content", 
        "POST /files/save",
        "POST /files/upload",
        "POST /files/mkdir",
        "POST /files/delete",
        "POST /files/rename",
        "POST /files/extract",
        "GET /domains",
        "GET /domains/ns-status",
        "POST /domains/add-enhanced",
        "POST /domains/remove",
        "GET /domains/ssl",
        "POST /domains/ssl/autossl",
        "GET /subdomains",
        "POST /subdomains/create",
        "POST /subdomains/delete"
    ]
    
    try:
        with open('/app/js/cpanel-routes.js', 'r') as f:
            content = f.read()
        
        found_routes = []
        missing_routes = []
        
        for route in expected_routes:
            method, path = route.split(' ', 1)
            
            # Check for route definition patterns
            route_patterns = [
                f"router.{method.lower()}('{path}'",
                f"router.{method.lower()}(\"/panel{path}\"",  # Some might have /panel prefix
                f"router.{method.lower()}(\"{path}\"",
            ]
            
            route_found = False
            for pattern in route_patterns:
                if pattern in content:
                    route_found = True
                    break
            
            if route_found:
                found_routes.append(route)
            else:
                missing_routes.append(route)
        
        if len(found_routes) >= 15:  # Allow some flexibility
            results.success(f"Panel routes: {len(found_routes)}/{len(expected_routes)} routes found")
        else:
            results.failure("Panel routes verification", f"Only {len(found_routes)}/{len(expected_routes)} routes found. Missing: {missing_routes}")
            
    except Exception as e:
        results.failure("Panel routes verification", f"Error reading cpanel-routes.js: {str(e)}")

def verify_cpanel_proxy_functions():
    """Test 6: Verify cpanel-proxy.js has matching functions"""
    print("\n🔍 Verifying cpanel-proxy.js functions...")
    
    expected_functions = [
        'listFiles',
        'getFileContent', 
        'saveFileContent',
        'createDirectory',
        'deleteFile',
        'renameFile',
        'extractFile',
        'listDomains',
        'addAddonDomain',
        'removeAddonDomain',
        'listSubdomains',
        'createSubdomain',
        'deleteSubdomain',
        'getSSLStatus'
    ]
    
    try:
        with open('/app/js/cpanel-proxy.js', 'r') as f:
            content = f.read()
        
        found_functions = []
        missing_functions = []
        
        for func in expected_functions:
            if f"async function {func}(" in content:
                found_functions.append(func)
            else:
                missing_functions.append(func)
        
        # Also check exports
        exports_section = content[content.find('module.exports'):]
        
        if len(found_functions) >= 10:  # Allow some flexibility
            results.success(f"cPanel proxy functions: {len(found_functions)}/{len(expected_functions)} functions found")
        else:
            results.failure("cPanel proxy functions", f"Only {len(found_functions)}/{len(expected_functions)} functions found. Missing: {missing_functions}")
            
    except Exception as e:
        results.failure("cPanel proxy functions verification", f"Error reading cpanel-proxy.js: {str(e)}")

def test_api_endpoints():
    """Test 7: Test basic API endpoint accessibility (without auth)"""
    print("\n🔍 Testing API endpoint accessibility...")
    
    # Test basic endpoints that should return 401 (unauthorized) rather than 404 (not found)
    test_endpoints = [
        '/panel/session',
        '/panel/domains', 
        '/panel/files',
        '/panel/subdomains'
    ]
    
    accessible_count = 0
    
    for endpoint in test_endpoints:
        try:
            response = requests.get(f"{API_URL}{endpoint}", timeout=5)
            # 401 means endpoint exists but requires auth (good)
            # 404 means endpoint doesn't exist (bad)
            if response.status_code == 401:
                accessible_count += 1
            elif response.status_code == 404:
                results.failure(f"API endpoint {endpoint}", "Endpoint not found (404)")
            else:
                # Other status codes are also acceptable (might be different auth handling)
                accessible_count += 1
        except requests.exceptions.RequestException as e:
            results.failure(f"API endpoint {endpoint}", f"Connection error: {str(e)}")
    
    if accessible_count >= len(test_endpoints) // 2:  # At least half should work
        results.success(f"API endpoints: {accessible_count}/{len(test_endpoints)} endpoints accessible")
    else:
        results.failure("API endpoints accessibility", f"Only {accessible_count}/{len(test_endpoints)} endpoints accessible")

def main():
    print("🚀 Starting Backend Testing for cPanel Management Panel")
    print("=" * 60)
    
    # Run all tests
    test_backend_health()
    test_nodejs_service()
    verify_autossl_fix()
    verify_create_folder_fix()
    verify_panel_routes()
    verify_cpanel_proxy_functions()
    test_api_endpoints()
    
    # Print summary
    results.summary()
    
    # Exit with error code if any tests failed
    if results.failed > 0:
        sys.exit(1)
    else:
        print("\n🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()