#!/usr/bin/env python3
"""
Comprehensive Wallet Payment Bug Fix Testing for Nomadly Node.js Backend
Testing the fix for global wallet handler intercepting payment-specific handlers.
"""

import requests
import subprocess
import re
import os
import json
from typing import Dict, List, Tuple

def test_nodejs_health() -> Tuple[bool, str]:
    """Test 1: Node.js health check"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                return True, f"✅ Health check passed: {data}"
            else:
                return False, f"❌ Health check failed: {data}"
        else:
            return False, f"❌ Health check returned status {response.status_code}"
    except Exception as e:
        return False, f"❌ Health check failed with exception: {str(e)}"

def test_error_log_empty() -> Tuple[bool, str]:
    """Test 2: Error log should be empty"""
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Check file size (should be 0 bytes)
            if ' 0 ' in result.stdout:
                return True, "✅ Error log is empty (0 bytes)"
            else:
                # Check actual content
                content_result = subprocess.run(['cat', '/var/log/supervisor/nodejs.err.log'], 
                                              capture_output=True, text=True)
                if content_result.stdout.strip() == '':
                    return True, "✅ Error log is empty"
                else:
                    return False, f"❌ Error log contains: {content_result.stdout[:200]}"
        else:
            return False, "❌ Could not check error log file"
    except Exception as e:
        return False, f"❌ Error checking log: {str(e)}"

def test_payactions_array() -> Tuple[bool, str]:
    """Test 3: _payActions array should contain exactly 8 payment actions"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find the _payActions array definition
        pattern = r"const _payActions = \[(.*?)\]"
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            array_content = match.group(1)
            # Extract quoted strings
            actions = re.findall(r"'([^']*)'", array_content)
            
            expected_actions = [
                'phone-pay', 'domain-pay', 'hosting-pay', 'vps-plan-pay', 
                'vps-upgrade-plan-pay', 'digital-product-pay', 'virtual-card-pay', 'leads-pay'
            ]
            
            if len(actions) == 8 and set(actions) == set(expected_actions):
                return True, f"✅ _payActions array contains exactly 8 required actions: {actions}"
            else:
                return False, f"❌ _payActions array mismatch. Found: {actions}, Expected: {expected_actions}"
        else:
            return False, "❌ _payActions array not found"
    except Exception as e:
        return False, f"❌ Error checking _payActions array: {str(e)}"

def test_global_wallet_conditional() -> Tuple[bool, str]:
    """Test 4: Global wallet conditional should have proper guard"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Find line ~9290
        for i, line in enumerate(lines[9285:9295], 9286):
            if 'if (message === user.wallet && !_payActions.includes(action))' in line.strip():
                return True, f"✅ Global wallet conditional found at line {i}: {line.strip()}"
        
        return False, "❌ Global wallet conditional with proper guard not found around line 9290"
    except Exception as e:
        return False, f"❌ Error checking global wallet conditional: {str(e)}"

def test_phone_pay_handler() -> Tuple[bool, str]:
    """Test 5: Phone-pay handler should have wallet check"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Find the phone-pay handler and its wallet check
        found_handler = False
        found_wallet_check = False
        
        for i, line in enumerate(lines):
            if "if (action === 'phone-pay')" in line:
                found_handler = True
                handler_start = i
                # Look for wallet check in next 50 lines
                for j in range(i, min(i+50, len(lines))):
                    if 'if (payOption === payIn.wallet)' in lines[j]:
                        if 'goto.walletSelectCurrency()' in lines[j+1] or 'goto.walletSelectCurrency()' in lines[j+2]:
                            found_wallet_check = True
                            wallet_line = j + 1
                            break
                break
        
        if found_handler and found_wallet_check:
            return True, f"✅ Phone-pay handler at line {handler_start+1} has wallet check at line {wallet_line} calling goto.walletSelectCurrency()"
        else:
            return False, f"❌ Phone-pay handler wallet check not found. Handler: {found_handler}, Wallet: {found_wallet_check}"
    except Exception as e:
        return False, f"❌ Error checking phone-pay handler: {str(e)}"

def test_leads_pay_handler() -> Tuple[bool, str]:
    """Test 6: Leads-pay handler should have wallet check"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Find the leads-pay handler and its wallet check
        found_handler = False
        found_wallet_check = False
        handler_line = 0
        
        for i, line in enumerate(lines):
            if "if (action === 'leads-pay')" in line:
                found_handler = True
                handler_line = i + 1
                # Look for wallet check in next 30 lines
                for j in range(i, min(i+30, len(lines))):
                    if 'if (payOption === payIn.wallet)' in lines[j]:
                        if 'goto.walletSelectCurrency()' in lines[j+1] or 'goto.walletSelectCurrency()' in lines[j+2]:
                            found_wallet_check = True
                            wallet_line = j + 1
                            break
                break
        
        if found_handler and found_wallet_check:
            return True, f"✅ Leads-pay handler at line {handler_line} has wallet check at line {wallet_line} calling goto.walletSelectCurrency()"
        else:
            return False, f"❌ Leads-pay handler wallet check not found. Handler: {found_handler}, Wallet: {found_wallet_check}"
    except Exception as e:
        return False, f"❌ Error checking leads-pay handler: {str(e)}"

def test_handler_ordering() -> Tuple[bool, str]:
    """Test 7: Verify leads-pay handler is AFTER global wallet check"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        global_check_line = 0
        leads_handler_line = 0
        
        for i, line in enumerate(lines):
            if 'if (message === user.wallet && !_payActions.includes(action))' in line:
                global_check_line = i + 1
            if "if (action === 'leads-pay')" in line:
                leads_handler_line = i + 1
        
        if global_check_line > 0 and leads_handler_line > 0:
            if leads_handler_line > global_check_line:
                return True, f"✅ Leads-pay handler (line {leads_handler_line}) is AFTER global wallet check (line {global_check_line})"
            else:
                return False, f"❌ Leads-pay handler (line {leads_handler_line}) is BEFORE global wallet check (line {global_check_line})"
        else:
            return False, f"❌ Could not find both handlers. Global: {global_check_line}, Leads: {leads_handler_line}"
    except Exception as e:
        return False, f"❌ Error checking handler ordering: {str(e)}"

def test_payment_handlers_before_global() -> Tuple[bool, str]:
    """Test 8: Verify 6 payment handlers BEFORE global wallet check have payIn.wallet checks"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            lines = f.readlines()
        
        # Use known global wallet check line (confirmed in test 4)
        global_check_line = 9290
        
        # Expected handlers before global check (from review request)
        expected_handlers = [
            ('digital-product-pay', r'if \(action === a\.digitalProductPay\)', 5794),
            ('virtual-card-pay', r'if \(action === a\.virtualCardPay\)', 5970),
            ('domain-pay', r'if \(action === \'domain-pay\'\)', 7671),
            ('hosting-pay', r'if \(action === \'hosting-pay\'\)', 7787),
            ('vps-plan-pay', r'if \(action === \'vps-plan-pay\'\)', 7944),
            ('vps-upgrade-plan-pay', r'if \(action === \'vps-upgrade-plan-pay\'\)', 8048)
        ]
        
        results = []
        for name, handler_pattern, expected_line in expected_handlers:
            # Find handler
            handler_matches = list(re.finditer(handler_pattern, content))
            
            if handler_matches:
                handler_match = handler_matches[0]
                handler_line_num = content[:handler_match.start()].count('\n') + 1
                
                # Verify it's before global check
                if handler_line_num < global_check_line:
                    # Look for wallet check after this handler
                    handler_section = content[handler_match.start():handler_match.start()+2000]  # Look in next 2000 chars
                    if 'if (payOption === payIn.wallet)' in handler_section:
                        results.append(f"✅ {name} (line {handler_line_num}): before global check (line {global_check_line}), wallet check found")
                    else:
                        results.append(f"❌ {name} (line {handler_line_num}): before global check, but wallet check missing")
                else:
                    results.append(f"❌ {name} (line {handler_line_num}): handler is AFTER global check (line {global_check_line})")
            else:
                results.append(f"❌ {name}: handler not found")
        
        # Check if all passed
        failed_count = sum(1 for r in results if r.startswith('❌'))
        if failed_count == 0:
            return True, f"✅ All 6 payment handlers before global check have wallet checks:\n" + "\n".join(results)
        else:
            return False, f"❌ {failed_count}/6 payment handlers failed:\n" + "\n".join(results)
            
    except Exception as e:
        return False, f"❌ Error checking payment handlers: {str(e)}"

def main():
    """Run comprehensive wallet payment bug fix tests"""
    print("=== COMPREHENSIVE WALLET PAYMENT BUG FIX TESTING ===")
    print("Testing the fix for global wallet handler intercepting payment-specific handlers")
    print()
    
    tests = [
        ("Node.js Health Check", test_nodejs_health),
        ("Error Log Empty", test_error_log_empty),
        ("_payActions Array (8 actions)", test_payactions_array),
        ("Global Wallet Conditional Guard", test_global_wallet_conditional),
        ("Phone-Pay Handler Wallet Check", test_phone_pay_handler),
        ("Leads-Pay Handler Wallet Check", test_leads_pay_handler),
        ("Handler Ordering (leads-pay after global)", test_handler_ordering),
        ("6 Payment Handlers Before Global Check", test_payment_handlers_before_global)
    ]
    
    passed = 0
    total = len(tests)
    
    for i, (test_name, test_func) in enumerate(tests, 1):
        print(f"Test {i}/{total}: {test_name}")
        success, message = test_func()
        print(f"  {message}")
        if success:
            passed += 1
        print()
    
    print(f"=== RESULTS ===")
    print(f"Passed: {passed}/{total} ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Wallet payment bug fix is working correctly!")
        print("\nKEY VERIFICATION POINTS:")
        print("✅ Node.js backend healthy and accessible")
        print("✅ _payActions guard array contains exactly 8 payment actions including 'leads-pay'") 
        print("✅ Global wallet conditional properly guards against payment flow interference")
        print("✅ Phone-pay and leads-pay handlers have intact wallet checks")
        print("✅ Leads-pay handler is positioned after global wallet check")
        print("✅ All 6 payment handlers before global check retain their wallet functionality")
        print("\n🔧 ROOT CAUSE FIX CONFIRMED: Global 'if (message === user.wallet)' handler")
        print("   now checks !_payActions.includes(action) to prevent intercepting wallet")
        print("   button presses during payment flows, allowing payment-specific handlers")
        print("   to process wallet payments correctly.")
    else:
        print(f"❌ {total - passed} tests failed - Issues need to be addressed")
        
    return passed == total

if __name__ == "__main__":
    main()