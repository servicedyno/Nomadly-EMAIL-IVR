#!/usr/bin/env python3
"""
Comprehensive backend testing for Nomadly Telegram bot hostingTransactions improvements.
Tests the recordHostingTransaction() function and its integration across all 4 hosting payment paths.
"""

import requests
import subprocess
import json
import os
import time
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://get-started-62.preview.emergentagent.com"
HEALTH_ENDPOINT = f"{BACKEND_URL}/api/health"

class HostingTransactionsTest:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
    
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append(f"{status}: {test_name}")
        if details:
            self.test_results.append(f"    Details: {details}")
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def test_syntax_validation(self):
        """Test 1: Syntax validation - node -c /app/js/_index.js should pass"""
        try:
            result = subprocess.run(['node', '-c', '/app/js/_index.js'], 
                                  capture_output=True, text=True, timeout=30)
            passed = result.returncode == 0
            details = f"Exit code: {result.returncode}"
            if result.stderr:
                details += f", stderr: {result.stderr.strip()}"
            self.log_test("Syntax validation (node -c _index.js)", passed, details)
            return passed
        except Exception as e:
            self.log_test("Syntax validation (node -c _index.js)", False, f"Exception: {str(e)}")
            return False
    
    def test_service_health(self):
        """Test 2: Service health checks"""
        # Health endpoint check
        try:
            response = requests.get(HEALTH_ENDPOINT, timeout=10)
            health_passed = response.status_code == 200
            health_data = response.json() if response.status_code == 200 else {}
            self.log_test("Health endpoint responds", health_passed, 
                         f"Status: {response.status_code}, Data: {health_data}")
        except Exception as e:
            self.log_test("Health endpoint responds", False, f"Exception: {str(e)}")
            health_passed = False
        
        # Check Node.js health on port 5000
        try:
            nodejs_response = requests.get("http://localhost:5000/health", timeout=10)
            nodejs_passed = nodejs_response.status_code == 200
            nodejs_data = nodejs_response.json() if nodejs_response.status_code == 200 else {}
            self.log_test("Node.js service health (port 5000)", nodejs_passed,
                         f"Status: {nodejs_response.status_code}, Data: {nodejs_data}")
        except Exception as e:
            self.log_test("Node.js service health (port 5000)", False, f"Exception: {str(e)}")
            nodejs_passed = False
        
        # Check error log size
        try:
            result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True)
            error_log_size = int(result.stdout.split()[0]) if result.returncode == 0 else -1
            log_passed = error_log_size == 0
            self.log_test("Error log is empty", log_passed, f"Size: {error_log_size} bytes")
        except Exception as e:
            self.log_test("Error log is empty", False, f"Exception: {str(e)}")
            log_passed = False
        
        return health_passed and nodejs_passed and log_passed
    
    def test_record_hosting_transaction_function(self):
        """Test 3: recordHostingTransaction function implementation"""
        try:
            # Read the _index.js file to verify function implementation
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check if function exists around line 1281
            function_found = 'recordHostingTransaction = async function (chatId, {' in content
            self.log_test("recordHostingTransaction function exists", function_found)
            
            # Check function parameters
            expected_params = [
                'domain,', 'plan,', 'priceUsd,', 'paymentMethod,', 'currency,', 
                'outcome,', 'hostingUsername,', 'refundAmount,', 'refundCurrency,',
                'gatewayData,', 'couponApplied,', 'couponDiscount,', 'existingDomain,', 'hostingType,'
            ]
            params_found = all(param in content for param in expected_params)
            self.log_test("Function has all required parameters", params_found)
            
            # Check hostingTransactions.insertOne call
            insert_call_found = 'await hostingTransactions.insertOne({' in content
            self.log_test("Function calls hostingTransactions.insertOne()", insert_call_found)
            
            # Check try/catch with logging
            try_catch_found = 'try {' in content and 'catch (err) {' in content and '[HostingTx] Failed to record transaction' in content
            self.log_test("Function has try/catch with error logging", try_catch_found)
            
            # Check timestamp field
            timestamp_found = 'timestamp: new Date(),' in content
            self.log_test("Function adds timestamp field", timestamp_found)
            
            return function_found and params_found and insert_call_found and try_catch_found and timestamp_found
            
        except Exception as e:
            self.log_test("recordHostingTransaction function verification", False, f"Exception: {str(e)}")
            return False
    
    def test_module_scope_fallback(self):
        """Test 4: Module-scope fallback around line 990"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                lines = f.readlines()
            
            # Check around line 990 for the fallback
            fallback_found = False
            for i, line in enumerate(lines[985:995], 986):  # Check lines 986-995
                if 'recordHostingTransaction = async () => { log(' in line and 'DB not yet initialized' in line:
                    fallback_found = True
                    self.log_test("Module-scope fallback exists", True, f"Found at line {i}")
                    break
            
            if not fallback_found:
                self.log_test("Module-scope fallback exists", False, "Fallback not found around line 990")
            
            return fallback_found
            
        except Exception as e:
            self.log_test("Module-scope fallback verification", False, f"Exception: {str(e)}")
            return False
    
    def test_wallet_path_integration(self):
        """Test 5: Wallet path integration (around line 5774)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for business context capture before registerDomainAndCreateCpanel
            context_capture = all(var in content for var in [
                'const txDomain = info?.domain || info?.website_name',
                'const txPlan = info?.plan || null',
                'const txHostingType = info?.hostingType || null',
                'const txPayMethod = coin === u.usd ? \'wallet_usd\' : \'wallet_ngn\'',
                'const txCurrency = coin === u.usd ? \'USD\' : \'NGN\''
            ])
            self.log_test("Wallet path captures business context", context_capture)
            
            # Check for 3 recordHostingTransaction calls with different outcomes
            outcomes_found = all(outcome in content for outcome in [
                'recordHostingTransaction(chatId, { domain: txDomain, plan: txPlan, priceUsd, paymentMethod: txPayMethod, currency: txCurrency, outcome: \'domain_only\'',
                'recordHostingTransaction(chatId, { domain: txDomain, plan: txPlan, priceUsd, paymentMethod: txPayMethod, currency: txCurrency, outcome: \'failed\'',
                'recordHostingTransaction(chatId, { domain: txDomain, plan: txPlan, priceUsd, paymentMethod: txPayMethod, currency: txCurrency, outcome: \'success\''
            ])
            self.log_test("Wallet path has 3 outcome recordings", outcomes_found)
            
            return context_capture and outcomes_found
            
        except Exception as e:
            self.log_test("Wallet path integration verification", False, f"Exception: {str(e)}")
            return False
    
    def test_bank_ngn_path_integration(self):
        """Test 6: Bank NGN path integration (around line 20955)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for txBase structure with bank_ngn payment method
            txbase_found = 'const txBase = { domain: txDomain, plan: txPlan, priceUsd: price, paymentMethod: \'bank_ngn\', currency: \'NGN\'' in content
            self.log_test("Bank NGN path has txBase with bank_ngn payment method", txbase_found)
            
            # Check for 4 outcome recordings
            bank_outcomes = all(outcome in content for outcome in [
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'failed\' })',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'domain_only\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'full_refund\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'success\' })'
            ])
            self.log_test("Bank NGN path has 4 outcome recordings", bank_outcomes)
            
            return txbase_found and bank_outcomes
            
        except Exception as e:
            self.log_test("Bank NGN path integration verification", False, f"Exception: {str(e)}")
            return False
    
    def test_blockbee_path_integration(self):
        """Test 7: BlockBee path integration (around line 21800)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for txBase structure with blockbee payment method
            txbase_found = 'const txBase = { domain: txDomain, plan: txPlan, priceUsd: price, paymentMethod: \'blockbee\', currency: coin || \'crypto\'' in content
            self.log_test("BlockBee path has txBase with blockbee payment method", txbase_found)
            
            # Check for 4 outcome recordings
            blockbee_outcomes = all(outcome in content for outcome in [
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'failed\' })',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'domain_only\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'full_refund\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'success\' })'
            ])
            self.log_test("BlockBee path has 4 outcome recordings", blockbee_outcomes)
            
            return txbase_found and blockbee_outcomes
            
        except Exception as e:
            self.log_test("BlockBee path integration verification", False, f"Exception: {str(e)}")
            return False
    
    def test_dynopay_path_integration(self):
        """Test 8: DynoPay path integration (around line 22446)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for txBase structure with dynopay payment method
            txbase_found = 'const txBase = { domain: txDomain, plan: txPlan, priceUsd: price, paymentMethod: \'dynopay\', currency: coin || \'crypto\'' in content
            self.log_test("DynoPay path has txBase with dynopay payment method", txbase_found)
            
            # Check for 4 outcome recordings
            dynopay_outcomes = all(outcome in content for outcome in [
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'failed\' })',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'domain_only\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'full_refund\'',
                'recordHostingTransaction(chatId, { ...txBase, outcome: \'success\' })'
            ])
            self.log_test("DynoPay path has 4 outcome recordings", dynopay_outcomes)
            
            return txbase_found and dynopay_outcomes
            
        except Exception as e:
            self.log_test("DynoPay path integration verification", False, f"Exception: {str(e)}")
            return False
    
    def test_no_old_insert_patterns(self):
        """Test 9: No remaining old insert patterns"""
        try:
            result = subprocess.run(['grep', 'insert(hostingTransactions', '/app/js/_index.js'], 
                                  capture_output=True, text=True)
            no_old_patterns = result.returncode != 0  # grep returns non-zero when no matches found
            self.log_test("No old insert(hostingTransactions patterns remain", no_old_patterns,
                         f"grep exit code: {result.returncode}")
            return no_old_patterns
            
        except Exception as e:
            self.log_test("Old insert patterns check", False, f"Exception: {str(e)}")
            return False
    
    def test_regression_check(self):
        """Test 10: Regression check - Node.js running with AutoPromo initialized"""
        try:
            # Check if Node.js is running (check for start-bot.js process)
            result = subprocess.run(['pgrep', '-f', 'node.*start-bot.js'], 
                                  capture_output=True, text=True)
            nodejs_running = result.returncode == 0
            self.log_test("Node.js process is running", nodejs_running, 
                         f"Process found: {result.stdout.strip() if nodejs_running else 'None'}")
            
            # Check supervisor logs for AutoPromo initialization
            try:
                with open('/var/log/supervisor/nodejs.out.log', 'r') as f:
                    log_content = f.read()
                autopromo_init = 'AutoPromo] Initialized' in log_content
                self.log_test("AutoPromo initialized in logs", autopromo_init)
            except:
                autopromo_init = False
                self.log_test("AutoPromo initialized in logs", False, "Could not read log file")
            
            return nodejs_running and autopromo_init
            
        except Exception as e:
            self.log_test("Regression check", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🧪 Starting Nomadly hostingTransactions Backend Testing...")
        print("=" * 80)
        
        # Run all tests
        tests = [
            self.test_syntax_validation,
            self.test_service_health,
            self.test_record_hosting_transaction_function,
            self.test_module_scope_fallback,
            self.test_wallet_path_integration,
            self.test_bank_ngn_path_integration,
            self.test_blockbee_path_integration,
            self.test_dynopay_path_integration,
            self.test_no_old_insert_patterns,
            self.test_regression_check
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(f"Test {test.__name__}", False, f"Unexpected error: {str(e)}")
        
        # Print results
        print("\n📊 TEST RESULTS:")
        print("=" * 80)
        for result in self.test_results:
            print(result)
        
        print(f"\n📈 SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"Success rate: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = HostingTransactionsTest()
    success = tester.run_all_tests()
    exit(0 if success else 1)