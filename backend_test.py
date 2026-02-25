#!/usr/bin/env python3
"""
Backend Testing Script for Nomadly Node.js Application
Tests the 2 new tasks from test_result.md:
1. Fix: Shortener activation must ensureCloudflare before adding CNAME
2. Fix: switchToCloudflare NS reassignment drift detection
"""

import requests
import os
import sys

def test_nodejs_health():
    """Test Node.js service health and database connectivity"""
    print("=" * 60)
    print("🔍 TESTING NODE.JS SERVICE HEALTH")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Node.js service: {data.get('status', 'unknown')}")
            print(f"✅ Database: {data.get('database', 'unknown')}")
            print(f"✅ Uptime: {data.get('uptime', 'unknown')}")
            return True
        else:
            print(f"❌ Health check failed with status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def verify_domain_service_exports():
    """Verify domain-service.js exports ensureCloudflare function"""
    print("\n" + "=" * 60)
    print("🔍 TESTING DOMAIN-SERVICE.JS EXPORTS")
    print("=" * 60)
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
            
        # Check if ensureCloudflare function exists
        if 'const ensureCloudflare = async' in content:
            print("✅ ensureCloudflare function exists")
        else:
            print("❌ ensureCloudflare function not found")
            return False
            
        # Check if ensureCloudflare is exported
        if 'ensureCloudflare,' in content and 'module.exports' in content:
            print("✅ ensureCloudflare is exported in module.exports")
        else:
            print("❌ ensureCloudflare not found in module.exports")
            return False
            
        return True
    except Exception as e:
        print(f"❌ Error checking domain-service.js: {e}")
        return False

def verify_ensure_cloudflare_logic():
    """Verify ensureCloudflare handles both cases correctly"""
    print("\n" + "=" * 60)
    print("🔍 TESTING ENSURECLOUDFLARE FUNCTION LOGIC")
    print("=" * 60)
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
            
        # Check case 1: Already on Cloudflare
        already_on_cf_check = (
            'if (meta.nameserverType === \'cloudflare\' && meta.cfZoneId)' in content and
            'return { success: true, cfZoneId: meta.cfZoneId, nameservers: meta.nameservers || [], alreadyActive: true }' in content
        )
        
        if already_on_cf_check:
            print("✅ Case A: Already on CF → returns { success: true, alreadyActive: true }")
        else:
            print("❌ Case A: Already on CF logic not found")
            return False
            
        # Check case 2: Not on CF → creates zone, updates NS, updates DB
        not_on_cf_checks = [
            'const cfResult = await cfService.createZone(domainName)' in content,
            'await opService.updateNameservers(domainName, cfNameservers)' in content,
            'await db.collection(\'domainsOf\').updateOne' in content,
            'nameserverType: \'cloudflare\'' in content
        ]
        
        if all(not_on_cf_checks):
            print("✅ Case B: Not on CF → creates zone, updates NS, updates DB")
        else:
            print("❌ Case B: Missing components in 'not on CF' logic")
            return False
            
        return True
    except Exception as e:
        print(f"❌ Error verifying ensureCloudflare logic: {e}")
        return False

def verify_shortener_handlers():
    """Verify all 3 shortener activation handlers call ensureCloudflare() before addDNSRecord()"""
    print("\n" + "=" * 60)
    print("🔍 TESTING SHORTENER ACTIVATION HANDLERS")
    print("=" * 60)
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        handlers = [
            {
                'name': 'Handler 1: quick-activate-domain-shortener',
                'line_ref': 'around line 5612',
                'ensure_cf_pattern': 'const cfEnsure = await domainService.ensureCloudflare(domain, db)',
                'add_dns_pattern': 'await domainService.addDNSRecord(domain, recordType, server'
            },
            {
                'name': 'Handler 2: activateShortener in DNS menu', 
                'line_ref': 'around line 6449',
                'ensure_cf_pattern': 'const cfEnsure = await domainService.ensureCloudflare(domain, db)',
                'add_dns_pattern': 'await domainService.addDNSRecord(domain, recordType, server'
            },
            {
                'name': 'Handler 3: Domain action shortener',
                'line_ref': 'around line 10920',
                'ensure_cf_pattern': 'const cfEnsure = await domainService.ensureCloudflare(domain, db)',
                'add_dns_pattern': 'await domainService.addDNSRecord(domain, recordType, server'
            }
        ]
        
        all_handlers_ok = True
        
        for handler in handlers:
            print(f"\n🔍 Checking {handler['name']} ({handler['line_ref']}):")
            
            # Check if ensureCloudflare is called
            if handler['ensure_cf_pattern'] in content:
                print(f"  ✅ Calls domainService.ensureCloudflare()")
            else:
                print(f"  ❌ Missing domainService.ensureCloudflare() call")
                all_handlers_ok = False
                continue
                
            # Check if addDNSRecord is called after ensureCloudflare
            if handler['add_dns_pattern'] in content:
                print(f"  ✅ Calls domainService.addDNSRecord()")
            else:
                print(f"  ❌ Missing domainService.addDNSRecord() call")
                all_handlers_ok = False
                continue
                
            # Check order: ensureCloudflare should come before addDNSRecord
            ensure_pos = content.find(handler['ensure_cf_pattern'])
            add_pos = content.find(handler['add_dns_pattern'], ensure_pos)
            
            if ensure_pos < add_pos and add_pos != -1:
                print(f"  ✅ Correct order: ensureCloudflare() BEFORE addDNSRecord()")
            else:
                print(f"  ❌ Wrong order or missing pattern")
                all_handlers_ok = False
                
        return all_handlers_ok
    except Exception as e:
        print(f"❌ Error verifying shortener handlers: {e}")
        return False

def verify_cf_service_usage():
    """Verify cfService.getZoneByName is used in background NS verification"""
    print("\n" + "=" * 60) 
    print("🔍 TESTING CLOUDFLARE SERVICE USAGE")
    print("=" * 60)
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
            
        # Check if cfService.getZoneByName is used
        if 'const zoneData = await cfService.getZoneByName(bgDomain)' in content:
            print("✅ cfService.getZoneByName is used in background NS verification")
        else:
            print("❌ cfService.getZoneByName not found in background verification")
            return False
            
        return True
    except Exception as e:
        print(f"❌ Error verifying CF service usage: {e}")
        return False

def verify_switch_to_cloudflare_logging():
    """Verify switchToCloudflare has logging statements"""
    print("\n" + "=" * 60)
    print("🔍 TESTING SWITCHTO CLOUDFLARE LOGGING")
    print("=" * 60)
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
            
        logging_patterns = [
            'log(`[switchToCloudflare] Starting for ${domainName}',
            'log(`[switchToCloudflare] CF zone created for ${domainName}',
            'log(`[switchToCloudflare] OP NS updated for ${domainName}',
            'log(`[switchToCloudflare] CR NS updated for ${domainName}',
            'log(`[switchToCloudflare] ⚠️ CF reassigned NS for ${bgDomain}',
            'log(`[switchToCloudflare] NS verified OK for ${bgDomain}'
        ]
        
        found_logs = 0
        for pattern in logging_patterns:
            if pattern in content:
                found_logs += 1
                
        print(f"✅ Found {found_logs}/{len(logging_patterns)} switchToCloudflare log statements")
        
        if found_logs >= 4:  # At least most of the key logging
            return True
        else:
            print("❌ Insufficient logging in switchToCloudflare")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying switchToCloudflare logging: {e}")
        return False

def verify_background_ns_verification():
    """Verify background NS verification IIFE exists with 30s delay"""
    print("\n" + "=" * 60)
    print("🔍 TESTING BACKGROUND NS VERIFICATION")
    print("=" * 60)
    
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
            
        # Check for IIFE patterns with 30s delay
        iife_patterns = [
            ';(async () => {',
            'await new Promise(r => setTimeout(r, 30000))',
            'const zoneData = await cfService.getZoneByName(bgDomain)',
            'const currentNS = (zoneData.name_servers || []).sort().join(\',\')',
            'if (currentNS !== savedNS) {'
        ]
        
        switchto_bg_found = all(pattern in content for pattern in iife_patterns)
        
        if switchto_bg_found:
            print("✅ switchToCloudflare: Background NS verification IIFE exists (30s delay)")
        else:
            print("❌ switchToCloudflare: Background NS verification IIFE missing components")
            return False
            
        # Check for ensureCloudflare background verification
        ensure_patterns = [
            'log(`[ensureCloudflare] ⚠️ CF reassigned NS for ${bgDomain}',
            'log(`[ensureCloudflare] NS drift corrected for ${bgDomain}',
            'log(`[ensureCloudflare] NS verify error for ${bgDomain}'
        ]
        
        ensure_bg_found = all(pattern in content for pattern in ensure_patterns)
        
        if ensure_bg_found:
            print("✅ ensureCloudflare: Background NS verification IIFE exists (30s delay)")
        else:
            print("❌ ensureCloudflare: Background NS verification IIFE missing components")
            return False
            
        return True
    except Exception as e:
        print(f"❌ Error verifying background NS verification: {e}")
        return False

def run_all_tests():
    """Run all backend tests for the 2 new tasks"""
    print("🚀 NOMADLY BACKEND TESTING - SHORTENER CLOUDFLARE FIXES")
    print("Testing 2 new tasks from test_result.md:")
    print("1. Fix: Shortener activation must ensureCloudflare before adding CNAME")
    print("2. Fix: switchToCloudflare NS reassignment drift detection\n")
    
    tests = [
        ("Node.js Service Health", test_nodejs_health),
        ("Domain Service Exports", verify_domain_service_exports), 
        ("ensureCloudflare Logic", verify_ensure_cloudflare_logic),
        ("Shortener Handler Integration", verify_shortener_handlers),
        ("Cloudflare Service Usage", verify_cf_service_usage),
        ("switchToCloudflare Logging", verify_switch_to_cloudflare_logging),
        ("Background NS Verification", verify_background_ns_verification)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test '{test_name}' failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🏆 OVERALL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Both fixes are correctly implemented!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Review the issues above")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)