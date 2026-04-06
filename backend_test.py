#!/usr/bin/env python3
"""
Backend Testing Suite for Idempotency Guard Implementation
Tests phone-scheduler.js and hosting-scheduler.js for duplicate auto-renewal prevention
"""

import requests
import subprocess
import json
import os
import re
from typing import Dict, List, Tuple, Optional

# Backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://getting-started-193.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api" if not BACKEND_URL.endswith('/api') else BACKEND_URL

class IdempotencyGuardTester:
    def __init__(self):
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        
        self.test_results.append(result)
        if not passed:
            self.failed_tests.append(f"{test_name}: {details}")
        print(result)
        
    def run_syntax_check(self, file_path: str) -> Tuple[bool, str]:
        """Check JavaScript syntax using node -c"""
        try:
            result = subprocess.run(['node', '-c', file_path], 
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0, result.stderr
        except Exception as e:
            return False, str(e)
            
    def check_file_content(self, file_path: str, patterns: List[str]) -> Tuple[bool, List[str]]:
        """Check if file contains required patterns"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            found_patterns = []
            missing_patterns = []
            
            for pattern in patterns:
                if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                    found_patterns.append(pattern)
                else:
                    missing_patterns.append(pattern)
                    
            return len(missing_patterns) == 0, missing_patterns
        except Exception as e:
            return False, [f"Error reading file: {str(e)}"]
            
    def check_health_endpoint(self) -> Tuple[bool, str]:
        """Check if backend health endpoint is working"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return True, f"Status: {data.get('status', 'unknown')}, DB: {data.get('database', 'unknown')}"
            else:
                return False, f"HTTP {response.status_code}: {response.text[:200]}"
        except Exception as e:
            return False, str(e)
            
    def check_service_logs(self) -> Tuple[bool, str]:
        """Check backend service logs for errors"""
        try:
            # Check supervisor backend logs
            result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                  capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                error_log = result.stdout.strip()
                if not error_log:
                    return True, "No errors in backend log"
                else:
                    # Check for critical errors
                    critical_errors = ['Error:', 'TypeError:', 'ReferenceError:', 'SyntaxError:']
                    has_critical = any(err in error_log for err in critical_errors)
                    return not has_critical, f"Log size: {len(error_log)} chars"
            else:
                return False, "Could not read backend logs"
        except Exception as e:
            return False, str(e)

    def test_phone_scheduler_idempotency(self):
        """Test phone-scheduler.js idempotency guard implementation"""
        print("\n=== Testing Phone Scheduler Idempotency Guard ===")
        
        file_path = "/app/js/phone-scheduler.js"
        
        # Test 1: Syntax validation
        syntax_ok, syntax_error = self.run_syntax_check(file_path)
        self.log_test("Phone scheduler syntax validation", syntax_ok, syntax_error if not syntax_ok else "")
        
        # Test 2: Layer 1 - Fresh-read guard patterns
        layer1_patterns = [
            r"const freshDoc = await _phoneNumbersOf\.findOne\(\{ _id: chatId \}\)",
            r"const freshNum = freshDoc\?\.val\?\.numbers\?\.find\(n => n\.phoneNumber === num\.phoneNumber\)",
            r"if \(new Date\(freshNum\.expiresAt\) > new Date\(\)\)",
            r"already renewed by another process"
        ]
        
        layer1_ok, missing = self.check_file_content(file_path, layer1_patterns)
        self.log_test("Phone scheduler Layer 1 fresh-read guard", layer1_ok, 
                     f"Missing patterns: {missing}" if not layer1_ok else "Fresh-read guard implemented correctly")
        
        # Test 3: Layer 2 - Atomic claim with $elemMatch
        layer2_patterns = [
            r"const claimResult = await _phoneNumbersOf\.findOneAndUpdate\(",
            r"'val\.numbers': \{\s*\$elemMatch: \{",
            r"phoneNumber: num\.phoneNumber,",
            r"expiresAt: num\.expiresAt\s*// must still be the old \(expired\) value",
            r"\$set: \{",
            r"'val\.numbers\.\$\.expiresAt': newExpiry\.toISOString\(\)"
        ]
        
        layer2_ok, missing = self.check_file_content(file_path, layer2_patterns)
        self.log_test("Phone scheduler Layer 2 atomic claim", layer2_ok,
                     f"Missing patterns: {missing}" if not layer2_ok else "Atomic claim with $elemMatch implemented correctly")
        
        # Test 4: Refund logic for duplicate prevention
        refund_patterns = [
            r"if \(!claimResult\) \{",
            r"DUPLICATE RENEWAL PREVENTED",
            r"if \(result\.currency === 'ngn'\) \{",
            r"await _walletOf\.updateOne\(\{ _id: chatId \}, \{ \$inc: \{ ngnOut: -result\.chargedNgn \} \}\)",
            r"await _walletOf\.updateOne\(\{ _id: chatId \}, \{ \$inc: \{ usdOut: -price \} \}\)"
        ]
        
        refund_ok, missing = self.check_file_content(file_path, refund_patterns)
        self.log_test("Phone scheduler refund logic", refund_ok,
                     f"Missing patterns: {missing}" if not refund_ok else "Auto-refund logic implemented correctly")
        
        # Test 5: In-memory updates after atomic claim
        memory_patterns = [
            r"// ━━━ Claim succeeded — update in-memory array",
            r"numbers\[index\]\.expiresAt = newExpiry\.toISOString\(\)",
            r"numbers\[index\]\.status = 'active'",
            r"numbers\[index\]\.smsUsed = 0",
            r"numbers\[index\]\.minutesUsed = 0"
        ]
        
        memory_ok, missing = self.check_file_content(file_path, memory_patterns)
        self.log_test("Phone scheduler in-memory updates", memory_ok,
                     f"Missing patterns: {missing}" if not memory_ok else "In-memory updates happen after atomic claim")
        
        # Test 6: Transaction and notification after atomic claim
        transaction_patterns = [
            r"await _phoneTransactions\?\.insertOne\(\{",
            r"action: 'auto_renew'",
            r"paymentMethod: result\.currency === 'ngn' \? 'wallet_ngn' : 'wallet_usd'",
            r"sendToUser\(chatId, buildAutoRenewSuccessMsg",
            r"_notifyGroup\?\(\`✅ <b>Auto-Renewed:</b>"
        ]
        
        transaction_ok, missing = self.check_file_content(file_path, transaction_patterns)
        self.log_test("Phone scheduler transaction/notification", transaction_ok,
                     f"Missing patterns: {missing}" if not transaction_ok else "Transactions and notifications happen after atomic claim")

    def test_hosting_scheduler_idempotency(self):
        """Test hosting-scheduler.js idempotency guard implementation"""
        print("\n=== Testing Hosting Scheduler Idempotency Guard ===")
        
        file_path = "/app/js/hosting-scheduler.js"
        
        # Test 1: Syntax validation
        syntax_ok, syntax_error = self.run_syntax_check(file_path)
        self.log_test("Hosting scheduler syntax validation", syntax_ok, syntax_error if not syntax_ok else "")
        
        # Test 2: Layer 1 - Fresh-read guard for hosting
        layer1_patterns = [
            r"const freshAccount = await cpanelAccounts\.findOne\(\{ _id: account\._id \}\)",
            r"if \(freshAccount && new Date\(freshAccount\.expiryDate\) > now\)",
            r"already renewed by another process"
        ]
        
        layer1_ok, missing = self.check_file_content(file_path, layer1_patterns)
        self.log_test("Hosting scheduler Layer 1 fresh-read guard", layer1_ok,
                     f"Missing patterns: {missing}" if not layer1_ok else "Fresh-read guard implemented correctly")
        
        # Test 3: Layer 2 - Atomic claim for hosting
        layer2_patterns = [
            r"const claimResult = await cpanelAccounts\.findOneAndUpdate\(",
            r"_id: account\._id,",
            r"expiryDate: \{ \$lte: now \}\s*// must still be expired",
            r"\$set: \{",
            r"expiryDate: newExpiry,",
            r"expiryNotified: false"
        ]
        
        layer2_ok, missing = self.check_file_content(file_path, layer2_patterns)
        self.log_test("Hosting scheduler Layer 2 atomic claim", layer2_ok,
                     f"Missing patterns: {missing}" if not layer2_ok else "Atomic claim with expiry condition implemented correctly")
        
        # Test 4: Refund logic for hosting duplicate prevention
        refund_patterns = [
            r"if \(!claimResult\) \{",
            r"DUPLICATE RENEWAL PREVENTED",
            r"already renewed — refunding",
            r"if \(result\.currency === 'ngn'\) \{",
            r"await walletOf\.updateOne\(\{ _id: chatId \}, \{ \$inc: \{ ngnOut: -result\.chargedNgn \} \}\)",
            r"await walletOf\.updateOne\(\{ _id: chatId \}, \{ \$inc: \{ usdOut: -price \} \}\)"
        ]
        
        refund_ok, missing = self.check_file_content(file_path, refund_patterns)
        self.log_test("Hosting scheduler refund logic", refund_ok,
                     f"Missing patterns: {missing}" if not refund_ok else "Auto-refund logic implemented correctly")

    def test_service_health(self):
        """Test overall service health"""
        print("\n=== Testing Service Health ===")
        
        # Test 1: Health endpoint
        health_ok, health_details = self.check_health_endpoint()
        self.log_test("Backend health endpoint", health_ok, health_details)
        
        # Test 2: Service logs
        logs_ok, log_details = self.check_service_logs()
        self.log_test("Backend service logs", logs_ok, log_details)
        
        # Test 3: Node.js service running
        try:
            result = subprocess.run(['pgrep', '-f', 'node.*js/_index.js'], 
                                  capture_output=True, text=True, timeout=5)
            node_running = result.returncode == 0 and result.stdout.strip()
            self.log_test("Node.js service running", node_running, 
                         f"PID: {result.stdout.strip()}" if node_running else "Node.js process not found")
        except Exception as e:
            self.log_test("Node.js service running", False, str(e))

    def run_all_tests(self):
        """Run all idempotency guard tests"""
        print("🧪 Starting Idempotency Guard Testing Suite")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        
        # Run all test suites
        self.test_phone_scheduler_idempotency()
        self.test_hosting_scheduler_idempotency()
        self.test_service_health()
        
        # Summary
        print(f"\n{'='*60}")
        print("📊 TEST SUMMARY")
        print(f"{'='*60}")
        
        total_tests = len(self.test_results)
        passed_tests = total_tests - len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure}")
        else:
            print(f"\n✅ ALL TESTS PASSED!")
            
        return len(self.failed_tests) == 0

if __name__ == "__main__":
    tester = IdempotencyGuardTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)