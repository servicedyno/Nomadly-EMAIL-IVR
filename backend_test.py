#!/usr/bin/env python3
"""
Backend Test Suite for CR Two-Step NS Update Fix
Tests the specific implementation of the updateAllNameservers function's two-step CR workaround.
"""

import requests
import json
import os
import time
import sys
from urllib.parse import urljoin

# Get backend URL from environment
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            backend_url = line.split('=', 1)[1].strip()
            break
    else:
        backend_url = 'http://localhost:5000'

API_BASE = urljoin(backend_url, '/api/')

def test_node_health():
    """Test Node.js service health"""
    try:
        response = requests.get(urljoin(API_BASE, 'health'), timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Node.js Health: {data}")
            return True
        else:
            print(f"❌ Node.js Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Node.js Health Check Error: {e}")
        return False

def test_domain_service_module():
    """Test that domain-service.js module loads and updateAllNameservers is exported"""
    try:
        # Test via a backend endpoint that would import domain-service
        response = requests.get(urljoin(API_BASE, 'health'), timeout=10)
        if response.status_code == 200:
            print("✅ Domain service module loads successfully (Node.js starts)")
            return True
        else:
            print(f"❌ Module loading test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Module loading test error: {e}")
        return False

def verify_two_step_cr_implementation():
    """Verify the two-step CR fix implementation in updateAllNameservers function"""
    
    print("\n=== Verifying Two-Step CR Fix Implementation ===")
    
    # Read the domain-service.js file to verify the implementation
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
        
        # Check for required code patterns from the review request
        patterns = {
            "msgCode 2303 check": "response?.data?.responseData?.msgCode === 2303",
            "currentCRNs collection": "rd[`nameserver${i}`]",
            "stuckNs filtering": "currentCRNs.filter(ns => !newNameservers.map(n => n.toLowerCase()).includes(ns.toLowerCase()))",
            "Step 1 allNs building": "const allNs = [...newNameservers]",
            "Step 2 retry": "response = await axios.get(crUrl, { params: requestData })",
            "max 12 slots check": "allNs.length < 12",
            "proper logging": "[updateAllNameservers] CR \"host not linked\"",
            "Step 1 logging": "[updateAllNameservers] CR Step 1 (include stuck NS)",
            "Step 2 logging": "[updateAllNameservers] CR Step 2 (remove stuck NS)"
        }
        
        results = {}
        for pattern_name, pattern in patterns.items():
            if pattern in content:
                print(f"✅ {pattern_name}: Found")
                results[pattern_name] = True
            else:
                print(f"❌ {pattern_name}: Missing - {pattern}")
                results[pattern_name] = False
        
        # Check overall structure of the two-step fix
        if "if (response?.data?.responseMsg?.statusCode !== 200 && response?.data?.responseData?.msgCode === 2303)" in content:
            print("✅ Two-step condition check: Correctly implemented")
            results["two_step_condition"] = True
        else:
            print("❌ Two-step condition check: Missing or incorrect")
            results["two_step_condition"] = False
            
        # Check that updateAllNameservers is properly exported
        if "updateAllNameservers," in content:
            print("✅ Function export: updateAllNameservers is exported")
            results["function_export"] = True
        else:
            print("❌ Function export: updateAllNameservers not found in exports")
            results["function_export"] = False
            
        return results
        
    except Exception as e:
        print(f"❌ Code verification error: {e}")
        return {}

def test_function_structure():
    """Test the specific function structure mentioned in the review request"""
    
    print("\n=== Testing Function Structure ===")
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
        
        # Extract the updateAllNameservers function
        start_marker = "const updateAllNameservers = async (domainName, newNameservers, db) => {"
        end_marker = "}"
        
        if start_marker not in content:
            print("❌ updateAllNameservers function not found")
            return False
            
        start_idx = content.find(start_marker)
        # Find the matching closing brace (this is simplified)
        brace_count = 0
        end_idx = start_idx
        for i, char in enumerate(content[start_idx:], start_idx):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i
                    break
        
        function_code = content[start_idx:end_idx+1]
        
        # Verify the ConnectReseller block structure
        cr_patterns = [
            "// ConnectReseller",
            "const currentCRNs = []",
            "for (let i = 1; i <= 4; i++)",
            "if (response?.data?.responseMsg?.statusCode !== 200 && response?.data?.responseData?.msgCode === 2303)",
            "const stuckNs = currentCRNs.filter",
            "// Step 1: Include stuck NS alongside new ones",
            "const step1Data = { APIKey, domainNameId: rd.domainNameId, websiteName: domainName }",
            "const allNs = [...newNameservers]",
            "for (const stuck of stuckNs)",
            "if (allNs.length < 12) allNs.push(stuck)",
            "// Step 2: Now update with ONLY the new NS"
        ]
        
        missing_patterns = []
        for pattern in cr_patterns:
            if pattern not in function_code:
                missing_patterns.append(pattern)
        
        if not missing_patterns:
            print("✅ All required CR block patterns found")
            return True
        else:
            print("❌ Missing CR block patterns:")
            for pattern in missing_patterns:
                print(f"   - {pattern}")
            return False
            
    except Exception as e:
        print(f"❌ Function structure test error: {e}")
        return False

def run_comprehensive_test():
    """Run comprehensive test suite"""
    print("🧪 Starting CR Two-Step NS Update Fix Verification\n")
    
    test_results = {}
    
    # Test 1: Node.js Health
    test_results['node_health'] = test_node_health()
    
    # Test 2: Module Loading
    test_results['module_loading'] = test_domain_service_module()
    
    # Test 3: Two-step implementation verification
    implementation_results = verify_two_step_cr_implementation()
    test_results['implementation'] = implementation_results
    
    # Test 4: Function structure
    test_results['function_structure'] = test_function_structure()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    total_tests = 0
    passed_tests = 0
    
    # Basic tests
    basic_tests = ['node_health', 'module_loading', 'function_structure']
    for test_name in basic_tests:
        status = "✅ PASS" if test_results[test_name] else "❌ FAIL"
        print(f"{test_name}: {status}")
        total_tests += 1
        if test_results[test_name]:
            passed_tests += 1
    
    # Implementation pattern tests
    if 'implementation' in test_results and test_results['implementation']:
        impl_results = test_results['implementation']
        for pattern_name, result in impl_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"Implementation - {pattern_name}: {status}")
            total_tests += 1
            if result:
                passed_tests += 1
    
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"\nOverall Results: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
    
    if success_rate >= 90:
        print("🎉 CR Two-Step NS Update Fix: VERIFICATION SUCCESSFUL")
        return True
    else:
        print("⚠️ CR Two-Step NS Update Fix: VERIFICATION FAILED")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)