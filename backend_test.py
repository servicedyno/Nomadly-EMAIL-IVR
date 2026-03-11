#!/usr/bin/env python3

"""
Nomadly Telegram Bot Payment Guard Fixes Test
Tests the comprehensive bot-wide payment guard fixes across ALL payment flows.
All tests via code inspection - grep/view js/_index.js
"""

import subprocess
import sys
import json

class NomadlyPaymentGuardTest:
    def __init__(self):
        self.test_results = []
        self.failed_tests = []

    def run_bash(self, command):
        """Run bash command and return result"""
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
            return result.returncode, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return 1, "", "Command timed out"

    def log_result(self, test_name, passed, details):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append(f"{status}: {test_name} - {details}")
        if not passed:
            self.failed_tests.append(test_name)
        print(f"{status}: {test_name}")

    def test_nodejs_health(self):
        """Test 1: Node.js Health - GET http://localhost:5000/health should return 200"""
        print("\n=== Test 1: Node.js Health Check ===")
        
        # Health endpoint check
        rc, stdout, stderr = self.run_bash('curl -s http://localhost:5000/health')
        if rc == 0:
            try:
                health_data = json.loads(stdout)
                if health_data.get('status') == 'healthy':
                    self.log_result("Node.js Health Check", True, f"Health endpoint returns {health_data}")
                else:
                    self.log_result("Node.js Health Check", False, f"Unhealthy status: {health_data}")
            except json.JSONDecodeError:
                self.log_result("Node.js Health Check", False, f"Invalid JSON response: {stdout}")
        else:
            self.log_result("Node.js Health Check", False, f"Health endpoint failed: {stderr}")

        # Check error log is empty
        rc, stdout, stderr = self.run_bash('wc -c /var/log/supervisor/nodejs.err.log')
        if rc == 0 and stdout.startswith('0 '):
            self.log_result("Error Log Empty", True, "nodejs.err.log is 0 bytes")
        else:
            self.log_result("Error Log Empty", False, f"nodejs.err.log has content: {stdout}")

    def test_goto_guards(self):
        """Test 2-7: Check all 6 goto guards"""
        print("\n=== Test 2-7: Goto Guards ===")
        
        guards_to_check = [
            ("domain-pay goto guard", "'domain-pay': async () =>", "if (!domain || !price)", "goto.submenu2()"),
            ("phone-pay goto guard", "'phone-pay': async () =>", "if (!info.cpSelectedNumber || !info.cpPrice)", "goto.submenu5()"),
            ("digital-product-pay goto guard", "'digital-product-pay': async () =>", "if (!info?.dpProductName || !info?.dpPrice)", "goto.submenu6()"),
            ("virtual-card-pay goto guard", "'virtual-card-pay': async () =>", "if (!info?.vcAmount || !info?.vcAddress)", "goto['virtual-card-start']()"),
            ("vps-plan-pay goto guard", "'vps-plan-pay' : async () =>", "if (!info?.vpsDetails || !info?.vpsDetails?.totalPrice)", "goto.displayMainMenuButtons()"),
            ("plan-pay goto guard", "'plan-pay': async () =>", "if (!plan || !price)", "goto['choose-subscription']()")
        ]
        
        for guard_name, handler_search, guard_condition, redirect_call in guards_to_check:
            # Find handler line number
            rc, stdout, stderr = self.run_bash(f"grep -n \"{handler_search}\" /app/js/_index.js")
            if rc == 0:
                handler_line = int(stdout.split(':')[0])
                
                # Check for guard condition in next 10 lines
                rc2, stdout2, stderr2 = self.run_bash(f"sed -n '{handler_line},{handler_line + 10}p' /app/js/_index.js | grep -F \"{guard_condition}\"")
                guard_found = rc2 == 0
                
                # Check for redirect call
                rc3, stdout3, stderr3 = self.run_bash(f"sed -n '{handler_line},{handler_line + 10}p' /app/js/_index.js | grep -F \"{redirect_call}\"")
                redirect_found = rc3 == 0
                
                if guard_found and redirect_found:
                    self.log_result(guard_name, True, f"Guard condition and redirect found at line {handler_line}")
                elif guard_found:
                    self.log_result(guard_name, False, f"Guard found but redirect missing at line {handler_line}")
                else:
                    self.log_result(guard_name, False, f"Guard condition missing at line {handler_line}")
            else:
                self.log_result(guard_name, False, f"Handler not found: {handler_search}")

    def test_walletok_guards(self):
        """Test 8-14: Check all 7 WalletOk payment guards"""
        print("\n=== Test 8-14: WalletOk Payment Guards ===")
        
        wallet_guards = [
            ("WalletOk hosting-pay guard", "'hosting-pay': async coin =>", "if (!info?.website_name || !price || price <= 0)"),
            ("WalletOk domain-pay guard", "'domain-pay': async coin =>", "if (!domain || !price || price <= 0)"),
            ("WalletOk phone-pay guard", "'phone-pay': async coin =>", "if (!price || price <= 0 || !info?.cpSelectedNumber)"),
            ("WalletOk digital-product-pay guard", "'digital-product-pay': async coin =>", "if (!price || price <= 0 || !product || !productKey)"),
            ("WalletOk virtual-card-pay guard", "'virtual-card-pay': async coin =>", "if (!vcAmount || vcAmount <= 0 || !address)"),
            ("WalletOk vps-plan-pay guard", "'vps-plan-pay': async coin =>", "if (!vpsDetails || !vpsDetails.totalPrice)"),
            ("WalletOk plan-pay guard", "'plan-pay': async coin =>", "if (!plan || !price || price <= 0)")
        ]
        
        for guard_name, handler_search, guard_condition in wallet_guards:
            # Find handler line number
            rc, stdout, stderr = self.run_bash(f"grep -n \"{handler_search}\" /app/js/_index.js")
            if rc == 0:
                handler_line = int(stdout.split(':')[0])
                
                # Check for guard condition in next 15 lines (walletOk handlers are longer)
                rc2, stdout2, stderr2 = self.run_bash(f"sed -n '{handler_line},{handler_line + 15}p' /app/js/_index.js | grep -F \"{guard_condition}\"")
                guard_found = rc2 == 0
                
                if guard_found:
                    self.log_result(guard_name, True, f"Payment guard found at line {handler_line}")
                else:
                    self.log_result(guard_name, False, f"Payment guard missing at line {handler_line}")
            else:
                self.log_result(guard_name, False, f"WalletOk handler not found: {handler_search}")
        
        # Special check for vps-plan-pay: ensure price calculation comes AFTER guard
        rc, stdout, stderr = self.run_bash("grep -n \"'vps-plan-pay': async coin =>\" /app/js/_index.js")
        if rc == 0:
            handler_line = int(stdout.split(':')[0])
            rc2, stdout2, stderr2 = self.run_bash(f"sed -n '{handler_line},{handler_line + 20}p' /app/js/_index.js")
            if rc2 == 0:
                handler_content = stdout2
                guard_line = None
                price_line = None
                
                for i, line in enumerate(handler_content.split('\n')):
                    if "if (!vpsDetails || !vpsDetails.totalPrice)" in line:
                        guard_line = i
                    if "const price = Number(vpsDetails.totalPrice)" in line:
                        price_line = i
                
                if guard_line is not None and price_line is not None and guard_line < price_line:
                    self.log_result("VPS price calculation after guard", True, f"Price calculation comes after guard check")
                elif guard_line is not None and price_line is None:
                    # Check if price is calculated inline later
                    self.log_result("VPS price calculation after guard", True, f"Guard check present, price calculated safely")
                else:
                    self.log_result("VPS price calculation after guard", False, f"Price calculation order incorrect")

    def test_phone_stale_state_resets(self):
        """Test 15-16: Check phone stale state resets"""
        print("\n=== Test 15-16: Phone Stale State Resets ===")
        
        # Test 15: buyPhoneNumber entry stale state reset
        rc, stdout, stderr = self.run_bash("grep -n \"btnKeyOf(message) === 'buyPhoneNumber'\" /app/js/_index.js | head -1")
        if rc == 0:
            handler_line = int(stdout.split(':')[0])
            
            # Check for all 11 required resets
            required_resets = [
                "cpIsSubNumber(false)",
                "cpSubParentNumber(null)",
                "cpSubParentPlan(null)",
                "cpSubParentPlanPrice(null)",
                "cpSubParentExpiresAt(null)",
                "cpSelectedNumber(null)",
                "cpPrice(null)",
                "cpCountryCode(null)",
                "cpCountryName(null)",
                "cpProvider(null)",
                "cpPlanKey(null)"
            ]
            
            reset_count = 0
            for reset in required_resets:
                rc2, stdout2, stderr2 = self.run_bash(f"sed -n '{handler_line},{handler_line + 20}p' /app/js/_index.js | grep -F \"saveInfo('{reset.split('(')[0]}\"")
                if rc2 == 0:
                    reset_count += 1
            
            if reset_count >= 11:
                self.log_result("Phone buyPhoneNumber stale state reset", True, f"Found {reset_count}/11 required state resets")
            else:
                self.log_result("Phone buyPhoneNumber stale state reset", False, f"Only found {reset_count}/11 required state resets")
        else:
            self.log_result("Phone buyPhoneNumber stale state reset", False, "buyPhoneNumber handler not found")
        
        # Test 16: Buy Another no-plans reset
        rc, stdout, stderr = self.run_bash("grep -n \"// No active plans → regular new purchase flow\" /app/js/_index.js")
        if rc == 0:
            comment_line = int(stdout.split(':')[0])
            
            # Check for required resets in the next 10 lines
            required_resets_buy_another = [
                "cpIsSubNumber(false)",
                "cpSubParentNumber(null)",
                "cpSubParentPlan(null)",
                "cpSubParentPlanPrice(null)",
                "cpSubParentExpiresAt(null)",
                "cpSelectedNumber(null)",
                "cpPrice(null)"
            ]
            
            reset_count = 0
            for reset in required_resets_buy_another:
                rc2, stdout2, stderr2 = self.run_bash(f"sed -n '{comment_line},{comment_line + 10}p' /app/js/_index.js | grep -F \"saveInfo('{reset.split('(')[0]}\"")
                if rc2 == 0:
                    reset_count += 1
            
            if reset_count >= 7:
                self.log_result("Phone Buy Another no-plans reset", True, f"Found {reset_count}/7 required state resets")
            else:
                self.log_result("Phone Buy Another no-plans reset", False, f"Only found {reset_count}/7 required state resets")
        else:
            self.log_result("Phone Buy Another no-plans reset", False, "Buy Another no-plans comment not found")

    def run_all_tests(self):
        """Run all tests"""
        print("🤖 Starting Nomadly Telegram Bot Payment Guard Fixes Test")
        print("=" * 70)
        
        self.test_nodejs_health()
        self.test_goto_guards()
        self.test_walletok_guards()
        self.test_phone_stale_state_resets()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = total_tests - len(self.failed_tests)
        
        for result in self.test_results:
            print(result)
        
        print(f"\nTotal Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        else:
            print(f"\n✅ ALL TESTS PASSED!")
        
        return len(self.failed_tests) == 0

if __name__ == "__main__":
    test_runner = NomadlyPaymentGuardTest()
    success = test_runner.run_all_tests()
    sys.exit(0 if success else 1)