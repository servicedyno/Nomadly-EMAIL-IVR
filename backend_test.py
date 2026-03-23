#!/usr/bin/env python3
"""
Backend Test Suite for External Number Detach Fix
Tests the Node.js Express backend (NOT FastAPI)
"""

import requests
import json
import subprocess
import re
import time
import sys
from typing import Dict, List, Optional

# Configuration
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def test_pass(self, test_name: str):
        print(f"✅ {test_name}")
        self.passed += 1
        
    def test_fail(self, test_name: str, error: str):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return self.failed == 0

def run_command(cmd: str) -> tuple[str, str, int]:
    """Run shell command and return stdout, stderr, exit_code"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1

def test_syntax_checks(results: TestResults):
    """Test 1: Syntax validation for key files"""
    print("\n🔍 Testing Syntax Validation...")
    
    files_to_check = [
        "/app/js/telnyx-service.js",
        "/app/js/_index.js", 
        "/app/js/voice-service.js"
    ]
    
    for file_path in files_to_check:
        stdout, stderr, exit_code = run_command(f"node -c {file_path}")
        if exit_code == 0:
            results.test_pass(f"Syntax check: {file_path}")
        else:
            results.test_fail(f"Syntax check: {file_path}", f"Exit code {exit_code}: {stderr}")

def test_health_endpoint(results: TestResults):
    """Test 2: Health endpoint verification"""
    print("\n🏥 Testing Health Endpoint...")
    
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                results.test_pass("Health endpoint returns healthy status")
            else:
                results.test_fail("Health endpoint status", f"Status: {data.get('status')}")
        else:
            results.test_fail("Health endpoint HTTP", f"Status code: {response.status_code}")
    except Exception as e:
        results.test_fail("Health endpoint connection", str(e))

def test_migration_function_signature(results: TestResults):
    """Test 3: Verify migrateNumbersToCallControlApp function signature"""
    print("\n📝 Testing Migration Function Signature...")
    
    # Check function signature in telnyx-service.js
    stdout, stderr, exit_code = run_command("grep -n 'async function migrateNumbersToCallControlApp' /app/js/telnyx-service.js")
    
    if exit_code == 0 and "callControlAppId, botNumbers = [], sipConnectionId = ''" in stdout:
        results.test_pass("migrateNumbersToCallControlApp accepts 3 parameters")
    else:
        results.test_fail("migrateNumbersToCallControlApp signature", "Function signature doesn't match expected pattern")
    
    # Check for normalizedBotNumbers Set
    stdout, stderr, exit_code = run_command("grep -n 'normalizedBotNumbers.*Set' /app/js/telnyx-service.js")
    if exit_code == 0:
        results.test_pass("normalizedBotNumbers Set exists for comparison")
    else:
        results.test_fail("normalizedBotNumbers Set", "Set not found in function")

def test_detach_logic(results: TestResults):
    """Test 4: Verify external number detach logic"""
    print("\n🔌 Testing External Number Detach Logic...")
    
    # Check for detach logic patterns
    patterns_to_check = [
        ("DETACHED external number", "Detach log message pattern"),
        ("connection_id.*restoreConnectionId", "SIP connection ID assignment"),
        ("connection_id.*null", "Null assignment for no SIP connection"),
        ("detached\\+\\+", "Detached counter increment")
    ]
    
    for pattern, description in patterns_to_check:
        stdout, stderr, exit_code = run_command(f"grep -n '{pattern}' /app/js/telnyx-service.js")
        if exit_code == 0:
            results.test_pass(f"Detach logic: {description}")
        else:
            results.test_fail(f"Detach logic: {description}", f"Pattern '{pattern}' not found")

def test_db_filtering_logic(results: TestResults):
    """Test 5: Verify DB filtering and parameter passing"""
    print("\n🗄️ Testing DB Filtering Logic...")
    
    # Check DB query pattern
    stdout, stderr, exit_code = run_command("grep -n \"db.collection('phoneNumbersOf').find({}).toArray()\" /app/js/_index.js")
    if exit_code == 0:
        results.test_pass("DB query for phoneNumbersOf collection")
    else:
        results.test_fail("DB query", "phoneNumbersOf query not found")
    
    # Check filtering logic
    stdout, stderr, exit_code = run_command("grep -n \"n.provider === 'telnyx' && n.status === 'active' && n.phoneNumber\" /app/js/_index.js")
    if exit_code == 0:
        results.test_pass("Telnyx active number filtering")
    else:
        results.test_fail("Telnyx filtering", "Active Telnyx number filter not found")
    
    # Check sipConnectionId parameter passing
    stdout, stderr, exit_code = run_command("grep -n 'telnyxResources.sipConnectionId.*process.env.TELNYX_SIP_CONNECTION_ID' /app/js/_index.js")
    if exit_code == 0:
        results.test_pass("SIP connection ID parameter passing")
    else:
        results.test_fail("SIP connection ID", "Parameter passing logic not found")

def test_startup_logs(results: TestResults):
    """Test 6: Verify startup log messages"""
    print("\n📋 Testing Startup Log Verification...")
    
    # Get recent logs
    stdout, stderr, exit_code = run_command("tail -n 200 /var/log/supervisor/nodejs.out.log")
    
    if exit_code == 0:
        # Check for Telnyx migration complete log with expected format
        if "[Telnyx] Migration complete:" in stdout:
            results.test_pass("Telnyx migration complete log found")
            
            # Check for external count in the log
            if "external" in stdout:
                results.test_pass("External count in migration log")
            else:
                results.test_fail("External count", "External count not found in migration log")
                
            # Check for "already correct" pattern (bot numbers)
            if "already correct" in stdout:
                results.test_pass("Already correct count in migration log")
            else:
                results.test_fail("Already correct", "Already correct count not found in logs")
        else:
            results.test_fail("Migration log", "Telnyx migration complete log not found")
    else:
        results.test_fail("Startup logs", f"Could not read logs: {stderr}")

def test_function_exports(results: TestResults):
    """Test 7: Verify function exports"""
    print("\n📤 Testing Function Exports...")
    
    # Check if migrateNumbersToCallControlApp is exported
    stdout, stderr, exit_code = run_command("grep -n 'migrateNumbersToCallControlApp,' /app/js/telnyx-service.js")
    if exit_code == 0:
        results.test_pass("migrateNumbersToCallControlApp is exported")
    else:
        results.test_fail("Function export", "migrateNumbersToCallControlApp not found in exports")

def test_regression_sip_fixes(results: TestResults):
    """Test 8: Verify previous SIP fixes are intact"""
    print("\n🔄 Testing Regression - Previous SIP Fixes...")
    
    # Check for token recovery in _attemptTwilioDirectCall
    stdout, stderr, exit_code = run_command("grep -n 'recovering from Twilio API' /app/js/voice-service.js")
    if exit_code == 0:
        results.test_pass("Token recovery in _attemptTwilioDirectCall")
    else:
        results.test_fail("Token recovery", "Token recovery logic not found")
    
    # Check for ANI restore
    stdout, stderr, exit_code = run_command("grep -n 'Restore connection ANI' /app/js/voice-service.js")
    if exit_code == 0:
        results.test_pass("ANI restore logic")
    else:
        results.test_fail("ANI restore", "ANI restore logic not found")
    
    # Check for Twilio Sync recovery
    stdout, stderr, exit_code = run_command("grep -n 'RECOVERED credentials' /app/js/_index.js")
    if exit_code == 0:
        results.test_pass("Twilio Sync credential recovery")
    else:
        results.test_fail("Twilio Sync", "Sync credential recovery not found")
    
    # Check for smartWallet imports
    stdout, stderr, exit_code = run_command("grep -n 'smartWalletDeduct.*smartWalletCheck' /app/js/voice-service.js")
    if exit_code == 0:
        results.test_pass("smartWallet functions imported")
    else:
        results.test_fail("smartWallet imports", "smartWallet functions not imported")

def test_error_log_check(results: TestResults):
    """Test 9: Verify error log is clean"""
    print("\n🚨 Testing Error Log Status...")
    
    stdout, stderr, exit_code = run_command("wc -c /var/log/supervisor/nodejs.err.log")
    if exit_code == 0:
        size = stdout.strip().split()[0]
        if size == "0":
            results.test_pass("Error log is 0 bytes (clean)")
        else:
            results.test_fail("Error log", f"Error log has {size} bytes")
    else:
        results.test_fail("Error log check", f"Could not check error log: {stderr}")

def main():
    print("🧪 Backend Test Suite - External Number Detach Fix")
    print("=" * 60)
    
    results = TestResults()
    
    # Run all tests
    test_syntax_checks(results)
    test_health_endpoint(results)
    test_migration_function_signature(results)
    test_detach_logic(results)
    test_db_filtering_logic(results)
    test_startup_logs(results)
    test_function_exports(results)
    test_regression_sip_fixes(results)
    test_error_log_check(results)
    
    # Print summary
    success = results.summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()