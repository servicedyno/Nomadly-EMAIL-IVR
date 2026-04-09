#!/usr/bin/env python3
"""
Backend Test for Fincra Recovery Notification Addition
Testing the reconcileFincraPayments function in Nomadly Telegram bot backend
"""

import subprocess
import requests
import json
import sys
import time

def run_command(cmd, description):
    """Run a shell command and return result"""
    print(f"\n🔍 {description}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(f"✅ {description} - SUCCESS")
            if result.stdout.strip():
                print(f"Output: {result.stdout.strip()}")
            return True, result.stdout
        else:
            print(f"❌ {description} - FAILED")
            print(f"Error: {result.stderr.strip()}")
            return False, result.stderr
    except subprocess.TimeoutExpired:
        print(f"⏰ {description} - TIMEOUT")
        return False, "Command timed out"
    except Exception as e:
        print(f"💥 {description} - EXCEPTION: {str(e)}")
        return False, str(e)

def check_file_content(file_path, search_patterns, description):
    """Check if file contains specific patterns"""
    print(f"\n🔍 {description}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        results = {}
        for pattern_name, pattern in search_patterns.items():
            if pattern in content:
                print(f"✅ Found: {pattern_name}")
                results[pattern_name] = True
            else:
                print(f"❌ Missing: {pattern_name}")
                results[pattern_name] = False
        
        return results
    except Exception as e:
        print(f"💥 Error reading file: {str(e)}")
        return {pattern: False for pattern in search_patterns.keys()}

def test_service_health():
    """Test if the Node.js service is healthy on port 5000"""
    print(f"\n🔍 Testing Node.js service health on port 5000")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Service healthy: {data}")
            return True
        else:
            print(f"❌ Service unhealthy - Status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Service health check failed: {str(e)}")
        return False

def main():
    """Main test function"""
    print("=" * 80)
    print("🧪 FINCRA RECOVERY NOTIFICATION TESTING")
    print("=" * 80)
    
    test_results = {}
    
    # Test 1: Syntax check
    success, output = run_command("node -c /app/js/_index.js", "Node.js syntax validation")
    test_results['syntax_check'] = success
    
    # Test 2: Service health check
    test_results['service_health'] = test_service_health()
    
    # Test 3: Check for reconciler active in logs
    success, output = run_command("grep -i 'Payment recovery scheduled' /var/log/supervisor/nodejs.out.log | tail -1", "Check reconciler scheduling log")
    test_results['reconciler_scheduled'] = success and 'Payment recovery scheduled' in output
    
    # Test 4: Verify recovery notification implementation
    recovery_patterns = {
        'recovery_comment': '// ── Send recovery notification to user ──',
        'service_map_start': 'const serviceMap = {',
        'domain_mapping': "'/bank-pay-domain': '🌐 Domain'",
        'hosting_mapping': "'/bank-pay-hosting': '🛡️ Hosting'", 
        'wallet_mapping': "'/bank-pay-wallet': '👛 Wallet Top-Up'",
        'phone_mapping': "'/bank-pay-phone': '📞 Phone Number'",
        'leads_mapping': "'/bank-pay-leads': '📱 SMS Leads'",
        'email_blast_mapping': "'/bank-pay-email-blast': '📧 Email Blast'",
        'digital_product_mapping': "'/bank-pay-digital-product': '🛒 Digital Product'",
        'virtual_card_mapping': "'/bank-pay-virtual-card': '💳 Virtual Card'",
        'plan_mapping': "'/bank-pay-plan': '📦 Service Plan'",
        'vps_mapping': "'/bank-pay-vps': '🖥️ VPS'",
        'upgrade_vps_mapping': "'/bank-pay-upgrade-vps': '🖥️ VPS Upgrade'",
        'payment_received_message': '🔄 <b>Payment Received!</b>',
        'amount_formatting': 'Number(ngnAmount).toLocaleString()',
        'apology_message': 'We apologize for the brief delay',
        'html_parse_mode': "{ parse_mode: 'HTML' }",
        'try_catch_wrapper': 'try {',
        'catch_error_logging': '[FincraReconcile] Recovery notification failed for ${chatId}:'
    }
    
    recovery_results = check_file_content('/app/js/_index.js', recovery_patterns, 
                                        "Verify recovery notification implementation")
    test_results.update(recovery_results)
    
    # Test 5: Check that notification is positioned after bankApis[endpoint] call
    positioning_patterns = {
        'bankapis_call': 'await bankApis[endpoint](fakeReq, fakeRes, Number(paymentData.amountReceived))',
        'notification_after_bankapis': 'log(`[FincraReconcile] Processed ${endpoint} for ref=${ref}`)\n\n              // ── Send recovery notification to user ──'
    }
    
    positioning_results = check_file_content('/app/js/_index.js', positioning_patterns,
                                           "Verify notification positioning after bankApis call")
    test_results.update(positioning_results)
    
    # Test 6: Count service mappings to ensure all 11 are present
    print(f"\n🔍 Counting service mappings in serviceMap")
    try:
        with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Count bank-pay mappings
        bank_pay_count = content.count("'/bank-pay-")
        if bank_pay_count >= 11:
            print(f"✅ Found {bank_pay_count} bank-pay service mappings (expected 11+)")
            test_results['service_mapping_count'] = True
        else:
            print(f"❌ Found only {bank_pay_count} bank-pay service mappings (expected 11)")
            test_results['service_mapping_count'] = False
    except Exception as e:
        print(f"❌ Error counting service mappings: {str(e)}")
        test_results['service_mapping_count'] = False
    
    # Test 7: Check backend logs for any recent errors
    success, output = run_command("tail -20 /var/log/supervisor/nodejs.err.log", "Check recent backend errors")
    if success and not output.strip():
        print("✅ No recent errors in backend logs")
        test_results['no_recent_errors'] = True
    else:
        print(f"⚠️ Backend error log content: {output}")
        test_results['no_recent_errors'] = False
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed_tests = sum(1 for result in test_results.values() if result)
    total_tests = len(test_results)
    
    print(f"Tests passed: {passed_tests}/{total_tests}")
    print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
    
    print("\nDetailed Results:")
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {test_name}: {status}")
    
    # Critical test failures
    critical_tests = ['syntax_check', 'service_health', 'recovery_comment', 'service_map_start', 
                     'payment_received_message', 'html_parse_mode', 'try_catch_wrapper']
    
    critical_failures = [test for test in critical_tests if not test_results.get(test, False)]
    
    if critical_failures:
        print(f"\n❌ CRITICAL FAILURES: {critical_failures}")
        return False
    else:
        print(f"\n✅ ALL CRITICAL TESTS PASSED")
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)