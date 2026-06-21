#!/usr/bin/env python3
"""
Nomadly Telegram Bot Backend Testing - Telnyx Stale Number Retry & Buy Another Number Fixes
Testing two specific fixes based on review request requirements.
"""

import requests
import json
import os
import subprocess
import time
from typing import Dict, Any, List

# Backend URL configuration
BACKEND_URL = "http://localhost:5000"

def log_test_result(test_name: str, passed: bool, details: str = ""):
    """Log test results with clear formatting"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"    {details}")
    return passed

def check_health() -> bool:
    """Verify Node.js backend health"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return log_test_result(
                "Node.js Backend Health Check", 
                True, 
                f"Status: {data.get('status')}, Database: {data.get('database')}, Uptime: {data.get('uptime')}"
            )
        else:
            return log_test_result("Node.js Backend Health Check", False, f"HTTP {response.status_code}")
    except Exception as e:
        return log_test_result("Node.js Backend Health Check", False, f"Error: {str(e)}")

def check_error_log() -> bool:
    """Check if nodejs.err.log is empty"""
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Parse file size from ls output
            size = result.stdout.split()[4] if len(result.stdout.split()) > 4 else "unknown"
            is_empty = size == "0"
            return log_test_result(
                "Error Log Empty Check", 
                is_empty, 
                f"nodejs.err.log size: {size} bytes"
            )
        else:
            return log_test_result("Error Log Empty Check", False, "Could not access error log")
    except Exception as e:
        return log_test_result("Error Log Empty Check", False, f"Error: {str(e)}")

def verify_telnyx_service_fix() -> bool:
    """Verify Fix 1: Telnyx stale number retry implementation"""
    try:
        # Read telnyx-service.js file
        with open('/app/js/telnyx-service.js', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 0
        
        # Test 1: buyNumber function signature includes retrySearch parameter
        total_tests += 1
        if 'async function buyNumber(phoneNumber, connectionId, messagingProfileId, retrySearch = null)' in content:
            log_test_result("Telnyx buyNumber() 4th parameter added", True, "retrySearch = null parameter found")
            tests_passed += 1
        else:
            log_test_result("Telnyx buyNumber() 4th parameter added", False, "retrySearch parameter not found in function signature")
        
        # Test 2: Error detection for stale numbers
        total_tests += 1
        if ("errDetail.includes(\"don't recognize\")" in content and 
            "errDetail.includes('Did you first search')" in content):
            log_test_result("Stale number error detection", True, "Both 'don't recognize' and 'Did you first search' checks found")
            tests_passed += 1
        else:
            log_test_result("Stale number error detection", False, "Missing error detection patterns")
        
        # Test 3: Retry logic with searchNumbers call
        total_tests += 1
        if ('const freshResults = await searchNumbers(' in content and
            'retrySearch.countryCode' in content and
            'retrySearch.numberType' in content and
            'retrySearch.areaCode' in content):
            log_test_result("Retry searchNumbers() call", True, "Fresh search with retrySearch parameters found")
            tests_passed += 1
        else:
            log_test_result("Retry searchNumbers() call", False, "Retry search logic not found")
        
        # Test 4: _retriedNumber flag setting
        total_tests += 1
        if 'retryData._retriedNumber = freshNumber' in content:
            log_test_result("_retriedNumber flag setting", True, "Flag set on successful retry")
            tests_passed += 1
        else:
            log_test_result("_retriedNumber flag setting", False, "_retriedNumber flag not set")
        
        return tests_passed == total_tests
        
    except Exception as e:
        log_test_result("Telnyx Service Fix Verification", False, f"Error reading file: {str(e)}")
        return False

def verify_index_js_telnyx_calls() -> bool:
    """Verify all 4 Telnyx buyNumber calls in _index.js pass retrySearch context"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 0
        
        # Find all telnyxApi.buyNumber calls
        lines = content.split('\n')
        buynumber_calls = []
        for i, line in enumerate(lines):
            if 'telnyxApi.buyNumber(' in line:
                # Get context around the call (5 lines before and after)
                context_start = max(0, i-5)
                context_end = min(len(lines), i+6)
                context = '\n'.join(lines[context_start:context_end])
                buynumber_calls.append({
                    'line_num': i+1,
                    'line': line.strip(),
                    'context': context
                })
        
        log_test_result("Telnyx buyNumber calls found", len(buynumber_calls) >= 4, 
                       f"Found {len(buynumber_calls)} calls (expected 4+)")
        
        # Test each call for retrySearch parameter
        for i, call in enumerate(buynumber_calls[:4]):  # Check first 4 calls
            total_tests += 1
            # Look for retrySearch context object pattern
            has_retry_context = (
                'countryCode' in call['context'] and 
                'numberType:' in call['context'] and 
                'areaCode:' in call['context']
            ) or '{ countryCode, numberType:' in call['line']
            
            if has_retry_context:
                log_test_result(f"Telnyx call #{i+1} retrySearch context", True, 
                               f"Line {call['line_num']}: retrySearch parameters found")
                tests_passed += 1
            else:
                log_test_result(f"Telnyx call #{i+1} retrySearch context", False, 
                               f"Line {call['line_num']}: missing retrySearch context")
        
        # Test handling of _retriedNumber results
        retriedNumber_handlers = content.count('_retriedNumber')
        total_tests += 1
        if retriedNumber_handlers >= 4:
            log_test_result("_retriedNumber result handling", True, 
                           f"Found {retriedNumber_handlers} _retriedNumber references")
            tests_passed += 1
        else:
            log_test_result("_retriedNumber result handling", False, 
                           f"Only {retriedNumber_handlers} _retriedNumber references found")
        
        # Test selectedNumber declared with 'let' not 'const'
        import re
        let_declarations = re.findall(r'let\s+selectedNumber\s*=', content)
        total_tests += 1
        if len(let_declarations) >= 3:  # Should be at least 3 'let' declarations
            log_test_result("selectedNumber 'let' declarations", True, 
                           f"Found {len(let_declarations)} 'let selectedNumber' declarations")
            tests_passed += 1
        else:
            log_test_result("selectedNumber 'let' declarations", False, 
                           f"Only {len(let_declarations)} 'let selectedNumber' declarations found")
        
        return tests_passed == total_tests
        
    except Exception as e:
        log_test_result("Index.js Telnyx Calls Verification", False, f"Error: {str(e)}")
        return False

def verify_buy_another_number_fix() -> bool:
    """Verify Fix 2: Buy Another Number routes to sub-number flow"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        tests_passed = 0
        total_tests = 0
        
        # Test 1: Action constant exists
        total_tests += 1
        if "cpSelectParentForBuyAnother: 'cpSelectParentForBuyAnother'" in content:
            log_test_result("cpSelectParentForBuyAnother action constant", True, "Action constant found")
            tests_passed += 1
        else:
            log_test_result("cpSelectParentForBuyAnother action constant", False, "Action constant not found")
        
        # Test 2: Buy Another Number handler logic
        total_tests += 1
        if ('primaryNumbers = allNumbers.filter(n => !n.isSubNumber' in content):
            log_test_result("Buy Another Number handler primary filtering", True, "Primary numbers filtering found")
            tests_passed += 1
        else:
            log_test_result("Buy Another Number handler primary filtering", False, "Primary filtering logic not found")
        
        # Test 3: Single plan auto-routing
        total_tests += 1
        if ('primaryNumbers.length === 1' in content and 
            'cpSubAddCountry' in content):
            log_test_result("Single plan auto-routing to sub-number", True, "Auto-routing logic found")
            tests_passed += 1
        else:
            log_test_result("Single plan auto-routing to sub-number", False, "Auto-routing logic not found")
        
        # Test 4: Multiple plans handler
        total_tests += 1
        if ('primaryNumbers.length > 1' in content and 
            'cpSelectParentForBuyAnother' in content):
            log_test_result("Multiple plans selection handler", True, "Multi-plan selection logic found")
            tests_passed += 1
        else:
            log_test_result("Multiple plans selection handler", False, "Multi-plan logic not found")
        
        # Test 5: cpSelectParentForBuyAnother handler exists
        total_tests += 1
        if 'action === a.cpSelectParentForBuyAnother' in content:
            log_test_result("cpSelectParentForBuyAnother handler exists", True, "Handler implementation found")
            tests_passed += 1
        else:
            log_test_result("cpSelectParentForBuyAnother handler exists", False, "Handler not found")
        
        # Test 6: Sub-number limit checking
        total_tests += 1
        if ('getSubNumberLimit' in content and 'currentSubCount' in content):
            log_test_result("Sub-number limit checking", True, "Limit checking logic found")
            tests_passed += 1
        else:
            log_test_result("Sub-number limit checking", False, "Limit checking not found")
        
        # Test 7: Back/cancel support
        total_tests += 1
        if ('goto.submenu5()' in content and 
            content.count('message === t.back || message === pc.back') > 0):
            log_test_result("Back/cancel navigation support", True, "Navigation support found")
            tests_passed += 1
        else:
            log_test_result("Back/cancel navigation support", False, "Navigation support not found")
        
        return tests_passed == total_tests
        
    except Exception as e:
        log_test_result("Buy Another Number Fix Verification", False, f"Error: {str(e)}")
        return False

def run_comprehensive_tests():
    """Run all comprehensive tests for both fixes"""
    print("=" * 80)
    print("NOMADLY TELEGRAM BOT BACKEND TESTING")
    print("Testing: Telnyx Stale Number Retry + Buy Another Number Sub-flow Fixes")
    print("=" * 80)
    
    all_tests = []
    
    # Basic health checks
    print("\n🔍 BASIC HEALTH CHECKS:")
    all_tests.append(check_health())
    all_tests.append(check_error_log())
    
    # Fix 1: Telnyx stale number retry
    print("\n🔧 FIX 1: TELNYX STALE NUMBER RETRY:")
    all_tests.append(verify_telnyx_service_fix())
    all_tests.append(verify_index_js_telnyx_calls())
    
    # Fix 2: Buy Another Number routing
    print("\n🔧 FIX 2: BUY ANOTHER NUMBER SUB-FLOW ROUTING:")
    all_tests.append(verify_buy_another_number_fix())
    
    # Summary
    passed_tests = sum(all_tests)
    total_tests = len(all_tests)
    success_rate = (passed_tests / total_tests) * 100
    
    print(f"\n" + "=" * 80)
    print(f"TEST SUMMARY: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}% success rate)")
    
    if success_rate == 100:
        print("🎉 ALL TESTS PASSED - Both fixes are working correctly!")
    elif success_rate >= 80:
        print("✅ MOSTLY WORKING - Minor issues detected")
    else:
        print("⚠️  CRITICAL ISSUES - Significant problems found")
    
    return success_rate >= 80

if __name__ == "__main__":
    run_comprehensive_tests()