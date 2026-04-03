#!/usr/bin/env python3
"""
Backend Test Suite for Nomadly Telegram Bot Platform
Tests the 6 new fixes implemented for the platform.
"""

import requests
import json
import re
import subprocess
import sys
import os
from typing import Dict, List, Any

# Configuration
BASE_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{BASE_URL}/health"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"✅ {test_name}")
        
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"❌ {test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed")
        if self.errors:
            print("\n🔍 Failed Tests:")
            for error in self.errors:
                print(f"  - {error}")

def read_file_content(file_path: str) -> str:
    """Read file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

def test_health_endpoint():
    """Test the health endpoint"""
    result = TestResult()
    
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                result.add_pass("Health endpoint returns healthy status")
            else:
                result.add_fail("Health endpoint", f"Unhealthy status: {data}")
        else:
            result.add_fail("Health endpoint", f"HTTP {response.status_code}")
    except Exception as e:
        result.add_fail("Health endpoint", str(e))
    
    return result

def test_fix_1_notify_group_hosting_payments():
    """Fix 1: Verify notifyGroup() calls in all 4 hosting payment paths"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/_index.js')
        
        # Count "Hosting Activated" occurrences
        hosting_activated_count = len(re.findall(r'Hosting Activated', content))
        if hosting_activated_count >= 4:
            result.add_pass(f"Found {hosting_activated_count} 'Hosting Activated' notifications (expected ≥4)")
        else:
            result.add_fail("Hosting Activated notifications", f"Found {hosting_activated_count}, expected ≥4")
        
        # Check for notifyGroup calls with hosting activation
        notify_group_pattern = r'notifyGroup\([^)]*Hosting Activated[^)]*\)'
        notify_group_matches = re.findall(notify_group_pattern, content, re.DOTALL)
        if len(notify_group_matches) >= 4:
            result.add_pass(f"Found {len(notify_group_matches)} notifyGroup() calls with hosting activation")
        else:
            result.add_fail("notifyGroup hosting calls", f"Found {len(notify_group_matches)}, expected ≥4")
        
        # Check for admin sendMessage calls
        admin_message_pattern = r'sendMessage\(TELEGRAM_ADMIN_CHAT_ID[^)]*hosting[^)]*\)'
        admin_matches = re.findall(admin_message_pattern, content, re.IGNORECASE | re.DOTALL)
        if len(admin_matches) >= 2:
            result.add_pass(f"Found {len(admin_matches)} admin notification calls")
        else:
            result.add_fail("Admin notification calls", f"Found {len(admin_matches)}, expected ≥2")
        
        # Check for domain/website_name pattern
        domain_pattern = r'info\?\.\w*domain\w*\s*\|\|\s*info\?\.\w*website_name\w*'
        domain_matches = re.findall(domain_pattern, content, re.IGNORECASE)
        if len(domain_matches) >= 2:
            result.add_pass(f"Found {len(domain_matches)} domain/website_name patterns")
        else:
            result.add_fail("Domain/website_name pattern", f"Found {len(domain_matches)}, expected ≥2")
            
    except Exception as e:
        result.add_fail("Fix 1 verification", str(e))
    
    return result

def test_fix_2_display_main_menu_buttons():
    """Fix 2: Verify displayMainMenuButtons function exists and is called"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/_index.js')
        
        # Check if displayMainMenuButtons function exists in goto object
        function_pattern = r'displayMainMenuButtons:\s*async\s*\(\s*\)\s*=>\s*\{'
        if re.search(function_pattern, content):
            result.add_pass("displayMainMenuButtons function exists in goto object")
        else:
            result.add_fail("displayMainMenuButtons function", "Function not found in goto object")
        
        # Check if it sets action to 'none'
        action_none_pattern = r'action.*=.*[\'"]none[\'"]'
        if re.search(action_none_pattern, content):
            result.add_pass("Function sets action to 'none'")
        else:
            result.add_fail("Action setting", "Function doesn't set action to 'none'")
        
        # Check if it calls getMainMenuGreeting
        greeting_pattern = r'getMainMenuGreeting\(\)'
        if re.search(greeting_pattern, content):
            result.add_pass("Function calls getMainMenuGreeting()")
        else:
            result.add_fail("getMainMenuGreeting call", "Function doesn't call getMainMenuGreeting()")
        
        # Check if it's called from multiple places
        call_pattern = r'goto\.displayMainMenuButtons\(\)'
        call_matches = re.findall(call_pattern, content)
        if len(call_matches) >= 10:
            result.add_pass(f"Function called from {len(call_matches)} places (expected ≥10)")
        else:
            result.add_fail("Function calls", f"Called from {len(call_matches)} places, expected ≥10")
            
    except Exception as e:
        result.add_fail("Fix 2 verification", str(e))
    
    return result

def test_fix_3_ssh_key_conversion():
    """Fix 3: Verify SSH key PEM-to-OpenSSH conversion fix"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/vm-instance-setup.js')
        
        # Check if convertPemToOpenSSH function exists
        function_pattern = r'function convertPemToOpenSSH\('
        if re.search(function_pattern, content):
            result.add_pass("convertPemToOpenSSH function exists")
        else:
            result.add_fail("convertPemToOpenSSH function", "Function not found")
        
        # Check for JWK export usage
        jwk_pattern = r'export\(\s*\{\s*format:\s*[\'"]jwk[\'"]'
        if re.search(jwk_pattern, content):
            result.add_pass("Uses JWK export to get key components")
        else:
            result.add_fail("JWK export", "JWK export not found")
        
        # Check for encodeSSHString helper
        ssh_string_pattern = r'encodeSSHString\s*='
        if re.search(ssh_string_pattern, content):
            result.add_pass("encodeSSHString helper function exists")
        else:
            result.add_fail("encodeSSHString helper", "Helper function not found")
        
        # Check for encodeSSHMpint helper
        ssh_mpint_pattern = r'encodeSSHMpint\s*='
        if re.search(ssh_mpint_pattern, content):
            result.add_pass("encodeSSHMpint helper function exists")
        else:
            result.add_fail("encodeSSHMpint helper", "Helper function not found")
        
        # Check for null return on failure
        null_return_pattern = r'return\s+null'
        if re.search(null_return_pattern, content):
            result.add_pass("Returns null on failure")
        else:
            result.add_fail("Null return", "Function doesn't return null on failure")
        
        # Check for null guard in generateNewSSHkey
        null_guard_pattern = r'if\s*\(\s*!\s*sshPubKey\s*\)'
        if re.search(null_guard_pattern, content):
            result.add_pass("generateNewSSHkey has null guard")
        else:
            result.add_fail("Null guard", "generateNewSSHkey missing null guard")
            
    except Exception as e:
        result.add_fail("Fix 3 verification", str(e))
    
    return result

def test_fix_4_contabo_product_fallback():
    """Fix 4: Verify Contabo product fallback mappings and logic"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/contabo-service.js')
        
        # Check for NVME_TO_SSD_FALLBACK mapping
        nvme_fallback_pattern = r'NVME_TO_SSD_FALLBACK\s*=\s*\{'
        if re.search(nvme_fallback_pattern, content):
            result.add_pass("NVME_TO_SSD_FALLBACK mapping exists")
        else:
            result.add_fail("NVME_TO_SSD_FALLBACK", "Mapping not found")
        
        # Check for SSD_TO_NVME_FALLBACK mapping
        ssd_fallback_pattern = r'SSD_TO_NVME_FALLBACK\s*=\s*\{'
        if re.search(ssd_fallback_pattern, content):
            result.add_pass("SSD_TO_NVME_FALLBACK mapping exists")
        else:
            result.add_fail("SSD_TO_NVME_FALLBACK", "Mapping not found")
        
        # Check for specific mappings (V45→V92, V47→V93, etc.)
        v45_mapping = re.search(r'V45.*V92', content)
        v47_mapping = re.search(r'V47.*V93', content)
        if v45_mapping and v47_mapping:
            result.add_pass("Specific product mappings found (V45→V92, V47→V93)")
        else:
            result.add_fail("Product mappings", "Specific mappings not found")
        
        # Check for createInstance fallback logic
        fallback_logic_pattern = r'is not available.*fallback'
        if re.search(fallback_logic_pattern, content, re.IGNORECASE):
            result.add_pass("createInstance has fallback logic for unavailable products")
        else:
            result.add_fail("Fallback logic", "createInstance fallback logic not found")
        
        # Check if getProductFallback is exported
        export_pattern = r'getProductFallback'
        exports_section = re.search(r'module\.exports\s*=\s*\{[^}]*\}', content, re.DOTALL)
        if exports_section and 'getProductFallback' in exports_section.group():
            result.add_pass("getProductFallback is exported")
        else:
            result.add_fail("getProductFallback export", "Function not exported")
            
    except Exception as e:
        result.add_fail("Fix 4 verification", str(e))
    
    return result

def test_fix_5_whm_cert_retry():
    """Fix 5: Verify WHM CERT_NOT_YET_VALID retry logic"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/protection-enforcer.js')
        
        # Check for _sendAdminAlert variable
        admin_alert_pattern = r'_sendAdminAlert\s*=\s*null'
        if re.search(admin_alert_pattern, content):
            result.add_pass("_sendAdminAlert variable exists")
        else:
            result.add_fail("_sendAdminAlert variable", "Variable not found")
        
        # Check for init() accepting opts parameter
        init_pattern = r'function init\([^)]*opts[^)]*\)'
        if re.search(init_pattern, content):
            result.add_pass("init() accepts opts parameter")
        else:
            result.add_fail("init() opts parameter", "Parameter not found")
        
        # Check for CERT_NOT_YET_VALID check
        cert_check_pattern = r'CERT_NOT_YET_VALID'
        if re.search(cert_check_pattern, content):
            result.add_pass("CERT_NOT_YET_VALID check exists")
        else:
            result.add_fail("CERT_NOT_YET_VALID check", "Check not found")
        
        # Check for 60s retry delay
        retry_delay_pattern = r'60000|60\s*\*\s*1000'
        if re.search(retry_delay_pattern, content):
            result.add_pass("60s retry delay found")
        else:
            result.add_fail("Retry delay", "60s delay not found")
        
        # Check for _clockSkewAlerted flag
        clock_skew_pattern = r'_clockSkewAlerted'
        if re.search(clock_skew_pattern, content):
            result.add_pass("_clockSkewAlerted flag exists")
        else:
            result.add_fail("_clockSkewAlerted flag", "Flag not found")
        
        # Check _index.js for protectionEnforcer.init call with sendAdminAlert
        index_content = read_file_content('/app/js/_index.js')
        init_call_pattern = r'protectionEnforcer\.init\([^)]*sendAdminAlert[^)]*\)'
        if re.search(init_call_pattern, index_content):
            result.add_pass("protectionEnforcer.init called with sendAdminAlert in _index.js")
        else:
            result.add_fail("protectionEnforcer.init call", "Call with sendAdminAlert not found in _index.js")
            
    except Exception as e:
        result.add_fail("Fix 5 verification", str(e))
    
    return result

def test_fix_6_contabo_password_guard():
    """Fix 6: Verify Contabo createSecret password validation"""
    result = TestResult()
    
    try:
        content = read_file_content('/app/js/contabo-service.js')
        
        # Check for password length guard
        guard_pattern = r'if\s*\(\s*!\s*value\s*\|\|\s*\(\s*type\s*===\s*[\'"]password[\'"].*value\.length\s*<\s*8\s*\)\s*\)'
        if re.search(guard_pattern, content):
            result.add_pass("Password length guard exists (min 8 chars)")
        else:
            result.add_fail("Password length guard", "Guard not found")
        
        # Check for descriptive error throwing
        error_pattern = r'throw\s+new\s+Error\([^)]*value.*length[^)]*\)'
        if re.search(error_pattern, content):
            result.add_pass("Throws descriptive error with value length")
        else:
            result.add_fail("Descriptive error", "Error with value length not found")
        
        # Check for createSecret function
        function_pattern = r'async\s+function\s+createSecret\('
        if re.search(function_pattern, content):
            result.add_pass("createSecret function exists")
        else:
            result.add_fail("createSecret function", "Function not found")
        
        # Check for type parameter validation
        type_check_pattern = r'type\s*===\s*[\'"]password[\'"]'
        if re.search(type_check_pattern, content):
            result.add_pass("Type parameter validation exists")
        else:
            result.add_fail("Type parameter validation", "Validation not found")
            
    except Exception as e:
        result.add_fail("Fix 6 verification", str(e))
    
    return result

def test_error_logs():
    """Check if error logs are empty"""
    result = TestResult()
    
    try:
        # Check nodejs error log
        log_path = '/var/log/supervisor/nodejs.err.log'
        if os.path.exists(log_path):
            log_size = os.path.getsize(log_path)
            if log_size == 0:
                result.add_pass("Node.js error log is empty (0 bytes)")
            else:
                result.add_fail("Node.js error log", f"Log file is {log_size} bytes (not empty)")
        else:
            result.add_fail("Node.js error log", "Log file not found")
            
    except Exception as e:
        result.add_fail("Error log check", str(e))
    
    return result

def run_syntax_validation():
    """Run syntax validation on key JavaScript files"""
    result = TestResult()
    
    files_to_check = [
        '/app/js/_index.js',
        '/app/js/vm-instance-setup.js',
        '/app/js/contabo-service.js',
        '/app/js/protection-enforcer.js'
    ]
    
    for file_path in files_to_check:
        try:
            # Use node -c to check syntax
            cmd_result = subprocess.run(['node', '-c', file_path], 
                                      capture_output=True, text=True, timeout=10)
            if cmd_result.returncode == 0:
                result.add_pass(f"Syntax validation passed: {os.path.basename(file_path)}")
            else:
                result.add_fail(f"Syntax validation: {os.path.basename(file_path)}", 
                              cmd_result.stderr.strip())
        except Exception as e:
            result.add_fail(f"Syntax validation: {os.path.basename(file_path)}", str(e))
    
    return result

def main():
    """Run all tests"""
    print("🚀 Starting Backend Test Suite for Nomadly Telegram Bot Platform")
    print("=" * 70)
    
    all_results = []
    
    # Test health endpoint first
    print("\n📡 Testing Health Endpoint...")
    all_results.append(test_health_endpoint())
    
    # Test syntax validation
    print("\n🔍 Running Syntax Validation...")
    all_results.append(run_syntax_validation())
    
    # Test error logs
    print("\n📋 Checking Error Logs...")
    all_results.append(test_error_logs())
    
    # Test all 6 fixes
    print("\n🔧 Testing Fix 1: notifyGroup in hosting payment paths...")
    all_results.append(test_fix_1_notify_group_hosting_payments())
    
    print("\n🔧 Testing Fix 2: displayMainMenuButtons function...")
    all_results.append(test_fix_2_display_main_menu_buttons())
    
    print("\n🔧 Testing Fix 3: SSH key PEM-to-OpenSSH conversion...")
    all_results.append(test_fix_3_ssh_key_conversion())
    
    print("\n🔧 Testing Fix 4: Contabo product fallback...")
    all_results.append(test_fix_4_contabo_product_fallback())
    
    print("\n🔧 Testing Fix 5: WHM CERT_NOT_YET_VALID retry...")
    all_results.append(test_fix_5_whm_cert_retry())
    
    print("\n🔧 Testing Fix 6: Contabo password guard...")
    all_results.append(test_fix_6_contabo_password_guard())
    
    # Calculate overall results
    total_passed = sum(r.passed for r in all_results)
    total_failed = sum(r.failed for r in all_results)
    total_tests = total_passed + total_failed
    
    print("\n" + "=" * 70)
    print(f"🎯 OVERALL RESULTS: {total_passed}/{total_tests} tests passed")
    
    if total_failed > 0:
        print(f"\n❌ {total_failed} tests failed:")
        for result in all_results:
            for error in result.errors:
                print(f"  - {error}")
    else:
        print("\n✅ All tests passed!")
    
    return 0 if total_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())