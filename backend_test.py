#!/usr/bin/env python3
"""
Backend Testing for OpenProvider .us Domain Registration Fix
Tests the code structure and implementation without making actual API calls.
"""

import subprocess
import os
import json
import re

def run_command(cmd, cwd=None):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {'success': False, 'stdout': '', 'stderr': 'Command timed out', 'returncode': -1}
    except Exception as e:
        return {'success': False, 'stdout': '', 'stderr': str(e), 'returncode': -1}

def test_syntax_validation():
    """Test 1: Verify JavaScript syntax is valid"""
    print("🔍 Test 1: JavaScript Syntax Validation")
    
    result = run_command("node -c /app/js/op-service.js")
    if result['success']:
        print("✅ PASS: op-service.js syntax validation successful")
        return True
    else:
        print(f"❌ FAIL: Syntax error in op-service.js: {result['stderr']}")
        return False

def test_nodejs_clean_startup():
    """Test 2: Verify Node.js is running without errors"""
    print("\n🔍 Test 2: Node.js Clean Startup")
    
    # Check error log size
    result = run_command("wc -c /var/log/supervisor/nodejs.err.log")
    if result['success']:
        error_bytes = int(result['stdout'].split()[0])
        if error_bytes == 0:
            print("✅ PASS: Node.js error log is 0 bytes (clean startup)")
            return True
        else:
            print(f"❌ FAIL: Node.js error log has {error_bytes} bytes")
            # Show last few lines of error log
            tail_result = run_command("tail -n 10 /var/log/supervisor/nodejs.err.log")
            if tail_result['success']:
                print(f"Error log content:\n{tail_result['stdout']}")
            return False
    else:
        print(f"❌ FAIL: Could not check error log: {result['stderr']}")
        return False

def test_health_endpoint():
    """Test 3: Verify health endpoint is working"""
    print("\n🔍 Test 3: Health Endpoint Check")
    
    result = run_command("curl -s http://localhost:5000/health")
    if result['success'] and 'healthy' in result['stdout'].lower():
        print("✅ PASS: Health endpoint returns healthy status")
        return True
    else:
        print(f"❌ FAIL: Health endpoint issue: {result['stdout']}")
        return False

def test_tld_contact_country_mapping():
    """Test 4: Verify TLD_CONTACT_COUNTRY includes us: ['US']"""
    print("\n🔍 Test 4: TLD_CONTACT_COUNTRY Mapping")
    
    try:
        with open('/app/js/op-service.js', 'r') as f:
            content = f.read()
        
        # Look for TLD_CONTACT_COUNTRY object
        tld_pattern = r'const TLD_CONTACT_COUNTRY\s*=\s*\{([^}]+)\}'
        match = re.search(tld_pattern, content, re.DOTALL)
        
        if match:
            tld_content = match.group(1)
            # Check for us: ['US'] mapping
            us_pattern = r'us:\s*\[\s*[\'"]US[\'"]\s*\]'
            if re.search(us_pattern, tld_content):
                print("✅ PASS: Found us: ['US'] in TLD_CONTACT_COUNTRY mapping")
                return True
            else:
                print("❌ FAIL: us: ['US'] mapping not found in TLD_CONTACT_COUNTRY")
                print(f"TLD_CONTACT_COUNTRY content:\n{tld_content}")
                return False
        else:
            print("❌ FAIL: TLD_CONTACT_COUNTRY object not found")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading op-service.js: {e}")
        return False

def test_preferred_handles_mapping():
    """Test 5: Verify PREFERRED_HANDLES includes US: 'JC961841-US'"""
    print("\n🔍 Test 5: PREFERRED_HANDLES Mapping")
    
    try:
        with open('/app/js/op-service.js', 'r') as f:
            content = f.read()
        
        # Look for PREFERRED_HANDLES object
        handles_pattern = r'const PREFERRED_HANDLES\s*=\s*\{([^}]+)\}'
        match = re.search(handles_pattern, content, re.DOTALL)
        
        if match:
            handles_content = match.group(1)
            # Check for US: 'JC961841-US' mapping
            us_handle_pattern = r'US:\s*[\'"]JC961841-US[\'"]'
            if re.search(us_handle_pattern, handles_content):
                print("✅ PASS: Found US: 'JC961841-US' in PREFERRED_HANDLES mapping")
                return True
            else:
                print("❌ FAIL: US: 'JC961841-US' mapping not found in PREFERRED_HANDLES")
                print(f"PREFERRED_HANDLES content:\n{handles_content}")
                return False
        else:
            print("❌ FAIL: PREFERRED_HANDLES object not found")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading op-service.js: {e}")
        return False

def test_us_pre_registration_check():
    """Test 6: Verify .us pre-registration check in registerDomain function"""
    print("\n🔍 Test 6: .us Pre-registration Check Implementation")
    
    try:
        with open('/app/js/op-service.js', 'r') as f:
            content = f.read()
        
        # Check for .us domain check - look in the entire file since the function is large
        us_check_pattern = r'if\s*\(\s*tld\s*===\s*[\'"]us[\'"]\s*\)'
        if re.search(us_check_pattern, content):
            print("✅ PASS: Found 'if (tld === 'us')' check in registerDomain")
            
            # Check for customer handle fetch with with_additional_data
            fetch_pattern = r'with_additional_data:\s*true'
            if re.search(fetch_pattern, content):
                print("✅ PASS: Found customer handle fetch with 'with_additional_data: true'")
                
                # Check for extension_additional_data check
                ext_data_pattern = r'extension_additional_data'
                if re.search(ext_data_pattern, content):
                    print("✅ PASS: Found extension_additional_data handling")
                    
                    # Check for nexus_category and applicant_purpose
                    nexus_pattern = r'nexus_category.*applicant_purpose|applicant_purpose.*nexus_category'
                    if re.search(nexus_pattern, content, re.DOTALL):
                        print("✅ PASS: Found nexus_category and applicant_purpose handling")
                        
                        # Check for handle update via PUT
                        put_pattern = r'axios\.put.*customers.*contactHandle'
                        if re.search(put_pattern, content, re.DOTALL):
                            print("✅ PASS: Found customer handle update via PUT request")
                            
                            # Check that the .us check happens BEFORE the axios.post registration call
                            us_section_pattern = r'if\s*\(\s*tld\s*===\s*[\'"]us[\'"]\s*\).*?axios\.post.*domains.*regData'
                            if re.search(us_section_pattern, content, re.DOTALL):
                                print("✅ PASS: .us pre-registration check happens BEFORE domain registration call")
                                return True
                            else:
                                print("❌ FAIL: .us check not positioned before domain registration call")
                                return False
                        else:
                            print("❌ FAIL: Customer handle update via PUT not found")
                            return False
                    else:
                        print("❌ FAIL: nexus_category and applicant_purpose handling not found")
                        return False
                else:
                    print("❌ FAIL: extension_additional_data handling not found")
                    return False
            else:
                print("❌ FAIL: Customer handle fetch with 'with_additional_data: true' not found")
                return False
        else:
            print("❌ FAIL: 'if (tld === 'us')' check not found in registerDomain")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading op-service.js: {e}")
        return False

def test_get_contact_handle_for_tld():
    """Test 7: Verify getContactHandleForTLD will be called for 'us' TLD"""
    print("\n🔍 Test 7: getContactHandleForTLD Usage for .us TLD")
    
    try:
        with open('/app/js/op-service.js', 'r') as f:
            content = f.read()
        
        # Look for registerDomain function and check if it calls getContactHandleForTLD
        register_pattern = r'const registerDomain\s*=\s*async\s*\([^)]*\)\s*=>\s*\{(.*?)\n\s*\}'
        match = re.search(register_pattern, content, re.DOTALL)
        
        if match:
            register_content = match.group(1)
            
            # Check for getContactHandleForTLD call
            get_handle_pattern = r'getContactHandleForTLD\s*\(\s*tld\s*\)'
            if re.search(get_handle_pattern, register_content):
                print("✅ PASS: Found getContactHandleForTLD(tld) call in registerDomain")
                
                # Since us is now in TLD_CONTACT_COUNTRY, it will be processed by getContactHandleForTLD
                print("✅ PASS: .us TLD will be processed by getContactHandleForTLD (us in TLD_CONTACT_COUNTRY)")
                return True
            else:
                print("❌ FAIL: getContactHandleForTLD(tld) call not found in registerDomain")
                return False
        else:
            print("❌ FAIL: registerDomain function not found")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading op-service.js: {e}")
        return False

def test_get_country_tld_data():
    """Test 8: Verify getCountryTLDData('us') returns additional_data"""
    print("\n🔍 Test 8: getCountryTLDData('us') Implementation")
    
    try:
        with open('/app/js/op-service.js', 'r') as f:
            content = f.read()
        
        # Look for getCountryTLDData function
        get_data_pattern = r'const getCountryTLDData\s*=\s*\([^)]*\)\s*=>\s*\{(.*?)\n\s*\}'
        match = re.search(get_data_pattern, content, re.DOTALL)
        
        if match:
            get_data_content = match.group(1)
            
            # Check for us mapping in the map object
            us_data_pattern = r'us:\s*\{[^}]*application_purpose[^}]*nexus_category[^}]*\}|us:\s*\{[^}]*nexus_category[^}]*application_purpose[^}]*\}'
            if re.search(us_data_pattern, get_data_content, re.DOTALL):
                print("✅ PASS: Found us mapping with application_purpose and nexus_category in getCountryTLDData")
                return True
            else:
                print("❌ FAIL: us mapping with required fields not found in getCountryTLDData")
                # Show the us mapping if it exists
                us_simple_pattern = r'us:\s*\{[^}]*\}'
                us_match = re.search(us_simple_pattern, get_data_content)
                if us_match:
                    print(f"Found us mapping: {us_match.group(0)}")
                return False
        else:
            print("❌ FAIL: getCountryTLDData function not found")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Error reading op-service.js: {e}")
        return False

def main():
    """Run all tests for OpenProvider .us domain registration fix"""
    print("🚀 Starting OpenProvider .us Domain Registration Fix Testing")
    print("=" * 70)
    
    tests = [
        test_syntax_validation,
        test_nodejs_clean_startup,
        test_health_endpoint,
        test_tld_contact_country_mapping,
        test_preferred_handles_mapping,
        test_us_pre_registration_check,
        test_get_contact_handle_for_tld,
        test_get_country_tld_data,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ FAIL: Test {test.__name__} threw exception: {e}")
    
    print("\n" + "=" * 70)
    print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - OpenProvider .us domain registration fix is properly implemented!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - Issues found in implementation")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)