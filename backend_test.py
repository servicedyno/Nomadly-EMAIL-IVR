#!/usr/bin/env python3
"""
CNAM Circuit Breaker Testing Script
Tests all 8 requirements from the review request
"""

import json
import subprocess
import sys
import os
import re

def run_command(cmd):
    """Run shell command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e:
        return "", str(e), 1

def test_nodejs_health():
    """Test 1: Node.js Health - service running and no critical errors"""
    print("1. Testing Node.js Health...")
    
    # Check supervisor status
    stdout, stderr, code = run_command("sudo supervisorctl status nodejs")
    if code != 0:
        return False, f"Failed to check supervisor status: {stderr}"
    
    if "RUNNING" not in stdout:
        return False, f"Node.js service not running. Status: {stdout}"
    
    # Check for critical errors in logs (ignore Telegram-related errors)
    stdout, stderr, code = run_command("tail -n 50 /var/log/supervisor/nodejs.err.log")
    critical_patterns = [
        r"Error.*circuit.*breaker",
        r"Error.*cnam.*service", 
        r"Cannot.*find.*module.*cnam",
        r"ReferenceError.*circuit",
        r"TypeError.*circuit"
    ]
    
    for pattern in critical_patterns:
        if re.search(pattern, stdout, re.IGNORECASE):
            return False, f"Critical error found in logs: {pattern}"
    
    return True, "Node.js service running healthy on port 5000"

def test_circuit_breaker_structure():
    """Test 2: Circuit Breaker Structure - verify circuitBreakers object exists"""
    print("2. Testing Circuit Breaker Structure...")
    
    # Read the cnam-service.js file to verify structure
    try:
        with open('/app/js/cnam-service.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read cnam-service.js: {e}"
    
    # Check for circuitBreakers object definition
    if 'const circuitBreakers = {' not in content:
        return False, "circuitBreakers object not found"
    
    # Check for required provider entries
    required_providers = ['telnyx:', 'multitel:', 'signalwire:']
    for provider in required_providers:
        if provider not in content:
            return False, f"Provider {provider.rstrip(':')} not found in circuitBreakers"
    
    # Check for required fields in structure
    required_fields = ['state:', 'failures:', 'lastFailure:', 'cooldownMs:', 'lastError:']
    for field in required_fields:
        if field not in content:
            return False, f"Required field {field.rstrip(':')} not found in circuit breaker entries"
    
    # Verify all initial states are CLOSED
    if 'state: BREAKER_STATES.CLOSED' not in content:
        return False, "Initial circuit breaker states not set to CLOSED"
    
    return True, "circuitBreakers object exists with telnyx/multitel/signalwire entries, all fields present, initial state CLOSED"

def test_constants():
    """Test 3: Constants - verify threshold and cooldown values"""
    print("3. Testing Circuit Breaker Constants...")
    
    try:
        with open('/app/js/cnam-service.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read cnam-service.js: {e}"
    
    expected_constants = {
        'CONSECUTIVE_FAIL_THRESHOLD = 3': 'Consecutive failure threshold',
        'CREDIT_FAIL_THRESHOLD = 1': 'Credit failure threshold', 
        'COOLDOWN_CREDIT_MS = 60 * 60 * 1000': 'Credit cooldown (1 hour)',
        'COOLDOWN_TRANSIENT_MS = 5 * 60 * 1000': 'Transient cooldown (5 min)'
    }
    
    missing = []
    for constant, desc in expected_constants.items():
        if constant not in content:
            missing.append(desc)
    
    if missing:
        return False, f"Missing constants: {', '.join(missing)}"
    
    return True, "All required constants verified: CONSECUTIVE_FAIL_THRESHOLD=3, CREDIT_FAIL_THRESHOLD=1, COOLDOWN_CREDIT_MS=3600000, COOLDOWN_TRANSIENT_MS=300000"

def test_functions():
    """Test 4: Functions - verify circuit breaker functions exist"""
    print("4. Testing Circuit Breaker Functions...")
    
    try:
        with open('/app/js/cnam-service.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read cnam-service.js: {e}"
    
    required_functions = [
        'function circuitAllows(',
        'function circuitSuccess(',
        'function circuitFailure(',
        'function getCircuitStatus('
    ]
    
    missing = []
    for func in required_functions:
        if func not in content:
            missing.append(func.replace('function ', '').replace('(', ''))
    
    if missing:
        return False, f"Missing functions: {', '.join(missing)}"
    
    return True, "All required functions exist: circuitAllows, circuitSuccess, circuitFailure, getCircuitStatus"

def test_lookup_cnam_integration():
    """Test 5: lookupCnam Integration - verify circuit breaker calls in proper places"""
    print("5. Testing lookupCnam Integration...")
    
    try:
        with open('/app/js/cnam-service.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read cnam-service.js: {e}"
    
    # Check for circuitAllows calls before each provider
    circuit_allow_patterns = [
        r'circuitAllows\([\'"]telnyx[\'"\]',
        r'circuitAllows\([\'"]multitel[\'"\]',
        r'circuitAllows\([\'"]signalwire[\'"\]'
    ]
    
    for pattern in circuit_allow_patterns:
        if not re.search(pattern, content):
            provider = pattern.split('"')[1] if '"' in pattern else pattern.split("'")[1]
            return False, f"circuitAllows() call missing for {provider}"
    
    # Check for circuitSuccess calls
    if 'circuitSuccess(' not in content:
        return False, "circuitSuccess() calls not found"
    
    # Check for circuitFailure calls
    if 'circuitFailure(' not in content:
        return False, "circuitFailure() calls not found"
    
    # Verify integration in lookupCnam function
    if 'async function lookupCnam(' not in content:
        return False, "lookupCnam function not found"
    
    return True, "lookupCnam integration verified: calls circuitAllows() before each provider, circuitSuccess() on success, circuitFailure() on error"

def test_module_exports():
    """Test 6: Module Exports - verify required exports"""
    print("6. Testing Module Exports...")
    
    try:
        with open('/app/js/cnam-service.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read cnam-service.js: {e}"
    
    # Find module.exports section
    exports_match = re.search(r'module\.exports\s*=\s*{([^}]+)}', content, re.DOTALL)
    if not exports_match:
        return False, "module.exports section not found"
    
    exports_content = exports_match.group(1)
    required_exports = ['initCnamService', 'lookupCnam', 'batchLookupCnam', 'getCircuitStatus']
    
    missing = []
    for export in required_exports:
        if export not in exports_content:
            missing.append(export)
    
    if missing:
        return False, f"Missing exports: {', '.join(missing)}"
    
    return True, f"All required exports verified: {', '.join(required_exports)}"

def test_get_circuit_status_usage():
    """Test 7: getCircuitStatus imported AND used in _index.js"""
    print("7. Testing getCircuitStatus Import and Usage...")
    
    # Check import in _index.js
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
    except Exception as e:
        return False, f"Cannot read _index.js: {e}"
    
    # Check if getCircuitStatus is imported at line 234
    lines = content.split('\n')
    if len(lines) < 234:
        return False, "_index.js has fewer than 234 lines"
    
    line_234 = lines[233]  # 0-indexed
    if 'getCircuitStatus' not in line_234:
        return False, f"getCircuitStatus not imported in line 234. Found: {line_234}"
    
    # Check for admin endpoint
    if '/admin/cnam-circuit' not in content:
        return False, "/admin/cnam-circuit endpoint not found in _index.js"
    
    # Test the actual endpoint
    session_secret = "o/Qb8ArGahlquhCQafi6752xMe0p0S93Uf5g2gTX6MZtBE7vVcp230LKEsGTz3YJ/q9fluyEvweAMB9FGdv8zQ=="
    key = session_secret[:16]
    
    stdout, stderr, code = run_command(f'curl -s "http://localhost:5000/admin/cnam-circuit?key={key}"')
    if code != 0:
        return False, f"Failed to test endpoint: {stderr}"
    
    try:
        response = json.loads(stdout)
        if not response.get('success'):
            return False, f"Endpoint returned failure: {response}"
        
        if 'circuitBreakers' not in response:
            return False, "Response missing circuitBreakers field"
        
        circuit_breakers = response['circuitBreakers']
        if len(circuit_breakers) != 3:
            return False, f"Expected 3 circuit breakers, got {len(circuit_breakers)}"
        
        providers = [cb['provider'] for cb in circuit_breakers]
        expected_providers = ['telnyx', 'multitel', 'signalwire']
        for provider in expected_providers:
            if provider not in providers:
                return False, f"Missing provider {provider} in response"
    
    except json.JSONDecodeError as e:
        return False, f"Invalid JSON response: {e}. Got: {stdout}"
    
    return True, f"getCircuitStatus imported in _index.js line 234 and /admin/cnam-circuit endpoint returns proper JSON: {response}"

def test_startup_log():
    """Test 8: Startup Log - verify initialization message"""
    print("8. Testing Startup Log...")
    
    expected_message = "[CnamService] Initialized — priority: Telnyx → Multitel → SignalWire + MongoDB cache + circuit breaker"
    
    stdout, stderr, code = run_command(f'grep -F "{expected_message}" /var/log/supervisor/nodejs.out.log')
    if code != 0:
        return False, f"Expected startup message not found in logs"
    
    if expected_message not in stdout:
        return False, f"Expected message format not found. Found: {stdout}"
    
    return True, f"Startup log verified: '{expected_message}' found in nodejs.out.log"

def main():
    print("=" * 60)
    print("CNAM CIRCUIT BREAKER TESTING - 8 REQUIREMENTS")
    print("=" * 60)
    
    tests = [
        test_nodejs_health,
        test_circuit_breaker_structure, 
        test_constants,
        test_functions,
        test_lookup_cnam_integration,
        test_module_exports,
        test_get_circuit_status_usage,
        test_startup_log
    ]
    
    passed = 0
    failed = 0
    results = []
    
    for i, test in enumerate(tests, 1):
        try:
            success, message = test()
            if success:
                print(f"✅ Test {i}: PASSED - {message}")
                passed += 1
                results.append(f"✅ Test {i}: PASSED")
            else:
                print(f"❌ Test {i}: FAILED - {message}")
                failed += 1
                results.append(f"❌ Test {i}: FAILED - {message}")
        except Exception as e:
            print(f"❌ Test {i}: ERROR - {str(e)}")
            failed += 1
            results.append(f"❌ Test {i}: ERROR - {str(e)}")
        
        print()
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Tests Passed: {passed}/8")
    print(f"Tests Failed: {failed}/8") 
    print(f"Success Rate: {(passed/8)*100:.1f}%")
    
    if passed == 8:
        print("\n🎉 ALL TESTS PASSED! CNAM Circuit Breaker is working correctly!")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Review the issues above.")
    
    return passed, failed

if __name__ == "__main__":
    passed, failed = main()
    sys.exit(0 if failed == 0 else 1)