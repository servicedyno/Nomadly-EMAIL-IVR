#!/usr/bin/env python3
"""
Email Blast Bug Fixes and UX Improvements Testing
Testing the Nomadly Telegram Bot backend Email Blast functionality
"""

import requests
import json
import time
import re
import subprocess
from pathlib import Path

# Test configuration
BACKEND_URL = "http://localhost:5000"
BACKEND_HEALTH_URL = f"{BACKEND_URL}/health"

# Test results tracker
test_results = {
    "passed": 0,
    "failed": 0,
    "errors": []
}

def log_result(test_name, passed, message=""):
    """Log test result and update counters"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{test_name}: {message}")

def check_nodejs_health():
    """Verify Node.js backend health"""
    try:
        response = requests.get(BACKEND_HEALTH_URL, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                log_result("Node.js Backend Health", True, f"Uptime: {data.get('uptime', 'unknown')}")
                return True
            else:
                log_result("Node.js Backend Health", False, f"Unhealthy response: {data}")
                return False
        else:
            log_result("Node.js Backend Health", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        log_result("Node.js Backend Health", False, f"Connection error: {str(e)}")
        return False

def check_error_logs():
    """Check for errors in nodejs error log"""
    try:
        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                               capture_output=True, text=True, check=True)
        size = int(result.stdout.split()[0])
        
        if size == 0:
            log_result("Error Log Check", True, "nodejs.err.log is empty (0 bytes)")
            return True
        else:
            log_result("Error Log Check", False, f"nodejs.err.log has {size} bytes of errors")
            return False
    except Exception as e:
        log_result("Error Log Check", False, f"Cannot check error log: {str(e)}")
        return False

def check_file_content(file_path, search_patterns):
    """Check if file contains expected patterns"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        results = {}
        for pattern_name, pattern in search_patterns.items():
            if isinstance(pattern, str):
                found = pattern in content
            else:  # regex pattern
                found = bool(re.search(pattern, content, re.MULTILINE))
            results[pattern_name] = found
            
        return results, content
    except Exception as e:
        return None, str(e)

def test_walletok_email_blast_crypto():
    """Test BUG FIX #1: walletOk['email_blast_crypto'] handler"""
    print("\n=== Testing BUG FIX #1: walletOk['email_blast_crypto'] handler ===")
    
    patterns = {
        "handler_exists": "'email_blast_crypto': async coin => {",
        "atomic_increment": "atomicIncrement(walletOf, chatId, 'usdOut', campaign.totalPrice)",
        "start_campaign": "emailBlastService.startCampaign(campaignId, 'crypto', coin",
        "try_catch": "try {",
        "catch_block": "} catch (err) {"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("walletOk email_blast_crypto handler", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("walletOk email_blast_crypto handler", True, "All required components found")
    else:
        log_result("walletOk email_blast_crypto handler", False, f"Missing: {', '.join(missing)}")

def test_ebpayment_wallet_handler():
    """Test BUG FIX #2: ebPayment wallet handler thread safety"""
    print("\n=== Testing BUG FIX #2: ebPayment wallet handler thread safety ===")
    
    patterns = {
        "action_check": "if \\(action === a\\.ebPayment\\)",
        "wallet_button": "'👛 Pay from Wallet'",
        "get_balance": "getBalance\\(walletOf, chatId\\)",
        "atomic_increment": "atomicIncrement\\(walletOf, chatId, 'usdOut', campaign\\.totalPrice\\)",
        "no_direct_mutation": "walletOf\\[chatId\\]\\.usd\\s*="
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("ebPayment wallet handler thread safety", False, f"Cannot read file: {content}")
        return
    
    # Check positive patterns (should exist)
    positive_patterns = ["action_check", "wallet_button", "get_balance", "atomic_increment"]
    positive_found = all(results[p] for p in positive_patterns)
    
    # Check negative pattern (should NOT exist)
    has_direct_mutation = results["no_direct_mutation"]
    
    if positive_found and not has_direct_mutation:
        log_result("ebPayment wallet handler thread safety", True, "Uses getBalance() and atomicIncrement(), no direct mutation")
    else:
        issues = []
        if not positive_found:
            missing = [p for p in positive_patterns if not results[p]]
            issues.append(f"Missing: {', '.join(missing)}")
        if has_direct_mutation:
            issues.append("Still uses direct wallet mutation")
        log_result("ebPayment wallet handler thread safety", False, "; ".join(issues))

def test_payactions_array():
    """Test BUG FIX #3: _payActions includes ebPayment"""
    print("\n=== Testing BUG FIX #3: _payActions includes ebPayment ===")
    
    # Look for the _payActions array definition
    try:
        with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the _payActions array
        pattern = r"const _payActions = \[(.*?)\]"
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            array_content = match.group(1)
            # Extract array elements
            elements = [elem.strip().strip("'\"") for elem in array_content.split(',')]
            elements = [e for e in elements if e and e != '']
            
            expected_elements = [
                'phone-pay', 'domain-pay', 'hosting-pay', 'vps-plan-pay', 
                'vps-upgrade-plan-pay', 'digital-product-pay', 'virtual-card-pay', 
                'leads-pay', 'ebPayment'
            ]
            
            if len(elements) == 9 and 'ebPayment' in elements:
                log_result("_payActions includes ebPayment", True, f"Found 9 elements including ebPayment: {elements}")
            else:
                log_result("_payActions includes ebPayment", False, f"Expected 9 elements with ebPayment, found: {elements}")
        else:
            log_result("_payActions includes ebPayment", False, "_payActions array not found")
            
    except Exception as e:
        log_result("_payActions includes ebPayment", False, f"Error reading file: {str(e)}")

def test_content_type_selection():
    """Test UX: Content type selection (ebSelectContentType)"""
    print("\n=== Testing UX: Content type selection (ebSelectContentType) ===")
    
    patterns = {
        "action_constant": "ebSelectContentType: 'ebSelectContentType'",
        "handler_exists": "if \\(action === a\\.ebSelectContentType\\)",
        "plain_text_option": "'📝 Type Plain Text'",
        "html_file_option": "'📎 Upload HTML File'",
        "save_content_type": "saveInfo\\('ebContentType'",
        "route_to_content": "a\\.ebEnterContent"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("Content type selection (ebSelectContentType)", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("Content type selection (ebSelectContentType)", True, "All components found")
    else:
        log_result("Content type selection (ebSelectContentType)", False, f"Missing: {', '.join(missing)}")

def test_enter_content_html_template():
    """Test UX: ebEnterContent wraps plain text in HTML template"""
    print("\n=== Testing UX: ebEnterContent HTML template wrapping ===")
    
    patterns = {
        "enter_content_handler": "if \\(action === a\\.ebEnterContent\\)",
        "doctype_html": "<!DOCTYPE html>",
        "html_template": "<html.*?>.*<body",
        "content_type_check": "info\\.ebContentType"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("ebEnterContent HTML template", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("ebEnterContent HTML template", True, "HTML template wrapping found")
    else:
        log_result("ebEnterContent HTML template", False, f"Missing: {', '.join(missing)}")

def test_test_email_constants():
    """Test UX: Test email action constants exist"""
    print("\n=== Testing UX: Test email action constants ===")
    
    patterns = {
        "ebTestEmail_constant": "ebTestEmail: 'ebTestEmail'",
        "ebTestEmailSent_constant": "ebTestEmailSent: 'ebTestEmailSent'"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("Test email action constants", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("Test email action constants", True, "Both constants found")
    else:
        log_result("Test email action constants", False, f"Missing: {', '.join(missing)}")

def test_preview_test_email_button():
    """Test UX: ebPreview handler has Send Test Email button"""
    print("\n=== Testing UX: ebPreview Send Test Email button ===")
    
    patterns = {
        "preview_handler": "if \\(action === a\\.ebPreview\\)",
        "send_test_button": "'📧 Send Test Email'",
        "route_to_test": "a\\.ebTestEmail"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("ebPreview Send Test Email button", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("ebPreview Send Test Email button", True, "Send Test Email button routing found")
    else:
        log_result("ebPreview Send Test Email button", False, f"Missing: {', '.join(missing)}")

def test_test_email_handler():
    """Test UX: ebTestEmail handler implementation"""
    print("\n=== Testing UX: ebTestEmail handler implementation ===")
    
    patterns = {
        "test_email_handler": "if \\(action === a\\.ebTestEmail\\)",
        "email_validation": "emailRegex\\.test\\(",
        "nodemailer_create": "nodemailer\\.createTransporter?",
        "brevo_config": "process\\.env\\.MAIL_DOMAIN",
        "mail_auth_user": "process\\.env\\.MAIL_AUTH_USER",
        "mail_auth_password": "process\\.env\\.MAIL_AUTH_PASSWORD",
        "test_prefix": "\\[TEST\\]",
        "route_to_sent": "a\\.ebTestEmailSent",
        "error_handling": "} catch \\(err\\) {"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("ebTestEmail handler", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("ebTestEmail handler", True, "Complete implementation found")
    else:
        log_result("ebTestEmail handler", False, f"Missing: {', '.join(missing)}")

def test_test_email_sent_handler():
    """Test UX: ebTestEmailSent handler implementation"""
    print("\n=== Testing UX: ebTestEmailSent handler implementation ===")
    
    patterns = {
        "test_sent_handler": "if \\(action === a\\.ebTestEmailSent\\)",
        "continue_payment": "'✅ Looks Good — Continue to Payment'",
        "send_another": "'📧 Send Another Test'",
        "edit_content": "'✏️ Edit Content'",
        "create_campaign": "emailBlastService\\.createCampaign",
        "route_to_payment": "a\\.ebPayment",
        "route_back_to_test": "a\\.ebTestEmail"
    }
    
    results, content = check_file_content('/app/js/_index.js', patterns)
    
    if results is None:
        log_result("ebTestEmailSent handler", False, f"Cannot read file: {content}")
        return
    
    all_found = all(results.values())
    missing = [k for k, v in results.items() if not v]
    
    if all_found:
        log_result("ebTestEmailSent handler", True, "Complete implementation found")
    else:
        log_result("ebTestEmailSent handler", False, f"Missing: {', '.join(missing)}")

def check_email_blast_service_initialization():
    """Check if Email Blast services are initialized"""
    print("\n=== Checking Email Blast Service Initialization ===")
    
    try:
        # Check supervisor logs for initialization messages
        result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/nodejs.out.log'], 
                               capture_output=True, text=True, check=True)
        
        log_content = result.stdout
        
        email_blast_init = '[EmailBlast]' in log_content
        email_warming_init = '[EmailWarming]' in log_content
        
        if email_blast_init and email_warming_init:
            log_result("Email Blast Service Initialization", True, "Both [EmailBlast] and [EmailWarming] services found in logs")
        else:
            missing = []
            if not email_blast_init:
                missing.append("[EmailBlast]")
            if not email_warming_init:
                missing.append("[EmailWarming]")
            log_result("Email Blast Service Initialization", False, f"Missing initialization for: {', '.join(missing)}")
    
    except Exception as e:
        log_result("Email Blast Service Initialization", False, f"Cannot check logs: {str(e)}")

def run_all_tests():
    """Run all Email Blast tests"""
    print("🚀 STARTING EMAIL BLAST BUG FIXES + UX IMPROVEMENTS TESTING")
    print("=" * 80)
    
    # Basic health checks
    if not check_nodejs_health():
        print("❌ Node.js backend is not healthy. Aborting tests.")
        return False
    
    check_error_logs()
    
    # Test all Email Blast functionality
    test_walletok_email_blast_crypto()
    test_ebpayment_wallet_handler()
    test_payactions_array()
    test_content_type_selection()
    test_enter_content_html_template()
    test_test_email_constants()
    test_preview_test_email_button()
    test_test_email_handler()
    test_test_email_sent_handler()
    check_email_blast_service_initialization()
    
    # Final results
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"📈 Success Rate: {test_results['passed']}/{test_results['passed'] + test_results['failed']} ({100 * test_results['passed'] / (test_results['passed'] + test_results['failed']):.1f}%)")
    
    if test_results['failed'] > 0:
        print("\n🔍 FAILED TESTS:")
        for error in test_results['errors']:
            print(f"   • {error}")
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)