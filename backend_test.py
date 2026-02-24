#!/usr/bin/env python3
"""
Backend Test Suite for Hosting SSL Provisioning Fixes
Tests 5 specific changes for preventing 526 SSL errors
"""

import json
import re
import subprocess
import sys
from pathlib import Path

def run_test(test_name, test_func):
    """Run a test and return results"""
    try:
        result = test_func()
        if result:
            print(f"✅ {test_name}: PASSED")
            return True
        else:
            print(f"❌ {test_name}: FAILED")
            return False
    except Exception as e:
        print(f"❌ {test_name}: ERROR - {str(e)}")
        return False

def test_node_js_health():
    """Test 1: Verify Node.js is running on port 5000"""
    result = subprocess.run(['curl', '-s', 'http://127.0.0.1:5000/health'], 
                          capture_output=True, text=True, timeout=10)
    if result.returncode == 0:
        try:
            health_data = json.loads(result.stdout)
            return health_data.get('status') == 'healthy'
        except json.JSONDecodeError:
            return False
    return False

def test_protection_enforcer_self_signed_check():
    """Test 2: protection-enforcer.js self-signed check fix (line ~289)"""
    file_path = Path('/app/js/protection-enforcer.js')
    if not file_path.exists():
        return False
    
    content = file_path.read_text()
    
    # Check for the correct self-signed detection logic
    # Must use != 0 (loose inequality) to handle string '1', number 1, and boolean true
    self_signed_pattern = r'const isSelfSigned = .*?domainVhost\.crt\?\.is_self_signed.*?!= 0'
    if not re.search(self_signed_pattern, content, re.DOTALL):
        print("❌ Self-signed check pattern not found")
        return False
    
    # Check that SSL upgrade condition includes !isSelfSigned
    upgrade_condition_pattern = r'if \(hasRoot && hasWww && !isSelfSigned\)'
    if not re.search(upgrade_condition_pattern, content):
        print("❌ SSL upgrade condition with !isSelfSigned not found")
        return False
    
    # Check that there's an AutoSSL trigger branch for self-signed certs
    autossl_branch_pattern = r'else if \(hasRoot && hasWww && isSelfSigned\)'
    if not re.search(autossl_branch_pattern, content):
        print("❌ AutoSSL trigger branch for self-signed certs not found")
        return False
    
    # Check that triggerAutoSSLFix function is called for self-signed certs
    trigger_autossl_pattern = r'triggerAutoSSLFix\('
    if not re.search(trigger_autossl_pattern, content):
        print("❌ triggerAutoSSLFix function call not found")
        return False
    
    return True

def test_cf_service_create_hosting_dns_records():
    """Test 3: cf-service.js createHostingDNSRecords parameter fix (line ~253)"""
    file_path = Path('/app/js/cf-service.js')
    if not file_path.exists():
        return False
    
    content = file_path.read_text()
    
    # Check function signature with new proxied parameter
    create_hosting_pattern = r'createHostingDNSRecords\s*=\s*async\s*\(\s*zoneId,\s*domainName,\s*serverIP,\s*proxied\s*=\s*true\s*\)'
    if not re.search(create_hosting_pattern, content):
        print("❌ createHostingDNSRecords function signature with proxied parameter not found")
        return False
    
    # Check that root A and www A records use the proxied parameter
    root_record_pattern = r'createDNSRecord\(zoneId,\s*[\'"]A[\'"],\s*domainName,\s*serverIP,.*?proxied\s*\?\s*1\s*:\s*300,\s*proxied\)'
    if not re.search(root_record_pattern, content):
        print("❌ Root A record using proxied parameter not found")
        return False
    
    www_record_pattern = r'createDNSRecord\(zoneId,\s*[\'"]A[\'"],\s*`www\.\${domainName}\`,\s*serverIP,.*?proxied\s*\?\s*1\s*:\s*300,\s*proxied\)'
    if not re.search(www_record_pattern, content):
        print("❌ WWW A record using proxied parameter not found")
        return False
    
    # Check that mail/cpanel/webmail/webdisk records are always proxied: false
    mail_record_pattern = r'createDNSRecord\(zoneId,\s*[\'"]A[\'"],\s*`mail\.\${domainName}\`,\s*serverIP,\s*300,\s*false\)'
    if not re.search(mail_record_pattern, content):
        print("❌ Mail A record with proxied: false not found")
        return False
    
    return True

def test_cf_service_proxy_hosting_dns_records():
    """Test 4: cf-service.js proxyHostingDNSRecords NEW function"""
    file_path = Path('/app/js/cf-service.js')
    if not file_path.exists():
        return False
    
    content = file_path.read_text()
    
    # Check that proxyHostingDNSRecords function exists
    proxy_function_pattern = r'const proxyHostingDNSRecords\s*=\s*async\s*\(\s*zoneId,\s*domainName\s*\)'
    if not re.search(proxy_function_pattern, content):
        print("❌ proxyHostingDNSRecords function definition not found")
        return False
    
    # Check that it finds DNS-only records and patches them to proxied: true
    find_dns_only_pattern = r'records\.filter\(.*?!r\.proxied.*?\)'
    if not re.search(find_dns_only_pattern, content, re.DOTALL):
        print("❌ DNS-only record filtering not found")
        return False
    
    # Check that it returns { proxied: count }
    return_pattern = r'return\s*\{\s*proxied:\s*.*?\.length\s*\}'
    if not re.search(return_pattern, content):
        print("❌ Return statement with proxied count not found")
        return False
    
    # Check that function is exported
    if 'proxyHostingDNSRecords' not in content[content.find('module.exports'):]:
        print("❌ proxyHostingDNSRecords not exported")
        return False
    
    return True

def test_cr_register_domain_cpanel_provisioning():
    """Test 5: cr-register-domain-&-create-cpanel.js provisioning flow"""
    file_path = Path('/app/js/cr-register-domain-&-create-cpanel.js')
    if not file_path.exists():
        return False
    
    content = file_path.read_text()
    
    # Check that createHostingDNSRecords is called with proxied=false (DNS-only for AutoSSL)
    dns_only_pattern = r'createHostingDNSRecords\(cfZoneId,\s*domain,\s*WHM_HOST,\s*false\)'
    if not re.search(dns_only_pattern, content):
        print("❌ createHostingDNSRecords call with proxied=false not found")
        return False
    
    # Check for comment mentioning DNS-only for AutoSSL
    dns_comment_pattern = r'DNS.*only.*AutoSSL|AutoSSL.*DNS.*only'
    if not re.search(dns_comment_pattern, content, re.IGNORECASE):
        print("❌ Comment about DNS-only for AutoSSL not found")
        return False
    
    # Check that AutoSSL is triggered after DNS creation
    autossl_trigger_pattern = r'startAutoSSL\(.*?username\)'
    if not re.search(autossl_trigger_pattern, content):
        print("❌ AutoSSL trigger call not found")
        return False
    
    # Check for background async that calls proxyHostingDNSRecords after delay
    background_proxy_pattern = r'setTimeout\(.*?120000.*?\).*?proxyHostingDNSRecords'
    if not re.search(background_proxy_pattern, content, re.DOTALL):
        print("❌ Background proxy call after 120s delay not found")
        return False
    
    return True

def test_backend_api_endpoints():
    """Test 6: Verify key backend API endpoints are accessible"""
    backend_url = "https://readme-config-deploy.preview.emergentagent.com"
    
    # Test health endpoint
    result = subprocess.run(['curl', '-s', f'{backend_url}/api/health'], 
                          capture_output=True, text=True, timeout=10)
    if result.returncode != 0:
        return False
        
    try:
        health_data = json.loads(result.stdout)
        if health_data.get('status') != 'healthy':
            return False
    except json.JSONDecodeError:
        return False
    
    return True

def main():
    """Run all SSL provisioning tests"""
    print("🧪 Testing Hosting SSL Provisioning Fixes")
    print("=" * 50)
    
    tests = [
        ("Node.js Health Check (Port 5000)", test_node_js_health),
        ("Protection Enforcer Self-Signed Check Fix", test_protection_enforcer_self_signed_check),
        ("CF Service createHostingDNSRecords Parameter", test_cf_service_create_hosting_dns_records),
        ("CF Service proxyHostingDNSRecords Function", test_cf_service_proxy_hosting_dns_records),
        ("CR Register Domain Provisioning Flow", test_cr_register_domain_cpanel_provisioning),
        ("Backend API Endpoints", test_backend_api_endpoints),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        if run_test(test_name, test_func):
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All SSL provisioning fixes verified successfully!")
        return True
    else:
        print("⚠️  Some SSL provisioning fixes need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)