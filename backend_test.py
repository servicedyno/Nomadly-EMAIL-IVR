#!/usr/bin/env python3
"""
Backend Test for CR Nameserver Stale-State Revert Bug Fix
Testing agent verifying the root cause fix implementation.
"""

import subprocess
import sys
import os
import re

def test_nameserver_fix_implementation():
    """Test that the CR nameserver stale-state revert bug fix is properly implemented."""
    
    print("=== TESTING CR NAMESERVER STALE-STATE REVERT BUG FIX ===")
    
    domain_service_path = "/app/js/domain-service.js"
    
    if not os.path.exists(domain_service_path):
        print("❌ CRITICAL: domain-service.js not found!")
        return False
    
    # Read the domain-service.js file
    with open(domain_service_path, 'r') as f:
        content = f.read()
    
    # Test 1: Verify updateDNSRecordNs appears at most 2 times (only in updateNameserverAtRegistrar)
    updateDNSRecordNs_count = content.count('updateDNSRecordNs')
    print(f"✓ updateDNSRecordNs appears {updateDNSRecordNs_count} times (should be ≤ 2)")
    
    if updateDNSRecordNs_count > 2:
        print("❌ FAIL: updateDNSRecordNs appears more than 2 times!")
        return False
    
    # Test 2: Verify the 4 locations now use updateAllNameservers instead of loops
    test_cases = [
        {
            "function": "postRegistrationNSUpdate",
            "pattern": r"updateAllNameservers\(domainName,\s*nameservers,\s*db\)",
            "description": "CR block uses updateAllNameservers"
        },
        {
            "function": "_createZoneAndUpdateNS", 
            "pattern": r"updateAllNameservers\(domainName,\s*cfNameservers,\s*null\)",
            "description": "CR else block uses updateAllNameservers with null db"
        },
        {
            "function": "backgroundNSVerify",
            "pattern": r"updateAllNameservers\(domainName,\s*correctNS,\s*null\)",
            "description": "CR else block uses updateAllNameservers"
        },
        {
            "function": "switchToProviderDefault",
            "pattern": r"updateAllNameservers\(domainName,\s*crDefaultNS,\s*null\)",
            "description": "CR block uses updateAllNameservers with null db"
        }
    ]
    
    all_passed = True
    for test in test_cases:
        if re.search(test["pattern"], content):
            print(f"✓ {test['function']}: {test['description']}")
        else:
            print(f"❌ {test['function']}: MISSING - {test['description']}")
            all_passed = False
    
    # Test 3: Verify NO remaining for loops that call updateDNSRecordNs
    for_loop_pattern = r'for\s*\([^)]*\)[^{]*\{[^}]*updateDNSRecordNs'
    if re.search(for_loop_pattern, content, re.DOTALL):
        print("❌ FAIL: Found for loop still calling updateDNSRecordNs!")
        all_passed = False
    else:
        print("✓ NO remaining for loops calling updateDNSRecordNs")
    
    # Test 4: Verify updateNameserverAtRegistrar single-slot function still exists and is valid
    if "updateNameserverAtRegistrar" in content:
        print("✓ updateNameserverAtRegistrar function exists (valid single-slot function)")
    else:
        print("❌ FAIL: updateNameserverAtRegistrar function missing!")
        all_passed = False
    
    return all_passed

def test_nodejs_startup():
    """Test that Node.js starts cleanly without syntax errors."""
    
    print("\n=== TESTING NODE.JS STARTUP ===")
    
    try:
        # Change to the correct directory and test syntax
        os.chdir("/app/js")
        
        # Check if the main index file exists
        if not os.path.exists("_index.js"):
            print("❌ FAIL: _index.js not found!")
            return False
        
        # Test Node.js syntax by requiring the domain-service module
        result = subprocess.run([
            "node", "-e", 
            "try { require('./domain-service.js'); console.log('✓ domain-service.js syntax OK'); } catch(e) { console.error('❌ Syntax error:', e.message); process.exit(1); }"
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✓ domain-service.js syntax validation passed")
        else:
            print(f"❌ domain-service.js syntax error: {result.stderr}")
            return False
            
        return True
        
    except subprocess.TimeoutExpired:
        print("❌ FAIL: Node.js syntax check timed out")
        return False
    except Exception as e:
        print(f"❌ FAIL: Error testing Node.js startup: {e}")
        return False

def main():
    """Main test execution."""
    
    print("Backend Testing Agent: CR Nameserver Stale-State Revert Bug Fix Verification")
    print("=" * 80)
    
    # Test 1: Fix Implementation
    fix_test_passed = test_nameserver_fix_implementation()
    
    # Test 2: Node.js Startup
    nodejs_test_passed = test_nodejs_startup()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY:")
    
    if fix_test_passed and nodejs_test_passed:
        print("✅ ALL TESTS PASSED - CR nameserver stale-state revert bug fix verified")
        return True
    else:
        print("❌ SOME TESTS FAILED")
        if not fix_test_passed:
            print("  - Fix implementation verification failed")
        if not nodejs_test_passed:
            print("  - Node.js startup test failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)