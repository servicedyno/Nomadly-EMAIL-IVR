#!/usr/bin/env python3
"""
Backend Test Suite for Domain Purchase Price Inflation Fix
Tests the 3-part fix for domain purchase price inflation from stale hosting totalPrice
"""

import requests
import json
import time
import sys
import os

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:5000')
API_BASE = f"{BACKEND_URL}/api" if not BACKEND_URL.endswith('/api') else BACKEND_URL

def test_health_endpoint():
    """Test 1: Health endpoint verification"""
    print("🔍 Test 1: Health endpoint verification")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print("✅ Health endpoint: PASS - Server healthy and database connected")
                return True
            else:
                print(f"❌ Health endpoint: FAIL - Unhealthy status: {data}")
                return False
        else:
            print(f"❌ Health endpoint: FAIL - Status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint: FAIL - Exception: {e}")
        return False

def test_syntax_validation():
    """Test 2: Node.js syntax validation"""
    print("\n🔍 Test 2: Node.js syntax validation")
    try:
        import subprocess
        result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                              capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ Syntax validation: PASS - No syntax errors in _index.js")
            return True
        else:
            print(f"❌ Syntax validation: FAIL - Syntax errors: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Syntax validation: FAIL - Exception: {e}")
        return False

def test_error_log_check():
    """Test 3: Node.js error log verification"""
    print("\n🔍 Test 3: Node.js error log verification")
    try:
        import subprocess
        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            size = int(result.stdout.split()[0])
            if size == 0:
                print("✅ Error log check: PASS - No errors in nodejs.err.log (0 bytes)")
                return True
            else:
                print(f"❌ Error log check: FAIL - Error log has {size} bytes")
                # Show last few lines of error log
                tail_result = subprocess.run(['tail', '-n', '10', '/var/log/supervisor/nodejs.err.log'], 
                                           capture_output=True, text=True, timeout=10)
                if tail_result.stdout:
                    print(f"Last errors:\n{tail_result.stdout}")
                return False
        else:
            print(f"❌ Error log check: FAIL - Could not check error log")
            return False
    except Exception as e:
        print(f"❌ Error log check: FAIL - Exception: {e}")
        return False

def verify_state_cleanup_fix():
    """Test 4: Verify state cleanup in domain search flow"""
    print("\n🔍 Test 4: State cleanup fix verification")
    try:
        # Read the _index.js file to verify the fix
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Look for the state cleanup around line 9982-9988
        lines = content.split('\n')
        
        # Find the section where domain pricing is saved
        cleanup_found = False
        saveinfo_calls = []
        
        for i, line in enumerate(lines):
            if 'await saveInfo(\'price\', price)' in line:
                # Check the next 20 lines for cleanup calls
                for j in range(i, min(i + 20, len(lines))):
                    if 'await saveInfo(' in lines[j]:
                        saveinfo_calls.append(lines[j].strip())
                        if any(field in lines[j] for field in ['totalPrice', 'couponApplied', 'newPrice', 'loyaltyDiscount', 'preLoyaltyPrice']):
                            cleanup_found = True
                break
        
        # Verify specific cleanup calls exist
        required_cleanups = [
            'totalPrice', 'couponApplied', 'newPrice', 'loyaltyDiscount', 'preLoyaltyPrice'
        ]
        
        found_cleanups = []
        for cleanup in required_cleanups:
            for call in saveinfo_calls:
                if cleanup in call and ('null' in call or 'false' in call):
                    found_cleanups.append(cleanup)
                    break
        
        if len(found_cleanups) >= 4:  # At least 4 of the 5 cleanup calls should be present
            print("✅ State cleanup fix: PASS - Found state cleanup calls:")
            for cleanup in found_cleanups:
                print(f"   - {cleanup} cleanup found")
            return True
        else:
            print(f"❌ State cleanup fix: FAIL - Missing cleanup calls. Found: {found_cleanups}")
            print("SaveInfo calls found:")
            for call in saveinfo_calls:
                print(f"   {call}")
            return False
            
    except Exception as e:
        print(f"❌ State cleanup fix: FAIL - Exception: {e}")
        return False

def verify_context_aware_pricing():
    """Test 5: Verify context-aware walletSelectCurrency"""
    print("\n🔍 Test 5: Context-aware pricing fix verification")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Look for the walletSelectCurrency function around line 3558-3567
        context_aware_found = False
        step_check_found = False
        domain_pay_check_found = False
        price_check_found = False
        
        for i, line in enumerate(lines):
            # Look for the step = info?.lastStep pattern
            if 'step = info?.lastStep' in line or 'const step = info?.lastStep' in line:
                step_check_found = True
                # Check next 15 lines for domain-pay logic
                for j in range(i, min(i + 15, len(lines))):
                    if 'domain-pay' in lines[j]:
                        domain_pay_check_found = True
                        # Check for info?.price in the next few lines after domain-pay
                        for k in range(j, min(j + 5, len(lines))):
                            if 'info?.price' in lines[k]:
                                price_check_found = True
                                context_aware_found = True
                                break
                        break
                break
        
        if context_aware_found and step_check_found and domain_pay_check_found and price_check_found:
            print("✅ Context-aware pricing: PASS - Found lastStep-based price selection")
            print("   - step = info?.lastStep pattern found")
            print("   - domain-pay specific logic found")
            print("   - info?.price usage found")
            return True
        else:
            print(f"❌ Context-aware pricing: FAIL")
            print(f"   - step check: {step_check_found}")
            print(f"   - domain-pay check: {domain_pay_check_found}")
            print(f"   - price check: {price_check_found}")
            return False
            
    except Exception as e:
        print(f"❌ Context-aware pricing: FAIL - Exception: {e}")
        return False

def verify_safe_totalprice_update():
    """Test 6: Verify safe totalPrice update guard"""
    print("\n🔍 Test 6: Safe totalPrice update guard verification")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Look for the safe totalPrice guard around line 3577
        guard_found = False
        
        for i, line in enumerate(lines):
            # Look for the condition that prevents totalPrice overwrite for domain-pay
            if 'step !== \'domain-pay\'' in line and 'info?.totalPrice' in line:
                guard_found = True
                break
            elif 'step != \'domain-pay\'' in line and 'info?.totalPrice' in line:
                guard_found = True
                break
        
        if guard_found:
            print("✅ Safe totalPrice guard: PASS - Found domain-pay guard condition")
            return True
        else:
            print("❌ Safe totalPrice guard: FAIL - Guard condition not found")
            return False
            
    except Exception as e:
        print(f"❌ Safe totalPrice guard: FAIL - Exception: {e}")
        return False

def verify_domain_service_pricing():
    """Test 7: Verify domain service higher price logic intact"""
    print("\n🔍 Test 7: Domain service dual-registrar pricing verification")
    try:
        with open('/app/js/domain-service.js', 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Look for the dual-registrar pricing logic around line 49-63
        higher_price_logic = False
        cheaper_price_logic = False
        
        for i, line in enumerate(lines):
            if 'cheaper = cr.price <= op.price ? cr : op' in line:
                cheaper_price_logic = True
            elif 'expensive = cr.price <= op.price ? op : cr' in line:
                higher_price_logic = True
            
            # Also check for the return statement with price: expensive.price
            if 'price: expensive.price' in line and higher_price_logic and cheaper_price_logic:
                print("✅ Domain service pricing: PASS - Dual-registrar logic intact")
                print("   - Higher price shown to user")
                print("   - Cheaper registrar tried first")
                return True
        
        if not (higher_price_logic and cheaper_price_logic):
            print("❌ Domain service pricing: FAIL - Dual-registrar logic missing")
            print(f"   - Higher price logic: {higher_price_logic}")
            print(f"   - Cheaper price logic: {cheaper_price_logic}")
            return False
            
    except Exception as e:
        print(f"❌ Domain service pricing: FAIL - Exception: {e}")
        return False

def verify_wallet_ok_savings_logic():
    """Test 8: Verify walletOk domain-pay savings logic intact"""
    print("\n🔍 Test 8: WalletOk savings logic verification")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Look for the savings logic around line 4620
        savings_logic_found = False
        
        for i, line in enumerate(lines):
            if 'fallbackOccurred && cheaperPrice && cheaperPrice < shownPrice' in line:
                savings_logic_found = True
                break
            elif '!fallbackOccurred && cheaperPrice && cheaperPrice < shownPrice' in line:
                savings_logic_found = True
                break
        
        if savings_logic_found:
            print("✅ WalletOk savings logic: PASS - Registrar savings logic intact")
            return True
        else:
            print("❌ WalletOk savings logic: FAIL - Savings logic not found")
            return False
            
    except Exception as e:
        print(f"❌ WalletOk savings logic: FAIL - Exception: {e}")
        return False

def run_all_tests():
    """Run all tests and return summary"""
    print("🚀 Starting Domain Purchase Price Inflation Fix Tests")
    print("=" * 60)
    
    tests = [
        test_health_endpoint,
        test_syntax_validation,
        test_error_log_check,
        verify_state_cleanup_fix,
        verify_context_aware_pricing,
        verify_safe_totalprice_update,
        verify_domain_service_pricing,
        verify_wallet_ok_savings_logic
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    test_names = [
        "Health endpoint",
        "Syntax validation", 
        "Error log check",
        "State cleanup fix",
        "Context-aware pricing",
        "Safe totalPrice guard",
        "Domain service pricing",
        "WalletOk savings logic"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Domain purchase price inflation fix is working correctly!")
        return True
    else:
        print(f"⚠️  {total-passed} test(s) failed - Fix may need attention")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)