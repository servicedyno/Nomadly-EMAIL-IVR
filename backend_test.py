#!/usr/bin/env python3
"""
Backend test for duplicate notifyGroup + admin notifications fix in DynoPay Twilio purchase paths
"""

import subprocess
import sys
import requests
import os
import re

def run_command(cmd, description):
    """Run a command and return success status and output"""
    print(f"\n🔍 {description}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(f"✅ PASS: {description}")
            return True, result.stdout
        else:
            print(f"❌ FAIL: {description}")
            print(f"Error: {result.stderr}")
            return False, result.stderr
    except subprocess.TimeoutExpired:
        print(f"❌ TIMEOUT: {description}")
        return False, "Command timed out"
    except Exception as e:
        print(f"❌ ERROR: {description} - {str(e)}")
        return False, str(e)

def check_file_content(file_path, pattern, description, should_exist=True):
    """Check if a pattern exists in a file"""
    print(f"\n🔍 {description}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        matches = re.findall(pattern, content, re.MULTILINE | re.IGNORECASE)
        
        if should_exist:
            if matches:
                print(f"✅ PASS: {description} - Found {len(matches)} matches")
                return True, matches
            else:
                print(f"❌ FAIL: {description} - Pattern not found")
                return False, []
        else:
            if not matches:
                print(f"✅ PASS: {description} - Pattern correctly not found")
                return True, []
            else:
                print(f"❌ FAIL: {description} - Found {len(matches)} unexpected matches")
                for i, match in enumerate(matches[:5]):  # Show first 5 matches
                    print(f"  Match {i+1}: {match}")
                return False, matches
                
    except Exception as e:
        print(f"❌ ERROR: {description} - {str(e)}")
        return False, str(e)

def check_health_endpoint():
    """Check the health endpoint"""
    print(f"\n🔍 Checking health endpoint")
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print(f"✅ PASS: Health endpoint returns healthy")
                return True, data
            else:
                print(f"❌ FAIL: Health endpoint status not healthy: {data}")
                return False, data
        else:
            print(f"❌ FAIL: Health endpoint returned status {response.status_code}")
            return False, response.text
    except Exception as e:
        print(f"❌ ERROR: Health endpoint check failed - {str(e)}")
        return False, str(e)

def check_error_log():
    """Check if error log is clean"""
    print(f"\n🔍 Checking error log")
    try:
        log_path = "/var/log/supervisor/nodejs.err.log"
        if os.path.exists(log_path):
            size = os.path.getsize(log_path)
            if size == 0:
                print(f"✅ PASS: Error log is clean (0 bytes)")
                return True, "Clean"
            else:
                print(f"❌ FAIL: Error log has {size} bytes")
                # Show last few lines
                with open(log_path, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        print("Last few lines:")
                        for line in lines[-5:]:
                            print(f"  {line.strip()}")
                return False, f"{size} bytes"
        else:
            print(f"✅ PASS: Error log file doesn't exist (clean)")
            return True, "No file"
    except Exception as e:
        print(f"❌ ERROR: Error log check failed - {str(e)}")
        return False, str(e)

def main():
    """Main test function"""
    print("=" * 80)
    print("🧪 TESTING: Fix for duplicate notifyGroup + admin notifications")
    print("   Context: DynoPay Twilio purchase paths in js/_index.js")
    print("=" * 80)
    
    tests_passed = 0
    total_tests = 0
    
    # Test 1: Syntax check
    total_tests += 1
    success, output = run_command("node -c /app/js/_index.js", "Syntax check for _index.js")
    if success:
        tests_passed += 1
    
    # Test 2: Health check
    total_tests += 1
    success, data = check_health_endpoint()
    if success:
        tests_passed += 1
    
    # Test 3: Error log check
    total_tests += 1
    success, data = check_error_log()
    if success:
        tests_passed += 1
    
    # Test 4: Verify 3 comments exist in DynoPay section
    total_tests += 1
    success, matches = check_file_content(
        "/app/js/_index.js",
        r"//\s*notifyGroup\s*\+\s*admin\s*already\s*sent\s*inside\s*executeTwilioPurchase\(\)",
        "Check for 3 comments about notifyGroup + admin already sent inside executeTwilioPurchase()",
        should_exist=True
    )
    if success and len(matches) >= 3:
        tests_passed += 1
        print(f"   Found {len(matches)} comment(s) as expected")
    elif success:
        print(f"❌ Expected 3 comments, found {len(matches)}")
    
    # Test 5: Verify ZERO notifyGroup calls in DynoPay Twilio paths (lines 22935-22995)
    total_tests += 1
    try:
        with open("/app/js/_index.js", 'r') as f:
            lines = f.readlines()
        
        # Extract lines 22935-22995
        dynopay_section = lines[22934:22995]  # 0-indexed
        dynopay_content = ''.join(dynopay_section)
        
        # Look for notifyGroup calls (excluding comments)
        notify_pattern = r'^[^/]*notifyGroup\s*\('
        notify_matches = re.findall(notify_pattern, dynopay_content, re.MULTILINE)
        
        if not notify_matches:
            print(f"✅ PASS: No notifyGroup calls found in DynoPay Twilio paths (lines 22935-22995)")
            tests_passed += 1
        else:
            print(f"❌ FAIL: Found {len(notify_matches)} notifyGroup calls in DynoPay section")
            for match in notify_matches:
                print(f"  Found: {match.strip()}")
    except Exception as e:
        print(f"❌ ERROR: Failed to check DynoPay section - {str(e)}")
    
    # Test 6: Verify executeTwilioPurchase() still has internal notifyGroup at lines ~1250-1254
    total_tests += 1
    try:
        with open("/app/js/_index.js", 'r') as f:
            lines = f.readlines()
        
        # Extract lines around 1248-1255
        exec_section = lines[1247:1256]  # 0-indexed
        exec_content = ''.join(exec_section)
        
        # Look for notifyGroup calls
        notify_pattern = r'notifyGroup\s*\('
        notify_matches = re.findall(notify_pattern, exec_content)
        
        if notify_matches:
            print(f"✅ PASS: executeTwilioPurchase() has {len(notify_matches)} notifyGroup call(s) as expected")
            tests_passed += 1
        else:
            print(f"❌ FAIL: executeTwilioPurchase() missing notifyGroup calls")
    except Exception as e:
        print(f"❌ ERROR: Failed to check executeTwilioPurchase section - {str(e)}")
    
    # Test 7: Verify other callers of executeTwilioPurchase do NOT have their own notifyGroup
    total_tests += 1
    success, matches = check_file_content(
        "/app/js/_index.js",
        r"executeTwilioPurchase\([^)]+\)",
        "Find all executeTwilioPurchase calls",
        should_exist=True
    )
    
    if success:
        # Check areas around each call for notifyGroup
        problem_calls = 0
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Find all executeTwilioPurchase calls and check surrounding context
            for match in re.finditer(r'executeTwilioPurchase\([^)]+\)', content):
                start_pos = max(0, match.start() - 500)  # 500 chars before
                end_pos = min(len(content), match.end() + 500)  # 500 chars after
                context = content[start_pos:end_pos]
                
                # Skip the function definition itself
                if 'async function executeTwilioPurchase' in context:
                    continue
                
                # Look for notifyGroup calls in the context (excluding comments)
                context_lines = context.split('\n')
                for line in context_lines:
                    if 'notifyGroup(' in line and not line.strip().startswith('//') and not line.strip().startswith('*'):
                        # Check if this is inside the executeTwilioPurchase function itself
                        if 'function executeTwilioPurchase' not in context[:context.find(line)]:
                            problem_calls += 1
                            print(f"   Found notifyGroup near executeTwilioPurchase call: {line.strip()}")
            
            if problem_calls == 0:
                print(f"✅ PASS: No notifyGroup calls found near other executeTwilioPurchase callers")
                tests_passed += 1
            else:
                print(f"❌ FAIL: Found {problem_calls} notifyGroup calls near executeTwilioPurchase callers")
        except Exception as e:
            print(f"❌ ERROR: Failed to analyze executeTwilioPurchase callers - {str(e)}")
    
    # Test 8: Verify Telnyx paths still have their own notifyGroup calls
    total_tests += 1
    success, matches = check_file_content(
        "/app/js/_index.js",
        r"provider\s*===\s*['\"]telnyx['\"]",
        "Find Telnyx provider sections",
        should_exist=True
    )
    
    if success:
        # Look for notifyGroup in Telnyx sections
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            telnyx_notify_found = False
            for match in re.finditer(r"provider\s*===\s*['\"]telnyx['\"]", content):
                # Look in the next 1000 characters for notifyGroup
                start_pos = match.start()
                end_pos = min(len(content), start_pos + 1000)
                telnyx_section = content[start_pos:end_pos]
                
                if 'notifyGroup(' in telnyx_section:
                    telnyx_notify_found = True
                    break
            
            if telnyx_notify_found:
                print(f"✅ PASS: Telnyx paths still have notifyGroup calls as expected")
                tests_passed += 1
            else:
                print(f"❌ FAIL: Telnyx paths missing notifyGroup calls")
        except Exception as e:
            print(f"❌ ERROR: Failed to check Telnyx sections - {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print(f"📊 TEST SUMMARY: {tests_passed}/{total_tests} tests passed")
    print("=" * 80)
    
    if tests_passed == total_tests:
        print("🎉 ALL TESTS PASSED! Duplicate notification fix is working correctly.")
        return True
    else:
        print(f"⚠️  {total_tests - tests_passed} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)