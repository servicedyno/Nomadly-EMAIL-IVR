#!/usr/bin/env python3
"""
Backend Test Suite for Wallet Cooldown Fix Verification
Tests the wallet cooldown fix in /app/js/voice-service.js
"""

import subprocess
import requests
import re
import os

def test_syntax_validation():
    """Test that voice-service.js passes syntax validation"""
    try:
        result = subprocess.run(['node', '-c', '/app/js/voice-service.js'], 
                              capture_output=True, text=True, timeout=30)
        return result.returncode == 0, f"Syntax check: {result.stderr if result.stderr else 'OK'}"
    except Exception as e:
        return False, f"Syntax check failed: {str(e)}"

def test_health_endpoint():
    """Test that health endpoint returns healthy status"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            is_healthy = data.get('status') == 'healthy' and data.get('database') == 'connected'
            return is_healthy, f"Health: {data}"
        else:
            return False, f"Health endpoint returned {response.status_code}"
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def test_error_log_clean():
    """Test that nodejs error log is empty (0 bytes)"""
    try:
        log_path = '/var/log/supervisor/nodejs.err.log'
        if os.path.exists(log_path):
            size = os.path.getsize(log_path)
            return size == 0, f"Error log size: {size} bytes"
        else:
            return False, "Error log file not found"
    except Exception as e:
        return False, f"Error log check failed: {str(e)}"

def test_early_cooldown_fix():
    """Test that early cooldown check only fires when credentialExtracted=true"""
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Look for the fixed pattern around line 1334
        pattern = r'const cooldownKey = credentialExtracted \? sipUsername : null'
        if re.search(pattern, content):
            return True, "Early cooldown fix verified: cooldownKey = credentialExtracted ? sipUsername : null"
        else:
            return False, "Early cooldown fix not found"
    except Exception as e:
        return False, f"Early cooldown check failed: {str(e)}"

def test_post_identification_cooldown():
    """Test that new post-identification cooldown check exists with chatId format"""
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Look for the new post-identification cooldown check
        patterns = [
            r'const userCooldownKey = `chatId:\$\{chatId\}`',
            r'if \(isWalletRejectCooldown\(userCooldownKey\)\)',
            r'POST-IDENTIFICATION WALLET COOLDOWN CHECK'
        ]
        
        found_patterns = []
        for pattern in patterns:
            if re.search(pattern, content):
                found_patterns.append(pattern)
        
        if len(found_patterns) >= 2:  # At least the key patterns
            return True, f"Post-identification cooldown verified: {len(found_patterns)}/3 patterns found"
        else:
            return False, f"Post-identification cooldown incomplete: {len(found_patterns)}/3 patterns found"
    except Exception as e:
        return False, f"Post-identification cooldown check failed: {str(e)}"

def test_no_fromclean_references():
    """Test that no setWalletRejectCooldown calls use fromClean"""
    try:
        result = subprocess.run(['grep', '-n', 'setWalletRejectCooldown.*fromClean', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        
        # grep returns exit code 1 when no matches found (which is what we want)
        if result.returncode == 1:
            return True, "No fromClean references in setWalletRejectCooldown calls"
        else:
            return False, f"Found fromClean references: {result.stdout}"
    except Exception as e:
        return False, f"fromClean reference check failed: {str(e)}"

def test_new_chatid_pattern():
    """Test that setWalletRejectCooldown calls use new chatId pattern"""
    try:
        result = subprocess.run(['grep', '-n', 'setWalletRejectCooldown.*chatId:', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:  # Should have at least 2 occurrences
                return True, f"New chatId pattern found: {len(lines)} occurrences at lines {[line.split(':')[0] for line in lines]}"
            else:
                return False, f"Insufficient chatId pattern occurrences: {len(lines)}"
        else:
            return False, "No chatId pattern found in setWalletRejectCooldown calls"
    except Exception as e:
        return False, f"chatId pattern check failed: {str(e)}"

def test_specific_line_numbers():
    """Test that setWalletRejectCooldown calls are at expected line numbers"""
    try:
        result = subprocess.run(['grep', '-n', 'setWalletRejectCooldown.*chatId:', '/app/js/voice-service.js'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            line_numbers = [int(line.split(':')[0]) for line in lines]
            
            # Check if lines are around expected ranges (1461-1464 and 1478-1481)
            expected_ranges = [(1460, 1470), (1475, 1485)]
            found_in_ranges = []
            
            for line_num in line_numbers:
                for range_start, range_end in expected_ranges:
                    if range_start <= line_num <= range_end:
                        found_in_ranges.append(line_num)
            
            if len(found_in_ranges) >= 2:
                return True, f"setWalletRejectCooldown calls found at expected line ranges: {found_in_ranges}"
            else:
                return False, f"setWalletRejectCooldown calls not at expected ranges: found at {line_numbers}"
        else:
            return False, "No setWalletRejectCooldown calls found"
    except Exception as e:
        return False, f"Line number check failed: {str(e)}"

def run_all_tests():
    """Run all tests and return results"""
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Health Endpoint", test_health_endpoint),
        ("Error Log Clean", test_error_log_clean),
        ("Early Cooldown Fix", test_early_cooldown_fix),
        ("Post-Identification Cooldown", test_post_identification_cooldown),
        ("No fromClean References", test_no_fromclean_references),
        ("New chatId Pattern", test_new_chatid_pattern),
        ("Specific Line Numbers", test_specific_line_numbers)
    ]
    
    results = []
    passed = 0
    total = len(tests)
    
    print("=" * 80)
    print("WALLET COOLDOWN FIX VERIFICATION TESTS")
    print("=" * 80)
    
    for test_name, test_func in tests:
        try:
            success, message = test_func()
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} {test_name}: {message}")
            results.append((test_name, success, message))
            if success:
                passed += 1
        except Exception as e:
            print(f"❌ FAIL {test_name}: Exception - {str(e)}")
            results.append((test_name, False, f"Exception - {str(e)}"))
    
    print("=" * 80)
    print(f"SUMMARY: {passed}/{total} tests passed ({(passed/total)*100:.1f}% success rate)")
    print("=" * 80)
    
    return results, passed, total

if __name__ == "__main__":
    results, passed, total = run_all_tests()
    
    # Exit with appropriate code
    exit(0 if passed == total else 1)