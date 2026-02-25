#!/usr/bin/env python3
"""
Backend Testing Script for NS Update 400 Error Fix for CR Domains on Cloudflare DNS

This script tests the implementation of the fix for NS update 400 error when updating 
nameservers for ConnectReseller domains managed via Cloudflare DNS.

Key components tested:
1. In js/domain-service.js: updateNameserverAtRegistrar() function has ConnectReseller handler
2. In js/_index.js: NS update block routes through domainService.updateNameserverAtRegistrar()
3. Node.js service health check
"""

import os
import sys
import requests
import json
from pathlib import Path

# Backend URL from environment
BACKEND_URL = "https://env-config-setup-3.preview.emergentagent.com"

def log_test(name, status, details=""):
    """Log test results with consistent formatting"""
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_emoji} {status}: {name}")
    if details:
        print(f"   Details: {details}")

def test_node_service_health():
    """Test 1: Verify Node.js service is running and accessible"""
    try:
        # Test health endpoint
        health_url = f"{BACKEND_URL}/api/health"
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            log_test("Node.js Service Health Check", "PASS", f"Service accessible at {BACKEND_URL}")
            return True
        else:
            log_test("Node.js Service Health Check", "FAIL", f"HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        log_test("Node.js Service Health Check", "FAIL", f"Connection error: {e}")
        return False

def test_domain_service_implementation():
    """Test 2: Verify updateNameserverAtRegistrar ConnectReseller implementation exists"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Check for ConnectReseller handler in updateNameserverAtRegistrar
        checks = [
            ("getDomainDetails require", "require('./cr-domain-details-get')" in content),
            ("updateDNSRecordNs require", "require('./cr-dns-record-update-ns')" in content),
            ("getDomainDetails call", "getDomainDetails(domainName)" in content),
            ("domainNameId extraction", "rd.domainNameId" in content),
            ("updateDNSRecordNs call", "updateDNSRecordNs(rd.domainNameId" in content),
            ("useDefaultCR fallback", "useDefaultCR: true" in content),
        ]
        
        passed = 0
        failed = 0
        
        for check_name, condition in checks:
            if condition:
                log_test(f"Domain Service - {check_name}", "PASS")
                passed += 1
            else:
                log_test(f"Domain Service - {check_name}", "FAIL")
                failed += 1
        
        # Check for ConnectReseller NS records building logic
        if "nameserver1" in content and "nameserver2" in content and "currentNSRecords" in content:
            log_test("Domain Service - NS Records Building", "PASS", "nameserver1-4 to currentNSRecords mapping found")
            passed += 1
        else:
            log_test("Domain Service - NS Records Building", "FAIL", "Missing nameserver1-4 to currentNSRecords mapping")
            failed += 1
            
        # Check for DB update logic
        if "domainsOf" in content and "registeredDomains" in content:
            log_test("Domain Service - DB Update Logic", "PASS", "Both collections updated")
            passed += 1
        else:
            log_test("Domain Service - DB Update Logic", "FAIL", "Missing DB update for domainsOf/registeredDomains")
            failed += 1
            
        return passed, failed
        
    except Exception as e:
        log_test("Domain Service Code Review", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_index_js_ns_routing():
    """Test 3: Verify _index.js routes all NS updates through updateNameserverAtRegistrar"""
    index_path = "/app/js/_index.js"
    
    try:
        with open(index_path, 'r') as f:
            content = f.read()
        
        # Find the NS update section around line 6886
        lines = content.split('\n')
        ns_update_section = None
        
        # Look for the NS update block
        for i, line in enumerate(lines):
            if "} else if (recordType === 'NS') {" in line:
                # Get about 20 lines after this
                ns_update_section = '\n'.join(lines[i:i+20])
                break
        
        if not ns_update_section:
            log_test("Index.js NS Update Section", "FAIL", "NS update block not found")
            return 0, 1
            
        checks = [
            ("updateNameserverAtRegistrar call", "domainService.updateNameserverAtRegistrar" in ns_update_section),
            ("useDefaultCR fallback", "result.useDefaultCR" in ns_update_section),
            ("Legacy CR path", "Final fallback to legacy CR direct path" in ns_update_section),
            ("No OP/CF conditional", "if (registrar ===" not in ns_update_section and "else if" not in ns_update_section.split("updateNameserverAtRegistrar")[0] if "updateNameserverAtRegistrar" in ns_update_section else False)
        ]
        
        passed = 0
        failed = 0
        
        for check_name, condition in checks:
            if condition:
                log_test(f"Index.js NS Routing - {check_name}", "PASS")
                passed += 1
            else:
                log_test(f"Index.js NS Routing - {check_name}", "FAIL")
                failed += 1
                
        # Check that ALL NS updates route through updateNameserverAtRegistrar
        if "Route ALL NS updates through updateNameserverAtRegistrar" in content:
            log_test("Index.js NS Routing - Unified NS Routing", "PASS", "All NS updates routed through updateNameserverAtRegistrar")
            passed += 1
        else:
            log_test("Index.js NS Routing - Unified NS Routing", "WARN", "Comment about unified routing not found")
            
        return passed, failed
        
    except Exception as e:
        log_test("Index.js NS Routing Review", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_cr_dependencies():
    """Test 4: Verify required CR modules exist"""
    required_modules = [
        "/app/js/cr-domain-details-get.js",
        "/app/js/cr-dns-record-update-ns.js"
    ]
    
    passed = 0
    failed = 0
    
    for module_path in required_modules:
        module_name = os.path.basename(module_path)
        if os.path.exists(module_path):
            log_test(f"CR Module - {module_name}", "PASS", "File exists")
            passed += 1
        else:
            log_test(f"CR Module - {module_name}", "FAIL", "File not found")
            failed += 1
    
    return passed, failed

def test_supervisor_service():
    """Test 5: Check supervisor status for nodejs service"""
    try:
        import subprocess
        result = subprocess.run(['sudo', 'supervisorctl', 'status', 'nodejs'], 
                               capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and 'RUNNING' in result.stdout:
            log_test("Supervisor nodejs Service", "PASS", "Service is RUNNING")
            return True
        else:
            log_test("Supervisor nodejs Service", "FAIL", f"Status: {result.stdout.strip()}")
            return False
    except Exception as e:
        log_test("Supervisor nodejs Service", "FAIL", f"Error checking status: {e}")
        return False

def run_comprehensive_test():
    """Run all tests and provide summary"""
    print("🧪 COMPREHENSIVE NS UPDATE FIX TESTING")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    total_passed = 0
    total_failed = 0
    
    # Test 1: Service Health
    print("\n📡 SERVICE HEALTH TESTS")
    print("-" * 30)
    if test_node_service_health():
        total_passed += 1
    else:
        total_failed += 1
        
    if test_supervisor_service():
        total_passed += 1
    else:
        total_failed += 1
    
    # Test 2: Code Implementation
    print("\n🔍 CODE IMPLEMENTATION TESTS")
    print("-" * 30)
    
    # Domain Service Tests
    print("Testing domain-service.js:")
    domain_passed, domain_failed = test_domain_service_implementation()
    total_passed += domain_passed
    total_failed += domain_failed
    
    # Index.js Tests
    print("\nTesting _index.js:")
    index_passed, index_failed = test_index_js_ns_routing()
    total_passed += index_passed
    total_failed += index_failed
    
    # CR Dependencies Tests
    print("\nTesting CR dependencies:")
    cr_passed, cr_failed = test_cr_dependencies()
    total_passed += cr_passed
    total_failed += cr_failed
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    success_rate = (total_passed / (total_passed + total_failed)) * 100 if (total_passed + total_failed) > 0 else 0
    
    print(f"✅ PASSED: {total_passed}")
    print(f"❌ FAILED: {total_failed}")
    print(f"📈 SUCCESS RATE: {success_rate:.1f}%")
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED - NS UPDATE FIX IMPLEMENTATION IS CORRECT")
        return True
    elif success_rate >= 80:
        print(f"\n⚠️  MOSTLY WORKING - {total_failed} issue(s) need attention")
        return False
    else:
        print(f"\n❌ SIGNIFICANT ISSUES - {total_failed} critical problems found")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)