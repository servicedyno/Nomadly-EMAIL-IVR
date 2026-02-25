#!/usr/bin/env python3
"""
Backend Testing Script for DNS Routing Fixes
Testing both fixes mentioned in the review request:

FIX 1: viewDNSRecords auto-create zone updates BOTH collections
FIX 2: cfZoneId-based CF routing for external/non-standard nameserverType

Key components tested:
1. viewDNSRecords auto-create zone path updates both registeredDomains and domainsOf
2. All CF routing checks use (nameserverType === 'cloudflare' || cfZoneId) && cfZoneId pattern
3. Auto-normalization when nameserverType !== 'cloudflare' but cfZoneId exists
4. Node.js service health
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

def test_fix1_viewdns_both_collections():
    """Test FIX 1: viewDNSRecords auto-create zone updates BOTH collections"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Find the auto-create zone section around line 260-278
        lines = content.split('\n')
        auto_create_section = None
        
        # Look for the auto-create zone logic
        for i, line in enumerate(lines):
            if "Cloudflare NS but no zone yet — try to auto-create zone" in line:
                # Get the next 30 lines to capture both DB updates
                auto_create_section = '\n'.join(lines[i:i+30])
                break
        
        if not auto_create_section:
            log_test("FIX 1 - Auto-create section found", "FAIL", "Auto-create zone section not found")
            return 0, 1
            
        # Check for both collection updates
        checks = [
            ("registeredDomains update", "db.collection('registeredDomains').updateOne" in auto_create_section),
            ("domainsOf update", "db.collection('domainsOf').updateOne" in auto_create_section),
            ("cfZoneId set in registeredDomains", "'val.cfZoneId': cfResult.zoneId" in auto_create_section),
            ("cfZoneId set in domainsOf", "cfZoneId: cfResult.zoneId" in auto_create_section),
            ("nameservers set in registeredDomains", "'val.nameservers': newNS" in auto_create_section),
            ("nameservers set in domainsOf", "nameservers: newNS" in auto_create_section)
        ]
        
        passed = 0
        failed = 0
        
        for check_name, condition in checks:
            if condition:
                log_test(f"FIX 1 - {check_name}", "PASS")
                passed += 1
            else:
                log_test(f"FIX 1 - {check_name}", "FAIL")
                failed += 1
        
        return passed, failed
        
    except Exception as e:
        log_test("FIX 1 - Code Review", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_fix2_cfzoneid_routing():
    """Test FIX 2: cfZoneId-based CF routing pattern in all locations"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Check for the new CF routing pattern in specific locations
        expected_locations = [
            # Location 1: viewDNSRecords isCfManaged check
            ("viewDNSRecords isCfManaged", "const isCfManaged = (meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId"),
            
            # Location 2: addDNSRecord NS handler
            ("addDNSRecord NS handler", "recordType === 'NS' && (meta?.nameserverType === 'cloudflare' || meta?.cfZoneId)"),
            
            # Location 3: addDNSRecord CF path
            ("addDNSRecord CF path", "if ((meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId)"),
            
            # Location 4: updateDNSRecord
            ("updateDNSRecord CF check", "if ((meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId && recordData.cfRecordId)"),
            
            # Location 5: deleteDNSRecord
            ("deleteDNSRecord CF check", "if ((meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId && recordData.cfRecordId)"),
            
            # Location 6: switchToCloudflare
            ("switchToCloudflare CF check", "if ((meta.nameserverType === 'cloudflare' || meta.cfZoneId) && meta.cfZoneId)"),
            
            # Location 7: ensureCloudflare
            ("ensureCloudflare CF check", "if ((meta.nameserverType === 'cloudflare' || meta.cfZoneId) && meta.cfZoneId)"),
            
            # Location 8: switchToProviderDefault (negated form)
            ("switchToProviderDefault CF check", "if (!(meta.nameserverType === 'cloudflare' || meta.cfZoneId) || !meta.cfZoneId)"),
            
            # Location 9: addShortenerCNAME
            ("addShortenerCNAME CF check", "if ((meta?.nameserverType === 'cloudflare' || meta?.cfZoneId) && meta?.cfZoneId)")
        ]
        
        passed = 0
        failed = 0
        
        for check_name, pattern in expected_locations:
            if pattern in content:
                log_test(f"FIX 2 - {check_name}", "PASS")
                passed += 1
            else:
                log_test(f"FIX 2 - {check_name}", "FAIL", f"Pattern not found: {pattern}")
                failed += 1
        
        return passed, failed
        
    except Exception as e:
        log_test("FIX 2 - Code Review", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_auto_normalization():
    """Test auto-normalization logic when nameserverType !== 'cloudflare' but cfZoneId exists"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Check for auto-normalization logic in viewDNSRecords
        checks = [
            ("Normalization condition check", "if (meta.nameserverType !== 'cloudflare' && db)" in content),
            ("Normalization log message", "normalizing to 'cloudflare'" in content),
            ("domainsOf normalization", "await db.collection('domainsOf').updateOne({ domainName }, { $set: { nameserverType: 'cloudflare' } }, { upsert: false })" in content),
            ("registeredDomains normalization", "await db.collection('registeredDomains').updateOne({ _id: domainName }, { $set: { 'val.nameserverType': 'cloudflare' } }, { upsert: false })" in content)
        ]
        
        passed = 0
        failed = 0
        
        for check_name, condition in checks:
            if condition:
                log_test(f"Auto-normalization - {check_name}", "PASS")
                passed += 1
            else:
                log_test(f"Auto-normalization - {check_name}", "FAIL")
                failed += 1
        
        return passed, failed
        
    except Exception as e:
        log_test("Auto-normalization - Code Review", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_no_old_patterns():
    """Test that no old CF routing patterns remain"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Search for old patterns that should have been replaced
        old_patterns = [
            "nameserverType === 'cloudflare' && meta?.cfZoneId",
            "nameserverType === 'cloudflare' && cfZoneId",
            "meta.nameserverType === 'cloudflare' && meta.cfZoneId"
        ]
        
        found_old_patterns = []
        for pattern in old_patterns:
            if pattern in content:
                found_old_patterns.append(pattern)
        
        if found_old_patterns:
            log_test("No old CF routing patterns", "FAIL", f"Found old patterns: {found_old_patterns}")
            return 0, 1
        else:
            log_test("No old CF routing patterns", "PASS", "All old patterns successfully replaced")
            return 1, 0
        
    except Exception as e:
        log_test("Old patterns check", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_checkdns_conflict_cfzoneid():
    """Test that checkDNSConflict uses meta?.cfZoneId directly (should remain unchanged)"""
    domain_service_path = "/app/js/domain-service.js"
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # checkDNSConflict should use meta?.cfZoneId directly
        if "if (!meta?.cfZoneId) return { hasConflict: false }" in content:
            log_test("checkDNSConflict cfZoneId usage", "PASS", "Uses meta?.cfZoneId directly as expected")
            return 1, 0
        else:
            log_test("checkDNSConflict cfZoneId usage", "FAIL", "checkDNSConflict pattern not found")
            return 0, 1
        
    except Exception as e:
        log_test("checkDNSConflict check", "FAIL", f"Error reading file: {e}")
        return 0, 1

def test_supervisor_service():
    """Test supervisor status for nodejs service"""
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

def run_comprehensive_dns_routing_test():
    """Run all DNS routing fix tests and provide summary"""
    print("🧪 COMPREHENSIVE DNS ROUTING FIXES TESTING")
    print("=" * 60)
    print("Testing two specific fixes:")
    print("FIX 1: viewDNSRecords auto-create zone updates BOTH collections")
    print("FIX 2: cfZoneId-based CF routing for external/non-standard nameserverType")
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
    
    # Test 2: FIX 1 - viewDNSRecords both collections update
    print("\n🔧 FIX 1: viewDNSRecords Auto-Create Zone Updates BOTH Collections")
    print("-" * 60)
    
    fix1_passed, fix1_failed = test_fix1_viewdns_both_collections()
    total_passed += fix1_passed
    total_failed += fix1_failed
    
    # Test 3: FIX 2 - cfZoneId-based CF routing
    print("\n🔧 FIX 2: cfZoneId-based CF Routing Pattern")
    print("-" * 50)
    
    fix2_passed, fix2_failed = test_fix2_cfzoneid_routing()
    total_passed += fix2_passed
    total_failed += fix2_failed
    
    # Test 4: Auto-normalization
    print("\n🔄 AUTO-NORMALIZATION LOGIC")
    print("-" * 30)
    
    norm_passed, norm_failed = test_auto_normalization()
    total_passed += norm_passed
    total_failed += norm_failed
    
    # Test 5: No old patterns remain
    print("\n🧹 OLD PATTERNS CLEANUP")
    print("-" * 25)
    
    cleanup_passed, cleanup_failed = test_no_old_patterns()
    total_passed += cleanup_passed
    total_failed += cleanup_failed
    
    # Test 6: checkDNSConflict unchanged
    print("\n✅ UNCHANGED FUNCTIONS")
    print("-" * 20)
    
    unchanged_passed, unchanged_failed = test_checkdns_conflict_cfzoneid()
    total_passed += unchanged_passed
    total_failed += unchanged_failed
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 DNS ROUTING FIXES TEST SUMMARY")
    print("=" * 60)
    success_rate = (total_passed / (total_passed + total_failed)) * 100 if (total_passed + total_failed) > 0 else 0
    
    print(f"✅ PASSED: {total_passed}")
    print(f"❌ FAILED: {total_failed}")
    print(f"📈 SUCCESS RATE: {success_rate:.1f}%")
    
    if total_failed == 0:
        print("\n🎉 ALL TESTS PASSED - BOTH DNS ROUTING FIXES ARE CORRECTLY IMPLEMENTED")
        print("\n📋 VERIFICATION SUMMARY:")
        print("✅ FIX 1: viewDNSRecords auto-create zone updates BOTH registeredDomains AND domainsOf collections")
        print("✅ FIX 2: All CF routing checks now use (nameserverType === 'cloudflare' || cfZoneId) && cfZoneId pattern")
        print("✅ Auto-normalization when nameserverType !== 'cloudflare' but cfZoneId exists")
        print("✅ No old CF routing patterns remain")
        print("✅ Node.js service running cleanly")
        return True
    elif success_rate >= 80:
        print(f"\n⚠️  MOSTLY WORKING - {total_failed} issue(s) need attention")
        return False
    else:
        print(f"\n❌ SIGNIFICANT ISSUES - {total_failed} critical problems found")
        return False

if __name__ == "__main__":
    success = run_comprehensive_dns_routing_test()
    sys.exit(0 if success else 1)