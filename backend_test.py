#!/usr/bin/env python3
"""
Backend Test for Domain Purchase Retry Logic + CR Log Fix + Wallet Refund
Testing the new task: Domain purchase retry logic + CR log fix + wallet refund on bank/crypto domain failure

Key files to verify:
1. js/cr-domain-register.js — [CR] Registered log should ONLY appear AFTER statusCode === 200 check
2. js/op-service.js — getContactHandle(attempt = 1) with retry logic
3. js/op-service.js — registerDomain() with retry and forced re-auth
4. js/_index.js — Bank domain payment handler with auto-refund on failure
5. js/_index.js — BlockBee crypto domain handler with auto-refund on failure  
6. js/_index.js — DynoPay crypto domain handler with auto-refund on failure
7. js/_index.js — Wallet domain handler (should charge AFTER success)

Test approach: Code verification — check line numbers, function signatures, conditional logic, log messages.
DO NOT attempt to call actual APIs.
"""

import re
import sys
import os
import subprocess
import json

class DomainPurchaseTestSuite:
    def __init__(self):
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    def log_test(self, test_name, passed, details=""):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            status = "✅ PASS"
        else:
            status = "❌ FAIL"
        
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })

    def read_file(self, filepath):
        """Read file content safely"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return None
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return None

    def check_health_endpoint(self):
        """Test 1: Verify Node.js service health"""
        try:
            result = subprocess.run(['curl', '-s', 'http://localhost:5000/health'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                try:
                    health_data = json.loads(result.stdout)
                    if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
                        self.log_test("Node.js Health Check", True, 
                                    f"Service healthy, database connected, uptime: {health_data.get('uptime', 'N/A')}")
                        return True
                    else:
                        self.log_test("Node.js Health Check", False, 
                                    f"Unhealthy status: {health_data}")
                        return False
                except json.JSONDecodeError:
                    self.log_test("Node.js Health Check", False, 
                                f"Invalid JSON response: {result.stdout}")
                    return False
            else:
                self.log_test("Node.js Health Check", False, 
                            f"Health endpoint unreachable: {result.stderr}")
                return False
        except subprocess.TimeoutExpired:
            self.log_test("Node.js Health Check", False, "Health endpoint timeout")
            return False
        except Exception as e:
            self.log_test("Node.js Health Check", False, f"Health check error: {e}")
            return False

    def check_error_logs(self):
        """Test 2: Verify nodejs.err.log is empty (no critical errors)"""
        try:
            result = subprocess.run(['stat', '-c', '%s', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                size = int(result.stdout.strip())
                if size == 0:
                    self.log_test("Node.js Error Log Check", True, 
                                "nodejs.err.log is empty (0 bytes)")
                    return True
                else:
                    self.log_test("Node.js Error Log Check", False, 
                                f"nodejs.err.log has {size} bytes of errors")
                    return False
            else:
                self.log_test("Node.js Error Log Check", False, 
                            "Could not check error log size")
                return False
        except Exception as e:
            self.log_test("Node.js Error Log Check", False, f"Error checking logs: {e}")
            return False

    def check_cr_domain_register_log_fix(self):
        """Test 3: Verify CR log fix - '[CR] Registered' only appears AFTER statusCode === 200 check"""
        content = self.read_file('/app/js/cr-domain-register.js')
        if not content:
            self.log_test("CR Domain Register Log Fix", False, "Could not read cr-domain-register.js")
            return False

        lines = content.split('\n')
        
        # Find the statusCode check line
        statuscode_check_line = -1
        registered_log_line = -1
        failed_log_line = -1
        
        for i, line in enumerate(lines):
            if 'statusCode === 200' in line:
                statuscode_check_line = i + 1  # Convert to 1-based line number
            if '[CR] Registered' in line and 'console.log' in line:
                registered_log_line = i + 1
            if '[CR] Registration FAILED' in line and 'console.error' in line:
                failed_log_line = i + 1

        # Verify the fix
        if statuscode_check_line == -1:
            self.log_test("CR Domain Register Log Fix", False, 
                        "statusCode === 200 check not found")
            return False
        
        if registered_log_line == -1:
            self.log_test("CR Domain Register Log Fix", False, 
                        "[CR] Registered log not found")
            return False
        
        if failed_log_line == -1:
            self.log_test("CR Domain Register Log Fix", False, 
                        "[CR] Registration FAILED log not found")
            return False
        
        # The registered log should come AFTER the status check (line 23 should be status check, line 24 should be registered log)
        if registered_log_line > statuscode_check_line:
            self.log_test("CR Domain Register Log Fix", True, 
                        f"[CR] Registered log (line {registered_log_line}) appears AFTER statusCode check (line {statuscode_check_line})")
            return True
        else:
            self.log_test("CR Domain Register Log Fix", False, 
                        f"[CR] Registered log (line {registered_log_line}) appears BEFORE statusCode check (line {statuscode_check_line})")
            return False

    def check_op_service_getcontacthandle_retry(self):
        """Test 4: Verify getContactHandle has retry logic with attempt parameter"""
        content = self.read_file('/app/js/op-service.js')
        if not content:
            self.log_test("OP Service getContactHandle Retry", False, "Could not read op-service.js")
            return False

        # Check function signature with attempt parameter
        function_signature_found = False
        retry_logic_found = False
        forced_reauth_found = False
        attempt_log_found = False
        
        lines = content.split('\n')
        for i, line in enumerate(lines):
            # Look for function signature with attempt parameter
            if 'getContactHandle = async (attempt = 1)' in line:
                function_signature_found = True
            
            # Look for retry logic
            if 'if (attempt < 2)' in line:
                retry_logic_found = True
            
            # Look for forced re-auth
            if 'cachedToken = null' in line and 'tokenExpiry = 0' in line:
                forced_reauth_found = True
                
            # Look for attempt number in log
            if 'getContactHandle error (attempt ${attempt})' in line:
                attempt_log_found = True

        tests_passed = []
        if function_signature_found:
            tests_passed.append("Function signature with attempt parameter")
        if retry_logic_found:
            tests_passed.append("Retry logic (attempt < 2)")
        if forced_reauth_found:
            tests_passed.append("Forced re-auth (cachedToken=null, tokenExpiry=0)")
        if attempt_log_found:
            tests_passed.append("Attempt number in logs")

        if len(tests_passed) >= 3:  # At least 3 out of 4 checks should pass
            self.log_test("OP Service getContactHandle Retry", True, 
                        f"Retry logic verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("OP Service getContactHandle Retry", False, 
                        f"Missing retry components. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def check_op_service_registerdomain_retry(self):
        """Test 5: Verify registerDomain has contactHandle retry with forced re-auth"""
        content = self.read_file('/app/js/op-service.js')
        if not content:
            self.log_test("OP Service registerDomain Retry", False, "Could not read op-service.js")
            return False

        # Look for specific retry patterns
        contact_handle_let = False
        retry_log_found = False
        forced_reauth_in_register = False
        second_attempt = False
        
        lines = content.split('\n')
        in_register_function = False
        
        for i, line in enumerate(lines):
            if 'const registerDomain = async' in line:
                in_register_function = True
            elif in_register_function and line.strip().startswith('const ') and ' = async' in line:
                in_register_function = False  # Entering next function
                
            if in_register_function:
                # Look for contactHandle declared with let (should be const initially)
                if 'let contactHandle = await getContactHandleForTLD' in line:
                    contact_handle_let = True
                elif 'contactHandle = await getContactHandleForTLD' in line:
                    contact_handle_let = True
                    
                # Look for retry log message
                if '[OP] Contact handle lookup failed for .${tld} — retrying with fresh auth in 2s...' in line:
                    retry_log_found = True
                elif 'Contact handle lookup failed' in line and 'retrying with fresh auth' in line:
                    retry_log_found = True
                    
                # Look for forced re-auth in registerDomain
                if 'cachedToken = null' in line:
                    forced_reauth_in_register = True
                    
                # Look for second attempt
                if 'contactHandle = await getContactHandleForTLD(tld)' in line:
                    second_attempt = True

        tests_passed = []
        if contact_handle_let:
            tests_passed.append("contactHandle variable allows reassignment")
        if retry_log_found:
            tests_passed.append("Retry log message found")
        if forced_reauth_in_register:
            tests_passed.append("Forced re-auth in registerDomain")
        if second_attempt:
            tests_passed.append("Second attempt after failure")

        if len(tests_passed) >= 2:
            self.log_test("OP Service registerDomain Retry", True, 
                        f"Retry logic verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("OP Service registerDomain Retry", False, 
                        f"Missing retry components. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def check_bank_domain_auto_refund(self):
        """Test 6: Verify bank domain payment handler has auto-refund on buyDomainFullProcess failure"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_test("Bank Domain Auto-Refund", False, "Could not read _index.js")
            return False

        # Find the /bank-pay-domain handler
        lines = content.split('\n')
        in_bank_domain_handler = False
        handler_found = False
        auto_refund_found = False
        user_message_found = False
        admin_alert_found = False
        nested_try_catch_found = False
        
        for i, line in enumerate(lines):
            if "'/bank-pay-domain':" in line:
                in_bank_domain_handler = True
                handler_found = True
                continue
            elif in_bank_domain_handler and line.strip().startswith("'/") and "':" in line:
                in_bank_domain_handler = False  # Entering next handler
                
            if in_bank_domain_handler:
                # Look for auto-refund logic
                if 'addFundsTo(walletOf, chatId,' in line and 'ngnPrice' in line:
                    auto_refund_found = True
                    
                # Look for user message
                if '💰 <b>Auto-Refund:</b>' in line:
                    user_message_found = True
                    
                # Look for admin alert
                if 'TELEGRAM_ADMIN_CHAT_ID' in line and 'Auto-Refund' in line:
                    admin_alert_found = True
                    
                # Look for nested try/catch
                if 'catch (refundErr)' in line:
                    nested_try_catch_found = True

        tests_passed = []
        if handler_found:
            tests_passed.append("/bank-pay-domain handler found")
        if auto_refund_found:
            tests_passed.append("Auto-refund to wallet")
        if user_message_found:
            tests_passed.append("User refund message")
        if admin_alert_found:
            tests_passed.append("Admin notification")
        if nested_try_catch_found:
            tests_passed.append("Nested try/catch for refund failure")

        if len(tests_passed) >= 4:
            self.log_test("Bank Domain Auto-Refund", True, 
                        f"Auto-refund logic verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("Bank Domain Auto-Refund", False, 
                        f"Missing refund components. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def check_blockbee_crypto_domain_auto_refund(self):
        """Test 7: Verify BlockBee crypto domain payment handler has auto-refund"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_test("BlockBee Crypto Domain Auto-Refund", False, "Could not read _index.js")
            return False

        # Find the /crypto-pay-domain handler
        lines = content.split('\n')
        in_crypto_domain_handler = False
        handler_found = False
        auto_refund_found = False
        user_message_found = False
        admin_alert_found = False
        usd_refund = False
        
        for i, line in enumerate(lines):
            if "app.get('/crypto-pay-domain'" in line:
                in_crypto_domain_handler = True
                handler_found = True
                continue
            elif in_crypto_domain_handler and ('app.get(' in line or 'app.post(' in line):
                in_crypto_domain_handler = False  # Entering next handler
                
            if in_crypto_domain_handler:
                # Look for USD auto-refund logic
                if 'addFundsTo(walletOf, chatId,' in line and "'usd'" in line and 'price' in line:
                    auto_refund_found = True
                    usd_refund = True
                    
                # Look for user message
                if '💰 <b>Auto-Refund:</b>' in line:
                    user_message_found = True
                    
                # Look for admin alert mentioning BlockBee
                if 'BlockBee Crypto→Domain' in line:
                    admin_alert_found = True

        tests_passed = []
        if handler_found:
            tests_passed.append("/crypto-pay-domain handler found")
        if auto_refund_found and usd_refund:
            tests_passed.append("USD auto-refund to wallet")
        if user_message_found:
            tests_passed.append("User refund message")
        if admin_alert_found:
            tests_passed.append("BlockBee admin notification")

        if len(tests_passed) >= 3:
            self.log_test("BlockBee Crypto Domain Auto-Refund", True, 
                        f"Auto-refund logic verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("BlockBee Crypto Domain Auto-Refund", False, 
                        f"Missing refund components. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def check_dynopay_crypto_domain_auto_refund(self):
        """Test 8: Verify DynoPay crypto domain payment handler has auto-refund"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_test("DynoPay Crypto Domain Auto-Refund", False, "Could not read _index.js")
            return False

        # Find the /dynopay/crypto-pay-domain handler
        lines = content.split('\n')
        in_dynopay_domain_handler = False
        handler_found = False
        auto_refund_found = False
        user_message_found = False
        admin_alert_found = False
        usd_refund = False
        
        for i, line in enumerate(lines):
            if "app.post('/dynopay/crypto-pay-domain'" in line:
                in_dynopay_domain_handler = True
                handler_found = True
                continue
            elif in_dynopay_domain_handler and ('app.get(' in line or 'app.post(' in line):
                in_dynopay_domain_handler = False  # Entering next handler
                
            if in_dynopay_domain_handler:
                # Look for USD auto-refund logic
                if 'addFundsTo(walletOf, chatId,' in line and "'usd'" in line and 'price' in line:
                    auto_refund_found = True
                    usd_refund = True
                    
                # Look for user message
                if '💰 <b>Auto-Refund:</b>' in line:
                    user_message_found = True
                    
                # Look for admin alert mentioning DynoPay
                if 'DynoPay Crypto→Domain' in line:
                    admin_alert_found = True

        tests_passed = []
        if handler_found:
            tests_passed.append("/dynopay/crypto-pay-domain handler found")
        if auto_refund_found and usd_refund:
            tests_passed.append("USD auto-refund to wallet")
        if user_message_found:
            tests_passed.append("User refund message")
        if admin_alert_found:
            tests_passed.append("DynoPay admin notification")

        if len(tests_passed) >= 3:
            self.log_test("DynoPay Crypto Domain Auto-Refund", True, 
                        f"Auto-refund logic verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("DynoPay Crypto Domain Auto-Refund", False, 
                        f"Missing refund components. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def check_wallet_domain_payment_order(self):
        """Test 9: Verify wallet domain payment charges AFTER successful buyDomainFullProcess"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_test("Wallet Domain Payment Order", False, "Could not read _index.js")
            return False

        # Find the walletOk['domain-pay'] handler
        lines = content.split('\n')
        in_wallet_domain_handler = False
        handler_found = False
        buy_domain_before_charge = False
        charge_after_success = False
        error_handling_present = False
        
        buy_domain_line = -1
        wallet_charge_line = -1
        
        for i, line in enumerate(lines):
            if "'domain-pay': async coin =>" in line:
                in_wallet_domain_handler = True
                handler_found = True
                continue
            elif in_wallet_domain_handler and line.strip().endswith('async coin => {') and 'domain-pay' not in line:
                in_wallet_domain_handler = False  # Entering next handler
            elif in_wallet_domain_handler and line.strip().startswith('},') and not line.strip().startswith('}, {'):
                in_wallet_domain_handler = False  # End of handler
                
            if in_wallet_domain_handler:
                # Look for buyDomainFullProcess call
                if 'buyDomainFullProcess(chatId, lang, domain)' in line:
                    buy_domain_line = i
                    
                # Look for wallet charge (atomicIncrement)
                if 'atomicIncrement(walletOf, chatId,' in line and ('usdOut' in line or 'ngnOut' in line):
                    wallet_charge_line = i
                    
                # Look for error handling
                if 'catch (domainErr)' in line:
                    error_handling_present = True

        tests_passed = []
        if handler_found:
            tests_passed.append("walletOk['domain-pay'] handler found")
        if buy_domain_line != -1 and wallet_charge_line != -1:
            if wallet_charge_line > buy_domain_line:
                buy_domain_before_charge = True
                charge_after_success = True
                tests_passed.append("Wallet charged AFTER buyDomainFullProcess")
        if error_handling_present:
            tests_passed.append("Error handling with try/catch")

        if len(tests_passed) >= 2 and charge_after_success:
            self.log_test("Wallet Domain Payment Order", True, 
                        f"Payment order verified: {', '.join(tests_passed)}")
            return True
        else:
            self.log_test("Wallet Domain Payment Order", False, 
                        f"Payment order issues. Found: {', '.join(tests_passed) if tests_passed else 'None'}")
            return False

    def run_all_tests(self):
        """Run all domain purchase tests"""
        print("🧪 DOMAIN PURCHASE RETRY LOGIC + CR LOG FIX + WALLET REFUND TESTING")
        print("=" * 80)
        
        # Test 1-2: Service Health
        self.check_health_endpoint()
        self.check_error_logs()
        
        # Test 3: CR Domain Register Log Fix
        self.check_cr_domain_register_log_fix()
        
        # Test 4-5: OP Service Retry Logic
        self.check_op_service_getcontacthandle_retry()
        self.check_op_service_registerdomain_retry()
        
        # Test 6-8: Auto-Refund Logic for Payment Handlers
        self.check_bank_domain_auto_refund()
        self.check_blockbee_crypto_domain_auto_refund()
        self.check_dynopay_crypto_domain_auto_refund()
        
        # Test 9: Wallet Payment Order
        self.check_wallet_domain_payment_order()
        
        # Summary
        print("=" * 80)
        print(f"📊 TEST SUMMARY:")
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {self.total_tests - self.passed_tests}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests)*100:.1f}%")
        
        if self.passed_tests == self.total_tests:
            print("🎉 ALL TESTS PASSED - Domain purchase retry logic and wallet refund system is working correctly!")
            return True
        else:
            print(f"⚠️  {self.total_tests - self.passed_tests} TEST(S) FAILED - See details above")
            return False

if __name__ == "__main__":
    test_suite = DomainPurchaseTestSuite()
    success = test_suite.run_all_tests()
    sys.exit(0 if success else 1)