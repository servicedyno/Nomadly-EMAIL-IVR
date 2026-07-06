#!/usr/bin/env python3
"""
Email Blast Bug Fixes and UX Improvements Testing - Simplified
Testing the Nomadly Telegram Bot backend Email Blast functionality
"""

import requests
import subprocess

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

def read_file_content():
    """Read the main _index.js file"""
    try:
        with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Cannot read _index.js: {e}")
        return None

def test_walletok_email_blast_crypto(content):
    """Test BUG FIX #1: walletOk['email_blast_crypto'] handler"""
    print("\n=== Testing BUG FIX #1: walletOk['email_blast_crypto'] handler ===")
    
    checks = {
        "handler_exists": "'email_blast_crypto': async coin => {" in content,
        "atomic_increment": "atomicIncrement(walletOf, chatId, 'usdOut', campaign.totalPrice)" in content,
        "start_campaign": "emailBlastService.startCampaign(campaignId, 'crypto', coin" in content,
        "try_catch": "try {" in content,
        "catch_error": "} catch (err) {" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("walletOk email_blast_crypto handler", True, "All components found")
    else:
        log_result("walletOk email_blast_crypto handler", False, f"Missing: {', '.join(missing)}")

def test_ebpayment_wallet_handler(content):
    """Test BUG FIX #2: ebPayment wallet handler thread safety"""
    print("\n=== Testing BUG FIX #2: ebPayment wallet handler thread safety ===")
    
    checks = {
        "handler_exists": "if (action === a.ebPayment)" in content,
        "wallet_button": "'👛 Pay from Wallet'" in content,
        "get_balance": "const { usdBal } = await getBalance(walletOf, chatId)" in content,
        "atomic_increment_found": "await atomicIncrement(walletOf, chatId, 'usdOut', campaign.totalPrice)" in content,
        "no_direct_mutation": "walletOf[chatId].usd =" not in content
    }
    
    positive_checks = ["handler_exists", "wallet_button", "get_balance", "atomic_increment_found", "no_direct_mutation"]
    all_passed = all(checks[k] for k in positive_checks)
    missing = [k for k in positive_checks if not checks[k]]
    
    if all_passed:
        log_result("ebPayment wallet handler thread safety", True, "Uses getBalance() and atomicIncrement(), no direct mutation")
    else:
        log_result("ebPayment wallet handler thread safety", False, f"Issues: {', '.join(missing)}")

def test_payactions_array(content):
    """Test BUG FIX #3: _payActions includes ebPayment"""
    print("\n=== Testing BUG FIX #3: _payActions includes ebPayment ===")
    
    # Find the _payActions array line
    lines = content.split('\n')
    payactions_line = None
    for line in lines:
        if "_payActions =" in line and "[" in line:
            payactions_line = line
            break
    
    if payactions_line:
        if "'ebPayment'" in payactions_line or '"ebPayment"' in payactions_line:
            # Count elements
            elements = payactions_line.count("'") + payactions_line.count('"')
            element_count = elements // 2  # Each element has 2 quotes
            log_result("_payActions includes ebPayment", True, f"Found ebPayment in array with {element_count} elements")
        else:
            log_result("_payActions includes ebPayment", False, "ebPayment not found in _payActions array")
    else:
        log_result("_payActions includes ebPayment", False, "_payActions array not found")

def test_content_type_selection(content):
    """Test UX: Content type selection (ebSelectContentType)"""
    print("\n=== Testing UX: Content type selection (ebSelectContentType) ===")
    
    checks = {
        "action_constant": "ebSelectContentType: 'ebSelectContentType'" in content,
        "handler_exists": "if (action === a.ebSelectContentType)" in content,
        "plain_text_option": "'📝 Type Plain Text'" in content,
        "html_file_option": "'📎 Upload HTML File'" in content,
        "save_content_type": "saveInfo('ebContentType'" in content,
        "route_to_content": "a.ebEnterContent" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("Content type selection (ebSelectContentType)", True, "All components found")
    else:
        log_result("Content type selection (ebSelectContentType)", False, f"Missing: {', '.join(missing)}")

def test_test_email_constants(content):
    """Test UX: Test email action constants exist"""
    print("\n=== Testing UX: Test email action constants ===")
    
    checks = {
        "ebTestEmail_constant": "ebTestEmail: 'ebTestEmail'" in content,
        "ebTestEmailSent_constant": "ebTestEmailSent: 'ebTestEmailSent'" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("Test email action constants", True, "Both constants found")
    else:
        log_result("Test email action constants", False, f"Missing: {', '.join(missing)}")

def test_preview_test_email_button(content):
    """Test UX: ebPreview handler has Send Test Email button"""
    print("\n=== Testing UX: ebPreview Send Test Email button ===")
    
    checks = {
        "preview_handler": "if (action === a.ebPreview)" in content,
        "send_test_button": "'📧 Send Test Email'" in content,
        "route_to_test": "a.ebTestEmail" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("ebPreview Send Test Email button", True, "Send Test Email button routing found")
    else:
        log_result("ebPreview Send Test Email button", False, f"Missing: {', '.join(missing)}")

def test_test_email_handler(content):
    """Test UX: ebTestEmail handler implementation"""
    print("\n=== Testing UX: ebTestEmail handler implementation ===")
    
    checks = {
        "test_email_handler": "if (action === a.ebTestEmail)" in content,
        "email_validation": "emailRegex.test(" in content,
        "nodemailer_create": "nodemailer.createTransport" in content,
        "brevo_config": "process.env.MAIL_DOMAIN" in content,
        "mail_auth_user": "process.env.MAIL_AUTH_USER" in content,
        "mail_auth_password": "process.env.MAIL_AUTH_PASSWORD" in content,
        "test_prefix": "[TEST]" in content,
        "route_to_sent": "a.ebTestEmailSent" in content,
        "error_handling": "} catch (err) {" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("ebTestEmail handler", True, "Complete implementation found")
    else:
        log_result("ebTestEmail handler", False, f"Missing: {', '.join(missing)}")

def test_test_email_sent_handler(content):
    """Test UX: ebTestEmailSent handler implementation"""
    print("\n=== Testing UX: ebTestEmailSent handler implementation ===")
    
    checks = {
        "test_sent_handler": "if (action === a.ebTestEmailSent)" in content,
        "continue_payment": "'✅ Looks Good — Continue to Payment'" in content,
        "send_another": "'📧 Send Another Test'" in content,
        "edit_content": "'✏️ Edit Content'" in content,
        "create_campaign": "emailBlastService.createCampaign" in content,
        "route_to_payment": "a.ebPayment" in content,
        "route_back_to_test": "a.ebTestEmail" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("ebTestEmailSent handler", True, "Complete implementation found")
    else:
        log_result("ebTestEmailSent handler", False, f"Missing: {', '.join(missing)}")

def test_enter_content_html_template(content):
    """Test UX: ebEnterContent wraps plain text in HTML template"""
    print("\n=== Testing UX: ebEnterContent HTML template wrapping ===")
    
    checks = {
        "enter_content_handler": "if (action === a.ebEnterContent)" in content,
        "doctype_html": "<!DOCTYPE html>" in content,
        "html_template": "<html" in content and "<body" in content,
        "content_type_check": "info.ebContentType" in content
    }
    
    all_passed = all(checks.values())
    missing = [k for k, v in checks.items() if not v]
    
    if all_passed:
        log_result("ebEnterContent HTML template", True, "HTML template wrapping found")
    else:
        log_result("ebEnterContent HTML template", False, f"Missing: {', '.join(missing)}")

def check_email_blast_service_initialization():
    """Check if Email Blast services are initialized"""
    print("\n=== Checking Email Blast Service Initialization ===")
    
    try:
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
    
    # Read the main file
    content = read_file_content()
    if not content:
        print("❌ Cannot read _index.js file. Aborting tests.")
        return False
    
    # Test all Email Blast functionality
    test_walletok_email_blast_crypto(content)
    test_ebpayment_wallet_handler(content)
    test_payactions_array(content)
    test_content_type_selection(content)
    test_enter_content_html_template(content)
    test_test_email_constants(content)
    test_preview_test_email_button(content)
    test_test_email_handler(content)
    test_test_email_sent_handler(content)
    check_email_blast_service_initialization()
    
    # Final results
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    total_tests = test_results['passed'] + test_results['failed']
    success_rate = 100 * test_results['passed'] / total_tests if total_tests > 0 else 0
    print(f"📈 Success Rate: {test_results['passed']}/{total_tests} ({success_rate:.1f}%)")
    
    if test_results['failed'] > 0:
        print("\n🔍 FAILED TESTS:")
        for error in test_results['errors']:
            print(f"   • {error}")
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)