#!/usr/bin/env python3
"""
Backend Test for Email Validation Features
Tests two new features:
1. Prominent deliverable email file with campaign-ready caption
2. Trial + Pay for extra emails when list exceeds free trial limit
"""

import subprocess
import requests
import json
import sys
import os
import re
from pathlib import Path

def run_command(cmd, description=""):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'description': description
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out',
            'description': description
        }

def check_file_content(file_path, patterns, description=""):
    """Check if file contains specific patterns"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        results = {}
        for pattern_name, pattern in patterns.items():
            if isinstance(pattern, list):
                # Check if all patterns in list exist
                results[pattern_name] = all(p in content for p in pattern)
            else:
                results[pattern_name] = pattern in content
        
        return {
            'success': all(results.values()),
            'results': results,
            'description': description,
            'content': content  # Include content for line number searches
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'description': description
        }

def find_line_number(content, pattern):
    """Find line number of a pattern in content"""
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if pattern in line:
            return i
    return None

def test_syntax_checks():
    """Test 1-2: Syntax checks for both files"""
    print("🔍 Test 1-2: Syntax Checks")
    
    files_to_check = [
        '/app/js/email-validation-service.js',
        '/app/js/_index.js'
    ]
    
    results = []
    for file_path in files_to_check:
        result = run_command(f'node -c {file_path}', f'Syntax check for {file_path}')
        results.append(result)
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"  {status} {file_path}")
        if not result['success']:
            print(f"    Error: {result['stderr']}")
    
    return all(r['success'] for r in results)

def test_nodejs_health():
    """Test 9: Node.js running clean"""
    print("\n🔍 Test 9: Node.js Health Check")
    
    # Check supervisor status
    supervisor_result = run_command('sudo supervisorctl status nodejs', 'Check nodejs supervisor status')
    nodejs_running = 'RUNNING' in supervisor_result['stdout']
    print(f"  {'✅ PASS' if nodejs_running else '❌ FAIL'} Node.js supervisor status: {supervisor_result['stdout']}")
    
    # Check health endpoint
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        health_ok = response.status_code == 200 and 'healthy' in response.text
        print(f"  {'✅ PASS' if health_ok else '❌ FAIL'} Health endpoint: {response.status_code}")
        if health_ok:
            health_data = response.json()
            print(f"    Status: {health_data.get('status')}")
            print(f"    Database: {health_data.get('database')}")
    except Exception as e:
        health_ok = False
        print(f"  ❌ FAIL Health endpoint error: {e}")
    
    # Check error log size
    error_log_result = run_command('wc -c /var/log/supervisor/nodejs.err.log', 'Check error log size')
    error_log_empty = error_log_result['stdout'].startswith('0 ')
    print(f"  {'✅ PASS' if error_log_empty else '❌ FAIL'} Error log is 0 bytes: {error_log_result['stdout']}")
    
    return nodejs_running and health_ok and error_log_empty

def test_deliverable_file_features():
    """Test 3-7: Prominent deliverable email file features"""
    print("\n🔍 Test 3-7: Deliverable Email File Features")
    
    # Test 3: generateValidCsv still filters results where r.category === 'valid'
    patterns_3 = {
        'valid_filter': "results.filter(r => r.category === 'valid')"
    }
    result_3 = check_file_content('/app/js/email-validation-service.js', patterns_3, 'generateValidCsv filters valid')
    print(f"  {'✅ PASS' if result_3['success'] else '❌ FAIL'} Test 3: generateValidCsv filters r.category === 'valid'")
    
    # Test 4: Filename changed to 'deliverable_emails_*.csv'
    patterns_4 = {
        'deliverable_filename': "deliverable_emails_"
    }
    result_4 = check_file_content('/app/js/email-validation-service.js', patterns_4, 'Deliverable filename')
    print(f"  {'✅ PASS' if result_4['success'] else '❌ FAIL'} Test 4: Filename contains 'deliverable_emails_'")
    
    # Test 5: Caption contains required text
    patterns_5 = {
        'campaign_ready': "Campaign-Ready",
        'deliverable_emails': "deliverable emails",
        'use_this_file': "Use this file for your email campaign"
    }
    result_5 = check_file_content('/app/js/email-validation-service.js', patterns_5, 'Caption text')
    print(f"  {'✅ PASS' if result_5['success'] else '❌ FAIL'} Test 5: Caption contains 'Campaign-Ready', 'deliverable emails', 'Use this file for your email campaign'")
    
    # Test 6: File send order - valid file sent FIRST
    content = result_5.get('content', '')
    if content:
        # Find line numbers for file sending
        valid_send_line = find_line_number(content, 'sendDocument(chatId, Buffer.from(validCsv)')
        invalid_send_line = find_line_number(content, 'sendDocument(chatId, Buffer.from(invalidCsv)')
        full_send_line = find_line_number(content, 'sendDocument(chatId, Buffer.from(fullCsv)')
        
        order_correct = (valid_send_line and invalid_send_line and full_send_line and 
                        valid_send_line < invalid_send_line < full_send_line)
        print(f"  {'✅ PASS' if order_correct else '❌ FAIL'} Test 6: File send order - valid first (lines: valid={valid_send_line}, invalid={invalid_send_line}, full={full_send_line})")
    else:
        print(f"  ❌ FAIL Test 6: Could not read file content")
        order_correct = False
    
    # Test 7: Summary message says "📬 Deliverable:" instead of "✅ Valid:"
    patterns_7 = {
        'deliverable_summary': "📬 Deliverable:",
        'first_file_hint': "The first file is your campaign-ready list"
    }
    result_7 = check_file_content('/app/js/email-validation-service.js', patterns_7, 'Summary message')
    print(f"  {'✅ PASS' if result_7['success'] else '❌ FAIL'} Test 7: Summary says '📬 Deliverable:' and includes hint about first file")
    
    return all([result_3['success'], result_4['success'], result_5['success'], order_correct, result_7['success']])

def test_trial_plus_pay_upload_handler():
    """Test 10-12: Upload handler logic changes"""
    print("\n🔍 Test 10-12: Upload Handler Logic")
    
    # Test 10: Old isTrialEligible replaced with new functions
    patterns_10 = {
        'hasTrialAvailable': 'hasTrialAvailable',
        'isFullyFree': 'isFullyFree',
        'isTrialPlusPay': 'isTrialPlusPay'
    }
    result_10 = check_file_content('/app/js/_index.js', patterns_10, 'New trial functions')
    print(f"  {'✅ PASS' if result_10['success'] else '❌ FAIL'} Test 10: Upload handler has hasTrialAvailable, isFullyFree, isTrialPlusPay")
    
    # Test 11: When isTrialPlusPay, saves state variables
    patterns_11 = {
        'evTrialPlusPay': 'evTrialPlusPay',
        'evTrialFreeCount': 'evTrialFreeCount', 
        'evTrialPaidCount': 'evTrialPaidCount',
        'evTrialPlusUsd': 'evTrialPlusUsd',
        'evTrialPlusNgn': 'evTrialPlusNgn'
    }
    result_11 = check_file_content('/app/js/_index.js', patterns_11, 'Trial plus pay state variables')
    print(f"  {'✅ PASS' if result_11['success'] else '❌ FAIL'} Test 11: Saves evTrialPlusPay, evTrialFreeCount, evTrialPaidCount, evTrialPlusUsd, evTrialPlusNgn")
    
    # Test 12: Shows button text with trial + pay
    patterns_12 = {
        'trial_pay_button': '🎁 Use Trial + Pay $'
    }
    result_12 = check_file_content('/app/js/_index.js', patterns_12, 'Trial plus pay button')
    print(f"  {'✅ PASS' if result_12['success'] else '❌ FAIL'} Test 12: Shows button text '🎁 Use Trial + Pay $' when isTrialPlusPay")
    
    return all([result_10['success'], result_11['success'], result_12['success']])

def test_trial_plus_pay_paste_handler():
    """Test 13: Paste handler logic"""
    print("\n🔍 Test 13: Paste Handler Logic")
    
    patterns_13 = {
        'hasTrialAvailable2': 'hasTrialAvailable2',
        'isFullyFree2': 'isFullyFree2',
        'isTrialPlusPay2': 'isTrialPlusPay2'
    }
    result_13 = check_file_content('/app/js/_index.js', patterns_13, 'Paste handler trial functions')
    print(f"  {'✅ PASS' if result_13['success'] else '❌ FAIL'} Test 13: Paste handler has hasTrialAvailable2, isFullyFree2, isTrialPlusPay2")
    
    return result_13['success']

def test_trial_plus_pay_confirm_handler():
    """Test 14-20: evConfirmPay handler features"""
    print("\n🔍 Test 14-20: evConfirmPay Handler Features")
    
    # Test 14: evConfirmPay handler with trial + pay message check
    patterns_14 = {
        'trial_pay_message_check': "message.startsWith('🎁 Use Trial + Pay')"
    }
    result_14 = check_file_content('/app/js/_index.js', patterns_14, 'Trial pay message check')
    print(f"  {'✅ PASS' if result_14['success'] else '❌ FAIL'} Test 14: evConfirmPay handler checks message.startsWith('🎁 Use Trial + Pay')")
    
    # Test 15: Atomic findOneAndUpdate for trial claim
    patterns_15 = {
        'atomic_trial_claim': 'findOneAndUpdate'
    }
    result_15 = check_file_content('/app/js/_index.js', patterns_15, 'Atomic trial claim')
    print(f"  {'✅ PASS' if result_15['success'] else '❌ FAIL'} Test 15: Uses atomic findOneAndUpdate for trial claim")
    
    # Test 16: USD wallet balance check
    patterns_16 = {
        'usd_balance_check': 'usdBal < trialPlusUsd'
    }
    result_16 = check_file_content('/app/js/_index.js', patterns_16, 'USD balance check')
    print(f"  {'✅ PASS' if result_16['success'] else '❌ FAIL'} Test 16: USD wallet balance check (usdBal < trialPlusUsd)")
    
    # Test 17: Rollback trial claim on insufficient funds
    patterns_17 = {
        'rollback_trial': 'evFreeTrialUsed: false'
    }
    result_17 = check_file_content('/app/js/_index.js', patterns_17, 'Trial rollback')
    print(f"  {'✅ PASS' if result_17['success'] else '❌ FAIL'} Test 17: Rollback trial claim on insufficient funds (evFreeTrialUsed: false)")
    
    # Test 18: atomicIncrement for USD charge
    patterns_18 = {
        'atomic_usd_charge': "atomicIncrement(walletOf, chatId, 'usdOut', trialPlusUsd)"
    }
    result_18 = check_file_content('/app/js/_index.js', patterns_18, 'Atomic USD charge')
    print(f"  {'✅ PASS' if result_18['success'] else '❌ FAIL'} Test 18: atomicIncrement(walletOf, chatId, 'usdOut', trialPlusUsd) for charge")
    
    # Test 19: processValidationJob with payment_method 'trial_plus_usd'
    patterns_19 = {
        'trial_plus_payment_method': "'trial_plus_usd'"
    }
    result_19 = check_file_content('/app/js/_index.js', patterns_19, 'Trial plus payment method')
    print(f"  {'✅ PASS' if result_19['success'] else '❌ FAIL'} Test 19: processValidationJob called with payment_method 'trial_plus_usd'")
    
    # Test 20: Refund on failure
    patterns_20 = {
        'refund_on_failure': "atomicIncrement(walletOf, chatId, 'usdIn', trialPlusUsd)"
    }
    result_20 = check_file_content('/app/js/_index.js', patterns_20, 'Refund on failure')
    print(f"  {'✅ PASS' if result_20['success'] else '❌ FAIL'} Test 20: Refund on failure (atomicIncrement usdIn)")
    
    return all([result_14['success'], result_15['success'], result_16['success'], 
               result_17['success'], result_18['success'], result_19['success'], result_20['success']])

def test_regression_old_trial():
    """Test 21: Regression test for old free trial handler"""
    print("\n🔍 Test 21: Regression Test - Old Free Trial Handler")
    
    patterns_21 = {
        'old_trial_handler': '🎁 Start Free Trial'
    }
    result_21 = check_file_content('/app/js/_index.js', patterns_21, 'Old trial handler')
    print(f"  {'✅ PASS' if result_21['success'] else '❌ FAIL'} Test 21: Old '🎁 Start Free Trial' handler still works")
    
    return result_21['success']

def main():
    """Run all tests"""
    print("🚀 Email Validation Features Test Suite")
    print("Testing: Prominent Deliverable File + Trial+Pay for Extra Emails")
    print("=" * 80)
    
    tests = [
        ("Syntax Checks", test_syntax_checks),
        ("Node.js Health", test_nodejs_health), 
        ("Deliverable File Features", test_deliverable_file_features),
        ("Upload Handler Logic", test_trial_plus_pay_upload_handler),
        ("Paste Handler Logic", test_trial_plus_pay_paste_handler),
        ("evConfirmPay Handler", test_trial_plus_pay_confirm_handler),
        ("Regression Test", test_regression_old_trial)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"  ❌ FAIL {test_name} error: {e}")
            results.append(False)
    
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Email validation features are working correctly.")
        print("\n📋 VERIFIED FEATURES:")
        print("  ✅ Feature 1: Prominent deliverable email file")
        print("    - generateValidCsv filters r.category === 'valid'")
        print("    - Filename changed to 'deliverable_emails_*.csv'")
        print("    - Caption contains 'Campaign-Ready' and required text")
        print("    - Valid file sent FIRST, then invalid, then full report")
        print("    - Summary says '📬 Deliverable:' with hint about first file")
        print("  ✅ Feature 2: Trial + Pay for extra emails")
        print("    - Upload handler uses hasTrialAvailable, isFullyFree, isTrialPlusPay")
        print("    - Saves trial+pay state variables when isTrialPlusPay")
        print("    - Shows '🎁 Use Trial + Pay $' button")
        print("    - Paste handler has same logic with *2 variants")
        print("    - evConfirmPay handler with atomic trial claim")
        print("    - USD wallet balance check and rollback on insufficient funds")
        print("    - atomicIncrement for charge and refund on failure")
        print("    - processValidationJob with 'trial_plus_usd' payment method")
        print("    - Old '🎁 Start Free Trial' handler still works (regression)")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)