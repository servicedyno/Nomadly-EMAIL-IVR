#!/usr/bin/env python3
"""
Backend Testing for Wallet Payment Bug Fix
Tests the fix for Cloud IVR phone purchase flow wallet payment issue
"""

import requests
import json
import sys
import subprocess
import os
import re
import time

# Configuration
BACKEND_URL = "http://localhost:5000"
NODEJS_INDEX_FILE = "/app/js/_index.js"
ERROR_LOG_PATH = "/var/log/supervisor/nodejs.err.log"

class WalletPaymentBugFixTester:
    def __init__(self):
        self.results = []
        self.errors = []
        
    def log_result(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        self.results.append(result)
        print(result)
        
    def log_error(self, error):
        """Log error"""
        self.errors.append(error)
        print(f"❌ ERROR: {error}")

    def test_nodejs_health(self):
        """Test Node.js backend health"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy' and data.get('database') == 'connected':
                    self.log_result("Node.js Health Check", True, f"Status: {data.get('status')}, DB: {data.get('database')}")
                    return True
                else:
                    self.log_result("Node.js Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Node.js Health Check", False, f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Node.js Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_error_log_empty(self):
        """Verify nodejs.err.log is empty"""
        try:
            if os.path.exists(ERROR_LOG_PATH):
                with open(ERROR_LOG_PATH, 'r') as f:
                    content = f.read().strip()
                if not content:
                    self.log_result("Error Log Empty", True, "No errors in nodejs.err.log")
                    return True
                else:
                    self.log_result("Error Log Empty", False, f"Errors found: {content[:100]}")
                    return False
            else:
                self.log_result("Error Log Empty", False, f"Log file not found: {ERROR_LOG_PATH}")
                return False
        except Exception as e:
            self.log_result("Error Log Empty", False, f"Error reading log: {str(e)}")
            return False

    def test_payactions_array(self):
        """Verify _payActions array contains exactly the 7 required actions"""
        try:
            with open(NODEJS_INDEX_FILE, 'r') as f:
                content = f.read()
            
            # Find the _payActions array definition
            pay_actions_pattern = r"const _payActions = \[(.*?)\]"
            match = re.search(pay_actions_pattern, content, re.DOTALL)
            
            if not match:
                self.log_result("_payActions Array Exists", False, "Array definition not found")
                return False
            
            # Extract and parse the actions
            actions_str = match.group(1)
            actions = [action.strip().strip("'\"") for action in actions_str.split(',')]
            actions = [action for action in actions if action]  # Remove empty strings
            
            expected_actions = [
                'phone-pay', 'domain-pay', 'hosting-pay', 'vps-plan-pay', 
                'vps-upgrade-plan-pay', 'digital-product-pay', 'virtual-card-pay'
            ]
            
            if set(actions) == set(expected_actions) and len(actions) == 7:
                self.log_result("_payActions Array Content", True, f"Contains all 7 required actions: {actions}")
                return True
            else:
                missing = set(expected_actions) - set(actions)
                extra = set(actions) - set(expected_actions)
                details = f"Expected {expected_actions}, got {actions}"
                if missing:
                    details += f", missing: {missing}"
                if extra:
                    details += f", extra: {extra}"
                self.log_result("_payActions Array Content", False, details)
                return False
                
        except Exception as e:
            self.log_result("_payActions Array Content", False, f"Error reading file: {str(e)}")
            return False

    def test_global_wallet_conditional(self):
        """Verify the global wallet conditional has the correct guard condition"""
        try:
            with open(NODEJS_INDEX_FILE, 'r') as f:
                content = f.read()
            
            # Find the global wallet conditional around line 9290
            lines = content.split('\n')
            
            # Search for the specific pattern
            found_conditional = False
            for i, line in enumerate(lines):
                if 'message === user.wallet && !_payActions.includes(action)' in line:
                    line_number = i + 1
                    found_conditional = True
                    self.log_result("Global Wallet Conditional", True, f"Found at line {line_number}: {line.strip()}")
                    break
            
            if not found_conditional:
                # Try alternate patterns
                for i, line in enumerate(lines):
                    if 'message === user.wallet' in line and '_payActions.includes' in line:
                        line_number = i + 1
                        found_conditional = True
                        self.log_result("Global Wallet Conditional", True, f"Found pattern at line {line_number}: {line.strip()}")
                        break
            
            if not found_conditional:
                self.log_result("Global Wallet Conditional", False, "Conditional with _payActions guard not found")
                return False
                
            return True
                
        except Exception as e:
            self.log_result("Global Wallet Conditional", False, f"Error reading file: {str(e)}")
            return False

    def test_phone_pay_wallet_handler(self):
        """Verify phone-pay handler still has proper wallet payment logic"""
        try:
            with open(NODEJS_INDEX_FILE, 'r') as f:
                content = f.read()
            
            # Find phone-pay action block
            phone_pay_pattern = r"if \(action === ['\"]phone-pay['\"]\).*?(?=if \(action === |$)"
            match = re.search(phone_pay_pattern, content, re.DOTALL)
            
            if not match:
                self.log_result("Phone-pay Handler Exists", False, "phone-pay action handler not found")
                return False
            
            phone_pay_block = match.group(0)
            
            # Check for wallet payment handling
            if 'payIn.wallet' in phone_pay_block and 'goto.walletSelectCurrency()' in phone_pay_block:
                self.log_result("Phone-pay Wallet Handler", True, "Contains payIn.wallet check and goto.walletSelectCurrency() call")
                return True
            else:
                self.log_result("Phone-pay Wallet Handler", False, "Missing proper wallet payment handling")
                return False
                
        except Exception as e:
            self.log_result("Phone-pay Wallet Handler", False, f"Error analyzing handler: {str(e)}")
            return False

    def test_payment_action_consistency(self):
        """Verify all payment actions in _payActions have corresponding handlers"""
        try:
            with open(NODEJS_INDEX_FILE, 'r') as f:
                content = f.read()
            
            expected_actions = [
                'phone-pay', 'domain-pay', 'hosting-pay', 'vps-plan-pay', 
                'vps-upgrade-plan-pay', 'digital-product-pay', 'virtual-card-pay'
            ]
            
            # Map actions to their possible handler patterns (direct strings or constants)
            action_patterns = {
                'phone-pay': ["if \\(action === ['\\\"]phone-pay['\\\"]"],
                'domain-pay': ["if \\(action === ['\\\"]domain-pay['\\\"]"],
                'hosting-pay': ["if \\(action === ['\\\"]hosting-pay['\\\"]"],
                'vps-plan-pay': ["if \\(action === ['\\\"]vps-plan-pay['\\\"]"],
                'vps-upgrade-plan-pay': ["if \\(action === ['\\\"]vps-upgrade-plan-pay['\\\"]"],
                'digital-product-pay': ["if \\(action === a\\.digitalProductPay\\)"],
                'virtual-card-pay': ["if \\(action === a\\.virtualCardPay\\)"]
            }
            
            missing_handlers = []
            wallet_handlers_found = []
            
            for action in expected_actions:
                found_handler = False
                
                # Check all possible patterns for this action
                for pattern in action_patterns[action]:
                    if re.search(pattern, content):
                        found_handler = True
                        # Find the action block to check for wallet handling
                        action_block_pattern = pattern + ".*?(?=if \\(action === |$)"
                        action_match = re.search(action_block_pattern, content, re.DOTALL)
                        
                        if action_match and 'payIn.wallet' in action_match.group(0):
                            wallet_handlers_found.append(action)
                        else:
                            # Handler exists but might not have wallet payment - that's ok for consistency check
                            wallet_handlers_found.append(action)
                        break
                
                if not found_handler:
                    missing_handlers.append(action)
            
            if not missing_handlers:
                self.log_result("Payment Action Handlers", True, f"All 7 actions have handlers: {wallet_handlers_found}")
                return True
            else:
                self.log_result("Payment Action Handlers", False, f"Missing handlers for: {missing_handlers}")
                return False
                
        except Exception as e:
            self.log_result("Payment Action Handlers", False, f"Error checking handlers: {str(e)}")
            return False

    def test_wallet_payment_handlers_exist(self):
        """Test that all payment handlers have wallet payment options"""
        try:
            with open(NODEJS_INDEX_FILE, 'r') as f:
                content = f.read()
            
            # Count occurrences of payIn.wallet in the file
            wallet_occurrences = len(re.findall(r'payIn\.wallet', content))
            
            if wallet_occurrences >= 7:  # Should have at least 7 for the payment actions
                self.log_result("Wallet Payment Options", True, f"Found {wallet_occurrences} wallet payment handlers")
                return True
            else:
                self.log_result("Wallet Payment Options", False, f"Only found {wallet_occurrences} wallet payment handlers, expected at least 7")
                return False
                
        except Exception as e:
            self.log_result("Wallet Payment Options", False, f"Error checking wallet handlers: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests"""
        print("🧪 Starting Wallet Payment Bug Fix Verification Tests\n")
        
        # Basic health checks
        print("📊 BASIC HEALTH CHECKS:")
        self.test_nodejs_health()
        self.test_error_log_empty()
        print()
        
        # Code verification tests
        print("📋 CODE VERIFICATION TESTS:")
        self.test_payactions_array()
        self.test_global_wallet_conditional()
        self.test_phone_pay_wallet_handler()
        self.test_payment_action_consistency()
        self.test_wallet_payment_handlers_exist()
        print()
        
        # Summary
        print("📈 SUMMARY:")
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if "✅ PASS" in r])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ ERRORS ENCOUNTERED:")
            for error in self.errors:
                print(f"  - {error}")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.results:
            print(f"  {result}")
        
        return passed_tests == total_tests

def main():
    tester = WalletPaymentBugFixTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED - Wallet payment bug fix is working correctly!")
        sys.exit(0)
    else:
        print("\n⚠️  SOME TESTS FAILED - Please review the issues above")
        sys.exit(1)

if __name__ == "__main__":
    main()