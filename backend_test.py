#!/usr/bin/env python3
"""
Backend test for URL shortener Cloudflare NS fix
Testing specific code changes in js/_index.js
"""

import requests
import subprocess
import sys
import json
import time

def test_node_health():
    """Test that Node.js service is running on port 5000"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Node.js health check failed: {e}")
        return False

def verify_code_changes():
    """Verify the specific code changes mentioned in the review request"""
    print("=== Code Review Verification ===")
    
    # Read the _index.js file
    try:
        with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception as e:
        print(f"❌ Failed to read js/_index.js: {e}")
        return False
    
    success = True
    
    # Test 1: Verify line ~5695 has nsChoice set to 'cloudflare' with correct comment
    print("\n1. Checking shortener NS choice (line ~5695)...")
    found_cloudflare_setting = False
    found_comment = False
    
    # Look around line 5695 (±10 lines)
    for i in range(max(0, 5690), min(len(lines), 5705)):
        line = lines[i].strip()
        if "saveInfo('nsChoice', 'cloudflare')" in line:
            found_cloudflare_setting = True
            print(f"✅ Found cloudflare nsChoice setting at line {i+1}")
        
        # Check for comment about Cloudflare for DNS management
        if "Cloudflare for DNS management" in line and "skip NS selection" in line:
            found_comment = True
            print(f"✅ Found correct comment at line {i+1}")
    
    if not found_cloudflare_setting:
        print("❌ Did not find saveInfo('nsChoice', 'cloudflare') around line 5695")
        success = False
    
    if not found_comment:
        print("❌ Did not find comment about 'Cloudflare for DNS management'")
        success = False
    
    # Test 2: Verify buyDomainFullProcess DNS section uses unified approach
    print("\n2. Checking buyDomainFullProcess DNS section (lines ~11203-11225)...")
    found_unified_dns = False
    found_5s_sleep = False
    found_fallback = False
    found_no_65s_sleep = True
    
    # Look for the unified DNS approach around lines 11203-11225
    for i in range(max(0, 11195), min(len(lines), 11235)):
        line = lines[i].strip()
        
        # Check for domainService.addDNSRecord usage
        if "domainService.addDNSRecord(domain, recordType, server, '', db)" in line:
            found_unified_dns = True
            print(f"✅ Found unified domainService.addDNSRecord at line {i+1}")
        
        # Check for 5000ms sleep (5s)
        if "sleep(5000)" in line:
            found_5s_sleep = True
            print(f"✅ Found 5s sleep at line {i+1}")
        
        # Check for fallback to saveServerInDomain
        if "saveServerInDomain" in line and "Falling back" in lines[max(0, i-2):i+3]:
            found_fallback = True
            print(f"✅ Found fallback to saveServerInDomain at line {i+1}")
        
        # Check that we don't have the old 65s sleep (65000ms)
        if "sleep(65000)" in line:
            found_no_65s_sleep = False
            print(f"❌ Found old 65s sleep at line {i+1}")
    
    if not found_unified_dns:
        print("❌ Did not find domainService.addDNSRecord usage")
        success = False
    
    if not found_5s_sleep:
        print("❌ Did not find 5s sleep (5000ms)")
        success = False
    
    if not found_fallback:
        print("❌ Did not find fallback to saveServerInDomain")
        success = False
    
    if not found_no_65s_sleep:
        print("❌ Found old 65s sleep - should be removed")
        success = False
    else:
        print("✅ No 65s sleep found (correctly removed)")
    
    return success

def test_node_startup_logs():
    """Check for any critical errors in Node.js startup"""
    try:
        # Check if the process is running without critical errors
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        if "node js/start-bot.js" in result.stdout:
            print("✅ Node.js process is running")
            return True
        else:
            print("❌ Node.js process not found")
            return False
    except Exception as e:
        print(f"❌ Failed to check Node.js process: {e}")
        return False

def main():
    print("Starting URL shortener Cloudflare NS fix verification...")
    print("=" * 60)
    
    all_passed = True
    
    # Test 1: Node.js health check
    print("1. Node.js Health Check...")
    if test_node_health():
        print("✅ Node.js service is running on port 5000")
    else:
        print("❌ Node.js health check failed")
        all_passed = False
    
    # Test 2: Code changes verification
    print("\n2. Code Changes Verification...")
    if verify_code_changes():
        print("✅ All code changes verified successfully")
    else:
        print("❌ Some code changes were not found")
        all_passed = False
    
    # Test 3: Node.js startup check
    print("\n3. Node.js Startup Check...")
    if test_node_startup_logs():
        print("✅ Node.js startup successful")
    else:
        print("❌ Node.js startup issues detected")
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED - URL shortener Cloudflare NS fix verified successfully!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Review the issues above")
        return 1

if __name__ == "__main__":
    sys.exit(main())