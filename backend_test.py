#!/usr/bin/env python3
"""
Backend Test Suite for Option E Call Rate Pricing Changes
Tests the Nomadly Telegram bot backend running on Node.js (port 5000) proxied through FastAPI (port 8001).

WHAT TO VERIFY:
1. Syntax validation: node -c on phone-config.js and voice-service.js
2. Health endpoint: curl http://localhost:5000/health
3. Error logs: /var/log/supervisor/nodejs.err.log should be 0 bytes
4. OVERAGE_RATE_MIN is now 0.15 (not 0.04 or 0.03) in phone-config.js default fallback
5. CALL_CONNECTION_FEE constant exists in phone-config.js at ~line 92 with default 0.03
6. CALL_CONNECTION_FEE is exported from phone-config.js
7. voice-service.js imports CALL_CONNECTION_FEE from phone-config.js (line 6)
8. In handleOutboundSipCall: wallet check uses minRequired = sipRate + CALL_CONNECTION_FEE
9. Connection fee charge block exists after wallet check with smartWalletDeduct, payment logging, and ConnectionFee label
10. User notification messages include connection fee note ($0.03 connect fee)
11. SIP Call Blocked message mentions connect fee
12. Railway production env vars: both OVERAGE_RATE_MIN=0.15 and CALL_CONNECTION_FEE=0.03 confirmed
"""

import subprocess
import requests
import os
import re
import json
import sys
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:5000"  # Node.js backend
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"
NODEJS_ERROR_LOG = "/var/log/supervisor/nodejs.err.log"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, details=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n📊 Test Summary: {self.passed}/{total} passed ({self.failed} failed)")
        return self.failed == 0

def run_command(cmd, cwd=None):
    """Run shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except Exception as e:
        return False, "", str(e)

def read_file(filepath):
    """Read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return None

def test_syntax_validation(results):
    """Test 1: Syntax validation on phone-config.js and voice-service.js"""
    
    # Test phone-config.js syntax
    success, stdout, stderr = run_command("node -c /app/js/phone-config.js")
    results.add_result(
        "Syntax validation: phone-config.js", 
        success, 
        stderr if not success else "OK"
    )
    
    # Test voice-service.js syntax
    success, stdout, stderr = run_command("node -c /app/js/voice-service.js")
    results.add_result(
        "Syntax validation: voice-service.js", 
        success, 
        stderr if not success else "OK"
    )

def test_health_endpoint(results):
    """Test 2: Health endpoint check"""
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        success = response.status_code == 200
        details = f"Status: {response.status_code}"
        if success:
            try:
                data = response.json()
                details += f", Response: {json.dumps(data, indent=2)}"
            except:
                details += f", Text: {response.text[:200]}"
        results.add_result("Health endpoint check", success, details)
    except Exception as e:
        results.add_result("Health endpoint check", False, str(e))

def test_error_logs(results):
    """Test 3: Check error logs are empty"""
    if os.path.exists(NODEJS_ERROR_LOG):
        try:
            size = os.path.getsize(NODEJS_ERROR_LOG)
            success = size == 0
            details = f"Log size: {size} bytes"
            if not success and size < 1000:
                # Show recent errors if log is small
                content = read_file(NODEJS_ERROR_LOG)
                if content:
                    details += f", Recent errors: {content[-500:]}"
        except Exception as e:
            success = False
            details = f"Error reading log: {e}"
    else:
        success = True
        details = "Log file does not exist (good)"
    
    results.add_result("Error logs check (0 bytes)", success, details)

def test_overage_rate_min(results):
    """Test 4: OVERAGE_RATE_MIN is 0.15 in phone-config.js"""
    content = read_file("/app/js/phone-config.js")
    if content is None:
        results.add_result("OVERAGE_RATE_MIN value check", False, "Could not read phone-config.js")
        return
    
    # Look for OVERAGE_RATE_MIN definition with default fallback
    pattern = r'const\s+OVERAGE_RATE_MIN\s*=\s*parseFloat\s*\(\s*process\.env\.OVERAGE_RATE_MIN\s*\|\|\s*[\'"]([0-9.]+)[\'"]\s*\)'
    match = re.search(pattern, content)
    
    if match:
        default_value = match.group(1)
        success = default_value == "0.15"
        details = f"Default fallback value: {default_value} (expected: 0.15)"
    else:
        success = False
        details = "OVERAGE_RATE_MIN definition not found or incorrect format"
    
    results.add_result("OVERAGE_RATE_MIN default fallback is 0.15", success, details)

def test_call_connection_fee_constant(results):
    """Test 5: CALL_CONNECTION_FEE constant exists with default 0.03"""
    content = read_file("/app/js/phone-config.js")
    if content is None:
        results.add_result("CALL_CONNECTION_FEE constant check", False, "Could not read phone-config.js")
        return
    
    # Look for CALL_CONNECTION_FEE definition around line 92
    pattern = r'const\s+CALL_CONNECTION_FEE\s*=\s*parseFloat\s*\(\s*process\.env\.CALL_CONNECTION_FEE\s*\|\|\s*[\'"]([0-9.]+)[\'"]\s*\)'
    match = re.search(pattern, content)
    
    if match:
        default_value = match.group(1)
        success = default_value == "0.03"
        details = f"Default value: {default_value} (expected: 0.03)"
        
        # Check if it's around line 92
        lines = content.split('\n')
        for i, line in enumerate(lines, 1):
            if 'CALL_CONNECTION_FEE' in line and 'parseFloat' in line:
                details += f", Found at line: {i}"
                break
    else:
        success = False
        details = "CALL_CONNECTION_FEE definition not found"
    
    results.add_result("CALL_CONNECTION_FEE constant exists (~line 92, default 0.03)", success, details)

def test_call_connection_fee_export(results):
    """Test 6: CALL_CONNECTION_FEE is exported from phone-config.js"""
    content = read_file("/app/js/phone-config.js")
    if content is None:
        results.add_result("CALL_CONNECTION_FEE export check", False, "Could not read phone-config.js")
        return
    
    # Look for export of CALL_CONNECTION_FEE
    # Could be in module.exports or individual export
    export_patterns = [
        r'module\.exports\s*=\s*\{[^}]*CALL_CONNECTION_FEE[^}]*\}',
        r'exports\.CALL_CONNECTION_FEE',
        r'CALL_CONNECTION_FEE[^}]*\}[^}]*module\.exports',
    ]
    
    found_export = False
    for pattern in export_patterns:
        if re.search(pattern, content, re.DOTALL):
            found_export = True
            break
    
    # Also check if it's in a general export block
    if not found_export:
        # Look for the end of file exports
        lines = content.split('\n')
        in_exports = False
        for line in lines:
            if 'module.exports' in line and '{' in line:
                in_exports = True
            if in_exports and 'CALL_CONNECTION_FEE' in line:
                found_export = True
                break
            if in_exports and '}' in line:
                in_exports = False
    
    results.add_result("CALL_CONNECTION_FEE is exported", found_export, 
                      "Found in exports" if found_export else "Not found in exports")

def test_voice_service_import(results):
    """Test 7: voice-service.js imports CALL_CONNECTION_FEE from phone-config.js"""
    content = read_file("/app/js/voice-service.js")
    if content is None:
        results.add_result("CALL_CONNECTION_FEE import check", False, "Could not read voice-service.js")
        return
    
    # Look for import of CALL_CONNECTION_FEE from phone-config.js around line 6
    lines = content.split('\n')
    found_import = False
    import_line = 0
    
    for i, line in enumerate(lines[:20], 1):  # Check first 20 lines
        if 'require' in line and 'phone-config' in line and 'CALL_CONNECTION_FEE' in line:
            found_import = True
            import_line = i
            break
    
    details = f"Found at line {import_line}" if found_import else "Import not found in first 20 lines"
    results.add_result("voice-service.js imports CALL_CONNECTION_FEE (line ~6)", found_import, details)

def test_wallet_check_logic(results):
    """Test 8: handleOutboundSipCall uses minRequired = sipRate + CALL_CONNECTION_FEE"""
    content = read_file("/app/js/voice-service.js")
    if content is None:
        results.add_result("Wallet check logic", False, "Could not read voice-service.js")
        return
    
    # Look for wallet check logic in handleOutboundSipCall
    # Search for minRequired calculation
    patterns = [
        r'minRequired\s*=\s*sipRate\s*\+\s*CALL_CONNECTION_FEE',
        r'sipRate\s*\+\s*CALL_CONNECTION_FEE',
        r'CALL_CONNECTION_FEE\s*\+\s*sipRate',
    ]
    
    found_logic = False
    for pattern in patterns:
        if re.search(pattern, content):
            found_logic = True
            break
    
    # Also look for smartWalletCheck with the combined amount
    if found_logic or re.search(r'smartWalletCheck.*\(\s*[^,]+,\s*[^,]+,\s*[^)]*\+[^)]*\)', content):
        found_logic = True
    
    results.add_result("Wallet check uses sipRate + CALL_CONNECTION_FEE", found_logic,
                      "Found wallet check logic" if found_logic else "Wallet check logic not found")

def test_connection_fee_charge_block(results):
    """Test 9: Connection fee charge block exists after wallet check"""
    content = read_file("/app/js/voice-service.js")
    if content is None:
        results.add_result("Connection fee charge block", False, "Could not read voice-service.js")
        return
    
    # Look for connection fee charging logic
    patterns = [
        r'smartWalletDeduct.*CALL_CONNECTION_FEE',
        r'ConnectionFee.*smartWalletDeduct',
        r'connection.*fee.*charge',
        r'CALL_CONNECTION_FEE.*deduct',
    ]
    
    found_charge = False
    found_logging = False
    
    for pattern in patterns:
        if re.search(pattern, content, re.IGNORECASE):
            found_charge = True
            break
    
    # Look for payment logging with ConnectionFee label
    if re.search(r'ConnectionFee', content) or re.search(r'connection.*fee', content, re.IGNORECASE):
        found_logging = True
    
    success = found_charge and found_logging
    details = f"Charge logic: {'✓' if found_charge else '✗'}, Logging: {'✓' if found_logging else '✗'}"
    
    results.add_result("Connection fee charge block with logging", success, details)

def test_user_notification_messages(results):
    """Test 10: User notification messages include connection fee note"""
    content = read_file("/app/js/voice-service.js")
    if content is None:
        results.add_result("User notification messages", False, "Could not read voice-service.js")
        return
    
    # Look for user messages mentioning connection fee
    patterns = [
        r'\$0\.03.*connect.*fee',
        r'connect.*fee.*\$0\.03',
        r'connection.*fee.*0\.03',
        r'CALL_CONNECTION_FEE.*message',
    ]
    
    found_messages = False
    for pattern in patterns:
        if re.search(pattern, content, re.IGNORECASE):
            found_messages = True
            break
    
    # Also check for general connection fee mentions in user messages
    if not found_messages:
        if re.search(r'sendMessage.*connection.*fee', content, re.IGNORECASE | re.DOTALL):
            found_messages = True
    
    results.add_result("User messages include connection fee ($0.03)", found_messages,
                      "Found connection fee in messages" if found_messages else "Connection fee not found in messages")

def test_sip_call_blocked_message(results):
    """Test 11: SIP Call Blocked message mentions connect fee"""
    content = read_file("/app/js/voice-service.js")
    if content is None:
        results.add_result("SIP Call Blocked message", False, "Could not read voice-service.js")
        return
    
    # Look for SIP call blocked messages that mention connection fee
    patterns = [
        r'SIP.*[Bb]locked.*connect.*fee',
        r'[Bb]locked.*SIP.*connect.*fee',
        r'insufficient.*balance.*connect.*fee',
        r'wallet.*low.*connect.*fee',
    ]
    
    found_blocked_msg = False
    for pattern in patterns:
        if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
            found_blocked_msg = True
            break
    
    results.add_result("SIP Call Blocked message mentions connect fee", found_blocked_msg,
                      "Found in blocked message" if found_blocked_msg else "Not found in blocked messages")

def test_env_vars(results):
    """Test 12: Environment variables are correctly set"""
    content = read_file("/app/backend/.env")
    if content is None:
        results.add_result("Environment variables check", False, "Could not read .env file")
        return
    
    # Check OVERAGE_RATE_MIN
    overage_match = re.search(r'OVERAGE_RATE_MIN\s*=\s*[\'"]?([0-9.]+)[\'"]?', content)
    overage_correct = overage_match and overage_match.group(1) == "0.15"
    
    # Check CALL_CONNECTION_FEE
    connection_match = re.search(r'CALL_CONNECTION_FEE\s*=\s*[\'"]?([0-9.]+)[\'"]?', content)
    connection_correct = connection_match and connection_match.group(1) == "0.03"
    
    success = overage_correct and connection_correct
    details = f"OVERAGE_RATE_MIN: {overage_match.group(1) if overage_match else 'NOT FOUND'}, "
    details += f"CALL_CONNECTION_FEE: {connection_match.group(1) if connection_match else 'NOT FOUND'}"
    
    results.add_result("Environment variables (OVERAGE_RATE_MIN=0.15, CALL_CONNECTION_FEE=0.03)", 
                      success, details)

def main():
    print("🧪 Testing Option E Call Rate Pricing Changes")
    print("=" * 60)
    
    results = TestResults()
    
    # Run all tests
    test_syntax_validation(results)
    test_health_endpoint(results)
    test_error_logs(results)
    test_overage_rate_min(results)
    test_call_connection_fee_constant(results)
    test_call_connection_fee_export(results)
    test_voice_service_import(results)
    test_wallet_check_logic(results)
    test_connection_fee_charge_block(results)
    test_user_notification_messages(results)
    test_sip_call_blocked_message(results)
    test_env_vars(results)
    
    # Print summary
    success = results.summary()
    
    if success:
        print("\n🎉 All tests passed! Option E pricing changes are correctly implemented.")
    else:
        print(f"\n⚠️  {results.failed} test(s) failed. Please review the implementation.")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())