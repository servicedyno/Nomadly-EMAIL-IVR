#!/usr/bin/env python3
"""
DNS Management Fixes Testing
Tests two DNS management fixes in js/_index.js and js/op-service.js
"""

import subprocess
import sys
import re
import requests
import json

def run_command(cmd):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"

def test_syntax_validation():
    """Test 1 & 2: Syntax validation for both files"""
    print("🔍 Testing syntax validation...")
    
    # Test _index.js syntax
    code, stdout, stderr = run_command("node -c /app/js/_index.js")
    if code != 0:
        print(f"❌ _index.js syntax validation failed: {stderr}")
        return False
    print("✅ _index.js syntax validation passed")
    
    # Test op-service.js syntax
    code, stdout, stderr = run_command("node -c /app/js/op-service.js")
    if code != 0:
        print(f"❌ op-service.js syntax validation failed: {stderr}")
        return False
    print("✅ op-service.js syntax validation passed")
    
    return True

def test_health_endpoint():
    """Test 3: Health endpoint check"""
    print("🔍 Testing health endpoint...")
    
    try:
        response = requests.get("https://readme-setup-12.preview.emergentagent.com/api/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print(f"✅ Health endpoint healthy: {data}")
                return True
            else:
                print(f"❌ Health endpoint unhealthy: {data}")
                return False
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
        return False

def test_error_log():
    """Test 4: Error log should be 0 bytes"""
    print("🔍 Testing error log size...")
    
    code, stdout, stderr = run_command("wc -c /var/log/supervisor/nodejs.err.log")
    if code == 0:
        size = stdout.strip().split()[0]
        if size == "0":
            print("✅ Error log is 0 bytes (clean)")
            return True
        else:
            print(f"❌ Error log is {size} bytes (not clean)")
            return False
    else:
        print(f"❌ Failed to check error log: {stderr}")
        return False

def test_cname_url_rejection():
    """Test 5: Verify CNAME URL rejection in type-dns-record-data-to-update handler"""
    print("🔍 Testing CNAME URL rejection validation...")
    
    # Search for CNAME validation in the handler
    code, stdout, stderr = run_command("grep -A 10 -B 5 \"recordType === 'CNAME'\" /app/js/_index.js")
    if code != 0:
        print("❌ Could not find CNAME validation code")
        return False
    
    # Check for URL rejection (contains :// or /)
    if "recordContent.includes('://')" in stdout and "recordContent.includes('/')" in stdout:
        print("✅ Found CNAME URL rejection validation (checks for :// and /)")
        return True
    else:
        print("❌ CNAME URL rejection validation not found")
        return False

def test_cname_self_reference_rejection():
    """Test 6: Verify CNAME self-reference rejection"""
    print("🔍 Testing CNAME self-reference rejection...")
    
    # Search for self-reference check
    code, stdout, stderr = run_command("grep -A 5 -B 5 \"baseDomain\" /app/js/_index.js")
    if code != 0:
        print("❌ Could not find baseDomain comparison code")
        return False
    
    # Check for self-reference comparison
    if "baseDomain.toLowerCase()" in stdout and "recordContent" in stdout:
        print("✅ Found CNAME self-reference rejection (compares recordContent to baseDomain)")
        return True
    else:
        print("❌ CNAME self-reference rejection not found")
        return False

def test_extract_dns_error_helper():
    """Test 7: Verify _extractDnsError helper function exists and checks result.errors array"""
    print("🔍 Testing _extractDnsError helper function...")
    
    # Search for the helper function
    code, stdout, stderr = run_command("grep -A 10 \"_extractDnsError\" /app/js/_index.js")
    if code != 0:
        print("❌ _extractDnsError helper function not found")
        return False
    
    # Check if it handles result.errors array (CF format)
    if "result.errors" in stdout and "result.errors.length" in stdout:
        print("✅ Found _extractDnsError helper that checks result.errors array (CF format)")
        return True
    else:
        print("❌ _extractDnsError helper does not check result.errors array")
        return False

def test_extract_dns_error_usage():
    """Test 8: Verify _extractDnsError is used in BOTH CF and OP paths"""
    print("🔍 Testing _extractDnsError usage in both CF and OP paths...")
    
    # Search for specific usage pattern
    code, stdout, stderr = run_command("grep -n \"sanitizeProviderError(_extractDnsError(result)\" /app/js/_index.js")
    if code != 0:
        print("❌ _extractDnsError usage pattern not found")
        return False
    
    # Check if we have exactly 2 usages (CF and OP paths)
    lines = stdout.strip().split('\n')
    if len(lines) >= 2:
        print(f"✅ _extractDnsError is used in BOTH CF and OP paths (found {len(lines)} usages)")
        for line in lines:
            print(f"   - Line {line.split(':')[0]}: {line.split(':', 1)[1].strip()}")
        return True
    else:
        print(f"❌ _extractDnsError found only {len(lines)} usage(s), expected 2")
        return False

def test_op_timeout_and_retry():
    """Test 9: Verify OP updateNameservers has 30000ms timeout and retry with 45000ms"""
    print("🔍 Testing OP updateNameservers timeout and retry logic...")
    
    # Search for timeout values in updateNameservers function
    code, stdout, stderr = run_command("grep -A 20 -B 5 \"updateNameservers.*async\" /app/js/op-service.js")
    if code != 0:
        print("❌ Could not find updateNameservers function")
        return False
    
    # Check for 30000ms timeout
    if "timeout: 30000" in stdout:
        print("✅ Found 30000ms timeout (increased from 15000ms)")
        timeout_found = True
    else:
        print("❌ 30000ms timeout not found")
        timeout_found = False
    
    # Check for retry logic with 45000ms
    code, stdout, stderr = run_command("grep -A 10 -B 5 \"timeout.*45000\" /app/js/op-service.js")
    if code == 0 and "45000" in stdout:
        print("✅ Found retry logic with 45000ms timeout")
        retry_found = True
    else:
        print("❌ Retry logic with 45000ms timeout not found")
        retry_found = False
    
    # Check for timeout error handling
    code, stdout, stderr = run_command("grep -A 5 -B 5 \"ECONNABORTED\\|ETIMEDOUT\" /app/js/op-service.js")
    if code == 0:
        print("✅ Found timeout error handling (ECONNABORTED/ETIMEDOUT)")
        error_handling_found = True
    else:
        print("❌ Timeout error handling not found")
        error_handling_found = False
    
    return timeout_found and retry_found and error_handling_found

def test_multilingual_cname_errors():
    """Test 10: Verify multilingual CNAME error messages exist (en/fr/zh/hi)"""
    print("🔍 Testing multilingual CNAME error messages...")
    
    # Search for multilingual error messages
    code, stdout, stderr = run_command("grep -A 10 -B 5 \"CNAME value must be\" /app/js/_index.js")
    if code != 0:
        print("❌ Could not find CNAME error messages")
        return False
    
    # Check for all 4 languages
    languages = ['en:', 'fr:', 'zh:', 'hi:']
    found_languages = []
    
    for lang in languages:
        if lang in stdout:
            found_languages.append(lang.rstrip(':'))
    
    if len(found_languages) == 4:
        print(f"✅ Found CNAME error messages in all 4 languages: {found_languages}")
        
        # Check for self-reference error messages too
        code, stdout, stderr = run_command("grep -A 10 -B 5 \"CNAME cannot point to itself\" /app/js/_index.js")
        if code == 0:
            self_ref_languages = []
            for lang in languages:
                if lang in stdout:
                    self_ref_languages.append(lang.rstrip(':'))
            
            if len(self_ref_languages) == 4:
                print(f"✅ Found CNAME self-reference error messages in all 4 languages: {self_ref_languages}")
                return True
            else:
                print(f"❌ CNAME self-reference error messages only found in: {self_ref_languages}")
                return False
        else:
            print("❌ CNAME self-reference error messages not found")
            return False
    else:
        print(f"❌ CNAME error messages only found in: {found_languages}")
        return False

def main():
    """Run all DNS management fix tests"""
    print("🚀 Starting DNS Management Fixes Testing")
    print("=" * 60)
    
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Health Endpoint", test_health_endpoint), 
        ("Error Log Check", test_error_log),
        ("CNAME URL Rejection", test_cname_url_rejection),
        ("CNAME Self-Reference Rejection", test_cname_self_reference_rejection),
        ("_extractDnsError Helper", test_extract_dns_error_helper),
        ("_extractDnsError Usage", test_extract_dns_error_usage),
        ("OP Timeout & Retry", test_op_timeout_and_retry),
        ("Multilingual CNAME Errors", test_multilingual_cname_errors),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 40)
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} FAILED")
        except Exception as e:
            print(f"❌ {test_name} ERROR: {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 SUMMARY: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL DNS MANAGEMENT FIXES VERIFIED SUCCESSFULLY!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)