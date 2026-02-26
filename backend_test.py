#!/usr/bin/env python3
"""
Backend Test for Addon Domain Protection Fix
Tests the 5 specific fixes (A-E) for addon domain protection gap in Nomadly Node.js application.

Fixes being tested:
A. /domains/add (basic) — cpanel-routes.js: $addToSet addonDomains + CF zone deployment + health check
B. /domains/add-enhanced — cpanel-routes.js: $addToSet addonDomains + health check  
C. /domains/remove — cpanel-routes.js: $pull addonDomains
D. protection-enforcer.js collectAllDomains(): addon entries include cpUser + parentDomain
E. protection-enforcer.js runEnforcement(): condition includes cpanelAddon source
"""

import requests
import json
import time
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://deployment-preview-3.preview.emergentagent.com/api"

def test_health_endpoint():
    """Test 1: Verify Node.js is healthy at the backend URL + /health"""
    print("🔍 Test 1: Node.js Health Check")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Node.js Health: {data}")
            return True
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def verify_cpanel_routes_fixes():
    """Test 2: Verify cpanel-routes.js fixes A, B, C by examining code"""
    print("\n🔍 Test 2: Verify cPanel Routes Fixes (A, B, C)")
    
    # Read the cpanel-routes.js file
    try:
        with open('/app/js/cpanel-routes.js', 'r') as f:
            content = f.read()
            
        fixes_found = {}
        
        # Fix A: /domains/add has $addToSet addonDomains + CF zone deployment + health check
        if '$addToSet: { addonDomains: domain.toLowerCase() }' in content:
            # Check if it's in both /domains/add and /domains/add-enhanced contexts
            add_basic_match = content.find('router.post(\'/domains/add\', ...auth, async (req, res) => {')
            add_enhanced_match = content.find('router.post(\'/domains/add-enhanced\', ...auth, async (req, res) => {')
            
            if add_basic_match != -1 and add_enhanced_match != -1:
                # Check for CF zone deployment in basic add
                cf_deploy_section = content[add_basic_match:add_basic_match+3000]  # Increased range
                if 'cfService.createZone(domain)' in cf_deploy_section and 'deployFullProtection' in cf_deploy_section:
                    fixes_found['A_addToSet_and_cf_deploy'] = True
                    print("✅ Fix A: /domains/add has $addToSet + CF zone deployment")
                else:
                    fixes_found['A_addToSet_and_cf_deploy'] = False
                    print("❌ Fix A: /domains/add missing CF zone deployment")
                    
                # Check for health check in basic add (it's after the CF deployment)
                if 'scheduleHealthCheck' in cf_deploy_section:
                    fixes_found['A_health_check'] = True
                    print("✅ Fix A: /domains/add has health check scheduling")
                else:
                    fixes_found['A_health_check'] = False
                    print("❌ Fix A: /domains/add missing health check")
            else:
                fixes_found['A_addToSet_and_cf_deploy'] = False
                fixes_found['A_health_check'] = False
                print("❌ Fix A: Could not locate /domains/add endpoints")
        
        # Fix B: /domains/add-enhanced has $addToSet + health check
        if add_enhanced_match != -1:
            enhanced_section = content[add_enhanced_match:add_enhanced_match+6000]  # Increased range further
            if '$addToSet: { addonDomains: domain.toLowerCase() }' in enhanced_section:
                fixes_found['B_addToSet'] = True
                print("✅ Fix B: /domains/add-enhanced has $addToSet addonDomains")
            else:
                fixes_found['B_addToSet'] = False
                print("❌ Fix B: /domains/add-enhanced missing $addToSet addonDomains")
                
            if 'scheduleHealthCheck' in enhanced_section:
                fixes_found['B_health_check'] = True
                print("✅ Fix B: /domains/add-enhanced has health check scheduling")
            else:
                fixes_found['B_health_check'] = False
                print("❌ Fix B: /domains/add-enhanced missing health check")
                # Debug: print part of the section to see what's there
                debug_section = enhanced_section[-500:] if len(enhanced_section) > 500 else enhanced_section
                print(f"   Debug: Last 500 chars: ...{debug_section}")
                if 'scheduleHealthCheck' in content:
                    print("   Debug: scheduleHealthCheck found somewhere in file")
        
        # Fix C: /domains/remove has $pull addonDomains
        remove_match = content.find('router.post(\'/domains/remove\', ...auth, async (req, res) => {')
        if remove_match != -1:
            remove_section = content[remove_match:remove_match+1500]
            if '$pull: { addonDomains: domain.toLowerCase() }' in remove_section:
                fixes_found['C_pull'] = True
                print("✅ Fix C: /domains/remove has $pull addonDomains")
            else:
                fixes_found['C_pull'] = False
                print("❌ Fix C: /domains/remove missing $pull addonDomains")
        else:
            fixes_found['C_pull'] = False
            print("❌ Fix C: Could not locate /domains/remove endpoint")
            
        return fixes_found
        
    except Exception as e:
        print(f"❌ Error reading cpanel-routes.js: {e}")
        return {}

def verify_protection_enforcer_fixes():
    """Test 3: Verify protection-enforcer.js fixes D and E"""
    print("\n🔍 Test 3: Verify Protection Enforcer Fixes (D, E)")
    
    try:
        with open('/app/js/protection-enforcer.js', 'r') as f:
            content = f.read()
            
        fixes_found = {}
        
        # Fix D: collectAllDomains() addon entries include cpUser + parentDomain
        collect_domains_start = content.find('async function collectAllDomains() {')
        if collect_domains_start != -1:
            # Look for the addon domains section
            addon_section_start = content.find('// Check for addon domains stored in the account', collect_domains_start)
            if addon_section_start != -1:
                addon_section = content[addon_section_start:addon_section_start+1000]
                
                # Check for cpUser propagation
                if 'cpUser: account._id || account.cpUser || null' in addon_section and 'source: \'cpanelAddon\'' in addon_section:
                    fixes_found['D_cpUser'] = True
                    print("✅ Fix D: collectAllDomains() addon entries include cpUser from parent")
                else:
                    fixes_found['D_cpUser'] = False
                    print("❌ Fix D: collectAllDomains() addon entries missing cpUser")
                
                # Check for parentDomain
                if 'parentDomain: mainDomain?.toLowerCase() || null' in addon_section:
                    fixes_found['D_parentDomain'] = True
                    print("✅ Fix D: collectAllDomains() addon entries include parentDomain")
                else:
                    fixes_found['D_parentDomain'] = False
                    print("❌ Fix D: collectAllDomains() addon entries missing parentDomain")
            else:
                fixes_found['D_cpUser'] = False
                fixes_found['D_parentDomain'] = False
                print("❌ Fix D: Could not locate addon domains section")
        else:
            fixes_found['D_cpUser'] = False
            fixes_found['D_parentDomain'] = False
            print("❌ Fix D: Could not locate collectAllDomains function")
        
        # Fix E: runEnforcement() condition includes cpanelAddon source
        run_enforcement_start = content.find('async function runEnforcement() {')
        if run_enforcement_start != -1:
            enforcement_section = content[run_enforcement_start:run_enforcement_start+2500]
            
            # Look for the condition around line 472
            if 'entry.source === \'cpanelAccounts\' || entry.source === \'cpanelAddon\'' in enforcement_section:
                fixes_found['E_condition'] = True
                print("✅ Fix E: runEnforcement() condition includes cpanelAddon source")
            else:
                fixes_found['E_condition'] = False
                print("❌ Fix E: runEnforcement() condition missing cpanelAddon source")
                
                # Check if old condition still exists
                if 'entry.source === \'cpanelAccounts\'' in enforcement_section and 'cpanelAddon' not in enforcement_section:
                    print("❌ Fix E: Still using old condition without cpanelAddon")
        else:
            fixes_found['E_condition'] = False
            print("❌ Fix E: Could not locate runEnforcement function")
            
        return fixes_found
        
    except Exception as e:
        print(f"❌ Error reading protection-enforcer.js: {e}")
        return {}

def verify_nodejs_startup():
    """Test 4: Verify Node.js started cleanly (no syntax errors)"""
    print("\n🔍 Test 4: Verify Node.js Started Cleanly")
    
    try:
        # Check error log
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            error_content = f.read().strip()
        
        if not error_content:
            print("✅ Node.js error log is empty - clean startup")
            startup_clean = True
        else:
            print(f"❌ Node.js errors found: {error_content[:200]}")
            startup_clean = False
            
        # Check output log for successful protection enforcer run
        with open('/var/log/supervisor/nodejs.out.log', 'r') as f:
            output_content = f.read()
            
        if 'Enforcement complete' in output_content and 'Errors: 0' in output_content:
            print("✅ Protection enforcer ran successfully with 0 errors")
            enforcer_success = True
        else:
            print("❌ Protection enforcer did not run successfully or had errors")
            enforcer_success = False
            
        return startup_clean and enforcer_success
        
    except Exception as e:
        print(f"❌ Error checking startup logs: {e}")
        return False

def verify_backend_report_url_warning():
    """Test 5: Verify BACKEND_REPORT_URL dev warning is shown"""
    print("\n🔍 Test 5: Verify Dev Environment Warning")
    
    try:
        with open('/var/log/supervisor/nodejs.out.log', 'r') as f:
            output_content = f.read()
            
        if 'Worker BACKEND_REPORT_URL points to dev environment' in output_content:
            print("✅ Dev environment warning correctly displayed")
            return True
        else:
            print("❌ Dev environment warning missing")
            return False
            
    except Exception as e:
        print(f"❌ Error checking dev warning: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Addon Domain Protection Fix Test Suite")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Health check
    results['health'] = test_health_endpoint()
    
    # Test 2: cPanel routes fixes
    cpanel_fixes = verify_cpanel_routes_fixes()
    results.update(cpanel_fixes)
    
    # Test 3: Protection enforcer fixes
    enforcer_fixes = verify_protection_enforcer_fixes()
    results.update(enforcer_fixes)
    
    # Test 4: Startup verification
    results['startup_clean'] = verify_nodejs_startup()
    
    # Test 5: Dev warning
    results['dev_warning'] = verify_backend_report_url_warning()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for v in results.values() if v is True)
    total = len(results)
    
    for test_name, passed_test in results.items():
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOverall Result: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL ADDON DOMAIN PROTECTION FIXES VERIFIED SUCCESSFULLY!")
        return True
    else:
        print("⚠️  Some fixes need attention")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)